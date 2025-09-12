// server/routes/tuya-counters.ts
import { Router } from "express";
import { getCounters, resetCounters } from "../storage.tuyaCounters";

export const tuyaCountersRouter = Router();

// Get current API counters
tuyaCountersRouter.get("/", async (req, res) => {
  try {
    const counters = await getCounters();
    res.json({ ok: true, counters });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "Failed to get counters" });
  }
});

// Reset counters
tuyaCountersRouter.post("/reset", async (req, res) => {
  try {
    await resetCounters();
    const counters = await getCounters();
    res.json({ ok: true, message: "Counters reset successfully", counters });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "Failed to reset counters" });
  }
});