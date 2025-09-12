import { TuyaContext } from "@tuya/tuya-connector-nodejs";
import { getPollerSettings } from "./storage.poller";

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

// Create wrapper that enforces master kill switch
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
    
    // Proceed with actual Tuya API call if kill switch is off
    return baseTuya.request(options);
  }
};

export { baseUrl };