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
 * GET /api/events?deviceId&start&end
 * Returns event data (anomalies and state changes)
 */
router.get("/events", async (req, res) => {
  try {
    const { deviceId, start, end } = req.query;

    const startTime = start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const endTime = end ? new Date(end as string) : new Date();

    const whereClause: any = {
      tsUtc: { gte: startTime, lte: endTime }
    };

    if (deviceId) {
      whereClause.deviceId = deviceId as string;
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      select: {
        id: true,
        deviceId: true,
        tsUtc: true,
        type: true,
        payload: true
      },
      orderBy: {
        tsUtc: 'desc'
      }
    });

    const response = events.map(event => ({
      id: event.id.toString(),
      deviceId: event.deviceId,
      timestamp: event.tsUtc.toISOString(),
      type: event.type,
      payload: event.payload
    }));

    res.json({
      success: true,
      deviceId: deviceId || 'all',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      count: response.length,
      events: response
    });

  } catch (error) {
    console.error("[ENERGY] Error getting events:", error);
    res.status(500).json({ 
      error: "Failed to get events",
      detail: String(error)
    });
  }
});

/**
 * GET /api/daily-kwh?deviceId&startDay&endDay
 * Returns daily kWh consumption data with device metadata
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

    // NEW: fetch canonical device name from DB
    const dev = await prisma.device.findUnique({ 
      where: { deviceId: deviceId as string } 
    });
    const device = {
      deviceId: deviceId as string,
      name: dev?.name ?? deviceId as string, // fallback to id if name missing
    };

    const response = dailyKwhData.map(d => ({
      dayIst: d.dayIst.toISOString().split('T')[0], // Return as YYYY-MM-DD format
      kwh: Number(d.kwh)
    }));

    res.json({
      success: true,
      device, // <-- frontend will read the name from here
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

/**
 * GET /api/energy/today-hourly?deviceId=...
 * Returns hourly kWh consumption for today in IST timezone
 */
router.get("/energy/today-hourly", async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Get today's date in IST timezone
    const today = new Date();
    const todayIST = new Date(today.getTime() + (5.5 * 60 * 60 * 1000)); // IST offset
    const dateStr = todayIST.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Query 1-hour rollups for today
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

    const hourlyData = await prisma.rollup1h.findMany({
      where: {
        deviceId: deviceId as string,
        windowUtc: { 
          gte: startOfDay, 
          lte: endOfDay 
        }
      },
      select: { 
        windowUtc: true, 
        kwh: true 
      },
      orderBy: { windowUtc: 'asc' }
    });

    if (hourlyData.length === 0) {
      return res.json({
        ok: false,
        reason: "NO_DATA",
        buckets: [],
        totalKwh: 0
      });
    }

    // Create 24-hour buckets (0-23)
    const buckets = Array.from({ length: 24 }, (_, hour) => {
      const hourData = hourlyData.find(d => 
        new Date(d.windowUtc).getUTCHours() === hour
      );
      return {
        hour,
        kwh: hourData ? Number(hourData.kwh || 0) : 0
      };
    });

    const totalKwh = buckets.reduce((sum, bucket) => sum + bucket.kwh, 0);

    res.json({
      date: dateStr,
      buckets,
      totalKwh: Number(totalKwh.toFixed(3)),
      ok: true
    });

  } catch (error) {
    console.error("[ENERGY] Error getting today-hourly data:", error);
    res.status(500).json({ 
      error: "Failed to get today-hourly data",
      detail: String(error)
    });
  }
});

/**
 * GET /api/energy/month-daily?deviceId=...&month=YYYY-MM
 * Returns daily kWh consumption for specified month (defaults to current IST month)
 */
router.get("/energy/month-daily", async (req, res) => {
  try {
    const { deviceId, month } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Default to current month in IST
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const defaultMonth = istNow.toISOString().substr(0, 7); // YYYY-MM
    const monthStr = (month as string) || defaultMonth;

    // Parse month and create date range
    const [year, monthNum] = monthStr.split('-').map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);

    const dailyData = await prisma.dailyKwh.findMany({
      where: {
        deviceId: deviceId as string,
        dayIst: { 
          gte: startOfMonth, 
          lte: endOfMonth 
        }
      },
      select: { 
        dayIst: true, 
        kwh: true 
      },
      orderBy: { dayIst: 'asc' }
    });

    if (dailyData.length === 0) {
      return res.json({
        ok: false,
        reason: "NO_DATA",
        buckets: [],
        totalKwh: 0
      });
    }

    // Create buckets for each day of the month
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dayData = dailyData.find(d => 
        d.dayIst.getDate() === day
      );
      return {
        day,
        kwh: dayData ? Number(dayData.kwh || 0) : 0
      };
    });

    const totalKwh = buckets.reduce((sum, bucket) => sum + bucket.kwh, 0);

    res.json({
      month: monthStr,
      buckets,
      totalKwh: Number(totalKwh.toFixed(3)),
      ok: true
    });

  } catch (error) {
    console.error("[ENERGY] Error getting month-daily data:", error);
    res.status(500).json({ 
      error: "Failed to get month-daily data",
      detail: String(error)
    });
  }
});

