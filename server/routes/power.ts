import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/power/last-24h?deviceId=...
 * Returns power readings for the last 24 hours with 3-second resolution
 */
router.get("/power/last-24h", async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Calculate 24 hours ago from now
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // Convert to IST for response formatting
    const nowIST = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const fromIST = new Date(twentyFourHoursAgo.getTime() + (5.5 * 60 * 60 * 1000));

    // Query raw health data for the last 24 hours
    const powerData = await prisma.rawHealth.findMany({
      where: {
        deviceId: deviceId as string,
        tsUtc: { 
          gte: twentyFourHoursAgo, 
          lte: now 
        }
      },
      select: { 
        tsUtc: true, 
        powerW: true 
      },
      orderBy: { tsUtc: 'asc' }
    });

    if (powerData.length === 0) {
      return res.json({
        ok: false,
        reason: "NO_DATA"
      });
    }

    // Convert to response format with IST timestamps
    const points = powerData.map(d => ({
      t: new Date(d.tsUtc.getTime() + (5.5 * 60 * 60 * 1000)).toISOString(), // Convert to IST
      w: d.powerW || 0
    }));

    res.json({
      from: fromIST.toISOString(),
      to: nowIST.toISOString(),
      resolutionSec: 3,
      points,
      ok: true
    });

  } catch (error) {
    console.error("[POWER] Error getting last-24h data:", error);
    res.status(500).json({ 
      error: "Failed to get last-24h power data",
      detail: String(error)
    });
  }
});

/**
 * GET /api/power/last-7d?deviceId=...
 * Returns daily average power readings for the last 7 days
 */
router.get("/power/last-7d", async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Calculate 7 days ago from today (start of day)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    // Set to start of day for cleaner day boundaries
    sevenDaysAgo.setHours(0, 0, 0, 0);
    now.setHours(23, 59, 59, 999);

    // Query 1-hour rollups for the last 7 days
    const hourlyData = await prisma.rollup1h.findMany({
      where: {
        deviceId: deviceId as string,
        windowUtc: { 
          gte: sevenDaysAgo, 
          lte: now 
        }
      },
      select: { 
        windowUtc: true, 
        avgPowerW: true 
      },
      orderBy: { windowUtc: 'asc' }
    });

    if (hourlyData.length === 0) {
      return res.json({
        ok: false,
        reason: "NO_DATA"
      });
    }

    // Group by day and calculate daily averages
    const dailyAverages: { [dateStr: string]: { total: number; count: number } } = {};
    
    hourlyData.forEach(d => {
      const date = d.windowUtc.toISOString().split('T')[0]; // YYYY-MM-DD
      const power = d.avgPowerW || 0;
      
      if (!dailyAverages[date]) {
        dailyAverages[date] = { total: 0, count: 0 };
      }
      
      dailyAverages[date].total += power;
      dailyAverages[date].count += 1;
    });

    // Create points array for last 7 days
    const points = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const dayData = dailyAverages[dateStr];
      const wAvg = dayData ? Math.round(dayData.total / dayData.count) : 0;
      
      points.push({
        d: dateStr,
        wAvg
      });
    }

    const fromDate = points[0].d;
    const toDate = points[points.length - 1].d;

    res.json({
      from: fromDate,
      to: toDate,
      resolution: "1d",
      points,
      ok: true
    });

  } catch (error) {
    console.error("[POWER] Error getting last-7d data:", error);
    res.status(500).json({ 
      error: "Failed to get last-7d power data",
      detail: String(error)
    });
  }
});

export default router;