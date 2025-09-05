import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Anomaly detection thresholds
const THRESHOLDS = {
  SAG_VOLTAGE: 200,      // Below 200V
  SWELL_VOLTAGE: 250,    // Above 250V  
  SAG_DURATION: 5000,    // 5 seconds in milliseconds
  SWELL_DURATION: 5000,  // 5 seconds in milliseconds
  PF_LOW_THRESHOLD: 0.8, // Power factor below 0.8
  PF_LOW_DURATION: 300000 // 5 minutes in milliseconds
};

// Track device states for anomaly detection
const deviceStates = new Map<string, {
  lastOnlineStatus?: boolean;
  sagStartTime?: Date;
  swellStartTime?: Date;
  pfLowStartTime?: Date;
  lastVoltage?: number;
  lastPf?: number;
}>();

/**
 * Check for voltage sag anomalies (< 200V for >= 5 seconds)
 */
async function checkVoltageSag(deviceId: string, voltage: number, timestamp: Date) {
  const state = deviceStates.get(deviceId) || {};
  
  if (voltage < THRESHOLDS.SAG_VOLTAGE) {
    // Start tracking sag if not already started
    if (!state.sagStartTime) {
      state.sagStartTime = timestamp;
      deviceStates.set(deviceId, state);
    } else {
      // Check if sag duration threshold exceeded
      const sagDuration = timestamp.getTime() - state.sagStartTime.getTime();
      if (sagDuration >= THRESHOLDS.SAG_DURATION) {
        // Create sag event
        await prisma.event.create({
          data: {
            deviceId,
            tsUtc: timestamp,
            type: 'SAG',
            payload: {
              voltage,
              duration: sagDuration,
              threshold: THRESHOLDS.SAG_VOLTAGE
            }
          }
        });
        
        console.log(`[ANOMALY] SAG detected for ${deviceId}: ${voltage}V for ${sagDuration}ms`);
        
        // Reset sag tracking to avoid duplicate events
        state.sagStartTime = undefined;
        deviceStates.set(deviceId, state);
      }
    }
  } else {
    // Voltage normal, reset sag tracking
    if (state.sagStartTime) {
      state.sagStartTime = undefined;
      deviceStates.set(deviceId, state);
    }
  }
}

/**
 * Check for voltage swell anomalies (> 250V for >= 5 seconds)
 */
async function checkVoltageSwell(deviceId: string, voltage: number, timestamp: Date) {
  const state = deviceStates.get(deviceId) || {};
  
  if (voltage > THRESHOLDS.SWELL_VOLTAGE) {
    // Start tracking swell if not already started
    if (!state.swellStartTime) {
      state.swellStartTime = timestamp;
      deviceStates.set(deviceId, state);
    } else {
      // Check if swell duration threshold exceeded
      const swellDuration = timestamp.getTime() - state.swellStartTime.getTime();
      if (swellDuration >= THRESHOLDS.SWELL_DURATION) {
        // Create swell event
        await prisma.event.create({
          data: {
            deviceId,
            tsUtc: timestamp,
            type: 'SWELL',
            payload: {
              voltage,
              duration: swellDuration,
              threshold: THRESHOLDS.SWELL_VOLTAGE
            }
          }
        });
        
        console.log(`[ANOMALY] SWELL detected for ${deviceId}: ${voltage}V for ${swellDuration}ms`);
        
        // Reset swell tracking to avoid duplicate events
        state.swellStartTime = undefined;
        deviceStates.set(deviceId, state);
      }
    }
  } else {
    // Voltage normal, reset swell tracking
    if (state.swellStartTime) {
      state.swellStartTime = undefined;
      deviceStates.set(deviceId, state);
    }
  }
}

/**
 * Check for low power factor anomalies (< 0.8 for >= 5 minutes)
 */
async function checkLowPowerFactor(deviceId: string, pf: number, timestamp: Date) {
  const state = deviceStates.get(deviceId) || {};
  
  if (pf < THRESHOLDS.PF_LOW_THRESHOLD) {
    // Start tracking low PF if not already started
    if (!state.pfLowStartTime) {
      state.pfLowStartTime = timestamp;
      deviceStates.set(deviceId, state);
    } else {
      // Check if low PF duration threshold exceeded
      const pfLowDuration = timestamp.getTime() - state.pfLowStartTime.getTime();
      if (pfLowDuration >= THRESHOLDS.PF_LOW_DURATION) {
        // Create low power factor event
        await prisma.event.create({
          data: {
            deviceId,
            tsUtc: timestamp,
            type: 'PF_LOW',
            payload: {
              powerFactor: pf,
              duration: pfLowDuration,
              threshold: THRESHOLDS.PF_LOW_THRESHOLD
            }
          }
        });
        
        console.log(`[ANOMALY] Low PF detected for ${deviceId}: ${pf} for ${pfLowDuration}ms`);
        
        // Reset PF tracking to avoid duplicate events
        state.pfLowStartTime = undefined;
        deviceStates.set(deviceId, state);
      }
    }
  } else {
    // Power factor normal, reset tracking
    if (state.pfLowStartTime) {
      state.pfLowStartTime = undefined;
      deviceStates.set(deviceId, state);
    }
  }
}

/**
 * Check for online/offline transitions
 */
async function checkOnlineOfflineTransition(deviceId: string, isOnline: boolean, timestamp: Date) {
  const state = deviceStates.get(deviceId) || {};
  
  // Check if online status changed
  if (state.lastOnlineStatus !== undefined && state.lastOnlineStatus !== isOnline) {
    const eventType = isOnline ? 'ONLINE' : 'OFFLINE';
    
    await prisma.event.create({
      data: {
        deviceId,
        tsUtc: timestamp,
        type: eventType,
        payload: {
          previousState: state.lastOnlineStatus,
          newState: isOnline
        }
      }
    });
    
    console.log(`[ANOMALY] ${eventType} transition for ${deviceId}: ${state.lastOnlineStatus} -> ${isOnline}`);
  }
  
  // Update state
  state.lastOnlineStatus = isOnline;
  deviceStates.set(deviceId, state);
}

/**
 * Main anomaly detection function - call this from health tick
 */
export async function detectAnomalies(deviceId: string, healthData: {
  voltageV?: number;
  pfEst?: number;
  online: boolean;
}, timestamp: Date) {
  try {
    // Check voltage anomalies
    if (healthData.voltageV !== undefined && healthData.voltageV !== null) {
      await checkVoltageSag(deviceId, healthData.voltageV, timestamp);
      await checkVoltageSwell(deviceId, healthData.voltageV, timestamp);
    }
    
    // Check power factor anomalies
    if (healthData.pfEst !== undefined && healthData.pfEst !== null) {
      await checkLowPowerFactor(deviceId, healthData.pfEst, timestamp);
    }
    
    // Check online/offline transitions
    await checkOnlineOfflineTransition(deviceId, healthData.online, timestamp);
    
  } catch (error) {
    console.error(`[ANOMALY] Error detecting anomalies for ${deviceId}:`, error);
  }
}