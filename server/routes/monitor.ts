import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { resolvePf } from "../pf";

const r = Router();
const prisma = new PrismaClient();

/**
 * Utility: detect DB flavor from DATABASE_URL
 */
function dbFlavor() {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("mysql://") || url.startsWith("mysqls://")) return "mysql";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgres";
  return "unknown";
}

/**
 * GET /api/monitor/ingest-summary
 * Robust summary: partial results plus per-metric errors instead of a single 500.
 */
r.get("/monitor/ingest-summary", async (_req, res) => {
  const errors: Record<string, string> = {};
  const result: any = {
    ok: true,
    global: {
      rawHealthCount: null as number | null,
      rawEnergyCount: null as number | null,
      rawHealthLast10m: null as number | null,
      rawEnergyLast10m: null as number | null,
      nowUtc: new Date().toISOString(),
    },
    devices: [] as Array<any>,
  };

  const since10 = new Date(Date.now() - 10 * 60 * 1000);

  try {
    result.global.rawHealthCount = await prisma.rawHealth.count();
  } catch (e: any) {
    errors.rawHealthCount = e?.message || String(e);
  }

  try {
    result.global.rawEnergyCount = await prisma.rawEnergy.count();
  } catch (e: any) {
    errors.rawEnergyCount = e?.message || String(e);
  }

  try {
    result.global.rawHealthLast10m = await prisma.rawHealth.count({ where: { tsUtc: { gte: since10 } } });
  } catch (e: any) {
    errors.rawHealthLast10m = e?.message || String(e);
  }

  try {
    result.global.rawEnergyLast10m = await prisma.rawEnergy.count({ where: { tsUtc: { gte: since10 } } });
  } catch (e: any) {
    errors.rawEnergyLast10m = e?.message || String(e);
  }

  try {
    const devs = await prisma.device.findMany({
      orderBy: { deviceId: "asc" },
      select: { deviceId: true, name: true, lastOnlineUtc: true, lastSeenUtc: true },
    });

    for (const d of devs) {
      // last health/energy rows (each guarded)
      let lastH: any = null, lastE: any = null, errH: string | null = null, errE: string | null = null;

      try {
        lastH = await prisma.rawHealth.findFirst({
          where: { deviceId: d.deviceId },
          orderBy: { tsUtc: "desc" },
        });
      } catch (e: any) {
        errH = e?.message || String(e);
      }

      try {
        lastE = await prisma.rawEnergy.findFirst({
          where: { deviceId: d.deviceId },
          orderBy: { tsUtc: "desc" },
        });
      } catch (e: any) {
        errE = e?.message || String(e);
      }

      // Calculate if device is online (same logic as in energy.ts)
      const isOnline = d.lastOnlineUtc && d.lastSeenUtc 
        ? d.lastOnlineUtc.getTime() >= d.lastSeenUtc.getTime() - 60000 // Within 1 minute
        : false;

      result.devices.push({
        deviceId: d.deviceId,
        name: d.name ?? d.deviceId,
        lastHealthTs: lastH?.tsUtc ?? null,
        lastEnergyTs: lastE?.tsUtc ?? null,
        // If device is offline, show 0 values for all electrical readings
        lastPowerW: isOnline ? (lastH?.powerW ?? null) : 0,
        lastVoltageV: isOnline ? (lastH?.voltageV ?? null) : 0,
        lastCurrentA: isOnline ? (lastH?.currentA ?? null) : 0,
        lastAddEleKwh: isOnline ? (lastE?.addEleKwh ?? null) : 0,
        _errors: { lastHealth: errH, lastEnergy: errE },
      });
    }
  } catch (e: any) {
    errors.devices = e?.message || String(e);
  }

  if (Object.keys(errors).length) {
    result.ok = false;
    result.errors = errors;
  }
  res.json(result);
});

/**
 * GET /api/monitor/latest?limit=50
 * Returns a merged "tail" of latest rows from RawHealth & RawEnergy.
 */
