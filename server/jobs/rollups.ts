import { PrismaClient } from "@prisma/client";
import * as cron from "node-cron";
import { floorToMinute, getPreviousIstDayStart, getIstDayStart } from "../time";

const prisma = new PrismaClient();

/**
 * Build 1-minute rollups from RawHealth data
 */
async function buildRollup1m() {
  try {
    console.log("[ROLLUP1M] Building 1-minute rollups...");
    
    // Get the last processed window or start from 1 hour ago
    const lastRollup = await prisma.rollup1m.findFirst({
      orderBy: { windowUtc: 'desc' }
    });
    
    const startTime = lastRollup 
      ? new Date(lastRollup.windowUtc.getTime() + 60000) // Next minute
      : new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    
    const endTime = floorToMinute(new Date()); // Current minute floor
    
    // Process each minute window
    for (let windowStart = floorToMinute(startTime); windowStart < endTime; windowStart.setMinutes(windowStart.getMinutes() + 1)) {
      const windowEnd = new Date(windowStart.getTime() + 60000);
      
      // Get unique devices with health data in this window
      const devicesInWindow = await prisma.rawHealth.groupBy({
        by: ['deviceId'],
        where: {
          tsUtc: { gte: windowStart, lt: windowEnd }
        }
      });
      
      for (const { deviceId } of devicesInWindow) {
        // Get health data for this device in this window
        const healthData = await prisma.rawHealth.findMany({
          where: {
            deviceId,
            tsUtc: { gte: windowStart, lt: windowEnd }
          },
          select: { powerW: true },
          orderBy: { tsUtc: 'asc' }
        });
        
        if (healthData.length === 0) continue;
        
        const powerValues = healthData.filter(h => h.powerW !== null).map(h => h.powerW!);
        
        let avgPowerW: number | undefined;
        let minPowerW: number | undefined;
        let maxPowerW: number | undefined;
        let kwh: number | undefined;
        
        if (powerValues.length > 0) {
          avgPowerW = Math.round(powerValues.reduce((sum, p) => sum + p, 0) / powerValues.length);
          minPowerW = Math.min(...powerValues);
          maxPowerW = Math.max(...powerValues);
          kwh = avgPowerW / 60 / 1000; // Convert W to kWh for 1 minute
        }
        
        // Get the latest addEleKwh value in this window
        const energyData = await prisma.rawEnergy.findFirst({
          where: {
            deviceId,
            tsUtc: { gte: windowStart, lt: windowEnd }
          },
          select: { addEleKwh: true },
          orderBy: { tsUtc: 'desc' }
        });
        
        const lastAddEle = energyData?.addEleKwh;
        
        // Create rollup record
        await prisma.rollup1m.create({
          data: {
            deviceId,
            windowUtc: windowStart,
            avgPowerW,
            minPowerW,
            maxPowerW,
            lastAddEle,
            kwh
          }
        });
      }
    }
    
    console.log("[ROLLUP1M] 1-minute rollups completed");
  } catch (error) {
    console.error("[ROLLUP1M] Error building 1-minute rollups:", error);
  }
}

/**
 * Build 15-minute rollups from 1-minute rollups
 */
