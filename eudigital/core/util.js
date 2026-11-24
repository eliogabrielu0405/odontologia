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
