import fetch from "node-fetch";
import { aggregateSeries } from "./agg.js";

const BASE = process.env.UPSTREAM_BASE_URL;   // e.g. https://<your-tuya-proxy>
const BEARER = process.env.UPSTREAM_BEARER || ""; // optional

function headers(extra={}) {
  const h = { "Content-Type": "application/json", ...extra };
  if (BEARER) h.Authorization = "Bearer " + BEARER;
  return h;
}

export async function proxyDevices(req, res) {
  try {
    const r = await fetch(BASE + "/devices", { headers: headers() });
    const j = await r.json();
    res.json(j);
  } catch (e) { res.status(500).json({ error: "devices", detail: String(e) }); }
}

export async function proxyLive(req, res) {
  try {
    const url = new URL(BASE + "/live");
    url.search = new URLSearchParams({ deviceId: req.query.deviceId }).toString();
    const r = await fetch(url, { headers: headers() });
    const j = await r.json();
    res.json(j);
  } catch (e) { res.status(500).json({ error: "live", detail: String(e) }); }
}

export async function proxySummary(req, res) {
  try {
    const url = new URL(BASE + "/summary");
    url.search = new URLSearchParams({ deviceIds: req.query.deviceIds }).toString();
    const r = await fetch(url, { headers: headers() });
    const j = await r.json();
    res.json(j);
  } catch (e) { res.status(500).json({ error: "summary", detail: String(e) }); }
}

// Optionally allow the server to aggregate multiple device series locally
export async function proxySeries(req, res) {
  try {
    const url = new URL(BASE + "/series");
    url.search = new URLSearchParams({
      deviceIds: req.query.deviceIds,
      granularity: req.query.granularity,
      start: req.query.start,
      end: req.query.end
    }).toString();
    const r = await fetch(url, { headers: headers() });
    const j = await r.json();
    // Normalize + aggregate if upstream returns per-device arrays
    const out = aggregateSeries(j);
    res.json(out);
  } catch (e) { res.status(500).json({ error: "series", detail: String(e) }); }
}