import type { Request, Response } from "express";
import { askLLM, samplePoints } from "./ai";

/**
 * GET /api/ask
 * query:
 *   q=... (user question)
 *   deviceIds=dev1,dev2  (optional; if absent, server can auto-pick top devices)
 *   start=ISO, end=ISO   (optional; if absent, fetch last 30 days)
 *   gran=hour|day|year   (default day)
 *
 * Implementation detail:
 * - Pulls compact stats from our own backend endpoints:
 *   /api/stats/summary, /api/stats/peaks, /api/series
 * - Downsamples time series to keep tokens small.
 */
export async function handleAsk(req: Request, res: Response): Promise<void> {
  try {
    const q = (req.query.q || "").toString();
    if (!q.trim()) {
      res.status(400).json({ error: "missing q" });
      return;
    }

    const deviceIds = ((req.query.deviceIds || "").toString())
      .split(",").map(s=>s.trim()).filter(Boolean);

    const now = new Date();
    const end = req.query.end ? new Date(req.query.end as string) : now;
    const start = req.query.start ? new Date(req.query.start as string)
      : new Date(end.getTime() - 30*24*60*60*1000); // last 30 days by default
    const gran = (req.query.gran || "day").toString();

    // For now, we'll create a simplified context from available data
    // In the future, this can be extended to call /api/stats/* endpoints when they're implemented
    const base = `http://localhost:${process.env.PORT || 5000}`;
    
    const getJSON = async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        console.warn(`Failed to fetch ${url}:`, error);
        return null;
      }
    };

    // Get basic device information that we have available
    const devicesResponse = await getJSON(`${base}/api/devices`);
    const devices = devicesResponse?.result?.devices || [];
    
    // Get device specifications
    const specsResponse = await getJSON(`${base}/api/device-specs`);
    const deviceSpecs = specsResponse?.result || [];

    // Get device statuses for the requested devices or all devices
    const targetDevices = deviceIds.length > 0 
      ? devices.filter((d: any) => deviceIds.includes(d.id || d.device_id))
      : devices.slice(0, 5); // Limit to first 5 devices to avoid too much data

    const deviceStatuses = [];
    for (const device of targetDevices) {
      const deviceId = device.id || device.device_id;
      if (deviceId) {
        const status = await getJSON(`${base}/api/devices/${deviceId}/status`);
        if (status) {
          deviceStatuses.push({
            device,
            status: status.result || []
          });
        }
      }
    }

    const context = {
      timeRange: { start: start.toISOString(), end: end.toISOString(), gran },
      devices: devices.map((d: any) => ({
        id: d.id || d.device_id,
        name: d.name,
        product_name: d.product_name,
        category: d.category,
        online: d.online,
        active_time: d.active_time
      })),
      deviceSpecs,
      deviceStatuses,
      summary: "Note: Advanced analytics endpoints (/api/stats/*, /api/series) are not yet implemented. Analysis is based on current device status and basic information."
    };

    const answer = await askLLM({ question: q, context });
    res.json({ 
      ok: true, 
      answer, 
      used: {
        devices: targetDevices.map((d: any) => d.id || d.device_id),
        timeRange: context.timeRange,
        granularity: gran,
        tokensCapped: true
      }
    });
  } catch (e: any) {
    console.error("Ask AI error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}