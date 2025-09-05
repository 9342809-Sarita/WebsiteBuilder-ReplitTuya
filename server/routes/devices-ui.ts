import { Router } from "express";
import { TuyaContext } from "@tuya/tuya-connector-nodejs";

// Reuse existing envs; keep defaults consistent with your project
const baseUrl  = process.env.TUYA_ENDPOINT || "https://openapi.tuyain.com";
const accessKey = process.env.TUYA_ACCESS_ID || "";
const secretKey = process.env.TUYA_ACCESS_SECRET || "";

const tuya = new TuyaContext({ baseUrl, accessKey, secretKey });
const r = Router();

/**
 * GET /api/devices/ui
 * Returns a normalized list for UI dropdown.
 * Never rely on DB; query Tuya directly so it works on fresh installs.
 */
r.get("/devices/ui", async (_req, res) => {
  try {
    const resp = await tuya.request({
      path: "/v1.0/iot-01/associated-users/devices",
      method: "GET",
      query: { page_no: 1, page_size: 100 }
    });
    const list = (resp as any)?.result?.devices ?? [];
    const devices = list.map((d: any) => {
      const deviceId = d.id ?? d.device_id ?? "";
      return {
        deviceId,
        name: d.name ?? deviceId,
        online: Boolean(d.online)
      };
    }).filter((x: any) => x.deviceId);
    res.json({ devices });
  } catch (err: any) {
    console.error("[/api/devices/ui] error:", err?.response ?? err);
    res.status(500).json({ devices: [], error: "Failed to fetch devices" });
  }
});

export default r;