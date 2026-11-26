/* Utilidades de los paneles (el del cliente y el de EU Digital). */
(function () {
  "use strict";
  const EU = (window.EU = window.EU || {});
  const K = window.EU_CATALOGOS;

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  EU.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
  EU.url = (u) => {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^\/(?!\/)/.test(u)) return u;
    try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch (_) { return ""; }
  };
  // Versión chica (400 px) de las fotos que suben los dueños: "foto-g.webp" viene con "foto-p.webp".
  // Las listas del menú usan la chica (se descarga 4 o 5 veces menos); las vistas grandes, la original.
  const RE_GRANDE = /-g\.(webp|jpe?g|png)$/i;
  EU.miniatura = (u) => { const x = EU.url(u); return RE_GRANDE.test(x) ? x.replace(RE_GRANDE, "-p.$1") : x; };
  EU.color = (h) => (K && K.color.valido(h)) || "";
  EU.soloNumeros = (s) => String(s || "").replace(/\D+/g, "");
  EU.fmtBs = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  EU.usd = (n) => "$" + (Number(n) || 0).toFixed(2);
  EU.numero = (v) => {
    // Acepta "3,50", "3.50", "1.234,56" y "1,234.56"
    let s = String(v == null ? "" : v).trim().replace(/[^\d.,-]/g, "");
    if (!s) return NaN;
    const coma = s.lastIndexOf(","), punto = s.lastIndexOf(".");
    if (coma > -1 && punto > -1) s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (coma > -1) s = s.replace(",", ".");
    return Number(s);
  };
  EU.hora = (h) => {
    let [a, b] = String(h).split(":").map(Number);
    a = a % 24;
    const ap = a >= 12 ? "pm" : "am", hh = a % 12 || 12;
    return hh + (b ? ":" + String(b).padStart(2, "0") : "") + " " + ap;
  };
  EU.telefonoVisible = (w) => {
    w = EU.soloNumeros(w);
    return w.startsWith("58") && w.length === 12 ? "0" + w.slice(2, 5) + "-" + w.slice(5) : w;
  };

  /* Fechas: el negocio vive en Venezuela, así que "hoy" es hoy en Caracas */
  EU.hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
  EU.fecha = (iso, conAnio) => {
    if (!iso) return "";
    const d = new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-VE", { day: "numeric", month: "long", year: conAnio ? "numeric" : undefined, timeZone: "America/Caracas" });
  };
  EU.fechaHora = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-VE", { day: "numeric", month: "short", timeZone: "America/Caracas" }) + ", " +
      d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", timeZone: "America/Caracas" });
  };
  EU.diasHasta = (iso) => {
    if (!iso) return null;
    const a = new Date(EU.hoyISO() + "T12:00:00"), b = new Date(String(iso).slice(0, 10) + "T12:00:00");
    return Math.round((b - a) / 86400000);
  };
  EU.sumarMeses = (iso, n) => {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const ultimo = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, ultimo));
    return t.toISOString().slice(0, 10);
  };

  /* Estado de una suscripción a partir del vencimiento */
  EU.estadoCuenta = function (sitio, cuenta, diasGracia) {
    const vence = cuenta && cuenta.vence;
    const dias = EU.diasHasta(vence);
    // Prueba gratis: cuenta los días que quedan y, al terminar, pide elegir un plan
    if (cuenta && cuenta.plan === "prueba") {
      if (sitio.estado === "suspendido" || (dias != null && dias < 0)) {
        return { id: sitio.estado === "suspendido" ? "suspendida" : "vencida", sello: "Prueba terminada", tono: "rojo", prueba: true,
          texto: sitio.estado === "suspendido" ? "Tu prueba gratis terminó y tu página no se ve. Elige un plan para activarla: todo lo que cargaste sigue guardado." : "Tu prueba gratis terminó. Elige un plan para que tu página siga en línea." };
      }
      return { id: dias != null && dias <= 5 ? "porvencer" : "activa", sello: "Prueba gratis", tono: dias != null && dias <= 3 ? "ambar" : "azul", prueba: true,
        texto: dias == null ? "Estás en la prueba gratis." : dias === 0 ? "Hoy es el último día de tu prueba gratis." : `Te ${dias === 1 ? "queda 1 día" : "quedan " + dias + " días"} de prueba gratis.` };
    }
    if (sitio.estado === "suspendido") return { id: "suspendida", sello: "Suspendida", tono: "rojo", texto: "La página no se ve. Reporta tu pago para activarla." };
    if (dias == null) return { id: "activa", sello: "Activa", tono: "verde", texto: "Sin fecha de vencimiento." };
    if (dias < 0) return { id: "vencida", sello: "Vencida", tono: "rojo", texto: `Venció hace ${-dias} día${dias === -1 ? "" : "s"}. ${diasGracia != null ? "Se suspende si no se paga pronto." : ""}`.trim() };
    if (dias <= 5) return { id: "porvencer", sello: "Por vencer", tono: "ambar", texto: dias === 0 ? "Vence hoy." : `Vence en ${dias} día${dias === 1 ? "" : "s"}.` };
    return { id: "activa", sello: "Activa", tono: "verde", texto: `Pagada hasta el ${EU.fecha(vence)}.` };
  };

  /* DOM */
  EU.h = function (tag, props, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === "class") e.className = v;
      else if (k === "style") e.style.cssText = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "value") e.value = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k in e && typeof v !== "string" && k !== "list") e[k] = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const x of hijos.flat(Infinity)) if (x != null && x !== false) e.append(x.nodeType ? x : String(x));
    return e;
  };
  EU.copiar = async function (texto, boton) {
    const viejo = boton ? boton.textContent : "";
    try { await navigator.clipboard.writeText(texto); if (boton) boton.textContent = "Copiado"; }
    catch (_) { if (boton) boton.textContent = "No se pudo copiar"; }
    if (boton) setTimeout(() => { boton.textContent = viejo; }, 1500);
  };
  EU.clonar = (o) => JSON.parse(JSON.stringify(o));
  EU.obtener = (obj, ruta) => String(ruta).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  EU.poner = function (obj, ruta, valor) {
    const ks = String(ruta).split(".");
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = valor;
  };
  EU.slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
  EU.claveAzar = function (n = 10) {
    const letras = "abcdefghjkmnpqrstuvwxyz23456789";
    const a = new Uint32Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, (x) => letras[x % letras.length]).join("");
  };
})();
