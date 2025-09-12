import { eq } from "drizzle-orm";
import { db } from "./db"; // your drizzle db instance
import { pollerSettings } from "../shared/schema";

export type PollerSettings = {
  energyEnabled: boolean;
  energyIntervalMs: number;
  healthEnabled: boolean;
  healthIntervalMs: number;
  dashboardRefreshMs: number;
};

const SINGLETON_ID = "singleton";

export async function ensureDefaultPollerSettings(): Promise<void> {
  const rows = await db.select().from(pollerSettings).where(eq(pollerSettings.id, SINGLETON_ID));
  if (rows.length === 0) {
    await db.insert(pollerSettings).values({ id: SINGLETON_ID }).returning();
  }
}

export async function getPollerSettings(): Promise<PollerSettings> {
  const [row] = await db.select().from(pollerSettings).where(eq(pollerSettings.id, SINGLETON_ID));
  if (!row) {
    await ensureDefaultPollerSettings();
    return getPollerSettings();
  }
  return {
    energyEnabled: !!row.energyEnabled,
    energyIntervalMs: row.energyIntervalMs,
    healthEnabled: !!row.healthEnabled,
    healthIntervalMs: row.healthIntervalMs,
    dashboardRefreshMs: row.dashboardRefreshMs,
  };
}

export async function updatePollerSettings(patch: Partial<PollerSettings>): Promise<PollerSettings> {
  await ensureDefaultPollerSettings();
  await db
    .update(pollerSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(pollerSettings.id, SINGLETON_ID));
  return getPollerSettings();
}