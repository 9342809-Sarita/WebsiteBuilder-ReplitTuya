// server/storage.tuyaCounters.ts
import { eq, sql } from "drizzle-orm";
import { db } from "./db";                  // your Drizzle instance
import { tuyaCounters } from "../shared/schema";

const ID = "singleton";

export type TuyaCounterSnapshot = {
  total: number;
  devicesCount: number;
  statusCount: number;
  logsCount: number;
  sinceReset: number;
  resetAt: Date | null;
  lastPingAt: Date | null;
};

export async function ensureCounterRow() {
  const rows = await db.select().from(tuyaCounters).where(eq(tuyaCounters.id, ID));
  if (rows.length === 0) {
    await db.insert(tuyaCounters).values({ id: ID }).returning();
  }
}

export async function getCounters(): Promise<TuyaCounterSnapshot> {
  await ensureCounterRow();
  const [row] = await db.select().from(tuyaCounters).where(eq(tuyaCounters.id, ID));
  return {
    total: row.total ?? 0,
    devicesCount: row.devicesCount ?? 0,
    statusCount: row.statusCount ?? 0,
    logsCount: row.logsCount ?? 0,
    sinceReset: row.sinceReset ?? 0,
    resetAt: row.resetAt ?? null,
    lastPingAt: row.lastPingAt ?? null,
  };
}

export type TuyaCallKind = "devices" | "status" | "logs" | "other";

export async function noteTuyaCall(kind: TuyaCallKind) {
  await ensureCounterRow();
  // Atomic in-DB increments
  const sets = {
    devices: sql`devices_count = ${tuyaCounters.devicesCount} + 1`,
    status:  sql`status_count = ${tuyaCounters.statusCount} + 1`,
    logs:    sql`logs_count = ${tuyaCounters.logsCount} + 1`,
    other:   sql`total = ${tuyaCounters.total}`, // no-op for per-kind, still counted in total below
  } as const;

  await db.execute(sql`
    UPDATE ${tuyaCounters}
    SET
      total = ${tuyaCounters.total} + 1,
      since_reset = ${tuyaCounters.sinceReset} + 1,
      ${sets[kind]},
      last_ping_at = now()
    WHERE ${tuyaCounters.id} = ${ID};
  `);
}

export async function resetCounters() {
  await ensureCounterRow();
  await db
    .update(tuyaCounters)
    .set({ sinceReset: 0, resetAt: new Date() })
    .where(eq(tuyaCounters.id, ID));
}