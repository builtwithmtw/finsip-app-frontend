// Kill switch for the service worker the old Vite build installed.
//
// Up to 1651268 the app called registerSW() from vite-plugin-pwa, which put a
// Workbox worker at this path with a navigation fallback to a precached
// index.html. The Next migration dropped the plugin but could not un-install the
// worker already sitting in every returning visitor's browser: it kept serving
// the old SPA shell, which has no /screener route and bounced every deep link
// through its catch-all to "/" and into the login form.
//
// A worker can only be replaced by another worker at the same URL, so this file
// has to keep existing. It claims the old registration, drops the precache, and
// unregisters itself; without a fetch handler, navigations go to the network in
// the meantime. Reload once and the browser is back on the real app.
//
// Safe to delete once returning clients have all had a chance to pick it up.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      // The tab is showing whatever the old worker served; reload it so the user
      // sees the page they asked for rather than a stale shell.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
