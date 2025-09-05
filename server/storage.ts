import { randomUUID } from "crypto";
import { deviceSpecs, type DeviceSpec, type InsertDeviceSpec, deviceSettings, type DeviceSettings, type InsertDeviceSettings } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Storage interface for device specifications and settings
export interface IStorage {
  // Device specification operations
  getDeviceSpec(deviceId: string): Promise<DeviceSpec | undefined>;
  getAllDeviceSpecs(): Promise<DeviceSpec[]>;
  createDeviceSpec(spec: InsertDeviceSpec): Promise<DeviceSpec>;
  updateDeviceSpec(deviceId: string, spec: Partial<InsertDeviceSpec>): Promise<DeviceSpec | undefined>;
  deleteDeviceSpec(deviceId: string): Promise<boolean>;
  
  // Device settings operations
  getDeviceSettings(deviceId: string): Promise<DeviceSettings | undefined>;
  getAllDeviceSettings(): Promise<DeviceSettings[]>;
  upsertDeviceSettings(settings: InsertDeviceSettings): Promise<DeviceSettings>;
  deleteDeviceSettings(deviceId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getDeviceSpec(deviceId: string): Promise<DeviceSpec | undefined> {
    const [spec] = await db.select().from(deviceSpecs).where(eq(deviceSpecs.deviceId, deviceId));
    return spec || undefined;
  }

  async getAllDeviceSpecs(): Promise<DeviceSpec[]> {
    return await db.select().from(deviceSpecs);
  }

  async createDeviceSpec(spec: InsertDeviceSpec): Promise<DeviceSpec> {
    const [createdSpec] = await db
      .insert(deviceSpecs)
      .values(spec)
      .returning();
    return createdSpec;
  }

  async updateDeviceSpec(deviceId: string, spec: Partial<InsertDeviceSpec>): Promise<DeviceSpec | undefined> {
    const [updatedSpec] = await db
      .update(deviceSpecs)
      .set({ ...spec, updatedAt: new Date() })
      .where(eq(deviceSpecs.deviceId, deviceId))
      .returning();
    return updatedSpec || undefined;
  }

  async deleteDeviceSpec(deviceId: string): Promise<boolean> {
    const result = await db
      .delete(deviceSpecs)
      .where(eq(deviceSpecs.deviceId, deviceId));
    return (result.rowCount || 0) > 0;
  }

  // Device settings operations
  async getDeviceSettings(deviceId: string): Promise<DeviceSettings | undefined> {
    const [settings] = await db.select().from(deviceSettings).where(eq(deviceSettings.deviceId, deviceId));
    return settings || undefined;
  }

  async getAllDeviceSettings(): Promise<DeviceSettings[]> {
    return await db.select().from(deviceSettings);
  }

  async upsertDeviceSettings(settings: InsertDeviceSettings): Promise<DeviceSettings> {
    // Try to update first
    const [updatedSettings] = await db
      .update(deviceSettings)
      .set({ 
        deviceName: settings.deviceName,
        dataStorageEnabled: settings.dataStorageEnabled,
        updatedAt: new Date() 
      })
      .where(eq(deviceSettings.deviceId, settings.deviceId))
      .returning();

    if (updatedSettings) {
      return updatedSettings;
    }

    // If no record exists, insert new one
    const [createdSettings] = await db
      .insert(deviceSettings)
      .values(settings)
      .returning();
    return createdSettings;
  }

  async deleteDeviceSettings(deviceId: string): Promise<boolean> {
    const result = await db
      .delete(deviceSettings)
      .where(eq(deviceSettings.deviceId, deviceId));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
