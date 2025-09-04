import { randomUUID } from "crypto";

// This app is read-only and doesn't store data locally
// All data comes directly from Tuya API
export interface IStorage {
  // No storage operations needed for this read-only app
}

export class MemStorage implements IStorage {
  constructor() {
    // No local storage needed
  }
}

export const storage = new MemStorage();
