/* Ubicaciones y mapa, sin Google y sin costo.
   - EU.geo.distanciaKm, enlace, deTexto: cuentas y enlaces con coordenadas.
   - EU.geo.miUbicacion(): la ubicación del teléfono (pide permiso).
   - EU.geo.elegir(): abre un mapa para marcar un punto (el local del negocio o la casa del cliente).
   El mapa usa Leaflet (guardado en core/vendor) y los mapas gratuitos de OpenStreetMap. Leaflet
   solo se descarga cuando alguien abre el mapa. Lo usan las plantillas (delivery por distancia)
   y el panel (dónde está el local). */
(function () {
  "use strict";
  const EU = (window.EU = window.EU || {});
  const LEAFLET = "/core/vendor/leaflet-1.9.4/";
  const VENEZUELA = { lat: 7.6, lng: -66.2 };

  const valido = (p) => !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
    && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180 && !(Number(p.lat) === 0 && Number(p.lng) === 0);
  const punto = (lat, lng) => ({ lat: Math.round(Number(lat) * 1e6) / 1e6, lng: Math.round(Number(lng) * 1e6) / 1e6 });

  EU.geo = {
    valido,
    punto,
    // Distancia en línea recta (km) entre dos puntos de la Tierra
    distanciaKm(a, b) {
      const R = 6371, rad = (x) => (x * Math.PI) / 180;
      const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    },
    enlace: (p) => "https://www.google.com/maps?q=" + p.lat + "," + p.lng,
    texto: (p) => Number(p.lat).toFixed(5) + ", " + Number(p.lng).toFixed(5),
    /* Saca las coordenadas de un enlace de Google Maps o de un texto "10.48, -66.90".
       Los enlaces cortos (maps.app.goo.gl) no traen coordenadas: hay que abrirlos primero. */
    deTexto(t) {
      t = String(t || "").trim();
      const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
      const formas = [
        new RegExp("!3d" + num + "!4d" + num),
        new RegExp("@" + num + "," + num),
        new RegExp("[?&](?:q|ll|query|destination|center)=" + num + "(?:,|%2C)\\s*" + num, "i"),
        new RegExp("^" + num + "\\s*[,;\\s]\\s*" + num + "$"),
      ];
      for (const f of formas) {
        const m = f.exec(t);
        if (m && valido({ lat: m[1], lng: m[2] })) return punto(m[1], m[2]);
      }
      return null;
    },
    miUbicacion() {
      return new Promise((ok, mal) => {
        if (!("geolocation" in navigator)) { mal(new Error("Este teléfono no permite ver la ubicación. Márcala en el mapa.")); return; }
        if (!window.isSecureContext) { mal(new Error("La ubicación solo funciona en páginas seguras (https). Márcala en el mapa.")); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => ok(punto(pos.coords.latitude, pos.coords.longitude)),
          (e) => mal(new Error(e && e.code === 1
            ? "No diste permiso para ver tu ubicación. Actívalo en tu navegador o márcala en el mapa."
            : "No pudimos encontrar tu ubicación. Revisa que el GPS esté encendido o márcala en el mapa.")),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
    },
    elegir,
  };

  let cargando = null;
  function cargarLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (cargando) return cargando;
    cargando = new Promise((ok, mal) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = LEAFLET + "leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = LEAFLET + "leaflet.js";
      s.onload = () => ok(window.L);
      s.onerror = () => { cargando = null; mal(new Error("No se pudo abrir el mapa. Revisa tu conexión.")); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  function estilos() {
    if (document.getElementById("eu-mapa-css")) return;
    const st = document.createElement("style");
    st.id = "eu-mapa-css";
    st.textContent = `
.eu-mapa-capa{position:fixed;inset:0;z-index:2147483000;background:rgba(10,14,20,.55);display:flex;align-items:flex-end;justify-content:center;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d232b}
.eu-mapa-hoja{width:min(640px,100%);max-height:100%;background:#fff;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 40px rgba(0,0,0,.25)}
@media (min-width:700px){.eu-mapa-capa{align-items:center;padding:24px}.eu-mapa-hoja{border-radius:18px}}
.eu-mapa-cab{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 8px}
.eu-mapa-cab h2{margin:0;font-size:18px;line-height:1.2}
.eu-mapa-cab button{width:40px;height:40px;border:0;border-radius:50%;background:#eef1f5;color:inherit;font-size:22px;line-height:1;cursor:pointer}
.eu-mapa-ayuda{margin:0;padding:0 16px 10px;color:#59626e;font-size:14px}
.eu-mapa-mapa{height:min(58vh,460px);min-height:260px;background:#e8eaed}
.eu-mapa-pie{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px))}
.eu-mapa-pie button{min-height:46px;padding:0 16px;border-radius:12px;border:1.5px solid #cfd6df;background:#fff;color:inherit;font:inherit;font-weight:700;cursor:pointer}
.eu-mapa-pie .eu-mapa-listo{margin-left:auto;background:#1f7a4d;border-color:#1f7a4d;color:#fff}
.eu-mapa-pie button:disabled{opacity:.55;cursor:default}
.eu-mapa-error{margin:0;padding:0 16px 8px;color:#c2362f;font-size:14px;font-weight:700}
.eu-mapa-capa button:focus-visible{outline:3px solid #1f7a4d;outline-offset:2px}`;
    document.head.appendChild(st);
  }

  /* Abre el mapa y devuelve el punto elegido, o null si la persona cancela. */
  function elegir({ inicio, titulo = "Marca el punto en el mapa", ayuda = "Toca el mapa o arrastra el marcador hasta el lugar exacto." } = {}) {
    estilos();
    return new Promise((resolver) => {
      const antes = document.activeElement;
      const capa = document.createElement("div");
      capa.className = "eu-mapa-capa";
      capa.innerHTML = `<div class="eu-mapa-hoja" role="dialog" aria-modal="true" aria-labelledby="eu-mapa-tit">
        <div class="eu-mapa-cab"><h2 id="eu-mapa-tit"></h2><button type="button" class="eu-mapa-x" aria-label="Cerrar">×</button></div>
        <p class="eu-mapa-ayuda"></p><p class="eu-mapa-error" role="alert" hidden></p>
        <div class="eu-mapa-mapa">Cargando el mapa…</div>
        <div class="eu-mapa-pie"><button type="button" class="eu-mapa-gps">Usar mi ubicación</button><button type="button" class="eu-mapa-cancelar">Cancelar</button><button type="button" class="eu-mapa-listo" disabled>Usar este punto</button></div>
      </div>`;
      capa.querySelector("h2").textContent = titulo;
      capa.querySelector(".eu-mapa-ayuda").textContent = ayuda;
      const error = capa.querySelector(".eu-mapa-error");
      const listo = capa.querySelector(".eu-mapa-listo");
      const desborde = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.body.appendChild(capa);
      let mapa = null, marca = null, elegido = valido(inicio) ? punto(inicio.lat, inicio.lng) : null;

      function cerrar(valor) {
        document.removeEventListener("keydown", teclas);
        document.body.style.overflow = desborde;
        if (mapa) mapa.remove();
        capa.remove();
        if (antes && antes.focus) antes.focus();
        resolver(valor);
      }
      function teclas(e) { if (e.key === "Escape") cerrar(null); }
      document.addEventListener("keydown", teclas);
      capa.addEventListener("click", (e) => { if (e.target === capa) cerrar(null); });
      capa.querySelector(".eu-mapa-x").addEventListener("click", () => cerrar(null));
      capa.querySelector(".eu-mapa-cancelar").addEventListener("click", () => cerrar(null));
      listo.addEventListener("click", () => cerrar(elegido));
      capa.querySelector(".eu-mapa-x").focus();

      function poner(p, acercar) {
        elegido = punto(p.lat, p.lng);
        listo.disabled = false;
        error.hidden = true;
        if (!mapa) return;
        if (marca) marca.setLatLng([elegido.lat, elegido.lng]);
        else {
          marca = window.L.marker([elegido.lat, elegido.lng], { draggable: true, keyboard: true, title: "Punto elegido" }).addTo(mapa);
          marca.on("dragend", () => { const ll = marca.getLatLng(); elegido = punto(ll.lat, ll.lng); });
        }
        if (acercar) mapa.setView([elegido.lat, elegido.lng], Math.max(mapa.getZoom(), 16));
      }
      capa.querySelector(".eu-mapa-gps").addEventListener("click", (e) => {
        const b = e.currentTarget;
        b.disabled = true; b.textContent = "Buscando…";
        EU.geo.miUbicacion().then((p) => poner(p, true), (err) => { error.textContent = err.message; error.hidden = false; })
          .finally(() => { b.disabled = false; b.textContent = "Usar mi ubicación"; });
      });

      cargarLeaflet().then((L) => {
        if (!capa.isConnected) return;
        const caja = capa.querySelector(".eu-mapa-mapa");
        caja.textContent = "";
        L.Icon.Default.imagePath = LEAFLET + "images/";
        const centro = elegido || VENEZUELA;
        mapa = L.map(caja, { zoomControl: true }).setView([centro.lat, centro.lng], elegido ? 16 : 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        }).addTo(mapa);
        mapa.on("click", (e) => poner(e.latlng, false));
        if (elegido) poner(elegido, false);
        setTimeout(() => mapa && mapa.invalidateSize(), 60);
      }, (err) => { capa.querySelector(".eu-mapa-mapa").textContent = ""; error.textContent = err.message; error.hidden = false; });
    });
  }
})();
