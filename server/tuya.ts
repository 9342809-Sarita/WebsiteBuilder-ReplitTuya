import { TuyaContext } from "@tuya/tuya-connector-nodejs";

// Initialize Tuya client with environment variables
const baseUrl = process.env.TUYA_ENDPOINT || "https://openapi.tuyain.com";
const accessKey = process.env.TUYA_ACCESS_ID || "";
const secretKey = process.env.TUYA_ACCESS_SECRET || "";

// Validate required environment variables
if (!accessKey || !secretKey) {
  console.warn("[WARN] Missing Tuya ENV: TUYA_ACCESS_ID, TUYA_ACCESS_SECRET");
}

// Export configured Tuya client instance and base URL
export const tuya = new TuyaContext({ 
  baseUrl, 
  accessKey, 
  secretKey 
});

export { baseUrl };