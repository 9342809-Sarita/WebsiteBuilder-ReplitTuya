// server/alerts.ts
import { PrismaClient } from "@prisma/client";
import { sendPushAll } from "./push";

const prisma = new PrismaClient();

type MetricKey = "powerW" | "voltageV" | "currentA" | "pfEst";

export function compare(op: string, a: number, b: number) {
  switch (op) {
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    case "==": return a === b;
    case "!=": return a !== b;
    default: return false;
  }
}

// --- SSE fanout (simple) ---
type Client = { id: string; write: (s: string) => void };
const clients = new Set<Client>();
export function sseAdd(c: Client) { clients.add(c); }
export function sseRemove(c: Client) { clients.delete(c); }
export function sseBroadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(c => c.write(payload));
}

// Fetch recent values and decide if a rule fires
export async function evaluateRuleForDevice(ruleId: bigint) {
  const rule = await prisma.alertRule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.isActive) return;

  const metric = rule.metric as MetricKey;
  const now = new Date();
  const since = new Date(now.getTime() - rule.durationS * 1000);

  // pull recent health samples for the device
  const samples = await prisma.rawHealth.findMany({
    where: { deviceId: rule.deviceId, tsUtc: { gte: since } },
    orderBy: { tsUtc: "asc" },
    select: { tsUtc: true, powerW: true, voltageV: true, currentA: true, pfEst: true },
  });
  if (samples.length === 0) return;

  const ok = samples.every(s => {
    const v =
      metric === "powerW" ? Number(s.powerW ?? 0) :
      metric === "voltageV" ? Number(s.voltageV ?? 0) :
      metric === "currentA" ? Number(s.currentA ?? 0) :
      Number(s.pfEst ?? 0);
    return compare(rule.op, v, rule.threshold);
  });

  if (!ok) return;

  // cooldown gate
  if (rule.lastFired) {
    const elapsed = (now.getTime() - rule.lastFired.getTime()) / 1000;
    if (elapsed < rule.cooldownS) return;
  }

  const last = samples[samples.length - 1];
  const value =
    metric === "powerW" ? Number(last.powerW ?? 0) :
    metric === "voltageV" ? Number(last.voltageV ?? 0) :
    metric === "currentA" ? Number(last.currentA ?? 0) :
    Number(last.pfEst ?? 0);

  const ev = await prisma.alertEvent.create({
    data: {
      ruleId: rule.id,
      deviceId: rule.deviceId,
      tsUtc: now,
      value,
      message: `${rule.name}: ${metric} ${rule.op} ${rule.threshold} (got ${value})`,
    },
  });

  await prisma.alertRule.update({ where: { id: rule.id }, data: { lastFired: now }});
  
  // Send push notifications
  await sendPushAll({
    title: "Power alert",
    body: ev.message || `Alert on ${ev.deviceId}`,
    url: "/alerts"
  });
  
  sseBroadcast("alert", { type: "fired", event: ev });
}

// evaluate all rules for a given device (call from poller)
export async function evaluateAlertsForDevice(deviceId: string) {
  const rules = await prisma.alertRule.findMany({ where: { deviceId, isActive: true }});
  await Promise.all(rules.map((r) => evaluateRuleForDevice(r.id)));
}