r.get("/monitor/latest", async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const errors: Record<string, string> = {};
    let h: any[] = [], e: any[] = [];

    try {
      h = await prisma.rawHealth.findMany({
        orderBy: { tsUtc: "desc" },
        take: limit,
        select: {
          tsUtc: true, deviceId: true,
          powerW: true, voltageV: true, currentA: true, pfEst: true,
        },
      });
    } catch (err: any) {
      errors.rawHealth = err?.message || String(err);
    }

    try {
      e = await prisma.rawEnergy.findMany({
        orderBy: { tsUtc: "desc" },
        take: limit,
        select: {
          tsUtc: true, deviceId: true,
          addEleKwh: true,
        },
      });
    } catch (err: any) {
      errors.rawEnergy = err?.message || String(err);
    }

    // Tag rows and merge then sort by time desc, add unified 'pf' field for health rows
    const healthRowsWithPf = await Promise.all(
      h.map(async (r) => {
        const pf = await resolvePf(prisma, null, Number(r.pfEst) || null);
        return { table: "RawHealth", ...r, pf: pf ?? 0 };
      })
    );
    
    const rows = [
      ...healthRowsWithPf,
      ...e.map(r => ({ table: "RawEnergy", ...r })),
    ].sort((a, b) => +new Date(b.tsUtc) - +new Date(a.tsUtc))
     .slice(0, limit);

    const result: any = { ok: true, rows };
    if (Object.keys(errors).length) {
      result.ok = false;
      result.errors = errors;
    }
    res.json(result);
  } catch (e: any) {
    console.error("[/api/monitor/latest] error:", e);
    res.status(500).json({ ok: false, error: "Failed to load latest" });
  }
});

/**
 * GET /api/monitor/schema
 * Report which tables exist for current DB flavor.
 */
r.get("/monitor/schema", async (_req, res) => {
  const flavor = dbFlavor();
  const want = [
    "Device",
    "RawHealth",
    "RawEnergy",
    "DailyKwh",
    "Rollup1m",
    "Rollup15m",
    "Rollup1h",
    "Event",
    // add others if you created more
  ];

  try {
    let rows: any[] = [];
    if (flavor === "sqlite") {
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT name FROM sqlite_master WHERE type='table'`
      );
      const have = new Set(rows.map(r => r.name));
      return res.json({ ok: true, db: flavor, tables: want.map(n => ({ name: n, exists: have.has(n) })) });
    }
    if (flavor === "mysql") {
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE()`
      );
      const have = new Set(rows.map(r => r.name));
      return res.json({ ok: true, db: flavor, tables: want.map(n => ({ name: n, exists: have.has(n) })) });
    }
    // generic fallback
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 1 as ok`
    );
    return res.json({ ok: true, db: flavor, note: "generic check ran", tables: want.map(n => ({ name: n, exists: null })) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, db: flavor, error: e?.message || String(e) });
  }
});

/**
 * GET /api/monitor/selftest
 * Quick DB connectivity + Prisma info.
 */
r.get("/monitor/selftest", async (_req, res) => {
  try {
    const flavor = dbFlavor();
    const prismaVersion = (require("@prisma/client/package.json") as any)?.version;
    // Lightweight 'SELECT 1'
    await prisma.$queryRawUnsafe(`SELECT 1`);
    res.json({
      ok: true,
      db: flavor,
      prismaVersion,
      databaseUrlPresent: Boolean(process.env.DATABASE_URL),
      nowUtc: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      databaseUrlPresent: Boolean(process.env.DATABASE_URL),
    });
  }
});

/**
 * GET /api/monitor/storage-size
 * Returns database storage size in bytes for live counter display
 */
r.get("/monitor/storage-size", async (_req, res) => {
  try {
    const db = dbFlavor();
    
    if (db === "postgres") {
      // For now, estimate storage size based on row counts from the monitor summary
      const ingestRes = await fetch("http://localhost:5000/api/monitor/ingest-summary");
      if (ingestRes.ok) {
        const data = await ingestRes.json();
        const healthCount = data.global?.rawHealthCount || 0;
        const energyCount = data.global?.rawEnergyCount || 0;
        
        // Estimate: ~200 bytes per health record, ~100 bytes per energy record
        const estimatedBytes = (healthCount * 200) + (energyCount * 100) + (1024 * 1024); // +1MB base
        
        res.json({
          ok: true,
          totalSizeBytes: estimatedBytes,
          totalRows: healthCount + energyCount,
          breakdown: { 
            health: healthCount,
            energy: energyCount,
            note: "Estimated size based on row counts"
          }
        });
      } else {
        // Fallback - just return a basic estimate
        res.json({
          ok: true,
          totalSizeBytes: 2048000, // 2MB default
          totalRows: 0,
          breakdown: { note: "Default estimate" }
        });
      }
    } else if (db === "sqlite") {
      // For SQLite, use PRAGMA to get database size
      const result = await prisma.$queryRaw`PRAGMA page_count;` as any[];
      const pageCount = result[0]?.page_count || 0;
      const pageSize = 4096; // SQLite default page size
      const totalSize = pageCount * pageSize;
      
      res.json({
        ok: true,
        totalSizeBytes: totalSize,
        totalRows: 0,
        breakdown: { note: "Row counts not available for SQLite" }
      });
    } else {
      res.json({
        ok: false,
        error: `Storage size not supported for database type: ${db}`
      });
    }
  } catch (e: any) {
    res.json({
      ok: false,
      error: e?.message || String(e)
    });
  }
});

export default r;