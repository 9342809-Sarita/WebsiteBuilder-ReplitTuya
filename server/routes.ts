import type { Express } from "express";
import { createServer, type Server } from "http";
import { PrismaClient } from "@prisma/client";
import { storage } from "./storage";
import { insertDeviceSpecSchema, insertDeviceSettingsSchema } from "@shared/schema";
import { handleAsk, getAskHistory, resetAsk } from "./ask";
import { tuya, baseUrl } from "./tuya";
import { resolvePf, resolvePfWithMeta } from "./pf";
import energyRouter from "./routes/energy";
import powerRouter from "./routes/power";
import devicesUiRouter from "./routes/devices-ui";
import monitorRouter from "./routes/monitor";
import alertsRouter from "./routes/alerts";
import pushRouter from "./routes/push";
import appSettingsRouter from "./routes/app-settings";
import debugRouter from "./routes/debug";
import { pollerRouter } from "./routes/pollers";

const prisma = new PrismaClient();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Mount energy API routes
  app.use("/api", energyRouter);
  
  // Mount power API routes
  app.use("/api", powerRouter);
  
  // Mount devices UI API routes
  app.use("/api", devicesUiRouter);
  
  // Mount monitor API routes
  app.use("/api", monitorRouter);
  
  // Mount alerts API routes
  app.use("/api", alertsRouter);
  
  // Mount push notifications API routes
  app.use("/api", pushRouter);
  
  // Mount app settings API routes
  app.use("/api", appSettingsRouter);
  
  // Mount debug API routes
  app.use("/api/debug", debugRouter);
  
  // Mount poller control API routes
  app.use("/api/pollers", pollerRouter);
  
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

  // Live dashboard data (devices + status for online devices)
  app.get("/api/live-dashboard", async (req, res) => {
    try {
      // First get device list
      const devicesResp = await tuya.request({
        path: "/v1.0/iot-01/associated-users/devices",
        method: "GET",
        query: { page_no: 1, page_size: 100 }
      });

      const deviceList = (devicesResp as any)?.result?.devices ?? [];
      const devices = deviceList.map((d: any) => {
        const deviceId = d.id ?? d.device_id ?? "";
        return {
          deviceId,
          name: d.name ?? deviceId,
          online: Boolean(d.online)
        };
      }).filter((x: any) => x.deviceId);

      // Get status for online devices only
      const onlineDevices = devices.filter((d: any) => d.online);
      const statusPromises = onlineDevices.map(async (device: any) => {
        try {
          const statusResp = await tuya.request({
            path: `/v1.0/devices/${device.deviceId}/status`,
            method: "GET"
          });
          
          const statusData = (statusResp as any)?.result || [];
          
          // Extract electrical readings from status data points
          let powerW = 0, voltageV = 0, currentA = 0, tuyaPf: number | null = null;
          
          statusData.forEach((dp: any) => {
            switch (dp.code) {
              case 'cur_power':
                powerW = dp.value ? dp.value / 10 : 0; // Convert from 0.1W to W
                break;
              case 'cur_voltage':
                voltageV = dp.value ? dp.value / 10 : 0; // Convert from 0.1V to V
                break;
              case 'cur_current':
                currentA = dp.value ? dp.value / 1000 : 0; // Convert from mA to A
                break;
              case 'power_factor':
                tuyaPf = dp.value ? dp.value / 1000 : null; // Convert to decimal
                break;
            }
          });

          // Calculate estimated PF from power, voltage, and current
          let pfEst: number | null = null;
          if (powerW != null && voltageV && currentA) {
            const denom = voltageV * currentA;
            if (denom > 0) {
              pfEst = Math.max(0, Math.min(1, powerW / denom));
            }
          }

          // Use global setting to choose PF source with metadata
          const { pf, hasPf } = await resolvePfWithMeta(prisma, tuyaPf, pfEst);

          return {
            deviceId: device.deviceId,
            name: device.name,
            online: true,
            powerW,
            voltageV,
            currentA,
            pf: pf ?? 0,
            hasPf
          };
        } catch (err) {
          // If status fetch fails, still include device but with zeros
          return {
            deviceId: device.deviceId,
            name: device.name,
            online: false, // Mark as offline if status fetch fails
            powerW: 0,
            voltageV: 0,
            currentA: 0,
            pf: 0,
            hasPf: false
          };
        }
      });

      const devicesWithStatus = await Promise.all(statusPromises);
      
      // Add offline devices with zero readings
      const offlineDevices = devices.filter((d: any) => !d.online).map((device: any) => ({
        deviceId: device.deviceId,
        name: device.name,
        online: false,
        powerW: 0,
        voltageV: 0,
        currentA: 0,
        pf: 0,
        hasPf: false
      }));

      const allDevicesWithStatus = [...devicesWithStatus, ...offlineDevices];

      // Calculate summary
      const summary = {
        totalDevices: devices.length,
        onlineDevices: devices.filter((d: any) => d.online).length,
        offlineDevices: devices.filter((d: any) => !d.online).length
      };

      res.json({
        success: true,
        summary,
        devices: allDevicesWithStatus,
        timestamp: new Date().toISOString()
      });

    } catch (err: any) {
      console.error("Live dashboard error:", err?.response ?? err);
      res.status(500).json({ 
        success: false,
        error: "Failed to get live dashboard data", 
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

  // Device settings endpoints
  // Get all device settings
  app.get("/api/device-settings", async (_req, res) => {
    try {
      const settings = await storage.getAllDeviceSettings();
      res.json({ success: true, result: settings });
    } catch (err: any) {
      console.error("Get device settings error:", err);
      res.status(500).json({ 
        error: "Failed to get device settings", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get device settings by device ID
  app.get("/api/device-settings/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const settings = await storage.getDeviceSettings(deviceId);
      if (!settings) {
        res.status(404).json({ error: "Device settings not found" });
        return;
      }
      res.json({ success: true, result: settings });
    } catch (err: any) {
      console.error("Get device settings error:", err);
      res.status(500).json({ 
        error: "Failed to get device settings", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Create or update device settings
  app.post("/api/device-settings", async (req, res) => {
    try {
      const validatedData = insertDeviceSettingsSchema.parse(req.body);
      const settings = await storage.upsertDeviceSettings(validatedData);
      res.json({ success: true, result: settings });
    } catch (err: any) {
      console.error("Upsert device settings error:", err);
      res.status(500).json({ 
        error: "Failed to save device settings", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Delete device settings
  app.delete("/api/device-settings/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const deleted = await storage.deleteDeviceSettings(deviceId);
      if (!deleted) {
        res.status(404).json({ error: "Device settings not found" });
        return;
      }
      res.json({ success: true, message: "Device settings deleted" });
    } catch (err: any) {
      console.error("Delete device settings error:", err);
      res.status(500).json({ 
        error: "Failed to delete device settings", 
        detail: err?.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Ask AI endpoints
  app.get("/api/ask", handleAsk);     // keep GET for backward-compat
  app.post("/api/ask", handleAsk);    // preferred
  app.get("/api/ask/history", getAskHistory);
  app.post("/api/ask/reset", resetAsk);

  const httpServer = createServer(app);
  return httpServer;
}
