import { PrismaClient } from "@prisma/client";
import * as cron from "node-cron";

const prisma = new PrismaClient();

// Retention periods from environment variables with defaults
const RETENTION_CONFIG = {
  RAW_HEALTH_DAYS: Number(process.env.RETENTION_RAW_HEALTH_DAYS) || 90,
  RAW_ENERGY_DAYS: Number(process.env.RETENTION_RAW_ENERGY_DAYS) || 90,
  ROLLUP_1M_MONTHS: Number(process.env.RETENTION_1M_MONTHS) || 13,
  ROLLUP_15M_YEARS: Number(process.env.RETENTION_15M_YEARS) || 5,
  ROLLUP_1H_YEARS: Number(process.env.RETENTION_1H_YEARS) || 7,
  DAILY_KWH_YEARS: Number(process.env.RETENTION_DAILY_YEARS) || 7,
  EVENTS_YEARS: Number(process.env.RETENTION_EVENTS_YEARS) || 7
};

/**
 * Delete RawHealth records older than configured retention period
 */
async function cleanupRawHealth() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_CONFIG.RAW_HEALTH_DAYS);
    
    const result = await prisma.rawHealth.deleteMany({
      where: {
        tsUtc: { lt: cutoffDate }
      }
    });
    
    console.log(`[RETENTION] Deleted ${result.count} RawHealth records older than ${RETENTION_CONFIG.RAW_HEALTH_DAYS} days`);
  } catch (error) {
    console.error("[RETENTION] Error cleaning up RawHealth:", error);
  }
}

/**
 * Delete RawEnergy records older than configured retention period
 */
async function cleanupRawEnergy() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_CONFIG.RAW_ENERGY_DAYS);
    
    const result = await prisma.rawEnergy.deleteMany({
      where: {
        tsUtc: { lt: cutoffDate }
      }
    });
    
    console.log(`[RETENTION] Deleted ${result.count} RawEnergy records older than ${RETENTION_CONFIG.RAW_ENERGY_DAYS} days`);
  } catch (error) {
    console.error("[RETENTION] Error cleaning up RawEnergy:", error);
  }
}

/**
 * Delete Rollup1m records older than configured retention period
 */
async function cleanupRollup1m() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_CONFIG.ROLLUP_1M_MONTHS);
    
    const result = await prisma.rollup1m.deleteMany({
      where: {
        windowUtc: { lt: cutoffDate }
      }
    });
    
    console.log(`[RETENTION] Deleted ${result.count} Rollup1m records older than ${RETENTION_CONFIG.ROLLUP_1M_MONTHS} months`);
  } catch (error) {
    console.error("[RETENTION] Error cleaning up Rollup1m:", error);
  }
}

/**
 * Delete Rollup15m records older than configured retention period
 */
async function cleanupRollup15m() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - RETENTION_CONFIG.ROLLUP_15M_YEARS);
    
    const result = await prisma.rollup15m.deleteMany({
      where: {
        windowUtc: { lt: cutoffDate }
      }
    });
    
    console.log(`[RETENTION] Deleted ${result.count} Rollup15m records older than ${RETENTION_CONFIG.ROLLUP_15M_YEARS} years`);
  } catch (error) {
    console.error("[RETENTION] Error cleaning up Rollup15m:", error);
  }
}

/**
 * Delete Rollup1h records older than configured retention period
 */
async function cleanupRollup1h() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - RETENTION_CONFIG.ROLLUP_1H_YEARS);
    
    const result = await prisma.rollup1h.deleteMany({
      where: {
        windowUtc: { lt: cutoffDate }
      }
    });
    
    console.log(`[RETENTION] Deleted ${result.count} Rollup1h records older than ${RETENTION_CONFIG.ROLLUP_1H_YEARS} years`);
  } catch (error) {
    console.error("[RETENTION] Error cleaning up Rollup1h:", error);
  }
}

/**
 * Delete DailyKwh records older than configured retention period
 */
async function cleanupDailyKwh() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - RETENTION_CONFIG.DAILY_KWH_YEARS);
    
    const result = await prisma.dailyKwh.deleteMany({
      where: {
        dayIst: { lt: cutoffDate }
      }
    });
    
    console.log(`[RETENTION] Deleted ${result.count} DailyKwh records older than ${RETENTION_CONFIG.DAILY_KWH_YEARS} years`);
  } catch (error) {
    console.error("[RETENTION] Error cleaning up DailyKwh:", error);
  }
}

/**
 * Delete Event records older than configured retention period
 */
async function cleanupEvents() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - RETENTION_CONFIG.EVENTS_YEARS);
    
    const result = await prisma.event.deleteMany({
      where: {
        tsUtc: { lt: cutoffDate }
      }
    });
    
    console.log(`[RETENTION] Deleted ${result.count} Event records older than ${RETENTION_CONFIG.EVENTS_YEARS} years`);
  } catch (error) {
    console.error("[RETENTION] Error cleaning up Events:", error);
  }
}

/**
 * Run all retention cleanup jobs
 */
async function runRetentionCleanup() {
  console.log("[RETENTION] Starting retention cleanup with configuration:", RETENTION_CONFIG);
  
  await cleanupRawHealth();
  await cleanupRawEnergy();
  await cleanupRollup1m();
  await cleanupRollup15m();
  await cleanupRollup1h();
  await cleanupDailyKwh();
  await cleanupEvents();
  
  console.log("[RETENTION] Retention cleanup completed");
}

/**
 * Start retention scheduler with nightly cron job
 */
export function startRetentionScheduler() {
  console.log("[RETENTION] Starting retention scheduler...");
  
  // Run nightly at 02:00 UTC
  cron.schedule('0 2 * * *', () => {
    console.log("[RETENTION] Running scheduled retention cleanup...");
    runRetentionCleanup();
  }, {
    timezone: 'UTC'
  });
  
  console.log("[RETENTION] Retention scheduler configured to run daily at 02:00 UTC");
}