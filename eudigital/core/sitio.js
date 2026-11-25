/* Motor de las páginas de los clientes.
   Carga los datos del negocio, aplica el tema, las animaciones y los avisos,
   y entrega todo a la plantilla con EU.alListo(function (sitio) { ... }). */
(function () {
  "use strict";
  const C = window.EU_CONFIG;
  const K = window.EU_CATALOGOS;
  const EU = (window.EU = window.EU || {});
  const BASE = C.supabaseUrl.replace(/\/+$/, "");
  const PLANTILLA = document.documentElement.dataset.plantilla;
  const P = (window.EU_PLANTILLAS || {})[PLANTILLA] || { defaults: K.contenidoBase };
  const params = new URLSearchParams(location.search);
  const enPanel = params.get("vista") === "borrador" && window.parent !== window;
  // En las demos, ?prueba=Nombre muestra la plantilla con el nombre del negocio de quien la mira
  // (lo usa "Mira tu negocio aquí" de la portada). Solo cambia el nombre, nunca una página real.
  const nombrePrueba = String(params.get("prueba") || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  EU.reducido = reducido;
  EU.enPanel = enPanel;
  EU.plantilla = P;

  /* ---------- Seguridad: todo lo que escribe el cliente pasa por aquí ---------- */
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  EU.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
  EU.url = (u) => {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^\/(?!\/)/.test(u)) return u;
    try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch (_) { return ""; }
  };
  EU.color = (h) => K.color.valido(h) || "";
  EU.soloNumeros = (s) => String(s || "").replace(/\D+/g, "");

  /* ---------- Dinero ---------- */
  const fmtBs = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  EU.usd = (n) => "$" + (Number(n) || 0).toFixed(2);
  EU.tasa = () => { const t = EU.sitio && Number(EU.sitio.c.tasa && EU.sitio.c.tasa.valor); return t > 0 ? t : 0; };
  EU.bs = (n) => (EU.tasa() > 0 ? "Bs " + fmtBs.format((Number(n) || 0) * EU.tasa()) : "");
  EU.bsNumero = (n) => fmtBs.format((Number(n) || 0) * EU.tasa());
  EU.fmtBs = fmtBs;

  /* ---------- WhatsApp ---------- */
  EU.whatsapp = () => EU.soloNumeros(EU.sitio && EU.sitio.c.negocio.whatsapp);
  EU.wa = (texto) => "https://wa.me/" + EU.whatsapp() + "?text=" + encodeURIComponent(texto);
  EU.telefonoVisible = () => {
    const n = EU.sitio.c.negocio;
    if (n.telefono) return n.telefono;
    const w = EU.whatsapp();
    return w.startsWith("58") ? "0" + w.slice(2, 5) + "-" + w.slice(5) : w;
  };

  /* ---------- Horario ---------- */
  const aMin = (h) => { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); };
  EU.hora = (h) => {
    let [a, b] = String(h).split(":").map(Number);
    a = a % 24;
    const ap = a >= 12 ? "pm" : "am", hh = a % 12 || 12;
    return hh + (b ? ":" + String(b).padStart(2, "0") : "") + " " + ap;
  };
  EU.estado = function () {
    const c = EU.sitio.c;
    if (c.hoy.cerrado) return { abierto: false, texto: "Cerrado por hoy" };
    const H = c.negocio.horario || {};
    const dia = (d) => { const v = H[d] || H[String(d)]; return Array.isArray(v) && v.length === 2 && v[0] && v[1] ? v : null; };
    const ahora = new Date(), d = ahora.getDay(), m = ahora.getHours() * 60 + ahora.getMinutes();
    const ayer = dia((d + 6) % 7);
    if (ayer && aMin(ayer[1]) <= aMin(ayer[0]) && m < aMin(ayer[1])) return { abierto: true, texto: "Abierto hasta las " + EU.hora(ayer[1]) };
    const hoy = dia(d);
    if (hoy) {
      const a = aMin(hoy[0]), z = aMin(hoy[1]);
      const abierto = z > a ? m >= a && m < z : m >= a || m < z;
      if (abierto) return { abierto: true, texto: "Abierto hasta las " + EU.hora(hoy[1]) };
      if (m < a) return { abierto: false, texto: "Cerrado, abre hoy a las " + EU.hora(hoy[0]) };
    }
    for (let i = 1; i <= 7; i++) {
      const n = dia((d + i) % 7);
      if (n) return { abierto: false, texto: "Cerrado, abre " + (i === 1 ? "mañana" : "el " + K.dias[(d + i) % 7].toLowerCase()) + " a las " + EU.hora(n[0]) };
    }
    return { abierto: false, texto: "Cerrado" };
  };

  /* ---------- Formas de pago ---------- */
  const conDatos = (m) => (m.datos || []).filter((d) => d && d[0] && String(d[1] || "").trim());
  EU.pagos = {
    // tipo: "delivery" usa los marcados para delivery; cualquier otro, los del local
    disponibles(tipo) { return (EU.sitio.c.pagos || []).filter((m) => m && m.nombre && (tipo === "delivery" ? m.delivery !== false : m.local !== false)); },
    html(tipo, elegido, nombre = "eu-pago") {
      const lista = EU.pagos.disponibles(tipo);
      if (!lista.length) return "";
      return '<fieldset class="eu-pago"><legend>Forma de pago</legend><div class="eu-pago-opciones">' +
        lista.map((m) => `<label class="eu-pago-op"><input type="radio" name="${nombre}" value="${EU.esc(m.id)}"${m.id === elegido ? " checked" : ""}><span>${EU.esc(m.nombre)}</span></label>`).join("") +
        "</div></fieldset>";
    },
    detalle(id, total) {
      const m = (EU.sitio.c.pagos || []).find((x) => x.id === id);
      if (!m) return "";
      const filas = [];
      if (total > 0) {
        if (m.bs && EU.tasa() > 0) filas.push(["Monto", EU.bs(total), EU.bsNumero(total)]);
        else filas.push(["Monto", EU.usd(total) + (EU.tasa() > 0 && id === "efectivo" ? " · " + EU.bs(total) : ""), id === "efectivo" ? null : (Number(total) || 0).toFixed(2)]);
      }
      conDatos(m).forEach((d) => filas.push([d[0], d[1], d[1]]));
      return `<div class="eu-pago-detalle"><b>${EU.esc(m.nombre)}</b>` +
        filas.map(([k, v, copiar]) => `<div class="eu-pago-fila"><span>${EU.esc(k)}</span><code>${EU.esc(v)}</code>${copiar != null ? `<button type="button" data-eu-copiar="${EU.esc(copiar)}">Copiar</button>` : ""}</div>`).join("") +
        (m.nota ? `<p>${EU.esc(m.nota)}</p>` : "") + "</div>";
    },
    lineas(id, total) {
      const m = (EU.sitio.c.pagos || []).find((x) => x.id === id);
      const out = [];
      if (m) out.push("Pago: " + m.nombre);
      if (EU.tasa() > 0 && total > 0) out.push("Total en bolívares: " + EU.bs(total) + " (tasa " + fmtBs.format(EU.tasa()) + ")");
      return out;
    },
  };
  EU.costoDelivery = () => Math.max(0, Number(EU.sitio.c.pedidos.delivery) || 0);

  /* ---------- Registro de pedidos para las estadísticas del panel del dueño ----------
     Cada plantilla lo llama justo antes de abrir WhatsApp. Solo guarda productos, total,
     tipo de entrega y forma de pago. Si falla, el pedido sigue su camino igual. */
  EU.registrarPedido = function ({ items = [], total = 0, tipo = "", pago = "" } = {}) {
    try {
      const s = EU.sitio;
      if (!s || s.demo || !s.id || enPanel) return;
      const lista = (items || []).filter((it) => it && String(it.nombre || "").trim()).slice(0, 60).map((it) => ({
        nombre: String(it.nombre).trim().slice(0, 120),
        cantidad: Math.max(1, Math.round(Number(it.cantidad) || 1)),
        precio: Math.max(0, Math.round((Number(it.precio) || 0) * 100) / 100),
      }));
      if (!lista.length) return;
      const metodo = (s.c.pagos || []).find((m) => m && m.id === pago);
      const datos = {
        p_sitio: s.id, p_items: lista, p_total: Math.max(0, Math.round((Number(total) || 0) * 100) / 100),
        p_tipo: String(tipo || "").slice(0, 40) || null, p_pago: String((metodo && metodo.nombre) || pago || "").slice(0, 60) || null,
      };
      // Si el cliente toca "enviar" dos veces con el mismo pedido, cuenta una sola vez
      const huella = JSON.stringify([lista, datos.p_total, datos.p_tipo]);
      try {
        const clave = "eu:pedido:" + s.id;
        const antes = JSON.parse(sessionStorage.getItem(clave) || "null");
        if (antes && antes.h === huella && Date.now() - antes.t < 10 * 60000) return;
        sessionStorage.setItem(clave, JSON.stringify({ h: huella, t: Date.now() }));
      } catch (_) { /* sin almacenamiento: se registra igual */ }
      fetch(BASE + "/rest/v1/rpc/eu_registrar_pedido", {
        method: "POST", keepalive: true,
        headers: { apikey: C.supabaseKey, Authorization: "Bearer " + C.supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      }).catch(() => { /* sin conexión: no pasa nada */ });
    } catch (_) { /* las estadísticas nunca deben estorbar un pedido */ }
  };

  /* ---------- Redes sociales ---------- */
  // Aceptan "@usuario", "usuario" o el enlace del perfil. Devuelve solo las que tienen algo.
  const NO_ES_USUARIO = ["channel", "c", "user", "profile.php", "pages", "groups", "share", "p", "reel", "watch", "people"];
  EU.redes = function () {
    const n = (EU.sitio && EU.sitio.c.negocio) || {};
    return (K.redes || []).map((r) => {
      const v = String(n[r.id] || "").trim();
      if (!v) return null;
      let href = "", usuario = "";
      if (/^(https?:\/\/|www\.)/i.test(v) || /^[\w-]+(\.[\w-]+)+\//.test(v)) {
        href = EU.url(/^https?:/i.test(v) ? v : "https://" + v);
        if (!href) return null;
        try {
          const seg = new URL(href).pathname.split("/").filter(Boolean)[0] || "";
          if (/^@?[\w.-]+$/.test(seg) && !NO_ES_USUARIO.includes(seg.toLowerCase())) usuario = seg.replace(/^@/, "");
        } catch (_) { /* enlace raro: se muestra sin usuario */ }
      } else {
        usuario = v.replace(/^@+/, "").replace(/\s+/g, "");
        if (!usuario) return null;
        href = r.base + encodeURIComponent(usuario);
      }
      return { id: r.id, nombre: r.nombre, corto: r.corto || r.nombre, href, usuario };
    }).filter(Boolean);
  };
  // Fila de botones de redes. Instagram muestra el @ porque es por donde más los buscan.
  EU.htmlRedes = function ({ titulo = "" } = {}) {
    let lista = EU.redes(), muestra = false;
    if (!lista.length && EU.sitio && EU.sitio.demo && !enPanel) {
      lista = [{ id: "instagram", corto: "Instagram", usuario: "tunegocio" }, { id: "tiktok", corto: "TikTok" }, { id: "facebook", corto: "Facebook" }];
      muestra = true;
    }
    if (!lista.length) return "";
    const boton = (r) => {
      const dentro = `<b>${EU.esc(r.corto)}</b>${r.id === "instagram" && r.usuario ? `<small>@${EU.esc(r.usuario)}</small>` : ""}`;
      return muestra
        ? `<span class="eu-red-pill">${dentro}</span>`
        : `<a class="eu-red-pill" href="${EU.esc(r.href)}" target="_blank" rel="noopener">${dentro}</a>`;
    };
    return (titulo ? `<span class="eu-redes-tit">${EU.esc(titulo)}</span>` : "") + lista.map(boton).join("");
  };
  EU.pintarRedes = function (raiz = document) {
    raiz.querySelectorAll("[data-eu-redes]").forEach((el) => {
      el.innerHTML = EU.htmlRedes({ titulo: el.getAttribute("data-eu-redes") || "" });
    });
  };

  /* ---------- Bloque "El local": horario, dirección, redes y pagos ---------- */
  EU.htmlInfo = function ({ titulo = "El local", redes: conRedes = true } = {}) {
    const c = EU.sitio.c, n = c.negocio, est = EU.estado();
    const hoy = new Date().getDay();
    const H = n.horario || {};
    const filasHorario = [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const v = H[d] || H[String(d)];
      const txt = Array.isArray(v) && v[0] ? EU.hora(v[0]) + " a " + EU.hora(v[1]) : "Cerrado";
      return `<div class="${d === hoy ? "eu-hoy" : ""}"><span>${K.dias[d]}</span><span>${txt}</span></div>`;
    }).join("");
    const dir = [n.direccion, n.ciudad].filter(Boolean).join(", ");
    const mapa = EU.url(n.mapa) || (dir ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(dir) : "");
    const redes = !conRedes ? "" : EU.redes().map((r) =>
      `<a class="eu-red" href="${EU.esc(r.href)}" target="_blank" rel="noopener"><b>${EU.esc(r.nombre)}</b><span>${EU.esc(r.usuario ? "@" + r.usuario : "Ver perfil")}</span></a>`).join("");
    const pagos = (c.pagos || []).filter((m) => m && m.nombre).map((m) => `<span class="eu-chip">${EU.esc(m.nombre)}</span>`).join("");
    return `<section class="eu-info" aria-label="${EU.esc(titulo)}">
      <div class="eu-info-col"><h3>Horario</h3><p class="eu-estado ${est.abierto ? "abierto" : "cerrado"}">${EU.esc(est.texto)}</p><div class="eu-horario">${filasHorario}</div></div>
      ${dir ? `<div class="eu-info-col"><h3>Dónde estamos</h3><p>${EU.esc(dir)}</p>${n.referencia ? `<p class="eu-suave">${EU.esc(n.referencia)}</p>` : ""}${mapa ? `<a class="eu-boton-sec" href="${EU.esc(mapa)}" target="_blank" rel="noopener">Cómo llegar</a>` : ""}</div>` : ""}
      ${pagos ? `<div class="eu-info-col"><h3>Formas de pago</h3><div class="eu-chips">${pagos}</div>${EU.tasa() > 0 ? `<p class="eu-suave">Tasa del día: Bs ${fmtBs.format(EU.tasa())} por dólar</p>` : ""}</div>` : ""}
      ${redes || EU.whatsapp() ? `<div class="eu-info-col"><h3>Contacto</h3>${EU.whatsapp() ? `<a class="eu-red" href="https://wa.me/${EU.whatsapp()}" target="_blank" rel="noopener"><b>WhatsApp</b><span>${EU.esc(EU.telefonoVisible())}</span></a>` : ""}${redes}</div>` : ""}
    </section>`;
  };

  /* ---------- Datos del negocio ---------- */
  function identificar() {
    const n = (params.get("n") || params.get("negocio") || "").trim().toLowerCase();
    if (n) return { slug: n };
    const host = location.hostname.toLowerCase();
    /* Las direcciones gratis de Cloudflare, Vercel y Netlify son de la plataforma, no de un cliente. */
    if (!host || host === "localhost" || host === "127.0.0.1" || /\.((workers|pages)\.dev|vercel\.app|netlify\.app)$/.test(host)) return null;
    if (C.dominioBase) {
      if (host === C.dominioBase || host === "www." + C.dominioBase) return null;
      if (host.endsWith("." + C.dominioBase)) {
        const sub = host.slice(0, -(C.dominioBase.length + 1));
        return sub && !sub.includes(".") && !["www", "app", "panel", "admin"].includes(sub) ? { slug: sub } : null;
      }
    }
    return { dominio: host.replace(/^www\./, "") };
  }
  EU.identificar = identificar;

  function pedirBorrador() {
    return new Promise((ok) => {
      const t = setTimeout(() => { removeEventListener("message", f); ok(null); }, 6000);
      function f(e) {
        if (e.origin !== location.origin || !e.data || e.data.tipo !== "eu:borrador") return;
        removeEventListener("message", f);
        clearTimeout(t);
        ok(e.data.sitio || null);
      }
      addEventListener("message", f);
      parent.postMessage({ tipo: "eu:pedir-borrador" }, location.origin);
    });
  }

  async function cargar() {
    if (enPanel) {
      const b = await pedirBorrador();
      if (b) return b;
    }
    const id = identificar();
    if (!id) return { demo: true };
    const clave = "eu:sitio:" + (id.slug || id.dominio);
    try {
      const g = JSON.parse(sessionStorage.getItem(clave));
      sessionStorage.removeItem(clave);
      if (g && Date.now() - g.t < 15000 && g.sitio) return g.sitio;
    } catch (_) { /* sin almacenamiento */ }
    const filtro = id.slug ? "slug=eq." + encodeURIComponent(id.slug) : "dominio=eq." + encodeURIComponent(id.dominio);
    const res = await fetch(BASE + "/rest/v1/eu_sitios?select=id,slug,nombre,plantilla,contenido,actualizado&estado=eq.activo&limit=1&" + filtro, {
      headers: { apikey: C.supabaseKey, Authorization: "Bearer " + C.supabaseKey },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("http " + res.status);
    const filas = await res.json();
    return filas[0] || null;
  }

  /* ---------- Pantallas de "no disponible" ---------- */
  function pantalla(tipo) {
    document.documentElement.classList.add("eu-sin-pagina");
    const txt = {
      "no-disponible": ["Esta página no está disponible", "Si eres el dueño del negocio, escríbele a EU Digital."],
      "sin-red": ["No pudimos cargar la página", "Revisa tu conexión a internet y vuelve a intentar."],
    }[tipo];
    document.body.innerHTML = `<main class="eu-pantalla"><h1>${txt[0]}</h1><p>${txt[1]}</p>${tipo === "sin-red" ? '<button type="button" onclick="location.reload()">Intentar de nuevo</button>' : ""}</main>`;
    document.title = txt[0];
  }

  /* ---------- Tema ---------- */
  EU.aplicarTema = function (tema) {
    const raiz = document.documentElement;
    (EU._varsTema || []).forEach((v) => raiz.style.removeProperty(v));
    EU._varsTema = [];
    const poner = (vars) => { for (const [k, v] of Object.entries(vars || {})) { if (!v) continue; raiz.style.setProperty(k, v); EU._varsTema.push(k); } };
    const temas = P.temas || [];
    const preset = temas.find((t) => t.id === tema.preset) || temas[0];
    let modo = tema.modo || (preset && preset.modo) || "";
    if (preset && preset !== temas[0]) poner(preset.vars);
    const col = tema.colores || {};
    const limpios = { principal: EU.color(col.principal), acento: EU.color(col.acento), fondo: EU.color(col.fondo) };
    if ((limpios.principal || limpios.acento || limpios.fondo) && P.colorear) {
      poner(P.colorear(limpios, K.color));
      if (limpios.fondo) modo = K.color.luz(limpios.fondo) > 0.35 ? "light" : "dark";
    }
    if (modo === "claro") modo = "light";
    if (modo === "oscuro") modo = "dark";
    if (modo === "light" || modo === "dark") raiz.dataset.theme = modo; else delete raiz.dataset.theme;
    const f = K.fuentes.find((x) => x.id === tema.fuente && x.css);
    if (f && P.varFuente) {
      if (!document.getElementById("eu-fuente-" + f.id)) {
        const l = document.createElement("link");
        l.rel = "stylesheet"; l.id = "eu-fuente-" + f.id;
        l.href = "https://fonts.googleapis.com/css2?family=" + f.css + "&display=swap";
        document.head.appendChild(l);
      }
      [].concat(P.varFuente).forEach((v) => { raiz.style.setProperty(v, f.familia); EU._varsTema.push(v); });
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && limpios.principal) meta.content = limpios.principal;
  };

  /* ---------- Avisos de arriba: cerrado, aviso del día y promoción ---------- */
  function tiras(c) {
    const lugar = document.querySelector("[data-eu-avisos]");
    const caja = document.createElement("div");
    caja.className = "eu-tiras";
    const est = EU.estado();
    let html = "";
    if (EU.sitio.demo && !enPanel) {
      html += EU.sitio.prueba
        ? `<div class="eu-tira eu-tira-demo">Así se vería la página de ${EU.esc(EU.sitio.nombre)}. <a href="/registro/?plantilla=${encodeURIComponent(PLANTILLA)}&amp;nombre=${encodeURIComponent(EU.sitio.nombre)}" target="_top">Créala gratis con tu menú</a></div>`
        : `<div class="eu-tira eu-tira-demo">Esta es una página de muestra de ${EU.esc(C.marca || "EU Digital")}. <a href="/registro/?plantilla=${encodeURIComponent(PLANTILLA)}">Pruébala gratis con tu negocio</a></div>`;
    }
    if (!est.abierto) html += `<div class="eu-tira eu-tira-cerrado" role="status"><b>${EU.esc(est.texto)}.</b> Puedes dejar tu pedido y te respondemos apenas abramos.</div>`;
    if (c.hoy.aviso) html += `<div class="eu-tira eu-tira-aviso" role="status">${EU.esc(c.hoy.aviso)}</div>`;
    const temp = K.temporada.find((t) => t.id === c.animaciones.temporada);
    const textoBanner = c.banner.texto || (temp && temp.saludo) || "";
    if (textoBanner) {
      const estilo = ["fijo", "desliza", "parpadea"].includes(c.banner.estilo) ? c.banner.estilo : "fijo";
      const t = EU.esc(textoBanner);
      html += estilo === "desliza" && !reducido
        ? `<div class="eu-tira eu-tira-promo eu-desliza" aria-label="${t}"><div class="eu-desliza-pista" aria-hidden="true">${("<span>" + t + "</span>").repeat(6)}</div></div>`
        : `<div class="eu-tira eu-tira-promo eu-${estilo}">${t}</div>`;
    }
    if (!html) return;
    caja.innerHTML = html;
    if (lugar) lugar.appendChild(caja);
    else document.body.prepend(caja);
  }

  /* ---------- Animaciones ---------- */
  const PARTICULAS = {
    petalos: { n: 16, clase: "petalo" },
    confeti: { n: 22, clase: "confeti" },
    nieve: { n: 18, clase: "copo" },
    corazones: { n: 12, clase: "corazon", texto: "♥" },
    burbujas: { n: 14, clase: "burbuja", sube: true },
    estrellas: { n: 16, clase: "estrella", fijas: true, texto: "✦" },
  };
  function lluvia(caja, tipo, emojis, cuantos) {
    const def = PARTICULAS[tipo] || { n: 14, clase: "emoji" };
    const lista = tipo === "emojis" ? Array.from(emojis || "🍕").filter((ch) => ch.trim()) : null;
    const capa = document.createElement("div");
    capa.className = "eu-particulas eu-p-" + tipo;
    capa.setAttribute("aria-hidden", "true");
    const total = cuantos || def.n;
    for (let i = 0; i < total; i++) {
      const s = document.createElement("span");
      s.className = "eu-p " + def.clase;
      if (lista && lista.length) s.textContent = lista[i % lista.length];
      else if (def.texto) s.textContent = def.texto;
      s.style.left = ((i * 61 + 7) % 100) + "%";
      if (def.fijas) s.style.top = ((i * 37 + 13) % 90) + "%";
      s.style.setProperty("--d", (def.fijas ? 2 + (i % 4) : 7 + (i % 6) * 1.6) + "s");
      s.style.setProperty("--r", -((i * 1.37) % 9).toFixed(2) + "s");
      s.style.setProperty("--x", ((i % 2 ? 1 : -1) * (10 + (i % 5) * 9)) + "px");
      s.style.setProperty("--s", (0.6 + (i % 4) * 0.18).toFixed(2));
      if (tipo === "confeti") s.style.background = ["var(--eu-principal,#e11)", "var(--eu-acento,#fc0)", "#2bb673", "#3a7bd5", "#ff8fb1"][i % 5];
      capa.appendChild(s);
    }
    caja.appendChild(capa);
    return capa;
  }

  function animaciones(c) {
    const a = c.animaciones || {}, raiz = document.documentElement;
    raiz.classList.add("eu-logo-" + (a.logo || "ninguna"), "eu-boton-" + (a.boton || "ninguna"));
    if (reducido) return;
    const portada = document.querySelector("[data-eu-portada]");
    if (portada && a.portada && a.portada !== "ninguna" && (PARTICULAS[a.portada] || a.portada === "emojis")) {
      portada.classList.add("eu-con-particulas");
      lluvia(portada, a.portada, a.emoji);
    }
    const temp = { navidad: ["nieve"], anonuevo: ["confeti"], carnaval: ["confeti"], sanvalentin: ["corazones"], madres: ["emojis", "🌸🌷💐"], halloween: ["emojis", "🎃🦇👻"] }[a.temporada];
    if (temp) {
      const capa = document.createElement("div");
      capa.className = "eu-temporada eu-t-" + a.temporada;
      document.body.appendChild(capa);
      lluvia(capa, temp[0], temp[1], 14);
    }
    if (a.productos && a.productos !== "ninguna" && "IntersectionObserver" in window) {
      const tipo = a.productos;
      const io = new IntersectionObserver((ents) => {
        let k = 0;
        ents.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          el.style.transitionDelay = Math.min(k++, 5) * 60 + "ms";
          el.classList.add("eu-visto");
          setTimeout(() => { el.style.transitionDelay = ""; }, 900);
          io.unobserve(en.target);
        });
      }, { rootMargin: "0px 0px -8% 0px" });
      const marcar = (raizBusqueda) => raizBusqueda.querySelectorAll("[data-eu-producto]:not(.eu-rev)").forEach((el) => { el.classList.add("eu-rev", "eu-rev-" + tipo); io.observe(el); });
      marcar(document);
      new MutationObserver(() => marcar(document)).observe(document.body, { childList: true, subtree: true });
    }
  }

  /* ---------- Mascota bailarina ----------
     El dueño elige el personaje y el baile en su panel. Las plantillas con un lugar propio para ella
     lo marcan con data-eu-mascota; en las demás sale flotando en una esquina. */
  EU.mascota = function () {
    const M = window.EU_MASCOTAS, s = EU.sitio;
    if (!M || !s) return null;
    const a = s.c.animaciones || {};
    let personaje = a.personaje || (a.mascota === false ? "ninguna" : P.mascota || (s.demo && !enPanel ? P.mascotaDemo : "") || "ninguna");
    if (!M.existe(personaje)) personaje = "ninguna";
    return { personaje, baile: M.hayBaile(a.baile) ? a.baile : "meneo" };
  };
  EU.pintarMascotas = function () {
    const m = EU.mascota(), M = window.EU_MASCOTAS, raiz = document.documentElement;
    if (!m || m.personaje === "ninguna") { raiz.classList.add("eu-sin-mascota"); return; }
    let lugares = [...document.querySelectorAll("[data-eu-mascota]")];
    if (!lugares.length) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "eu-mascota-flota"; b.setAttribute("data-eu-mascota", "");
      b.setAttribute("aria-label", "Mascota bailarina, tócala para que salte");
      document.body.appendChild(b);
      lugares = [b];
    }
    lugares.forEach((el) => {
      el.classList.add("eu-mascota", "eu-baile-" + m.baile);
      if (el instanceof SVGElement) { el.setAttribute("viewBox", "0 0 200 220"); el.innerHTML = M.interior(m.personaje); }
      else el.innerHTML = M.svg(m.personaje);
    });
  };
  // Tres saltos de fiesta: al tocarla y cuando el cliente agrega algo al pedido
  EU.mascotaBrinca = function () {
    document.querySelectorAll("[data-eu-mascota]").forEach((el) => {
      el.classList.remove("eu-m-brinca"); void el.getBoundingClientRect(); el.classList.add("eu-m-brinca");
      clearTimeout(el._euBrinca); el._euBrinca = setTimeout(() => el.classList.remove("eu-m-brinca"), 1600);
    });
  };
  document.addEventListener("click", (e) => { if (e.target.closest("button[data-eu-mascota]:not([data-dancer])")) EU.mascotaBrinca(); });

  /* ---------- Copiar datos de pago ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-eu-copiar]");
    if (!b) return;
    const txt = b.dataset.euCopiar;
    const viejo = b.textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = "Copiado"; }
    catch (_) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling || b); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Mantén presionado"; }
    setTimeout(() => { b.textContent = viejo; }, 1600);
  });

  /* ---------- Vista previa dentro del panel ---------- */
  if (enPanel) {
    addEventListener("message", (e) => {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.tipo === "eu:recargar") {
        try { sessionStorage.setItem("eu:scroll", String(scrollY)); } catch (_) { /* nada */ }
        location.reload();
      }
      if (e.data.tipo === "eu:tema" && EU.sitio) EU.aplicarTema(e.data.tema);
    });
    // Los enlaces de la vista previa no deben sacar al cliente del panel
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (a && /^https?:/i.test(a.getAttribute("href")) && !a.href.startsWith(location.origin)) { e.preventDefault(); }
    }, true);
  }

  /* ---------- Arranque ---------- */
  const pendientes = [];
  EU.alListo = (fn) => { if (EU.sitio && EU._listo) fn(EU.sitio); else pendientes.push(fn); };

  async function iniciar() {
    let datos;
    try { datos = await cargar(); }
    catch (_) { pantalla("sin-red"); return; }
    if (datos === null) { pantalla("no-disponible"); return; }
    const sitio = datos.demo
      ? { id: null, slug: null, nombre: (!enPanel && nombrePrueba) || P.nombreDemo || P.nombre || "Mi negocio", plantilla: PLANTILLA, demo: true, prueba: !enPanel && !!nombrePrueba, contenido: {} }
      : datos;
    if (sitio.plantilla && PLANTILLA && sitio.plantilla !== PLANTILLA && !enPanel) {
      location.replace("/t/" + encodeURIComponent(sitio.plantilla) + "/" + location.search);
      return;
    }
    sitio.c = K.combinar(P.defaults || K.contenidoBase, sitio.contenido || {});
    // En la muestra, los pedidos de prueba llegan al WhatsApp de EU Digital
    if (sitio.demo && !EU.soloNumeros(sitio.c.negocio.whatsapp)) sitio.c.negocio.whatsapp = C.whatsappMarca || "";
    EU.sitio = sitio;
    document.title = sitio.nombre + (sitio.c.negocio.eslogan ? " · " + sitio.c.negocio.eslogan : "");
    EU.aplicarTema(sitio.c.tema || {});
    tiras(sitio.c);
    EU._listo = true;
    for (const fn of pendientes.splice(0)) {
      try { fn(sitio); } catch (err) { console.error(err); }
    }
    EU.pintarRedes();
    EU.pintarMascotas();
    animaciones(sitio.c);
    if (enPanel) {
      try {
        const y = Number(sessionStorage.getItem("eu:scroll"));
        sessionStorage.removeItem("eu:scroll");
        if (y) requestAnimationFrame(() => scrollTo(0, y));
      } catch (_) { /* nada */ }
      parent.postMessage({ tipo: "eu:montado" }, location.origin);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else setTimeout(iniciar, 0);
})();
