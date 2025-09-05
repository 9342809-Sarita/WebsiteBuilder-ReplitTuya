import { PrismaClient } from "@prisma/client";
import { tuya } from "../tuya";
import { normalizeFromStatus, type TuyaStatus } from "../normalize";
import { detectAnomalies } from "../logic/anomaly";
import { storage } from "../storage";

const prisma = new PrismaClient();

// Polling intervals
const POLL_ENERGY_MS = Number(process.env.POLL_ENERGY_MS) || 300000; // 5 minutes
const POLL_HEALTH_MS = Number(process.env.POLL_HEALTH_MS) || 30000;  // 30 seconds

/**
 * Energy polling tick: Updates device info and logs energy consumption data
 */
async function energyTick() {
  try {
    console.log("[ENERGY] Starting energy tick...");
    
    // Fetch all devices from Tuya API
    const devicesResp = await tuya.request({
      path: "/v1.0/iot-01/associated-users/devices",
      method: "GET",
      query: { page_no: 1, page_size: 100 }
    });

    const devices = (devicesResp as any)?.result?.devices || [];
    console.log(`[ENERGY] Found ${devices.length} devices`);

    for (const device of devices) {
      const now = new Date();
      
      // Upsert device record
      await prisma.device.upsert({
        where: { deviceId: device.id },
        update: {
          name: device.name,
          productName: device.product_name,
          category: device.category,
          lastSeenUtc: now,
          lastOnlineUtc: device.online ? now : undefined,
          lastStatus: device.status
        },
        create: {
          deviceId: device.id,
          name: device.name,
          productName: device.product_name,
          category: device.category,
          firstSeenUtc: now,
          lastSeenUtc: now,
          lastOnlineUtc: device.online ? now : undefined,
          lastStatus: device.status
        }
      });

      // Extract and normalize energy data
      const normalized = normalizeFromStatus(device.status as TuyaStatus);
      
      // Check if data storage is enabled for this device
      const deviceSettings = await storage.getDeviceSettings(device.id);
      const dataStorageEnabled = deviceSettings?.dataStorageEnabled ?? true; // Default to enabled if no settings found
      
      // Record energy data if available and storage is enabled
      if (normalized.addEleKwh !== undefined && dataStorageEnabled) {
        await prisma.rawEnergy.create({
          data: {
            deviceId: device.id,
            tsUtc: now,
            addEleKwh: normalized.addEleKwh
          }
        });
      }
    }
    
    console.log("[ENERGY] Energy tick completed");
  } catch (error) {
    console.error("[ENERGY] Error in energy tick:", error);
  }
}

/**
 * Health polling tick: Updates device health metrics
 */
async function healthTick() {
  try {
    console.log("[HEALTH] Starting health tick...");
    
    // Fetch all devices from Tuya API
    const devicesResp = await tuya.request({
      path: "/v1.0/iot-01/associated-users/devices", 
      method: "GET",
      query: { page_no: 1, page_size: 100 }
    });

    const devices = (devicesResp as any)?.result?.devices || [];
    console.log(`[HEALTH] Found ${devices.length} devices`);

    for (const device of devices) {
      const now = new Date();
      
      // Upsert device record
      await prisma.device.upsert({
        where: { deviceId: device.id },
        update: {
          name: device.name,
          productName: device.product_name,
          category: device.category,
          lastSeenUtc: now,
          lastOnlineUtc: device.online ? now : undefined,
          lastStatus: device.status
        },
        create: {
          deviceId: device.id,
          name: device.name,
          productName: device.product_name,
          category: device.category,
          firstSeenUtc: now,
          lastSeenUtc: now,
          lastOnlineUtc: device.online ? now : undefined,
          lastStatus: device.status
        }
      });

      // Extract and normalize health data
      const normalized = normalizeFromStatus(device.status as TuyaStatus);
      
      // Check if data storage is enabled for this device
      const deviceSettings = await storage.getDeviceSettings(device.id);
      const dataStorageEnabled = deviceSettings?.dataStorageEnabled ?? true; // Default to enabled if no settings found
      
      // Record health metrics only if storage is enabled
      if (dataStorageEnabled) {
        await prisma.rawHealth.create({
          data: {
            deviceId: device.id,
            tsUtc: now,
            powerW: normalized.powerW,
            voltageV: normalized.voltageV,
            currentA: normalized.currentA,
            pfEst: normalized.pfEst,
            online: device.online
          }
        });

        // Run anomaly detection only if storage is enabled
        await detectAnomalies(device.id, {
          voltageV: normalized.voltageV,
          pfEst: normalized.pfEst,
          online: device.online
        }, now);
      }
    }
    
    console.log("[HEALTH] Health tick completed");
  } catch (error) {
    console.error("[HEALTH] Error in health tick:", error);
  }
}

/**
 * Start both polling intervals
 */
export function startPollers() {
  console.log(`[POLLER] Starting pollers - Energy: ${POLL_ENERGY_MS}ms, Health: ${POLL_HEALTH_MS}ms`);
  
  // Start energy polling
  setInterval(energyTick, POLL_ENERGY_MS);
  
  // Start health polling  
  setInterval(healthTick, POLL_HEALTH_MS);
  
  // Run initial ticks immediately
  energyTick();
  healthTick();
}