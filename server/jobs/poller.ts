import { PrismaClient } from "@prisma/client";
import { tuya } from "../tuya";
import { normalizeFromStatus, type TuyaStatus } from "../normalize";
import { detectAnomalies } from "../logic/anomaly";
import { storage } from "../storage";
import { evaluateAlertsForDevice } from "../alerts";
import { getPollerSettings } from "../storage.poller";

const prisma = new PrismaClient();

let energyTimer: NodeJS.Timeout | null = null;
let healthTimer: NodeJS.Timeout | null = null;

export async function energyTickOnce(): Promise<{ ok: boolean; devices: number }> {
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
      
      // Record energy data if available, storage is enabled, and device is online
      // Offline devices don't consume energy so we skip recording
      if (normalized.addEleKwh !== undefined && dataStorageEnabled && device.online) {
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
    return { ok: true, devices: devices.length };
  } catch (error) {
    console.error("[ENERGY] Error in energy tick:", error);
    return { ok: false, devices: 0 };
  }
}

export async function healthTickOnce(): Promise<{ ok: boolean; devices: number }> {
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
      
      // If device is offline, zero out all electrical readings since device is powered off or disconnected
      const finalValues = device.online ? normalized : {
        powerW: 0,
        voltageV: 0,
        currentA: 0,
        pfEst: 0,
        addEleKwh: 0
      };
      
      // Check if data storage is enabled for this device
      const deviceSettings = await storage.getDeviceSettings(device.id);
      const dataStorageEnabled = deviceSettings?.dataStorageEnabled ?? true; // Default to enabled if no settings found
      
      // Record health metrics only if storage is enabled
      if (dataStorageEnabled) {
        await prisma.rawHealth.create({
          data: {
            deviceId: device.id,
            tsUtc: now,
            powerW: finalValues.powerW,
            voltageV: finalValues.voltageV,
            currentA: finalValues.currentA,
            pfEst: finalValues.pfEst,
            online: device.online
          }
        });

        // Run anomaly detection only if storage is enabled
        await detectAnomalies(device.id, {
          voltageV: finalValues.voltageV,
          pfEst: finalValues.pfEst,
          online: device.online
        }, now);

        // Evaluate alert rules for this device
        await evaluateAlertsForDevice(device.id);
      }
    }
    
    console.log("[HEALTH] Health tick completed");
    return { ok: true, devices: devices.length };
  } catch (error) {
    console.error("[HEALTH] Error in health tick:", error);
    return { ok: false, devices: 0 };
  }
}

async function scheduleEnergy() {
  const s = await getPollerSettings();
  if (!s.energyEnabled) {
    if (energyTimer) { clearTimeout(energyTimer); energyTimer = null; }
    return; // no schedule while disabled
  }
  if (energyTimer) clearTimeout(energyTimer);
  energyTimer = setTimeout(async () => {
    try { await energyTickOnce(); } catch (e) { console.error("energyTick error", e); }
    scheduleEnergy(); // re-read interval next time
  }, s.energyIntervalMs);
}

async function scheduleHealth() {
  const s = await getPollerSettings();
  if (!s.healthEnabled) {
    if (healthTimer) { clearTimeout(healthTimer); healthTimer = null; }
    return;
  }
  if (healthTimer) clearTimeout(healthTimer);
  healthTimer = setTimeout(async () => {
    try { await healthTickOnce(); } catch (e) { console.error("healthTick error", e); }
    scheduleHealth();
  }, s.healthIntervalMs);
}

export async function startPollerSupervisor() {
  const s = await getPollerSettings();
  console.log(`[POLLER] Starting poller supervisor - Energy: ${s.energyEnabled ? s.energyIntervalMs + 'ms' : 'disabled'}, Health: ${s.healthEnabled ? s.healthIntervalMs + 'ms' : 'disabled'}`);
  
  await scheduleEnergy();
  await scheduleHealth();
  
  // simple watcher: if user toggles from disabled->enabled, we need to re-schedule
  setInterval(() => { scheduleEnergy(); scheduleHealth(); }, 5000);
}