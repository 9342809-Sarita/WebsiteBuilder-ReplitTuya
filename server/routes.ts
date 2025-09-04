import type { Express } from "express";
import { createServer, type Server } from "http";
import { TuyaContext } from "@tuya/tuya-connector-nodejs";

const baseUrl = process.env.TUYA_ENDPOINT || process.env.TUYA_ENDPOINT_ENV_VAR || "https://openapi.tuyain.com";
const accessKey = process.env.TUYA_ACCESS_ID || process.env.TUYA_ACCESS_ID_ENV_VAR || "default_access_id";
const secretKey = process.env.TUYA_ACCESS_SECRET || process.env.TUYA_ACCESS_SECRET_ENV_VAR || "default_secret";

if (!baseUrl || !accessKey || !secretKey || accessKey === "default_access_id" || secretKey === "default_secret") {
  console.warn("[WARN] Missing Tuya ENV: TUYA_ENDPOINT, TUYA_ACCESS_ID, TUYA_ACCESS_SECRET");
}

const tuya = new TuyaContext({
  baseUrl,
  accessKey,
  secretKey
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ 
      ok: true, 
      dc: baseUrl,
      timestamp: new Date().toISOString()
    });
  });

  // List devices associated with the linked Smart Life account
  app.get("/api/devices", async (_req, res) => {
    try {
      // Tuya OpenAPI: GET /v1.0/iot-01/associated-users/devices
      const resp = await tuya.request({
        path: "/v1.0/iot-01/associated-users/devices",
        method: "GET",
        query: { page_no: 1, page_size: 100 }
      });
      res.json(resp);
    } catch (err: any) {
      console.error("List devices error:", err?.response ?? err);
      res.status(500).json({ 
        error: "Failed to list devices", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Current device status
  app.get("/api/devices/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      // Tuya OpenAPI: GET /v1.0/devices/{device_id}/status
      const resp = await tuya.request({
        path: `/v1.0/devices/${id}/status`,
        method: "GET"
      });
      res.json(resp);
    } catch (err: any) {
      console.error("Get status error:", err?.response ?? err);
      res.status(500).json({ 
        error: "Failed to get device status", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
