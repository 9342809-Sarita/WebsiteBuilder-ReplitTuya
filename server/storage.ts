import { randomUUID } from "crypto";
import { deviceSpecs, type DeviceSpec, type InsertDeviceSpec } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Storage interface for device specifications
export interface IStorage {
  // Device specification operations
  getDeviceSpec(deviceId: string): Promise<DeviceSpec | undefined>;
  getAllDeviceSpecs(): Promise<DeviceSpec[]>;
  createDeviceSpec(spec: InsertDeviceSpec): Promise<DeviceSpec>;
  updateDeviceSpec(deviceId: string, spec: Partial<InsertDeviceSpec>): Promise<DeviceSpec | undefined>;
  deleteDeviceSpec(deviceId: string): Promise<boolean>;
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
}

export const storage = new DatabaseStorage();
