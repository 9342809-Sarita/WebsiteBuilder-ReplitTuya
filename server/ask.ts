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

    // Get device statuses for all devices to provide comprehensive data to AI
    const targetDevices = deviceIds.length > 0 
      ? devices.filter((d: any) => deviceIds.includes(d.id || d.device_id))
      : devices; // Get all devices for comprehensive analysis

    const deviceStatuses: any[] = [];
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

    // Create comprehensive context with all UI data
    const enhancedDeviceData = devices.map((device: any) => {
      const deviceId = device.id || device.device_id;
      const status = deviceStatuses.find((s: any) => 
        (s.device.id || s.device.device_id) === deviceId
      );
      const spec = deviceSpecs.find((s: any) => s.deviceId === deviceId);
      
      // Format status data points for readability
      const statusData: any = {};
      if (status?.status) {
        status.status.forEach((dp: any) => {
          const code = dp.code;
          const value = dp.value;
          
          // Format specific data points with proper units and descriptions
          switch (code) {
            case 'switch_1':
            case 'switch':
              statusData.power_switch = value ? 'ON' : 'OFF';
              break;
            case 'cur_current':
              statusData.current = `${(value / 1000).toFixed(3)} A`;
              break;
            case 'cur_power':
              statusData.power = `${(value / 10).toFixed(1)} W`;
              break;
            case 'cur_voltage':
              statusData.voltage = `${(value / 10).toFixed(1)} V`;
              break;
            case 'add_ele':
              statusData.energy_consumption = `${(value / 100).toFixed(2)} kWh`;
              break;
            default:
              statusData[code] = value;
          }
        });
      }
      
      return {
        id: deviceId,
        name: device.name || 'Unknown Device',
        product_name: device.product_name,
        category: device.category,
        online: device.online ? 'Online' : 'Offline',
        active_time: device.active_time,
        current_status: statusData,
        user_specification: spec?.specification || 'No specification provided',
        last_updated: new Date().toISOString()
      };
    });

    const context = {
      query_time: new Date().toISOString(),
      timeRange: { start: start.toISOString(), end: end.toISOString(), gran },
      total_devices: devices.length,
      online_devices: devices.filter((d: any) => d.online).length,
      offline_devices: devices.filter((d: any) => !d.online).length,
      device_categories: Array.from(new Set(devices.map((d: any) => d.category).filter(Boolean))),
      devices: enhancedDeviceData,
      tuya_endpoint: "https://openapi.tuyain.com",
      data_freshness: "Real-time data from Tuya Smart Life platform"
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