// server/ask.ts
import type { Request, Response } from "express";
import { askLLMWithHistory, samplePoints } from "./ai";
import { getHistory, appendMessage, resetSession } from "./chat-store";

// Build a comprehensive context object with device data, specs, and status
async function buildContext(req: Request) {
  try {
    const baseUrl = `http://${req.headers.host || 'localhost:5000'}`;
    
    // Fetch devices list with embedded status
    const devicesResponse = await fetch(`${baseUrl}/api/devices`);
    const devicesData = await devicesResponse.json();
    const devices = devicesData?.result?.devices || [];
    
    // Fetch device specifications
    const specsResponse = await fetch(`${baseUrl}/api/device-specs`);
    const specsData = await specsResponse.json();
    const specifications = specsData?.result || [];
    
    // Create a comprehensive context
    const context = {
      timestamp: new Date().toISOString(),
      deviceCount: devices.length,
      devices: devices.map((device: any) => ({
        id: device.id || device.device_id,
        name: device.name,
        category: device.category,
        categoryName: device.category_name,
        productName: device.product_name,
        online: device.online,
        status: device.status || [],
        activeTime: device.active_time,
        updateTime: device.update_time
      })),
      deviceSpecifications: specifications.map((spec: any) => ({
        deviceId: spec.deviceId,
        deviceName: spec.deviceName,
        specification: spec.specification,
        createdAt: spec.createdAt
      })),
      summary: {
        onlineDevices: devices.filter((d: any) => d.online).length,
        offlineDevices: devices.filter((d: any) => !d.online).length,
        totalSpecs: specifications.length,
        categories: [...new Set(devices.map((d: any) => d.category_name).filter(Boolean))]
      }
    };
    
    return context;
  } catch (error) {
    console.error('buildContext error:', error);
    // Return minimal context on error
    return {
      timestamp: new Date().toISOString(),
      error: 'Failed to fetch context data',
      deviceCount: 0,
      devices: [],
      deviceSpecifications: []
    };
  }
}

/**
 * POST /api/ask
 * body: { q: string, sessionId: string }
 * (GET /api/ask?q=...&sessionId=... also supported)
 */
export async function handleAsk(req: Request, res: Response) {
  try {
    const isPost = req.method.toUpperCase() === "POST";
    const q = (isPost ? (req.body?.q ?? "") : (req.query.q ?? "")) as string;
    const sessionId = (isPost ? (req.body?.sessionId ?? "") : (req.query.sessionId ?? "")) as string;

    if (!q) return res.status(400).json({ ok: false, error: "Missing q" });
    if (!sessionId) return res.status(400).json({ ok: false, error: "Missing sessionId" });

    const context = await buildContext(req);

    const userContent =
      "Question:\n" + q +
      "\n\nContext JSON (compact):\n" + JSON.stringify(context).slice(0, 120_000);

    const history = getHistory(sessionId);
    const answer = await askLLMWithHistory({ history, userContent });

    // Parse potential tool calls
    let parsed: any; try { parsed = JSON.parse(answer); } catch {}
    let finalText = parsed?.answer || answer;

    if (parsed?.tool?.name === "create_alert") {
      const a = parsed.tool.args || {};
      // map deviceName → id
      const devs = context.devices || [];
      const match = devs.find((d:any) => d.name?.toLowerCase() === String(a.deviceName||"").toLowerCase());
      if (match?.id) {
        const baseUrl = `http://${req.headers.host || 'localhost:5000'}`;
        const res = await fetch(`${baseUrl}/api/alerts/rules`, {
          method: "POST", headers: { "Content-Type":"application/json" },
          body: JSON.stringify({
            name: a.name || `Alert: ${a.metric} ${a.op} ${a.threshold}`,
            deviceId: match.id,
            metric: a.metric, op: a.op, threshold: a.threshold, durationS: a.durationS
          })
        }).then(r=>r.json());
        if (res.ok) {
          finalText += `\n\n✅ Created alert rule "${res.rule.name}" for ${match.name}.`;
        } else {
          finalText += `\n\n⚠️ Failed to create alert: ${res.error || "unknown error"}.`;
        }
      } else {
        finalText += `\n\n⚠️ I couldn't find a device named "${a.deviceName}".`;
      }
    }

    appendMessage(sessionId, { role: "user", content: q, ts: Date.now() });
    appendMessage(sessionId, { role: "assistant", content: finalText, ts: Date.now() });

    res.json({
      ok: true,
      answer: finalText,
      sessionId,
      history: getHistory(sessionId),
    });
  } catch (e: any) {
    console.error("Ask AI error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}

/**
 * GET /api/ask/history?sessionId=...
 */
export async function getAskHistory(req: Request, res: Response) {
  const sessionId = String(req.query.sessionId || "");
  if (!sessionId) return res.status(400).json({ ok: false, error: "Missing sessionId" });
  res.json({ ok: true, sessionId, history: getHistory(sessionId) });
}

/**
 * POST /api/ask/reset  body: { sessionId: string }
 */
export async function resetAsk(req: Request, res: Response) {
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) return res.status(400).json({ ok: false, error: "Missing sessionId" });
  resetSession(sessionId);
  res.json({ ok: true, sessionId, history: [] });
}