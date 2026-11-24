/* App del panel de EU Digital: este archivo existe para que el panel se pueda instalar en el teléfono
   o en la computadora. No guarda páginas ni datos: todo sigue yendo a internet. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* sin caché */ });
