/* global self */
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { self.clients.claim(); });

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data.json(); } catch {}
  const title = data.title || "Power alert";
  const body = data.body || "An alert fired.";
  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/badge.png",
    vibrate: [150, 75, 150],
    data: { url: data.url || "/alerts" },
    actions: [
      { action: "open", title: "Open Alerts" },
      { action: "dismiss", title: "Dismiss" }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = event.notification?.data?.url || "/alerts";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = all.find(c => c.url.includes(url));
    if (existing) { existing.focus(); existing.postMessage({ type: "focus" }); }
    else { self.clients.openWindow(url); }
  })());
});