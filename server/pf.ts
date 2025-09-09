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

/**
 * Choose the appropriate PF value based on the source setting
 * @param pfSource The configured PF source ("tuya" or "calculated")
 * @param tuyaPf Direct PF reading from Tuya (0..1, after scaling)
 * @param estPf Calculated PF estimate (0..1)
 * @returns The chosen PF value or null if none available
 */
export function choosePf(
  pfSource: "tuya"|"calculated",
  tuyaPf?: number | null,   // 0..1 (after scaling)
  estPf?:  number | null    // 0..1
): number | null {
  if (pfSource === "tuya" && tuyaPf != null) return tuyaPf;
  if (estPf != null) return estPf;
  return tuyaPf ?? null; // last fallback
}

/**
 * Resolve the appropriate PF value using the global setting from database
 * @param db Prisma client instance
 * @param tuyaPf Direct PF reading from Tuya (0..1, after scaling)
 * @param estPf Calculated PF estimate (0..1)
 * @returns Promise<number|null> The resolved PF value
 */
export async function resolvePf(
  db: PrismaClient,
  tuyaPf?: number|null,
  estPf?: number|null
): Promise<number|null> {
  const src = await getPfSource(db);
  return choosePf(src, tuyaPf, estPf);
}