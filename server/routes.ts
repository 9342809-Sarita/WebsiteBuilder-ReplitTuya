import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDeviceSpecSchema } from "@shared/schema";
import { handleAsk } from "./ask";
import { tuya, baseUrl } from "./tuya";
import energyRouter from "./routes/energy";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Mount energy API routes
  app.use("/api", energyRouter);
  
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

  // Device history logs
  app.get("/api/devices/:id/history", async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        start_time, 
        end_time, 
        size = "20", 
        type = "1,2" 
      } = req.query;

      // Default to last 7 days if no time range specified
      const endTime = end_time ? parseInt(end_time as string) : Date.now();
      const startTime = start_time ? parseInt(start_time as string) : (endTime - 7 * 24 * 60 * 60 * 1000);

      // Tuya OpenAPI: GET /v1.0/devices/{device_id}/logs
      const resp = await tuya.request({
        path: `/v1.0/devices/${id}/logs`,
        method: "GET",
        query: {
          start_time: startTime,
          end_time: endTime,
          size: parseInt(size as string),
          type: type as string
        }
      });
      res.json(resp);
    } catch (err: any) {
      console.error("Get history error:", err?.response ?? err);
      res.status(500).json({ 
        error: "Failed to get device history", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Device specifications endpoints
  
  // Get all device specifications
  app.get("/api/device-specs", async (_req, res) => {
    try {
      const specs = await storage.getAllDeviceSpecs();
      res.json({ success: true, result: specs });
    } catch (err: any) {
      console.error("Get device specs error:", err);
      res.status(500).json({ 
        error: "Failed to get device specifications", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get device specification by device ID
  app.get("/api/device-specs/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const spec = await storage.getDeviceSpec(deviceId);
      if (!spec) {
        res.status(404).json({ error: "Device specification not found" });
        return;
      }
      res.json({ success: true, result: spec });
    } catch (err: any) {
      console.error("Get device spec error:", err);
      res.status(500).json({ 
        error: "Failed to get device specification", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Create or update device specification
  app.post("/api/device-specs", async (req, res) => {
    try {
      const validatedData = insertDeviceSpecSchema.parse(req.body);
      
      // Check if specification already exists
      const existingSpec = await storage.getDeviceSpec(validatedData.deviceId);
      
      if (existingSpec) {
        // Update existing specification
        const updatedSpec = await storage.updateDeviceSpec(validatedData.deviceId, {
          deviceName: validatedData.deviceName,
          specification: validatedData.specification
        });
        res.json({ success: true, result: updatedSpec, action: "updated" });
      } else {
        // Create new specification
        const newSpec = await storage.createDeviceSpec(validatedData);
        res.json({ success: true, result: newSpec, action: "created" });
      }
    } catch (err: any) {
      console.error("Create/update device spec error:", err);
      res.status(500).json({ 
        error: "Failed to save device specification", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Delete device specification
  app.delete("/api/device-specs/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const deleted = await storage.deleteDeviceSpec(deviceId);
      if (!deleted) {
        res.status(404).json({ error: "Device specification not found" });
        return;
      }
      res.json({ success: true, message: "Device specification deleted" });
    } catch (err: any) {
      console.error("Delete device spec error:", err);
      res.status(500).json({ 
        error: "Failed to delete device specification", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Ask AI endpoint
  app.get("/api/ask", handleAsk);

  const httpServer = createServer(app);
  return httpServer;
}