async function buildRollup15m() {
  try {
    console.log("[ROLLUP15M] Building 15-minute rollups...");
    
    // Get the last processed window or start from 4 hours ago
    const lastRollup = await prisma.rollup15m.findFirst({
      orderBy: { windowUtc: 'desc' }
    });
    
    const startTime = lastRollup 
      ? new Date(lastRollup.windowUtc.getTime() + 15 * 60000) // Next 15-minute window
      : new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
    
    // Floor to 15-minute boundary
    const startMinutes = Math.floor(startTime.getMinutes() / 15) * 15;
    const alignedStart = new Date(startTime);
    alignedStart.setMinutes(startMinutes, 0, 0);
    
    const endTime = new Date();
    const endMinutes = Math.floor(endTime.getMinutes() / 15) * 15;
    const alignedEnd = new Date(endTime);
    alignedEnd.setMinutes(endMinutes, 0, 0);
    
    // Process each 15-minute window
    for (let windowStart = alignedStart; windowStart < alignedEnd; windowStart.setMinutes(windowStart.getMinutes() + 15)) {
      const windowEnd = new Date(windowStart.getTime() + 15 * 60000);
      
      // Get unique devices with 1m rollup data in this window
      const devicesInWindow = await prisma.rollup1m.groupBy({
        by: ['deviceId'],
        where: {
          windowUtc: { gte: windowStart, lt: windowEnd }
        }
      });
      
      for (const { deviceId } of devicesInWindow) {
        // Aggregate 1-minute rollups for this device in this 15-minute window
        const rollup1mData = await prisma.rollup1m.findMany({
          where: {
            deviceId,
            windowUtc: { gte: windowStart, lt: windowEnd }
          },
          select: { avgPowerW: true, minPowerW: true, maxPowerW: true, kwh: true }
        });
        
        if (rollup1mData.length === 0) continue;
        
        // Calculate aggregated values
        const validAvgPowers = rollup1mData.filter(r => r.avgPowerW !== null).map(r => r.avgPowerW!);
        const validMinPowers = rollup1mData.filter(r => r.minPowerW !== null).map(r => r.minPowerW!);
        const validMaxPowers = rollup1mData.filter(r => r.maxPowerW !== null).map(r => r.maxPowerW!);
        const validKwh = rollup1mData.filter(r => r.kwh !== null).map(r => Number(r.kwh!));
        
        const avgPowerW = validAvgPowers.length > 0 
          ? Math.round(validAvgPowers.reduce((sum, p) => sum + p, 0) / validAvgPowers.length) 
          : undefined;
        
        const minPowerW = validMinPowers.length > 0 ? Math.min(...validMinPowers) : undefined;
        const maxPowerW = validMaxPowers.length > 0 ? Math.max(...validMaxPowers) : undefined;
        const kwh = validKwh.length > 0 ? validKwh.reduce((sum, k) => sum + k, 0) : undefined;
        
        // Create 15-minute rollup
        await prisma.rollup15m.create({
          data: {
            deviceId,
            windowUtc: windowStart,
            avgPowerW,
            minPowerW,
            maxPowerW,
            kwh
          }
        });
      }
    }
    
    console.log("[ROLLUP15M] 15-minute rollups completed");
  } catch (error) {
    console.error("[ROLLUP15M] Error building 15-minute rollups:", error);
  }
}

/**
 * Build 1-hour rollups from 15-minute rollups
 */
async function buildRollup1h() {
  try {
    console.log("[ROLLUP1H] Building 1-hour rollups...");
    
    // Get the last processed window or start from 24 hours ago
    const lastRollup = await prisma.rollup1h.findFirst({
      orderBy: { windowUtc: 'desc' }
    });
    
    const startTime = lastRollup 
      ? new Date(lastRollup.windowUtc.getTime() + 60 * 60000) // Next hour
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // Floor to hour boundary
    const alignedStart = new Date(startTime);
    alignedStart.setMinutes(0, 0, 0);
    
    const endTime = new Date();
    const alignedEnd = new Date(endTime);
    alignedEnd.setMinutes(0, 0, 0);
    
    // Process each hour window
    for (let windowStart = alignedStart; windowStart < alignedEnd; windowStart.setHours(windowStart.getHours() + 1)) {
      const windowEnd = new Date(windowStart.getTime() + 60 * 60000);
      
      // Get unique devices with 15m rollup data in this window
      const devicesInWindow = await prisma.rollup15m.groupBy({
        by: ['deviceId'],
        where: {
          windowUtc: { gte: windowStart, lt: windowEnd }
        }
      });
      
      for (const { deviceId } of devicesInWindow) {
        // Aggregate 15-minute rollups for this device in this hour window
        const rollup15mData = await prisma.rollup15m.findMany({
          where: {
            deviceId,
            windowUtc: { gte: windowStart, lt: windowEnd }
          },
          select: { avgPowerW: true, minPowerW: true, maxPowerW: true, kwh: true }
        });
        
        if (rollup15mData.length === 0) continue;
        
        // Calculate aggregated values
        const validAvgPowers = rollup15mData.filter(r => r.avgPowerW !== null).map(r => r.avgPowerW!);
        const validMinPowers = rollup15mData.filter(r => r.minPowerW !== null).map(r => r.minPowerW!);
        const validMaxPowers = rollup15mData.filter(r => r.maxPowerW !== null).map(r => r.maxPowerW!);
        const validKwh = rollup15mData.filter(r => r.kwh !== null).map(r => Number(r.kwh!));
        
        const avgPowerW = validAvgPowers.length > 0 
          ? Math.round(validAvgPowers.reduce((sum, p) => sum + p, 0) / validAvgPowers.length) 
          : undefined;
        
        const minPowerW = validMinPowers.length > 0 ? Math.min(...validMinPowers) : undefined;
        const maxPowerW = validMaxPowers.length > 0 ? Math.max(...validMaxPowers) : undefined;
        const kwh = validKwh.length > 0 ? validKwh.reduce((sum, k) => sum + k, 0) : undefined;
        
        // Create 1-hour rollup
        await prisma.rollup1h.create({
          data: {
            deviceId,
            windowUtc: windowStart,
            avgPowerW,
            minPowerW,
            maxPowerW,
            kwh
          }
        });
      }
    }
    
    console.log("[ROLLUP1H] 1-hour rollups completed");
  } catch (error) {
    console.error("[ROLLUP1H] Error building 1-hour rollups:", error);
  }
}

