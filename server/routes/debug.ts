import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { toIsoIst } from "../time";
// If you have pf helpers from earlier work:
import { resolvePf } from "../pf"; // if missing, fallback in-code

import { tuya } from "../tuya"; // you already use tuya.request elsewhere

const prisma = new PrismaClient();

const router = Router();

/**
 * GET /api/debug/last-sample?deviceId=...&live=0|1
 * Returns latest RawHealth & RawEnergy rows for device,
 * plus optional live Tuya status (raw DP).
 */
router.get("/last-sample", async (req, res) => {
  try {
    const { deviceId, live } = req.query;
    if (!deviceId) return res.status(400).json({ ok:false, reason:"MISSING_DEVICE" });

    const [health, energy] = await Promise.all([
      prisma.rawHealth.findFirst({
        where: { deviceId: String(deviceId) },
        orderBy: { tsUtc: "desc" },
        select: {
          tsUtc: true, voltageV: true, currentA: true, powerW: true,
          pfEst: true
        }
      }),
      prisma.rawEnergy.findFirst({
        where: { deviceId: String(deviceId) },
        orderBy: { tsUtc: "desc" },
        select: { tsUtc: true, addEleKwh: true }
      })
    ]);

    // Resolve PF according to global setting if helper exists, otherwise use calculated est
    let pfResolved: number | null = null;
    if (typeof resolvePf === "function") {
      pfResolved = await resolvePf(prisma, null, health?.pfEst ? Number(health.pfEst) : null);
    } else {
      pfResolved = health?.pfEst ? Number(health.pfEst) : null;
    }

    // Optional: live Tuya status (raw DP list)
    let liveStatus: any = null;
    if (String(live) === "1") {
      try {
        const resp = await tuya.request({
          path: `/v1.0/devices/${deviceId}/status`,
          method: "GET"
        });
        liveStatus = { fetchedAt: toIsoIst(new Date()), status: resp?.result ?? [] };
      } catch (e) {
        liveStatus = { fetchedAt: toIsoIst(new Date()), error: "TUYA_FETCH_FAILED" };
      }
    }

    return res.json({
      ok: true,
      deviceId,
      db: {
        health: health ? {
          ts: toIsoIst(health.tsUtc),
          voltageV: health.voltageV ? Number(health.voltageV) : null,
          currentA: health.currentA ? Number(health.currentA) : null,
          powerW: health.powerW,
          pfEst: health.pfEst ? Number(health.pfEst) : null,
          pfResolved
        } : null,
        energy: energy ? {
          ts: toIsoIst(energy.tsUtc),
          addEleKwh: energy.addEleKwh
        } : null
      },
      live: liveStatus
    });
  } catch (err) {
    return res.status(500).json({ ok:false, reason:"SERVER_ERROR" });
  }
});

export default router;