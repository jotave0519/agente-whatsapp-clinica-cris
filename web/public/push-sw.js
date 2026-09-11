// Listeners de Web Push, injetados no service worker gerado pelo Workbox via
// workbox.importScripts (vite.config.ts) - o generateSW nao permite editar o
// sw.js final diretamente, so importar scripts extras que rodam no mesmo escopo.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, scheduleId } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Clínica Zangelmi", {
      body: body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      data: { scheduleId: scheduleId || null, url: "/agenda" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/agenda";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
