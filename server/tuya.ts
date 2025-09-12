import { TuyaContext } from "@tuya/tuya-connector-nodejs";
import { getPollerSettings } from "./storage.poller";
import { noteTuyaCall, type TuyaCallKind } from "./storage.tuyaCounters";

// Initialize Tuya client with environment variables
const baseUrl = process.env.TUYA_ENDPOINT || "https://openapi.tuyain.com";
const accessKey = process.env.TUYA_ACCESS_ID || "";
const secretKey = process.env.TUYA_ACCESS_SECRET || "";

// Validate required environment variables
if (!accessKey || !secretKey) {
  console.warn("[WARN] Missing Tuya ENV: TUYA_ACCESS_ID, TUYA_ACCESS_SECRET");
}

// Initialize base Tuya client
const baseTuya = new TuyaContext({ 
  baseUrl, 
  accessKey, 
  secretKey 
});

// Create wrapper that enforces master kill switch and tracks API calls
export const tuya = {
  async request(options: any) {
    // Check master kill switch before any Tuya API call
    const settings = await getPollerSettings();
    if (settings.masterKillSwitch) {
      console.log("[TUYA] Request blocked by master kill switch:", options.path);
      // Return empty success response when kill switch is enabled
      return {
        success: true,
        result: null,
        t: Date.now(),
        masterKillSwitchEnabled: true
      };
    }
    
    // Determine API call type for tracking
    let callKind: TuyaCallKind = "other";
    if (options.path?.includes("/devices")) {
      if (options.path.includes("/status")) {
        callKind = "status";
      } else if (options.path.includes("/logs")) {
        callKind = "logs";
      } else {
        callKind = "devices";
      }
    }
    
    // Track the API call
    try {
      await noteTuyaCall(callKind);
    } catch (error) {
      console.warn("[TUYA] Failed to track API call:", error);
    }
    
    // Proceed with actual Tuya API call if kill switch is off
    return baseTuya.request(options);
  }
};

export { baseUrl };