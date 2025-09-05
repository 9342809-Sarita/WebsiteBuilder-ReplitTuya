import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/devices/summary
 * Returns device summary information from Device table
 */
router.get("/devices/summary", async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      select: {
        deviceId: true,
        name: true,
        lastSeenUtc: true,
        lastOnlineUtc: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Add online status based on lastOnlineUtc vs lastSeenUtc
    const devicesWithOnlineStatus = devices.map(device => ({
      deviceId: device.deviceId,
      name: device.name,
      online: device.lastOnlineUtc && device.lastSeenUtc 
        ? device.lastOnlineUtc.getTime() >= device.lastSeenUtc.getTime() - 60000 // Within 1 minute
        : false,
      lastSeenUtc: device.lastSeenUtc
    }));

    res.json({ 
      success: true,
      devices: devicesWithOnlineStatus 
    });
  } catch (error) {
    console.error("[ENERGY] Error getting device summary:", error);
    res.status(500).json({ 
      error: "Failed to get device summary",
      detail: String(error)
    });
  }
});

/**
 * GET /api/series?deviceId&metric=power|voltage|current|kwh&gran=raw|1m|15m|1h&start&end
 * Returns time series data as {t, v} pairs
 */
router.get("/series", async (req, res) => {
  try {
    const { deviceId, metric, gran = 'raw', start, end } = req.query;

    if (!deviceId || !metric) {
      return res.status(400).json({ 
        error: "Missing required parameters: deviceId and metric" 
      });
    }

    if (!['power', 'voltage', 'current', 'kwh'].includes(metric as string)) {
      return res.status(400).json({ 
        error: "Invalid metric. Must be one of: power, voltage, current, kwh" 
      });
    }

    if (!['raw', '1m', '15m', '1h'].includes(gran as string)) {
      return res.status(400).json({ 
        error: "Invalid granularity. Must be one of: raw, 1m, 15m, 1h" 
      });
    }

    const startTime = start ? new Date(start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endTime = end ? new Date(end as string) : new Date();

    let seriesData: Array<{ t: Date, v: number | null }> = [];

    if (gran === 'raw') {
      // Query raw data tables
      if (metric === 'kwh') {
        const rawEnergy = await prisma.rawEnergy.findMany({
          where: {
            deviceId: deviceId as string,
            tsUtc: { gte: startTime, lte: endTime }
          },
          select: { tsUtc: true, addEleKwh: true },
          orderBy: { tsUtc: 'asc' }
        });
        seriesData = rawEnergy.map(r => ({ 
          t: r.tsUtc, 
          v: r.addEleKwh ? Number(r.addEleKwh) : null 
        }));
      } else {
        const rawHealth = await prisma.rawHealth.findMany({
          where: {
            deviceId: deviceId as string,
            tsUtc: { gte: startTime, lte: endTime }
          },
          select: { 
            tsUtc: true, 
            powerW: true, 
            voltageV: true, 
            currentA: true 
          },
          orderBy: { tsUtc: 'asc' }
        });
        
        seriesData = rawHealth.map(r => {
          let value: number | null = null;
          switch (metric) {
            case 'power': value = r.powerW; break;
            case 'voltage': value = r.voltageV ? Number(r.voltageV) : null; break;
            case 'current': value = r.currentA ? Number(r.currentA) : null; break;
          }
          return { t: r.tsUtc, v: value };
        });
      }
    } else {
      // Query rollup tables
      let rollupData: Array<{ windowUtc: Date, avgPowerW: number | null, kwh: any }> = [];
      
      if (gran === '1m') {
        rollupData = await prisma.rollup1m.findMany({
          where: {
            deviceId: deviceId as string,
            windowUtc: { gte: startTime, lte: endTime }
          },
          select: { windowUtc: true, avgPowerW: true, kwh: true },
          orderBy: { windowUtc: 'asc' }
        });
      } else if (gran === '15m') {
        rollupData = await prisma.rollup15m.findMany({
          where: {
            deviceId: deviceId as string,
            windowUtc: { gte: startTime, lte: endTime }
          },
          select: { windowUtc: true, avgPowerW: true, kwh: true },
          orderBy: { windowUtc: 'asc' }
        });
      } else if (gran === '1h') {
        rollupData = await prisma.rollup1h.findMany({
          where: {
            deviceId: deviceId as string,
            windowUtc: { gte: startTime, lte: endTime }
          },
          select: { windowUtc: true, avgPowerW: true, kwh: true },
          orderBy: { windowUtc: 'asc' }
        });
      }

      seriesData = rollupData.map(r => {
        let value: number | null = null;
        switch (metric) {
          case 'power': value = r.avgPowerW; break;
          case 'kwh': value = r.kwh ? Number(r.kwh) : null; break;
          case 'voltage':
          case 'current':
            // These metrics not available in rollup tables
            value = null;
            break;
        }
        return { t: r.windowUtc, v: value };
      });
    }

    // Convert to {t, v} format with timestamps as ISO strings
    const response = seriesData.map(point => ({
      t: point.t.toISOString(),
      v: point.v
    }));

    res.json({
      success: true,
      deviceId,
      metric,
      granularity: gran,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      count: response.length,
      data: response
    });

  } catch (error) {
    console.error("[ENERGY] Error getting series data:", error);
    res.status(500).json({ 
      error: "Failed to get series data",
      detail: String(error)
    });
  }
});

/**
 * GET /api/daily-kwh?deviceId&startDay&endDay
 * Returns daily kWh consumption data
 */
router.get("/daily-kwh", async (req, res) => {
  try {
    const { deviceId, startDay, endDay } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    const startDate = startDay ? new Date(startDay as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = endDay ? new Date(endDay as string) : new Date();

    const dailyKwhData = await prisma.dailyKwh.findMany({
      where: {
        deviceId: deviceId as string,
        dayIst: { gte: startDate, lte: endDate }
      },
      select: {
        dayIst: true,
        kwh: true
      },
      orderBy: {
        dayIst: 'asc'
      }
    });

    const response = dailyKwhData.map(d => ({
      dayIst: d.dayIst.toISOString().split('T')[0], // Return as YYYY-MM-DD format
      kwh: Number(d.kwh)
    }));

    res.json({
      success: true,
      deviceId,
      startDay: startDate.toISOString().split('T')[0],
      endDay: endDate.toISOString().split('T')[0],
      count: response.length,
      data: response
    });

  } catch (error) {
    console.error("[ENERGY] Error getting daily kWh data:", error);
    res.status(500).json({ 
      error: "Failed to get daily kWh data",
      detail: String(error)
    });
  }
});

export default router;