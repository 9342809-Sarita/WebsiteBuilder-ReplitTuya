import type { Express } from "express";
import { createServer, type Server } from "http";
import { proxyDevices, proxyLive, proxySummary, proxySeries } from "./proxy";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Energy monitoring API health check
  app.get("/api/health", (_req, res) => {
    res.json({ 
      ok: true, 
      tz: "Asia/Kolkata",
      timestamp: new Date().toISOString()
    });
  });

  // Energy monitoring proxy endpoints
  app.get("/api/devices", proxyDevices);
  app.get("/api/live", proxyLive);
  app.get("/api/summary", proxySummary);
  app.get("/api/series", proxySeries);

  const httpServer = createServer(app);
  return httpServer;
}
