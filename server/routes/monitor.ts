import { Router } from "express";
import { PrismaClient } from "@prisma/client";

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
      select: { deviceId: true, name: true },
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

      result.devices.push({
        deviceId: d.deviceId,
        name: d.name ?? d.deviceId,
        lastHealthTs: lastH?.tsUtc ?? null,
        lastEnergyTs: lastE?.tsUtc ?? null,
        lastPowerW: lastH?.powerW ?? null,
        lastVoltageV: lastH?.voltageV ?? null,
        lastCurrentA: lastH?.currentA ?? null,
        lastAddEleKwh: lastE?.addEleKwh ?? null,
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

    // Tag rows and merge then sort by time desc
    const rows = [
      ...h.map(r => ({ table: "RawHealth", ...r })),
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

export default r;