/**
 * GET /api/energy/year-monthly?deviceId=...&year=YYYY
 * Returns monthly kWh consumption for specified year (defaults to current IST year)
 */
router.get("/energy/year-monthly", async (req, res) => {
  try {
    const { deviceId, year } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Default to current year in IST
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const yearNum = year ? parseInt(year as string) : istNow.getFullYear();

    // Create date range for the year
    const startOfYear = new Date(yearNum, 0, 1);
    const endOfYear = new Date(yearNum, 11, 31, 23, 59, 59, 999);

    const dailyData = await prisma.dailyKwh.findMany({
      where: {
        deviceId: deviceId as string,
        dayIst: { 
          gte: startOfYear, 
          lte: endOfYear 
        }
      },
      select: { 
        dayIst: true, 
        kwh: true 
      },
      orderBy: { dayIst: 'asc' }
    });

    // Aggregate by month
    const monthlyTotals: { [month: number]: number } = {};
    dailyData.forEach(d => {
      const month = d.dayIst.getMonth() + 1; // 1-12
      monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(d.kwh || 0);
    });

    // Create buckets for all 12 months
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return {
        month,
        kwh: Number((monthlyTotals[month] || 0).toFixed(3))
      };
    });

    const totalKwh = buckets.reduce((sum, bucket) => sum + bucket.kwh, 0);

    res.json({
      year: yearNum,
      buckets,
      totalKwh: Number(totalKwh.toFixed(3)),
      ok: true
    });

  } catch (error) {
    console.error("[ENERGY] Error getting year-monthly data:", error);
    res.status(500).json({ 
      error: "Failed to get year-monthly data",
      detail: String(error)
    });
  }
});

/**
 * GET /api/energy/calendar?deviceId=...&month=YYYY-MM
 * Returns calendar view of daily kWh consumption with activity levels (0-4)
 */
router.get("/energy/calendar", async (req, res) => {
  try {
    const { deviceId, month } = req.query;

    if (!deviceId) {
      return res.status(400).json({ 
        error: "Missing required parameter: deviceId" 
      });
    }

    // Default to current month in IST
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const defaultMonth = istNow.toISOString().substr(0, 7); // YYYY-MM
    const monthStr = (month as string) || defaultMonth;

    // Parse month and create date range
    const [year, monthNum] = monthStr.split('-').map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);

    const dailyData = await prisma.dailyKwh.findMany({
      where: {
        deviceId: deviceId as string,
        dayIst: { 
          gte: startOfMonth, 
          lte: endOfMonth 
        }
      },
      select: { 
        dayIst: true, 
        kwh: true 
      },
      orderBy: { dayIst: 'asc' }
    });

    // Calculate activity levels based on kWh usage
    const kwhValues = dailyData.map(d => Number(d.kwh || 0)).filter(v => v > 0);
    const maxKwh = Math.max(...kwhValues, 1); // Avoid division by zero

    // Create days array for calendar view
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dayData = dailyData.find(d => d.dayIst.getDate() === day);
      const kwh = dayData ? Number(dayData.kwh || 0) : 0;
      
      // Calculate activity level (0-4 scale)
      let level = 0;
      if (kwh > 0) {
        const ratio = kwh / maxKwh;
        if (ratio <= 0.2) level = 1;
        else if (ratio <= 0.4) level = 2;
        else if (ratio <= 0.7) level = 3;
        else level = 4;
      }

      return {
        day,
        kwh: Number(kwh.toFixed(3)),
        level
      };
    });

    const totalKwh = days.reduce((sum, day) => sum + day.kwh, 0);

    res.json({
      month: monthStr,
      days,
      totalKwh: Number(totalKwh.toFixed(3)),
      ok: true
    });

  } catch (error) {
    console.error("[ENERGY] Error getting calendar data:", error);
    res.status(500).json({ 
      error: "Failed to get calendar data",
      detail: String(error)
    });
  }
});

export default router;