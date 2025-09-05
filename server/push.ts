// server/push.ts
import webpush from "web-push";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// Only set VAPID details if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function saveSubscription(sub: any, userHint?: string) {
  const { endpoint, keys } = sub;
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userHint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userHint },
    });
  } catch (e) { /* ignore dup */ }
}

export async function deleteSubscription(endpoint: string) {
  try { await prisma.pushSubscription.delete({ where: { endpoint } }); } catch {}
}

export async function sendPushAll(payload: any) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured, skipping push notifications");
    return;
  }
  const subs = await prisma.pushSubscription.findMany({ take: 5000 });
  const msg = JSON.stringify(payload);
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({
        endpoint: s.endpoint,
        expirationTime: null,
        keys: { p256dh: s.p256dh, auth: s.auth }
      } as any, msg);
    } catch (err: any) {
      // cleanup gone endpoints
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await deleteSubscription(s.endpoint);
      }
    }
  }));
}

export function getVapidPublicKey() { 
  if (!VAPID_PUBLIC_KEY) throw new Error("VAPID keys not configured");
  return VAPID_PUBLIC_KEY; 
}