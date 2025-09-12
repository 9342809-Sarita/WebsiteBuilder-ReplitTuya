import { z } from "zod";
import { pgTable, varchar, text, timestamp, serial, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Tuya device schema
export const TuyaDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  category_name: z.string().optional(),
  online: z.union([z.boolean(), z.string()]),
  device_id: z.string().optional(),
});

export const TuyaDeviceStatusSchema = z.object({
  code: z.string(),
  value: z.any(),
  type: z.string().optional(),
});

export const TuyaApiResponseSchema = z.object({
  result: z.any(),
  success: z.boolean().optional(),
  t: z.number().optional(),
});

export type TuyaDevice = z.infer<typeof TuyaDeviceSchema>;
export type TuyaDeviceStatus = z.infer<typeof TuyaDeviceStatusSchema>;
export type TuyaApiResponse = z.infer<typeof TuyaApiResponseSchema>;

// Database schema for device specifications
export const deviceSpecs = pgTable("device_specs", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 255 }).notNull().unique(),
  deviceName: varchar("device_name", { length: 255 }).notNull(),
  specification: text("specification").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema for device specifications
export const insertDeviceSpecSchema = createInsertSchema(deviceSpecs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Device settings schema for enable/disable data storage per device
export const deviceSettings = pgTable("device_settings", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 255 }).notNull().unique(),
  deviceName: varchar("device_name", { length: 255 }).notNull(),
  dataStorageEnabled: boolean("data_storage_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema for device settings
export const insertDeviceSettingsSchema = createInsertSchema(deviceSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Poller settings schema for global polling configuration
export const pollerSettings = pgTable("poller_settings", {
  id: text("id").primaryKey().$default(() => "singleton"),
  energyEnabled: boolean("energy_enabled").notNull().default(true),
  energyIntervalMs: integer("energy_interval_ms").notNull().default(300000), // 5 min
  healthEnabled: boolean("health_enabled").notNull().default(true),
  healthIntervalMs: integer("health_interval_ms").notNull().default(30000),  // 30 s
  dashboardRefreshEnabled: boolean("dashboard_refresh_enabled").notNull().default(true),
  dashboardRefreshMs: integer("dashboard_refresh_ms").notNull().default(10000), // 10 s
  masterKillSwitch: boolean("master_kill_switch").notNull().default(false), // Master switch to disable all Tuya traffic
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Insert schema for poller settings
export const insertPollerSettingsSchema = createInsertSchema(pollerSettings).omit({
  id: true,
  updatedAt: true,
});

// Tuya API counters table for tracking API usage
export const tuyaCounters = pgTable("tuya_counters", {
  id: text("id").primaryKey().$default(() => "singleton"),
  total: integer("total").notNull().default(0),
  devicesCount: integer("devices_count").notNull().default(0),
  statusCount: integer("status_count").notNull().default(0),
  logsCount: integer("logs_count").notNull().default(0),
  sinceReset: integer("since_reset").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).defaultNow(),
  lastPingAt: timestamp("last_ping_at", { withTimezone: true }),
});

// Types
export type DeviceSpec = typeof deviceSpecs.$inferSelect;
export type InsertDeviceSpec = z.infer<typeof insertDeviceSpecSchema>;
export type DeviceSettings = typeof deviceSettings.$inferSelect;
export type InsertDeviceSettings = z.infer<typeof insertDeviceSettingsSchema>;
export type PollerSettings = typeof pollerSettings.$inferSelect;
export type InsertPollerSettings = z.infer<typeof insertPollerSettingsSchema>;
export type TuyaCounters = typeof tuyaCounters.$inferSelect;
