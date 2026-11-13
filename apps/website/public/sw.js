/* 505th Command Network — service worker for phone alerts (web push). Shows the alert, sets the app badge, opens the right page on tap. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "505th", body: e.data ? e.data.text() : "" }; }
  const jobs = [self.registration.showNotification(d.title || "505th", { body: d.body || "", icon: "/images/apple-touch-icon.png", badge: "/images/favicon-32x32.png", tag: d.tag, data: { url: d.url || "/terminal" } })];
  if (typeof d.badge === "number" && "setAppBadge" in self.navigator) jobs.push(d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge());
  e.waitUntil(Promise.all(jobs).catch(() => {}));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/terminal", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if (w.url.startsWith(self.location.origin) && "focus" in w) { w.navigate(url).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
