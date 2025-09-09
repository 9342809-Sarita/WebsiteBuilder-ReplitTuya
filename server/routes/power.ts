import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/power/last-24h?deviceId=...
 * Returns power data for the last 24 hours with 3-second resolution
 */
router.get("/power/last-24h", async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Calculate time range (last 24 hours in IST)
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query raw health data for power readings
    const powerData = await prisma.rawHealth.findMany({
      where: {
        deviceId: deviceId as string,
        tsUtc: { gte: from, lte: now }
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
        reason: "NO_DATA",
        from: from.toISOString(),
        to: now.toISOString(),
        resolutionSec: 3,
        points: []
      });
    }

    // Convert to IST format for response
    const points = powerData.map(point => ({
      t: point.tsUtc.toISOString(),
      w: point.powerW || 0
    }));

    res.json({
      from: from.toISOString(),
      to: now.toISOString(),
      resolutionSec: 3,
      points,
      ok: true
    });

  } catch (error) {
    console.error("[POWER] Error getting last 24h data:", error);
    res.status(500).json({ 
      error: "Failed to get power data",
      detail: String(error)
    });
  }
});

/**
 * GET /api/power/last-7d?deviceId=...
 * Returns power data for the last 7 days with daily resolution
 */
router.get("/power/last-7d", async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Calculate time range (last 7 days)
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Query daily rollup data for average power
    const dailyData = await prisma.rollup1h.findMany({
      where: {
        deviceId: deviceId as string,
        windowUtc: { gte: from, lte: now }
      },
      select: {
        windowUtc: true,
        avgPowerW: true
      },
      orderBy: { windowUtc: 'asc' }
    });

    if (dailyData.length === 0) {
      return res.json({
        ok: false,
        reason: "NO_DATA",
        from: from.toISOString().split('T')[0],
        to: now.toISOString().split('T')[0],
        resolution: "1d",
        points: []
      });
    }

    // Group by day and calculate average
    const dailyAverages = new Map<string, { sum: number, count: number }>();
    
    dailyData.forEach(point => {
      const day = point.windowUtc.toISOString().split('T')[0];
      const power = point.avgPowerW || 0;
      
      if (!dailyAverages.has(day)) {
        dailyAverages.set(day, { sum: 0, count: 0 });
      }
      
      const current = dailyAverages.get(day)!;
      current.sum += power;
      current.count += 1;
    });

    const points = Array.from(dailyAverages.entries()).map(([day, data]) => ({
      d: day,
      wAvg: Math.round(data.sum / data.count)
    }));

    res.json({
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
      resolution: "1d",
      points,
      ok: true
    });

  } catch (error) {
    console.error("[POWER] Error getting last 7d data:", error);
    res.status(500).json({ 
      error: "Failed to get power data",
      detail: String(error)
    });
  }
});

export default router;