import { Router } from "express";
import { saveSubscription, deleteSubscription, getVapidPublicKey } from "../push";
const r = Router();

r.get("/push/public-key", (_req, res) => {
  try {
    const key = getVapidPublicKey();
    res.json({ ok: true, key });
  } catch (error) {
    res.status(500).json({ ok: false, error: "VAPID keys not configured" });
  }
});

r.post("/push/subscribe", async (req, res) => {
  const { subscription, userHint } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ ok: false, error: "Invalid subscription" });
  }
  await saveSubscription(subscription, userHint);
  res.json({ ok: true });
});

r.post("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  await deleteSubscription(endpoint);
  res.json({ ok: true });
});

export default r;