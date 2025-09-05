import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const r = Router();
const prisma = new PrismaClient();

/**
 * GET /api/monitor/ingest-summary
 * Returns global counts and per-device last-seen snapshots for health/energy.
 */
r.get("/monitor/ingest-summary", async (_req, res) => {
  try {
    // Global counts
    const [healthCount, energyCount] = await Promise.all([
      prisma.rawHealth.count(),
      prisma.rawEnergy.count(),
    ]);

    // Counts in last 10 minutes (ingest rate rough check)
    const since10 = new Date(Date.now() - 10 * 60 * 1000);
    const [health10, energy10] = await Promise.all([
      prisma.rawHealth.count({ where: { tsUtc: { gte: since10 } } }),
      prisma.rawEnergy.count({ where: { tsUtc: { gte: since10 } } }),
    ]);

    // Device list from DB
    const devices = await prisma.device.findMany({
      orderBy: { deviceId: "asc" },
      select: { deviceId: true, name: true },
    });

    // For each device, find last health & energy rows
    const perDevice = [];
    for (const d of devices) {
      const [lastH, lastE] = await Promise.all([
        prisma.rawHealth.findFirst({
          where: { deviceId: d.deviceId },
          orderBy: { tsUtc: "desc" },
        }),
        prisma.rawEnergy.findFirst({
          where: { deviceId: d.deviceId },
          orderBy: { tsUtc: "desc" },
        }),
      ]);

      perDevice.push({
        deviceId: d.deviceId,
        name: d.name ?? d.deviceId,
        lastHealthTs: lastH?.tsUtc ?? null,
        lastEnergyTs: lastE?.tsUtc ?? null,
        lastPowerW: lastH?.powerW ?? null,
        lastVoltageV: lastH?.voltageV ?? null,
        lastCurrentA: lastH?.currentA ?? null,
        lastAddEleKwh: lastE?.addEleKwh ?? null,
      });
    }

    res.json({
      ok: true,
      global: {
        rawHealthCount: healthCount,
        rawEnergyCount: energyCount,
        rawHealthLast10m: health10,
        rawEnergyLast10m: energy10,
        nowUtc: new Date().toISOString(),
      },
      devices: perDevice,
    });
  } catch (e: any) {
    console.error("[/api/monitor/ingest-summary] error:", e);
    res.status(500).json({ ok: false, error: "Failed to build summary" });
  }
});

/**
 * GET /api/monitor/latest?limit=50
 * Returns a merged "tail" of latest rows from RawHealth & RawEnergy.
 */
r.get("/monitor/latest", async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

    const [h, e] = await Promise.all([
      prisma.rawHealth.findMany({
        orderBy: { tsUtc: "desc" },
        take: limit,
        select: {
          tsUtc: true, deviceId: true,
          powerW: true, voltageV: true, currentA: true, pfEst: true,
        },
      }),
      prisma.rawEnergy.findMany({
        orderBy: { tsUtc: "desc" },
        take: limit,
        select: {
          tsUtc: true, deviceId: true,
          addEleKwh: true,
        },
      }),
    ]);

    // Tag rows and merge then sort by time desc
    const rows = [
      ...h.map(r => ({ table: "RawHealth", ...r })),
      ...e.map(r => ({ table: "RawEnergy", ...r })),
    ].sort((a, b) => +new Date(b.tsUtc) - +new Date(a.tsUtc))
     .slice(0, limit);

    res.json({ ok: true, rows });
  } catch (e: any) {
    console.error("[/api/monitor/latest] error:", e);
    res.status(500).json({ ok: false, error: "Failed to load latest" });
  }
});

export default r;