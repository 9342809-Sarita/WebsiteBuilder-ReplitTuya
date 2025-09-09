import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getIstDayStart, toIsoIst } from "../time";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/power/last-24h?deviceId=...
 * Returns power readings for the last 24 hours with 3-second step-series resolution
 * Creates ~28,800 points using "last observation carried forward" interpolation
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

    // Strategy 1: Try Rollup1m first for power averages
    let sourceData: Array<{ tsUtc: Date; powerW: number }> = [];
    
    const rollup1mData = await prisma.rollup1m.findMany({
      where: {
        deviceId: deviceId as string,
        windowUtc: { 
          gte: twentyFourHoursAgo, 
          lte: now 
        },
        avgPowerW: { not: null }
      },
      select: { 
        windowUtc: true, 
        avgPowerW: true 
      },
      orderBy: { windowUtc: 'asc' }
    });

    if (rollup1mData.length > 0) {
      sourceData = rollup1mData.map(d => ({
        tsUtc: d.windowUtc,
        powerW: d.avgPowerW || 0
      }));
    } else {
      // Strategy 2: Fallback to RawHealth if no rollup data
      const rawHealthData = await prisma.rawHealth.findMany({
        where: {
          deviceId: deviceId as string,
          tsUtc: { 
            gte: twentyFourHoursAgo, 
            lte: now 
          },
          powerW: { not: null }
        },
        select: { 
          tsUtc: true, 
          powerW: true 
        },
        orderBy: { tsUtc: 'asc' }
      });

      sourceData = rawHealthData.map(d => ({
        tsUtc: d.tsUtc,
        powerW: d.powerW || 0
      }));
    }

    if (sourceData.length === 0) {
      // Strategy 3: Derive from energy data if available
      const energyData = await prisma.rawEnergy.findMany({
        where: {
          deviceId: deviceId as string,
          tsUtc: { 
            gte: twentyFourHoursAgo, 
            lte: now 
          }
        },
        select: { 
          tsUtc: true, 
          addEleKwh: true 
        },
        orderBy: { tsUtc: 'asc' }
      });

      if (energyData.length >= 2) {
        // Derive power from consecutive energy samples
        for (let i = 1; i < energyData.length; i++) {
          const t1 = energyData[i - 1];
          const t2 = energyData[i];
          const kwhDiff = Number(t2.addEleKwh) - Number(t1.addEleKwh);
          const timeDiffHours = (t2.tsUtc.getTime() - t1.tsUtc.getTime()) / (1000 * 60 * 60);
          
          if (timeDiffHours > 0 && kwhDiff >= 0) {
            const powerW = Math.round((kwhDiff * 1000) / timeDiffHours);
            sourceData.push({
              tsUtc: t2.tsUtc,
              powerW
            });
          }
        }
      }
    }

    if (sourceData.length === 0) {
      return res.json({
        ok: false,
        reason: "NO_DATA",
        from: toIsoIst(twentyFourHoursAgo),
        to: toIsoIst(now),
        resolutionSec: 3,
        points: []
      });
    }

    // Create 3-second grid: ~28,800 points over 24 hours
    const points: Array<{ t: string; w: number }> = [];
    const startTime = twentyFourHoursAgo.getTime();
    const endTime = now.getTime();
    const stepMs = 3 * 1000; // 3 seconds in milliseconds

    let sourceIndex = 0;
    let lastObservedPower = 0;

    for (let currentTime = startTime; currentTime <= endTime; currentTime += stepMs) {
      const currentDate = new Date(currentTime);
      
      // Update last observed power if we have a newer source point
      while (sourceIndex < sourceData.length && sourceData[sourceIndex].tsUtc.getTime() <= currentTime) {
        lastObservedPower = sourceData[sourceIndex].powerW;
        sourceIndex++;
      }

      points.push({
        t: toIsoIst(currentDate),
        w: lastObservedPower
      });
    }

    res.json({
      from: toIsoIst(twentyFourHoursAgo),
      to: toIsoIst(now),
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
 * Returns daily average power for last 7 IST days computed from kWh data
 * Formula: W_avg(day) = (kWh_day * 1000) / 24
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

    // Query DailyKwh table for the last 7 days
    const dailyKwhData = await prisma.dailyKwh.findMany({
      where: {
        deviceId: deviceId as string,
        dayIst: { 
          gte: new Date(sevenDaysAgo.getTime() + (5.5 * 60 * 60 * 1000)), // Convert to IST
          lt: new Date(today.getTime() + (24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) // End of today in IST
        }
      },
      select: { 
        dayIst: true, 
        kwh: true 
      },
      orderBy: { dayIst: 'asc' }
    });

    if (dailyKwhData.length === 0) {
      return res.json({
        ok: false,
        reason: "NO_DATA",
        from: "",
        to: "",
        resolution: "1d",
        points: []
      });
    }

    // Create exactly 7 points for the last 7 days
    const points = [];
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
      const istTargetDate = new Date(targetDate.getTime() + (5.5 * 60 * 60 * 1000));
      const dateStr = istTargetDate.toISOString().split('T')[0]; // YYYY-MM-DD in IST
      
      // Find matching daily kWh data
      const dayData = dailyKwhData.find(d => {
        const dayDateStr = d.dayIst.toISOString().split('T')[0];
        return dayDateStr === dateStr;
      });
      
      // Compute daily average power: W_avg = (kWh_day * 1000) / 24
      const kwhDay = dayData ? Number(dayData.kwh) : 0;
      const wAvg = Math.round((kwhDay * 1000) / 24);
      
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