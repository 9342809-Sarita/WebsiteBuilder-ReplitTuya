// server/tuya.ts
import { TuyaContext } from "@tuya/tuya-connector-nodejs";
import { getPollerSettings } from "./storage.poller";
import { noteTuyaCall, type TuyaCallKind } from "./storage.tuyaCounters";

const baseUrl = process.env.TUYA_ENDPOINT || "https://openapi.tuyain.com";
const accessKey = process.env.TUYA_ACCESS_ID || "";
const secretKey = process.env.TUYA_ACCESS_SECRET || "";

// Validate required environment variables
if (!accessKey || !secretKey) {
  console.warn("[WARN] Missing Tuya ENV: TUYA_ACCESS_ID, TUYA_ACCESS_SECRET");
}

export const tuya = new TuyaContext({ baseUrl, accessKey, secretKey });

// Map path -> kind for per-endpoint breakdown
function classify(path: string): TuyaCallKind {
  if (path.includes("/associated-users/devices")) return "devices";
  if (path.includes("/devices/") && path.endsWith("/status")) return "status";
  if (path.includes("/devices/") && path.endsWith("/logs")) return "logs";
  return "other";
}

// Patch request() to count pings and enforce master kill switch
const _request = tuya.request.bind(tuya);
tuya.request = async (opts: any) => {
  // Check master kill switch before any Tuya API call
  const settings = await getPollerSettings();
  if (settings.masterKillSwitch) {
    console.log("[TUYA] Request blocked by master kill switch:", opts.path);
    // Return empty success response when kill switch is enabled
    return {
      success: true,
      result: null,
      t: Date.now(),
      masterKillSwitchEnabled: true
    } as any;
  }

  const path = typeof opts?.path === "string" ? opts.path : "";
  const kind = classify(path);
  try {
    const res = await _request(opts);
    // count only successful calls (or move this before await to count attempts)
    noteTuyaCall(kind).catch(() => {});
    return res;
  } catch (err) {
    // still count as an attempt, if you prefer:
    noteTuyaCall(kind).catch(() => {});
    throw err;
  }
} as any;

export { baseUrl };