import { PrismaClient } from "@prisma/client";

// In-memory cache for PF source setting
let pfCache: { value: "tuya" | "calculated"; ts: number } | null = null;

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Get the current PF source setting with caching
 * @param db Prisma client instance
 * @returns Promise<"tuya" | "calculated">
 */
export async function getPfSource(db: PrismaClient): Promise<"tuya" | "calculated"> {
  const now = Date.now();
  
  // Check if cache is present and fresh (< 5 min)
  if (pfCache && (now - pfCache.ts) < CACHE_DURATION_MS) {
    return pfCache.value;
  }
  
  try {
    // Read from database
    const settings = await db.appSettings.findFirst();
    const pfSource = settings?.pfSource || "calculated";
    
    // Ensure valid value
    const validatedPfSource = ["tuya", "calculated"].includes(pfSource) 
      ? pfSource as "tuya" | "calculated" 
      : "calculated";
    
    // Update cache
    pfCache = {
      value: validatedPfSource,
      ts: now
    };
    
    return validatedPfSource;
  } catch (error) {
    console.error("[PF] Error reading pfSource from DB:", error);
    
    // Return cached value if available, otherwise default
    if (pfCache) {
      return pfCache.value;
    }
    return "calculated";
  }
}

/**
 * Clear the PF source cache (useful when settings are updated)
 */
export function clearPfCache(): void {
  pfCache = null;
}