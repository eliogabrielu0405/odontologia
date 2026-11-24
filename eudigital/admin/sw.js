/* Avisos de EU Digital: muestra la notificación cuando un cliente reporta un pago,
   aunque el panel esté cerrado. No guarda páginas ni datos. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { /* aviso sin datos: se muestra el texto general */ }
  e.waitUntil(self.registration.showNotification(d.titulo || "Te reportaron un pago", {
    body: d.texto || "Abre tu panel para revisarlo.",
    icon: "/img/icono-192.png",
    badge: "/img/insignia.png",
    tag: d.tag || "eu-pago",
    renotify: true,
    data: { url: d.url || "/admin/#pagos" },
  }));
});

// Al tocar el aviso: si el panel ya está abierto se le pasa el foco; si no, se abre.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin/";
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const abierta = ventanas.find((c) => new URL(c.url).pathname.startsWith("/admin"));
    if (abierta) {
      abierta.postMessage({ eu: "aviso", url });
      return abierta.focus();
    }
    return self.clients.openWindow(url);
  })());
});
