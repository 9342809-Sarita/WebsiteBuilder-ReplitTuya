import { Router } from "express";
import { getPollerSettings, updatePollerSettings } from "../storage.poller";
import { energyTickOnce, healthTickOnce } from "../jobs/poller";

export const pollerRouter = Router();

pollerRouter.get("/settings", async (_req, res) => {
  try {
    const s = await getPollerSettings();
    res.json(s);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "Failed to get poller settings" });
  }
});

pollerRouter.put("/settings", async (req, res) => {
  try {
    const patch = req.body ?? {};
    
    // Server-side validation to prevent runaway polling
    if (patch.healthIntervalMs !== undefined && patch.healthIntervalMs < 5000) {
      patch.healthIntervalMs = 5000; // Minimum 5 seconds
    }
    if (patch.energyIntervalMs !== undefined && patch.energyIntervalMs < 60000) {
      patch.energyIntervalMs = 60000; // Minimum 1 minute
    }
    if (patch.dashboardRefreshMs !== undefined && patch.dashboardRefreshMs < 5000) {
      patch.dashboardRefreshMs = 5000; // Minimum 5 seconds
    }
    
    const s = await updatePollerSettings(patch);
    res.json(s);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "Failed to update poller settings" });
  }
});

pollerRouter.post("/ping-now", async (req, res) => {
  const type = (req.query.type as string) || (req.body?.type as string) || "health";
  try {
    const result =
      type === "energy" ? await energyTickOnce() :
      type === "health" ? await healthTickOnce() :
      (() => { throw new Error("type must be 'energy' or 'health'"); })();
    res.json({ type, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "ping failed" });
  }
});