import { Router } from "express";
import { getCounters, resetCounters } from "../storage.tuyaCounters";

export const tuyaCountersRouter = Router();

tuyaCountersRouter.get("/", async (_req, res) => {
  const snapshot = await getCounters();
  res.json(snapshot);
});

tuyaCountersRouter.post("/reset", async (_req, res) => {
  await resetCounters();
  const snapshot = await getCounters();
  res.json({ ok: true, ...snapshot });
});