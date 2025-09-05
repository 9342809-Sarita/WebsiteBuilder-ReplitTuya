// server/routes/alerts.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sseAdd, sseRemove } from "../alerts";

const r = Router();
const prisma = new PrismaClient();

r.get("/alerts/rules", async (_req, res) => {
  const rules = await prisma.alertRule.findMany({ orderBy: { updatedAt: "desc" }});
  res.json({ ok: true, rules });
});

r.post("/alerts/rules", async (req, res) => {
  const { name, deviceId, metric, op, threshold, durationS, isActive, cooldownS } = req.body || {};
  if (!(name && deviceId && metric && op && typeof threshold === "number" && typeof durationS === "number")) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }
  const rule = await prisma.alertRule.create({
    data: { name, deviceId, metric, op, threshold, durationS, isActive: isActive ?? true, cooldownS: cooldownS ?? 120 }
  });
  res.json({ ok: true, rule });
});

r.delete("/alerts/rules/:id", async (req, res) => {
  const id = BigInt(req.params.id);
  await prisma.alertRule.delete({ where: { id } });
  res.json({ ok: true });
});

r.get("/alerts/events", async (_req, res) => {
  const events = await prisma.alertEvent.findMany({ orderBy: { tsUtc: "desc" }, take: 200 });
  res.json({ ok: true, events });
});

// Live stream for alert events via SSE
r.get("/alerts/stream", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const client = {
    id: crypto.randomUUID(),
    write: (s: string) => res.write(s),
  };
  sseAdd(client);

  // heartbeat
  const t = setInterval(() => res.write(`event: ping\ndata: {}\n\n`), 20000);

  req.on("close", () => {
    clearInterval(t);
    sseRemove(client);
  });
});

export default r;