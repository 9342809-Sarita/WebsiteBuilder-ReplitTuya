import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getIstDayStart, toIsoIst } from "../time";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/power/last-24h?deviceId=...
 * Returns power readings for the last 24 hours with 3-second resolution
 * Uses RawHealth table for high-resolution power data
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

    // Query RawHealth table for raw power data
    const powerData = await prisma.rawHealth.findMany({
      where: {
        deviceId: deviceId as string,
        tsUtc: { 
          gte: twentyFourHoursAgo, 
          lte: now 
        },
        powerW: { not: null } // Only include records with power data
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
      t: toIsoIst(d.tsUtc), // Use centralized IST conversion
      w: d.powerW || 0
    }));

    res.json({
      from: toIsoIst(twentyFourHoursAgo),
      to: toIsoIst(now),
      resolutionSec: 3, // Approximate resolution based on data collection frequency
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
 * Uses Rollup1h table for aggregated daily averages
 */
router.get("/power/last-7d", async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Get last 7 IST days using centralized time functions
    const today = getIstDayStart();
    const sevenDaysAgo = new Date(today.getTime() - (6 * 24 * 60 * 60 * 1000)); // 7 days including today

    // Query Rollup1h table for the last 7 days
    const hourlyData = await prisma.rollup1h.findMany({
      where: {
        deviceId: deviceId as string,
        windowUtc: { 
          gte: sevenDaysAgo, 
          lt: new Date(today.getTime() + (24 * 60 * 60 * 1000)) // End of today
        },
        avgPowerW: { not: null } // Only include records with power data
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

    // Group by IST day and calculate daily averages
    const dailyAverages: { [dateStr: string]: { total: number; count: number } } = {};
    
    hourlyData.forEach(d => {
      // Convert to IST for grouping by day
      const istTime = new Date(d.windowUtc.getTime() + (5.5 * 60 * 60 * 1000));
      const dateStr = istTime.toISOString().split('T')[0]; // YYYY-MM-DD in IST
      const power = d.avgPowerW || 0;
      
      if (!dailyAverages[dateStr]) {
        dailyAverages[dateStr] = { total: 0, count: 0 };
      }
      
      dailyAverages[dateStr].total += power;
      dailyAverages[dateStr].count += 1;
    });

    // Create points array for last 7 days
    const points = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() + (i * 24 * 60 * 60 * 1000));
      const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
      const dateStr = istDate.toISOString().split('T')[0]; // YYYY-MM-DD in IST
      
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