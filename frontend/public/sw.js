/*
 * Service worker: receives push messages and shows them as notifications,
 * even when the app is closed. Kept deliberately small — no caching, no
 * offline mode — so it can never serve a stale copy of the app.
 *
 * A push carries: { id, title, body, link, tag, unread }.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "New notification" };
  }

  const show = self.registration.showNotification(data.title || "New notification", {
    body: data.body || "",
    icon: "/logoroumdoul.png",
    badge: "/logoroumdoul.png",
    // The same alert never shows twice, even if the open app also showed it.
    tag: data.tag || undefined,
    data: { link: data.link || "/dashboard" },
  });

  // The unread count on the app icon, where the device supports it.
  const badge =
    typeof data.unread === "number" && "setAppBadge" in self.navigator
      ? (data.unread > 0 ? self.navigator.setAppBadge(data.unread) : self.navigator.clearAppBadge()).catch(() => {})
      : Promise.resolve();

  event.waitUntil(Promise.all([show, badge]));
});

// Clicking opens what the alert is about: in an already-open app window if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.link || "/dashboard", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        return open.focus().then((w) => (w && "navigate" in w ? w.navigate(target) : undefined));
      }
      return self.clients.openWindow(target);
    }),
  );
});