/**
 * Compute daily kWh for the previous IST day using positive deltas of addEleKwh
 */
async function computeDailyKwh() {
  try {
    console.log("[DAILY] Computing daily kWh for previous IST day...");
    
    const now = new Date();
    const previousDayStart = getPreviousIstDayStart(now);
    const previousDayEnd = getIstDayStart(now);
    
    console.log(`[DAILY] Processing day: ${previousDayStart.toISOString()} to ${previousDayEnd.toISOString()}`);
    
    // Get all devices that have energy data
    const devicesWithEnergy = await prisma.rawEnergy.groupBy({
      by: ['deviceId'],
      where: {
        tsUtc: { gte: previousDayStart, lt: previousDayEnd }
      }
    });
    
    for (const { deviceId } of devicesWithEnergy) {
      // Get baseline (last sample before or at day start)
      const baseline = await prisma.rawEnergy.findFirst({
        where: {
          deviceId,
          tsUtc: { lte: previousDayStart }
        },
        orderBy: { tsUtc: 'desc' },
        select: { addEleKwh: true }
      });
      
      // Get final reading of the day
      const finalReading = await prisma.rawEnergy.findFirst({
        where: {
          deviceId,
          tsUtc: { gte: previousDayStart, lt: previousDayEnd }
        },
        orderBy: { tsUtc: 'desc' },
        select: { addEleKwh: true }
      });
      
      if (!finalReading) continue;
      
      // Calculate kWh consumed during the day
      const baselineKwh = baseline ? Number(baseline.addEleKwh) : 0;
      const finalKwh = Number(finalReading.addEleKwh);
      const dailyKwh = Math.max(0, finalKwh - baselineKwh); // Ensure positive
      
      // Upsert daily kWh record
      await prisma.dailyKwh.upsert({
        where: {
          deviceId_dayIst: {
            deviceId,
            dayIst: previousDayStart
          }
        },
        update: {
          kwh: dailyKwh
        },
        create: {
          deviceId,
          dayIst: previousDayStart,
          kwh: dailyKwh
        }
      });
      
      console.log(`[DAILY] Device ${deviceId}: ${dailyKwh} kWh`);
    }
    
    console.log("[DAILY] Daily kWh computation completed");
  } catch (error) {
    console.error("[DAILY] Error computing daily kWh:", error);
  }
}

/**
 * Run all rollup builders
 */
async function runRollupBuilders() {
  await buildRollup1m();
  await buildRollup15m(); 
  await buildRollup1h();
}

/**
 * Start rollup scheduling with node-cron
 */
export function startRollupScheduler() {
  console.log("[ROLLUP] Starting rollup scheduler...");
  
  // Every 5 minutes: build 1m/15m/1h rollups
  cron.schedule('*/5 * * * *', () => {
    console.log("[ROLLUP] Running scheduled rollup builders...");
    runRollupBuilders();
  });
  
  // Daily at 00:05 IST (18:35 UTC): compute daily kWh for previous day
  cron.schedule('35 18 * * *', () => {
    console.log("[ROLLUP] Running scheduled daily kWh computation...");
    computeDailyKwh();
  }, {
    timezone: 'UTC'
  });
  
  // Run initial rollups on startup
  console.log("[ROLLUP] Running initial rollup builders...");
  runRollupBuilders();
}