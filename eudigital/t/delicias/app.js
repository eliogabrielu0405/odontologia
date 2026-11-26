/* Plantilla Delicias (plan Premium): menú moderno de comida rápida.
   Buscador, «Lo más pedido», franjas con foto por categoría, hoja para elegir la opción (carne, pollo…)
   y los adicionales (con doble o triple porción), sugerencias dentro del pedido y envío por WhatsApp.
   En el teléfono el pedido sube en una hoja de dos pasos; en la computadora queda en una columna fija. */
EU.alListo(function (sitio) {
  "use strict";
  /* Si el navegador todavía tiene guardado el código común de antes, la página funciona igual,
     solo que sin recordar al cliente ni promociones. Nunca debe quedar en blanco por eso. */
  const memoria = EU.cliente || { datos: () => ({}), ultimo: () => null, recordar() {}, olvidar() {} };
  const ofertas = EU.promos || {
    calcular: () => ({ monto: 0, texto: "" }), lineas: () => [],
    caja: () => Object.assign(document.createElement("div"), { hidden: true, actualizar() {} }),
  };
  const envio = EU.envio || null; // delivery por distancia y ubicación del cliente
  const c = sitio.c;
  const $ = (id) => document.getElementById(id);
  const usd = EU.usd;
  const tr = (s) => (EU.t ? EU.t(s) : s);
  const NOTA_MAX = 200;
  const LINEA = "----------------------------------------";
  const MAX_EXTRAS = 8;
  const MAX_POR_EXTRA = 3;
  const ES_ESCRITORIO = () => matchMedia("(min-width: 1024px)").matches;
  const SIN_MOVIMIENTO = () => EU.reducido || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AHORRO_DATOS = !!(navigator.connection && navigator.connection.saveData);
  const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const limpiar = (t, max) => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, max);
  const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  try { history.scrollRestoration = "manual"; } catch (_) { /* nada */ } // el botón Atrás cierra hojas: que no mueva la página

  textosPropios();

  /* ───────── Construir HTML sin innerHTML (lo que escribe el dueño nunca se interpreta como código) ───────── */
  const aplanar = (x, out) => { if (Array.isArray(x)) x.forEach((y) => aplanar(y, out)); else if (x != null && x !== false && x !== "") out.push(x); return out; };
  function poner(el, ...hijos) { aplanar(hijos, []).forEach((x) => el.appendChild(x instanceof Node ? x : document.createTextNode(String(x)))); return el; }
  function reemplazar(el, ...hijos) { while (el.firstChild) el.removeChild(el.firstChild); return poner(el, ...hijos); }
  function h(etiqueta, props, ...hijos) {
    const el = document.createElement(etiqueta);
    Object.keys(props || {}).forEach((k) => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k in el && typeof v !== "string") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    return poner(el, hijos);
  }

  /* Íconos (trazos de Lucide, licencia ISC). Son textos fijos del código, nunca datos de clientes. */
  const TRAZOS = {
    bolsa: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    menos: '<path d="M5 12h14"/>',
    basura: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    enviar: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    cubiertos: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    moto: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
    telefono: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>',
    instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z"/><path d="M17.5 6.5h.01"/>',
    enlace: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    flecha_izq: '<path d="m15 18-6-6 6-6"/>',
    flecha_der: '<path d="m9 18 6-6-6-6"/>',
    repetir: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  };
  function icono(nombre, tam) {
    tam = tam || 22;
    const span = document.createElement("span");
    span.className = "ico";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + (TRAZOS[nombre] || "") + "</svg>";
    return span;
  }
  const SVG_BOLSA = '<svg viewBox="0 0 120 110" aria-hidden="true"><ellipse cx="60" cy="103" rx="40" ry="6" fill="currentColor" opacity=".12"/><path d="M27 38h66l-5 56a9 9 0 0 1-9 8H41a9 9 0 0 1-9-8z" fill="var(--rojo)"/><path d="M27 38h66l-1 9H28z" fill="var(--rojo-hondo)"/><path d="M45 38v-6a15 15 0 0 1 30 0v6" fill="none" stroke="var(--vino)" stroke-width="5" stroke-linecap="round"/><path d="M60 56c8 7 12 13 12 20a12 12 0 0 1-24 0c0-4 2-8 5-10 0 4 2 7 4 7-1-7 1-12 3-17z" fill="var(--mostaza)"/><path d="M60 69c3 3 6 7 6 10a6 6 0 0 1-12 0c0-3 3-7 6-10z" fill="var(--llama)"/></svg>';
  const SVG_LUPA = '<svg viewBox="0 0 120 110" aria-hidden="true"><ellipse cx="60" cy="103" rx="40" ry="6" fill="currentColor" opacity=".12"/><circle cx="54" cy="48" r="28" fill="var(--crema)" stroke="var(--vino)" stroke-width="6"/><path d="M75 69l18 18" stroke="var(--vino)" stroke-width="9" stroke-linecap="round"/><path d="M44 44c3-6 9-9 15-9" fill="none" stroke="var(--llama)" stroke-width="5" stroke-linecap="round"/></svg>';
  function svgDe(cadena) { const s = document.createElement("span"); s.innerHTML = cadena; return s.firstChild; } // dibujos fijos del código

  /* ───────── Menú desde los datos del negocio ───────── */
  const limpiarOpciones = (ops) => (Array.isArray(ops) ? ops : []).map((x) => limpiar(x, 30)).filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i).slice(0, 8);
  const CATS = (c.catalogo.categorias || []).filter((k) => k && k.id && k.nombre)
    .map((k) => Object.assign({}, k, { foto: EU.url(k.foto), emoji: String(k.emoji || "").trim() || "🍽️" }));
  const CAT_POR_ID = new Map(CATS.map((k) => [String(k.id), k]));
  const PRODUCTOS = (c.catalogo.productos || []).filter((p) => p && p.id && p.nombre && CAT_POR_ID.has(String(p.cat)))
    .map((p) => Object.assign({}, p, { id: String(p.id), cat: String(p.cat), precio: Math.max(0, Number(p.precio) || 0), foto: EU.url(p.foto), opciones: limpiarOpciones(p.opciones) }));
  const POR_ID = new Map(PRODUCTOS.map((p) => [p.id, p]));
  const emojiDe = (p) => (CAT_POR_ID.get(p.cat) || {}).emoji || "🍽️";
  const sePuede = (p) => !!p && p.precio > 0 && !p.agotado;
  const ES_ADICIONAL = (p) => !!p && !!(CAT_POR_ID.get(p.cat) || {}).adicionales;
  const ADICIONALES = PRODUCTOS.filter((p) => ES_ADICIONAL(p) && sePuede(p));
  const DESTACADOS = PRODUCTOS.filter((p) => p.destacado && sePuede(p)).slice(0, 12);
  const SUGERENCIAS = PRODUCTOS.filter((p) => p.sugerido && sePuede(p)).slice(0, 8);
  const textosMenu = c.menu || {};
  const TIPOS = {
    aqui: { nombre: "Comer aquí", icono: "cubiertos" },
    llevar: { nombre: "Para llevar", icono: "bolsa" },
    delivery: { nombre: "Delivery", icono: "moto" },
  };
  const tiposOfrecidos = (c.pedidos.tipos || []).filter((t) => TIPOS[t]);
  if (!tiposOfrecidos.length) tiposOfrecidos.push("llevar");
  const pagosPara = (tipo) => EU.pagos.disponibles(tipo);
  const nombrePago = (id) => ((c.pagos || []).find((m) => m && m.id === id) || {}).nombre || "";
  const listaNombres = (lista) => lista.map((f) => f.nombre).join(", ").replace(/, ([^,]*)$/, " o $1");
  const listaOpciones = (ops) => ops.join(", ").replace(/, ([^,]*)$/, " o $1");

  /* ───────── Estado: el carrito vive en esta pestaña; los datos del cliente, en su teléfono (EU.cliente) ───────── */
  const CLAVE = "eu:delicias:" + (sitio.slug || "demo");
  const ss = {
    leer(k, def) { try { const v = JSON.parse(sessionStorage.getItem(k)); return v == null ? def : v; } catch (_) { return def; } },
    poner(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } },
  };
  /* Los adicionales de una línea son una lista de ids; un id repetido es doble porción (ej. doble tocineta) */
  const claveLinea = (id, opcion, extras) => id + "|" + (opcion || "") + "|" + (extras || []).slice().sort().join(",");
  const agrupar = (ids) => { const m = new Map(); (ids || []).forEach((id) => m.set(id, (m.get(id) || 0) + 1)); return m; };
  const extrasValidos = (lista) => (Array.isArray(lista) ? lista : []).map(String).filter((e) => { const a = POR_ID.get(e); return ES_ADICIONAL(a) && sePuede(a); }).slice(0, MAX_EXTRAS);
  const lineaValida = (l) => {
    const p = l && POR_ID.get(String(l.id));
    if (!sePuede(p) || !(Number(l.cant) > 0)) return null;
    const opcion = limpiar(l.opcion, 30);
    if (p.opciones.length && p.opciones.indexOf(opcion) < 0) return null; // la opción ya no existe
    return { id: p.id, opcion: p.opciones.length ? opcion : "", extras: ES_ADICIONAL(p) ? [] : extrasValidos(l.extras), cant: Math.min(99, Math.floor(Number(l.cant))) };
  };
  const guardado = ss.leer(CLAVE, {}) || {};
  const carrito = new Map();
  (Array.isArray(guardado.lineas) ? guardado.lineas : []).forEach((x) => { const l = lineaValida(x); if (l) carrito.set(claveLinea(l.id, l.opcion, l.extras), l); });

  const yo = memoria.datos() || {};
  const cliente = { nombre: yo.nombre || "", tipo: "", direccion: yo.direccion || "", notas: "", pago: "" };
  const recordado = !!(yo.nombre || yo.direccion);
  cliente.tipo = tiposOfrecidos.indexOf(guardado.tipo) >= 0 ? guardado.tipo : tiposOfrecidos.indexOf(yo.tipo) >= 0 ? yo.tipo : tiposOfrecidos[0];
  const pagoGuardado = guardado.pago || yo.pago;
  if (pagosPara(cliente.tipo).some((m) => m.id === pagoGuardado)) cliente.pago = pagoGuardado;
  const guardar = () => ss.poner(CLAVE, { lineas: Array.from(carrito.values()), tipo: cliente.tipo, pago: cliente.pago });

  const lineas = () => Array.from(carrito.values()).map((l) => {
    const producto = POR_ID.get(l.id);
    const extrasProductos = l.extras.map((e) => POR_ID.get(e)).filter(Boolean);
    const unitario = producto ? redondear(producto.precio + extrasProductos.reduce((s, e) => s + e.precio, 0)) : 0;
    return Object.assign({}, l, { producto, extrasProductos, unitario });
  }).filter((l) => l.producto);
  const cuenta = () => lineas().reduce((s, l) => s + l.cant, 0);
  const subtotal = () => redondear(lineas().reduce((s, l) => s + l.cant * l.unitario, 0));
  const delivery = () => (cliente.tipo === "delivery" && cuenta() ? EU.costoDelivery() : 0);
  const descuento = () => ofertas.calcular(subtotal());
  const total = () => redondear(subtotal() - descuento().monto + delivery());
  const cantidadDe = (id) => lineas().filter((l) => l.id === id).reduce((s, l) => s + l.cant, 0);
  const nombreLinea = (l) => (l.opcion ? l.producto.nombre + " (" + l.opcion + ")" : l.producto.nombre);
  const textoExtras = (l) => {
    if (!l.extrasProductos || !l.extrasProductos.length) return "";
    return "+ " + Array.from(agrupar(l.extras)).map(([id, n]) => (n > 1 ? n + "× " : "") + ((POR_ID.get(id) || {}).nombre || id)).join(", ");
  };

  function cambiar(id, opcion, delta, extras) {
    extras = extras || [];
    const k = claveLinea(id, opcion, extras);
    const actual = carrito.has(k) ? carrito.get(k).cant : 0;
    const nueva = Math.max(0, Math.min(99, actual + delta));
    if (nueva) carrito.set(k, { id, opcion: opcion || "", extras: extras.slice(), cant: nueva });
    else carrito.delete(k);
    guardar();
    if (delta > 0) EU.mascotaBrinca();
    actualizarTodo(id, delta > 0);
  }

  function falta() {
    if (!cuenta()) return "";
    if (!cliente.nombre.trim()) return "Escribe tu nombre para enviar el pedido.";
    if (cliente.tipo === "delivery" && !cliente.direccion.trim()) return "Escribe la dirección para el delivery.";
    if (pagosPara(cliente.tipo).length && !cliente.pago) return "Elige cómo vas a pagar.";
    return "";
  }

  /* ───────── Microinteracciones ───────── */
  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (_) { /* sin vibración */ } }
  function saltar(el) {
    if (!el || SIN_MOVIMIENTO()) return;
    el.classList.remove("salta");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("salta");
  }
  /* Cuenta el número hasta el valor nuevo (precios y totales) */
  function contar(el, valor) {
    const desde = Number(el.dataset.valor == null ? valor : el.dataset.valor);
    el.dataset.valor = String(valor);
    if (SIN_MOVIMIENTO() || desde === valor) { el.textContent = usd(valor); return; }
    const inicio = performance.now(), dur = 320;
    cancelAnimationFrame(el._cuadro);
    const paso = (t) => {
      const k = Math.min(1, (t - inicio) / dur);
      el.textContent = usd(desde + (valor - desde) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) el._cuadro = requestAnimationFrame(paso);
    };
    el._cuadro = requestAnimationFrame(paso);
  }
  /* La foto del producto "vuela" hasta el pedido */
  function volarAlPedido(origen) {
    try {
      if (!origen || SIN_MOVIMIENTO() || origen.tagName !== "IMG" || !origen.animate) return;
      const destino = ES_ESCRITORIO() ? $("pedido-lateral") : document.querySelector("#barra-pedido .barra-icono");
      if (!destino) return;
      const a = origen.getBoundingClientRect(), b = destino.getBoundingClientRect();
      if (!a.width || !b.width) return;
      const img = h("img", { class: "volando", src: origen.currentSrc || origen.src, alt: "" });
      Object.assign(img.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
      document.body.appendChild(img);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + Math.min(b.height, 80) / 2 - (a.top + a.height / 2);
      const anim = img.animate([
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: "translate(" + dx * 0.5 + "px, " + (dy * 0.5 - 60) + "px) scale(0.6)", opacity: 0.95, offset: 0.5 },
        { transform: "translate(" + dx + "px, " + dy + "px) scale(0.18)", opacity: 0.4 },
      ], { duration: 620, easing: "cubic-bezier(0.5, 0, 0.3, 1)" });
      anim.onfinish = () => img.remove();
      setTimeout(() => img.remove(), 900);
    } catch (_) { /* es solo decorativo */ }
  }

  /* ───────── Avisos cortos ───────── */
  let temporizadorAviso;
  function avisar(texto) {
    $("aviso").textContent = tr(texto);
    const viejo = document.querySelector(".aviso-flotante");
    if (viejo) viejo.remove();
    const el = h("div", { class: "aviso-flotante", "aria-hidden": "true" }, texto);
    document.body.appendChild(el);
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => el.remove(), 1800);
  }

  /* ───────── "Atrás" del teléfono: cierra la hoja abierta en vez de salir de la página ───────── */
  const pilaHistorial = [];
  let entradaPropia = false, popsIgnorados = 0;
  function asegurarEntrada() {
    if (entradaPropia || EU.enPanel) return;
    try { history.pushState({ euHoja: true }, ""); entradaPropia = true; } catch (_) { /* sin historial */ }
  }
  function soltarEntrada() {
    setTimeout(() => {
      if (pilaHistorial.length || !entradaPropia) return;
      entradaPropia = false;
      popsIgnorados++;
      history.back();
    }, 0);
  }
  addEventListener("popstate", () => {
    if (popsIgnorados) { popsIgnorados--; return; }
    if (!entradaPropia) return;
    entradaPropia = false;
    const ultima = pilaHistorial[pilaHistorial.length - 1];
    if (ultima) ultima();
    if (pilaHistorial.length) asegurarEntrada();
  });

  /* ───────── Hoja que sube desde abajo ───────── */
  function abrirHoja(titulo, llenar, opciones) {
    const op = opciones || {};
    const anterior = document.activeElement;
    const capa = h("div", { class: "fondo-hoja" });
    const hoja = h("div", { class: "hoja", role: "dialog", "aria-modal": "true", "aria-label": titulo });
    let cerrada = false;
    const porHistorial = () => cerrarInterno(true);
    const cerrar = () => cerrarInterno(false);
    function cerrarInterno(desdeHistorial) {
      if (cerrada) return;
      cerrada = true;
      const i = pilaHistorial.indexOf(porHistorial);
      if (i >= 0) { pilaHistorial.splice(i, 1); if (!desdeHistorial) soltarEntrada(); }
      document.removeEventListener("keydown", tecla);
      const quitar = () => {
        capa.remove();
        if (!document.querySelector(".fondo-hoja:not(.cerrando)")) { document.body.style.overflow = ""; document.body.classList.remove("con-hoja"); }
      };
      capa.classList.add("cerrando");
      if (SIN_MOVIMIENTO()) quitar(); else setTimeout(quitar, 200);
      if (op.alCerrar) op.alCerrar();
      if (anterior && anterior.focus) anterior.focus({ preventScroll: true });
    }
    const tecla = (e) => {
      const abiertas = document.querySelectorAll(".fondo-hoja:not(.cerrando)");
      if (e.key === "Escape" && capa === abiertas[abiertas.length - 1]) cerrar();
    };
    const cuerpo = h("div", { class: "hoja-cuerpo" });
    poner(hoja, h("div", { class: "hoja-cabeza" }, h("h2", null, titulo),
      h("button", { class: "cerrar-hoja", type: "button", "aria-label": "Cerrar", onclick: cerrar }, icono("x", 20))), cuerpo);
    capa.appendChild(hoja);
    capa.addEventListener("click", (e) => { if (e.target === capa) cerrar(); });
    document.addEventListener("keydown", tecla);
    $("capa").appendChild(capa);
    document.body.style.overflow = "hidden";
    document.body.classList.add("con-hoja");
    if (op.historial) { pilaHistorial.push(porHistorial); asegurarEntrada(); }
    llenar(cuerpo, cerrar, hoja);
    hoja.tabIndex = -1;
    hoja.focus({ preventScroll: true });
    return cerrar;
  }

  /* Arrastrar la hoja hacia abajo para cerrarla (solo en el teléfono) */
  function hacerArrastrable(hoja, cerrar, asa) {
    if (!asa) return;
    let inicioY = null, dy = 0, t0 = 0, moviendo = false;
    const soltar = () => {
      if (inicioY == null) return;
      const velocidad = dy / Math.max(1, performance.now() - t0);
      inicioY = null;
      if (!moviendo) return;
      hoja.style.transition = "transform 0.22s ease";
      if (dy > 110 || (dy > 40 && velocidad > 0.6)) { hoja.style.transform = "translateY(100%)"; setTimeout(cerrar, 120); }
      else {
        hoja.style.transform = "";
        setTimeout(() => { hoja.style.transition = ""; hoja.classList.remove("arrastrando"); }, 230);
      }
    };
    asa.style.touchAction = "none";
    asa.addEventListener("pointerdown", (e) => {
      if (matchMedia("(min-width: 720px)").matches || hoja.scrollTop > 2) return;
      if (e.target.closest("button, input, textarea, a, label")) return;
      inicioY = e.clientY; dy = 0; t0 = performance.now(); moviendo = false;
      try { asa.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    });
    asa.addEventListener("pointermove", (e) => {
      if (inicioY == null) return;
      dy = Math.max(0, e.clientY - inicioY);
      if (!moviendo && dy > 6) { moviendo = true; hoja.classList.add("arrastrando"); hoja.style.animation = "none"; }
      if (moviendo) { hoja.style.transform = "translateY(" + dy + "px)"; e.preventDefault(); }
    });
    asa.addEventListener("pointerup", soltar);
    asa.addEventListener("pointercancel", soltar);
  }

  /* ───────── Imágenes ─────────
     Las fotos de la plantilla tienen una versión chica (foto-240.webp, o foto-720.webp las de categoría)
     y el teléfono baja la que le basta. Las que sube el dueño se usan tal cual. Si una foto no carga,
     sale el emoji de su categoría. */
  const PROPIA = (ruta) => ruta.indexOf("/t/delicias/img/") === 0 && /\.webp$/i.test(ruta);
  const variante = (ruta, ancho) => ruta.replace(/\.webp$/i, "-" + ancho + ".webp");
  function imagen(ruta, op) {
    op = op || {};
    const chica = op.chica || 240, grande = op.grande || 400;
    const props = { loading: op.diferida === false ? null : "lazy", decoding: "async", class: op.clase, alt: "", width: op.ancho || 104, height: op.alto || 104 };
    if (PROPIA(ruta) && op.sizes) Object.assign(props, { sizes: op.sizes, srcset: variante(ruta, chica) + " " + chica + "w, " + ruta + " " + grande + "w" });
    const img = h("img", Object.assign(props, { src: ruta }));
    img.addEventListener("error", () => {
      if (img.getAttribute("srcset")) { img.removeAttribute("srcset"); img.removeAttribute("sizes"); img.src = ruta; return; }
      if (op.emoji != null && img.parentNode) img.replaceWith(h("span", { class: (op.clase || "") + " foto-vacia", "aria-hidden": "true" }, op.emoji));
      else img.style.visibility = "hidden";
    });
    return img;
  }
  // Versión chica (400 px) de las fotos del dueño para todo lo que sale pequeño; la grande, solo en la hoja del producto
  const chica = (u) => (EU.miniatura ? EU.miniatura(u) : u);
  function mediaProducto(p, clase, sizes, grande) {
    clase = clase || "foto-producto";
    if (p.foto) return imagen(grande ? p.foto : chica(p.foto), { clase, sizes: sizes || "(max-width: 360px) 88px, 104px", emoji: emojiDe(p) });
    return h("span", { class: clase + " foto-vacia", "aria-hidden": "true" }, emojiDe(p));
  }
  const precioHTML = (p) => (p.precio > 0
    ? h("span", { class: "precio num" }, usd(p.precio), EU.tasa() > 0 ? h("small", null, " · " + EU.bs(p.precio)) : null)
    : h("span", { class: "precio sin" }, "Precio por confirmar"));

  /* ───────── Cabecera y portada ───────── */
  const logo = EU.url(c.negocio.logo);
  $("marca-nombre").textContent = sitio.nombre;
  $("portada-nombre").textContent = sitio.nombre;
  $("portada-lema").textContent = c.negocio.eslogan || "";
  const primeraCat = CATS.find((k) => k.foto) || null;
  $("insignia-emoji").textContent = (CATS[0] || {}).emoji || "🍔";
  if (logo) {
    const enCabecera = h("img", { src: chica(logo), alt: "", onerror: function () { this.remove(); } });
    $("insignia").appendChild(enCabecera);
    const grande = h("img", { src: chica(logo), alt: "", onerror: () => { $("portada-logo").hidden = true; $("portada-contenido").classList.add("sin-logo"); } });
    $("portada-logo").appendChild(grande);
    $("portada-logo").hidden = false;
    $("portada-contenido").classList.remove("sin-logo");
  }
  (function fotoPortada() {
    const propia = EU.url((c.portada || {}).foto);
    const ruta = propia || (primeraCat ? primeraCat.foto : "");
    const img = $("portada-fondo");
    if (!ruta) return;
    if (PROPIA(ruta)) { img.srcset = variante(ruta, 720) + " 720w, " + ruta + " 1200w"; img.sizes = "(max-width: 719px) 100vw, 1200px"; }
    img.src = ruta;
    img.hidden = false;
    img.onerror = () => { img.hidden = true; };
  })();
  // Teléfono y la red social principal (Instagram si la hay)
  if (EU.whatsapp()) {
    const tel = $("accion-telefono");
    tel.href = "https://wa.me/" + EU.whatsapp();
    tel.target = "_blank"; tel.rel = "noopener";
    tel.setAttribute("aria-label", "Escríbenos por WhatsApp");
    $("accion-telefono-texto").textContent = EU.telefonoVisible();
    tel.hidden = false;
  }
  (function redPrincipal() {
    const redes = EU.redes ? EU.redes() : [];
    const r = redes.find((x) => x.id === "instagram") || redes[0];
    if (!r) return;
    const a = $("accion-red");
    a.href = r.href;
    a.setAttribute("aria-label", r.nombre);
    $("accion-red-texto").textContent = r.corto || r.nombre;
    if (r.id !== "instagram") a.querySelector(".ico").replaceWith(icono("enlace", 16));
    a.hidden = false;
  })();
  // Globo de la mascota: dice algo al tocarla
  (function globo() {
    const frases = (Array.isArray((c.portada || {}).frases) ? c.portada.frases : []).map((x) => limpiar(x, 30)).filter(Boolean);
    const b = document.querySelector(".ranura-mascota"), g = $("globo");
    if (!b || !frases.length) return;
    let t, ultima = -1;
    b.addEventListener("click", () => {
      let i = Math.floor(Math.random() * frases.length);
      if (i === ultima && frases.length > 1) i = (i + 1) % frases.length;
      ultima = i;
      g.textContent = frases[i];
      g.classList.add("visto");
      clearTimeout(t);
      t = setTimeout(() => g.classList.remove("visto"), 1900);
      vibrar(12);
    });
  })();

  /* Horario de la semana en una línea: "Mar a Dom: 6 pm – 11 pm" */
  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  function resumenHorario() {
    const H = c.negocio.horario || {};
    const dia = (d) => { const v = H[d] || H[String(d)]; return Array.isArray(v) && v[0] && v[1] ? v : null; };
    const grupos = [];
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      const v = dia(d), clave = v ? v[0] + "-" + v[1] : "";
      const ult = grupos[grupos.length - 1];
      if (ult && ult.clave === clave) ult.dias.push(d); else grupos.push({ clave, v, dias: [d] });
    });
    const abiertos = grupos.filter((g) => g.v);
    if (!abiertos.length) return "";
    const horas = (v) => EU.hora(v[0]) + " – " + EU.hora(v[1]);
    const nombre = (g) => {
      const d = g.dias;
      if (d.length === 7) return "Todos los días";
      if (d.length === 1) return DIAS_CORTOS[d[0]];
      if (d.length === 2) return DIAS_CORTOS[d[0]] + " y " + DIAS_CORTOS[d[1]];
      return DIAS_CORTOS[d[0]] + " a " + DIAS_CORTOS[d[d.length - 1]];
    };
    if (abiertos.length <= 2) return abiertos.map((g) => nombre(g) + ": " + horas(g.v)).join(" · ");
    const hoy = dia(new Date().getDay());
    return hoy ? "Hoy: " + horas(hoy) : "Hoy cerrado";
  }
  const textoHorario = resumenHorario();
  if (textoHorario) { $("horario-semana-texto").textContent = textoHorario; $("horario-semana").hidden = false; }

  function refrescarHorario() {
    const est = EU.estado();
    document.querySelectorAll("[data-horario]").forEach((el) => {
      el.className = "estado-horario chico " + (est.abierto ? "abierto" : "cerrado");
      el.textContent = est.abierto ? "Abierto ahora" : "Cerrado";
    });
    const linea = $("estado-portada");
    linea.className = "estado-portada " + (est.abierto ? "abierto" : "cerrado");
    linea.textContent = est.texto;
    vistasPedido.forEach((v) => v.refrescarDatos());
  }

  /* ───────── Tarjetas ───────── */
  function etiquetaAccion(p) {
    if (!sePuede(p)) return p.nombre + ", " + tr(p.agotado ? "agotado por ahora" : "precio por confirmar");
    const n = cantidadDe(p.id);
    return p.nombre + ", " + usd(p.precio) + ". " + tr(ES_ADICIONAL(p) || !(p.opciones.length || ADICIONALES.length) ? "Agregar al pedido" : "Elegir y agregar") + (n ? ". " + n + " " + tr("en tu pedido") : "");
  }
  function insigniaCantidad(p) {
    const n = cantidadDe(p.id);
    return h("span", { class: "cuenta-tarjeta num", hidden: !n, "aria-hidden": "true" }, String(n));
  }
  function alTocarProducto(p, origen) {
    if (!sePuede(p)) { vibrar(30); avisar(p.agotado ? p.nombre + " está agotado por ahora" : "Este producto todavía no tiene precio"); return; }
    // Los adicionales sueltos y lo que no tiene nada que elegir se agregan de una vez
    if (ES_ADICIONAL(p) || (!p.opciones.length && !ADICIONALES.length)) {
      vibrar();
      cambiar(p.id, "", 1);
      volarAlPedido(origen);
      avisar("Agregaste " + p.nombre);
    } else abrirPersonalizar(p);
  }
  function tarjeta(p) {
    const media = mediaProducto(p);
    const cat = CAT_POR_ID.get(p.cat) || {};
    return h("button", {
      class: "producto" + (sePuede(p) ? "" : " agotado"), type: "button", "aria-disabled": sePuede(p) ? null : "true",
      dataset: { pid: p.id, buscar: normalizar(p.nombre + " " + (p.desc || "") + " " + (cat.nombre || "") + " " + p.opciones.join(" ")) },
      "data-eu-producto": "", "aria-label": etiquetaAccion(p), onclick: () => alTocarProducto(p, media),
    },
      h("span", { class: "producto-info" },
        h("span", { class: "producto-nombre" }, p.nombre),
        p.desc ? h("span", { class: "desc" }, p.desc) : null,
        p.opciones.length ? h("span", { class: "opciones-texto" }, listaOpciones(p.opciones)) : null,
        p.agotado ? h("span", { class: "etiqueta-agotado" }, "Agotado por ahora") : precioHTML(p)),
      h("span", { class: "producto-media" }, media, insigniaCantidad(p), sePuede(p) ? h("span", { class: "mas-flotante", "aria-hidden": "true" }, icono("mas", 20)) : null));
  }
  function tarjetaDestacada(p) {
    const media = mediaProducto(p, "foto-producto", "(max-width: 360px) 150px, (min-width: 720px) 200px, 168px");
    return h("button", { class: "destacado", type: "button", dataset: { pid: p.id }, "aria-label": etiquetaAccion(p), onclick: () => alTocarProducto(p, media) },
      media, insigniaCantidad(p),
      h("span", { class: "mas-flotante", "aria-hidden": "true" }, icono("mas", 20)),
      h("span", { class: "destacado-info" }, h("b", null, p.nombre), h("span", { class: "precio num" }, usd(p.precio))));
  }

  /* ───────── Menú ───────── */
  function pintarMenu() {
    const nav = $("categorias"), menu = $("menu");
    const esq = $("esqueleto");
    if (esq) esq.remove();
    poner(menu, tarjetaRepetir());
    if (DESTACADOS.length) {
      poner(menu, h("section", { class: "destacados", id: "destacados", "aria-labelledby": "titulo-destacados" },
        h("div", { class: "titulo-bloque" }, h("h2", { id: "titulo-destacados" }, limpiar(textosMenu.tituloDestacados, 30) || "🔥 Lo más pedido"),
          DESTACADOS.length > 2 ? h("span", null, "Desliza para ver más") : null),
        h("div", { class: "destacados-carril" }, DESTACADOS.map(tarjetaDestacada))));
    }
    const conProductos = CATS.filter((k) => PRODUCTOS.some((p) => p.cat === String(k.id)));
    conProductos.forEach((k) => {
      const productos = PRODUCTOS.filter((p) => p.cat === String(k.id));
      const sid = "cat-" + String(k.id).replace(/[^\w-]/g, "");
      poner(nav, h("a", { class: "categoria", href: "#" + sid, dataset: { cat: sid } },
        h("span", { class: "emo", "aria-hidden": "true" }, k.emoji), limpiar(k.corto, 16) || k.nombre));
      poner(menu, h("section", { class: "seccion", id: sid, "aria-labelledby": "titulo-" + sid },
        h("div", { class: "franja" },
          k.foto && !AHORRO_DATOS
            ? imagen(k.foto, { clase: "franja-foto", sizes: "(min-width: 1024px) 780px, calc(100vw - 32px)", chica: 720, grande: 1200, ancho: 1200, alto: 450 })
            : h("span", { class: "franja-emoji", "aria-hidden": "true" }, k.emoji),
          h("h2", { id: "titulo-" + sid }, k.nombre),
          h("span", { class: "franja-cuenta num" }, productos.length + " " + (productos.length === 1 ? "opción" : "opciones"))),
        k.nota ? h("p", { class: "seccion-nota" }, limpiar(k.nota, 200)) : null,
        h("div", { class: "lista" }, productos.map(tarjeta))));
    });
    if (!conProductos.length) poner(menu, h("div", { class: "vacio" }, svgDe(SVG_BOLSA), h("b", null, "Pronto publicaremos el menú."), h("p", null, "Escríbenos por WhatsApp y te contamos qué hay hoy.")));
    nav.hidden = conProductos.length < 2;
    poner(menu, h("div", { class: "vacio", id: "busqueda-vacia", hidden: true },
      svgDe(SVG_LUPA), h("b", null, "No encontramos eso"), h("p", null, "Prueba con otra palabra o revisa cómo la escribiste."),
      h("button", { class: "boton suave toca", type: "button", onclick: () => limpiarBusqueda(true) }, "Ver todo el menú")));
    const local = h("section", { class: "local", "aria-labelledby": "local-t" }, h("h2", { id: "local-t" }, "El local"), h("div"));
    local.lastChild.innerHTML = EU.htmlInfo(); // escapa todo lo que escribió el dueño
    poner(menu, local);

    // Tocar una categoría lleva a su sección sin llenar el historial
    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a.categoria");
      if (!a) return;
      e.preventDefault();
      if ($("buscar").value) limpiarBusqueda(false);
      const sec = $(a.dataset.cat);
      if (!sec) return;
      const y = sec.getBoundingClientRect().top + scrollY - $("cabecera").offsetHeight - nav.offsetHeight + 6;
      scrollTo({ top: Math.max(0, y), behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
    });
    // Marca la categoría que se está viendo y la centra en la barra
    if (!("IntersectionObserver" in window)) return;
    const enlaces = Array.from(nav.querySelectorAll(".categoria"));
    const visibles = new Set();
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => (e.isIntersecting ? visibles.add(e.target.id) : visibles.delete(e.target.id)));
      const primera = enlaces.map((a) => a.dataset.cat).find((id) => visibles.has(id));
      enlaces.forEach((a) => {
        const activa = a.dataset.cat === primera;
        if (activa && a.getAttribute("aria-current") !== "true") nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
        a.setAttribute("aria-current", activa ? "true" : "false");
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    menu.querySelectorAll(".seccion").forEach((s) => observador.observe(s));
  }

  /* ───────── Buscador ───────── */
  function filtrar(texto) {
    const q = normalizar(texto).trim();
    const palabras = q.split(/\s+/).filter(Boolean);
    let hallados = 0;
    document.querySelectorAll("#menu .seccion").forEach((sec) => {
      let enSeccion = 0;
      sec.querySelectorAll(".producto").forEach((t) => {
        const ok = !palabras.length || palabras.every((w) => t.dataset.buscar.indexOf(w) >= 0);
        t.classList.toggle("oculto-busqueda", !ok);
        if (ok) enSeccion++;
      });
      sec.classList.toggle("oculto-busqueda", !enSeccion);
      hallados += enSeccion;
    });
    const dest = $("destacados");
    if (dest) dest.classList.toggle("oculto-busqueda", !!q);
    const rep = $("repetir");
    if (rep) rep.classList.toggle("oculto-busqueda", !!q);
    const res = $("resultado-busqueda");
    res.hidden = !q || !hallados;
    res.textContent = q ? hallados + " " + (hallados === 1 ? "resultado" : "resultados") + " para “" + texto.trim() + "”" : "";
    $("busqueda-vacia").hidden = !q || hallados > 0;
    $("buscar-limpiar").hidden = !q;
  }
  function limpiarBusqueda(enfocar) {
    $("buscar").value = "";
    filtrar("");
    if (enfocar) $("buscar").focus();
  }

  /* ───────── Elegir: opción, adicionales y cantidad ───────── */
  function abrirPersonalizar(p) {
    const conteo = new Map(); // id del adicional → porciones
    let opcion = p.opciones.length === 1 ? p.opciones[0] : "";
    let cant = 1;
    abrirHoja(p.nombre, (cuerpo, cerrar, hoja) => {
      const media = mediaProducto(p, "foto-producto", "(min-width: 720px) 560px, 100vw", true);
      // Mientras baja la foto grande se ve la chica que ya está en el teléfono (sin hueco en blanco)
      const vista = document.querySelector('[data-pid="' + CSS.escape(p.id) + '"] img');
      if (vista && vista.currentSrc && media.tagName === "IMG") media.style.background = 'var(--crema) url("' + vista.currentSrc + '") center / cover';
      const botonCerrar = h("button", { class: "cerrar-hoja", type: "button", "aria-label": "Cerrar", onclick: cerrar }, icono("x", 20));
      const asa = h("span", { class: "asa", "aria-hidden": "true" });
      const cabeza = p.foto ? h("div", { class: "personalizar-foto" }, media, asa, botonCerrar) : h("div", { class: "sin-foto-cab" }, asa, botonCerrar);

      const precioBoton = h("span", { class: "num" });
      const boton = h("button", { class: "boton rojo toca", type: "button" }, icono("mas", 20), h("span", null, "Agregar"), h("span", { "aria-hidden": "true" }, "·"), precioBoton);
      const mensaje = h("p", { class: "falta", role: "status" });

      // Opción obligatoria (carne, pollo…)
      const estadoOpcion = h("span", { class: "etiqueta-estado obligatorio" }, "Obligatorio");
      const botonesOpcion = p.opciones.map((op) => h("button", {
        class: "chip-opcion", type: "button", "aria-pressed": "false", dataset: { op },
        onclick: () => { opcion = op; vibrar(6); if (bloqueOpcion) bloqueOpcion.classList.remove("error"); refrescar(); },
      }, op));
      const bloqueOpcion = botonesOpcion.length ? h("fieldset", { class: "bloque-eleccion" },
        h("legend", null, h("span", null, "Elige una opción"), estadoOpcion),
        h("div", { class: "chips-opcion" }, botonesOpcion)) : null;

      // Adicionales con − / + (doble o triple porción)
      const totalExtras = () => Array.from(conteo.values()).reduce((s, n) => s + n, 0);
      const filas = ES_ADICIONAL(p) ? [] : ADICIONALES.map((a) => {
        const salida = h("output", { class: "num" }, "0");
        const menos = h("button", { class: "menos", type: "button", "aria-label": "Quitar " + a.nombre }, icono("menos", 18));
        const mas = h("button", { class: "mas", type: "button", "aria-label": "Agregar " + a.nombre }, icono("mas", 18));
        const fila = h("div", { class: "extra", dataset: { extra: a.id } },
          a.foto ? imagen(chica(a.foto), { clase: "extra-foto", sizes: "44px", ancho: 44, alto: 44, emoji: emojiDe(a) }) : h("span", { class: "extra-foto", "aria-hidden": "true" }, emojiDe(a)),
          h("span", { class: "extra-textos" }, h("span", { class: "extra-nombre" }, a.nombre), h("span", { class: "extra-precio num" }, "+" + usd(a.precio))),
          h("span", { class: "paso" }, menos, salida, mas));
        const sumar = (d) => {
          const n = Math.max(0, Math.min(MAX_POR_EXTRA, (conteo.get(a.id) || 0) + d));
          if (d > 0 && totalExtras() >= MAX_EXTRAS) { avisar("Máximo " + MAX_EXTRAS + " adicionales por producto"); return; }
          if (n) conteo.set(a.id, n); else conteo.delete(a.id);
          vibrar(6);
          refrescar();
        };
        menos.addEventListener("click", () => sumar(-1));
        mas.addEventListener("click", () => sumar(1));
        fila.addEventListener("click", (e) => { if (!e.target.closest("button") && !conteo.get(a.id)) sumar(1); });
        return { a, fila, salida, menos, mas };
      });
      const estadoExtras = h("span", { class: "etiqueta-estado opcional" }, "Opcional");
      const bloqueExtras = filas.length ? h("fieldset", { class: "bloque-eleccion" },
        h("legend", null, h("span", null, "¿Le agregas algo?"), estadoExtras),
        h("div", { class: "lista-extras" }, filas.map((f) => f.fila))) : null;

      // Cantidad
      const salidaCant = h("output", { class: "num", "aria-live": "polite" }, "1");
      const menosCant = h("button", { type: "button", "aria-label": "Uno menos", onclick: () => { cant = Math.max(1, cant - 1); vibrar(6); refrescar(); } }, icono("menos", 20));
      const masCant = h("button", { type: "button", "aria-label": "Uno más", onclick: () => { cant = Math.min(99, cant + 1); vibrar(6); refrescar(); } }, icono("mas", 20));

      function refrescar() {
        botonesOpcion.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.op === opcion)));
        if (bloqueOpcion) {
          estadoOpcion.className = "etiqueta-estado " + (opcion ? "listo" : "obligatorio");
          estadoOpcion.textContent = opcion ? "✓ Listo" : "Obligatorio";
        }
        filas.forEach((f) => {
          const n = conteo.get(f.a.id) || 0;
          f.salida.textContent = String(n);
          f.fila.classList.toggle("activo", n > 0);
          f.menos.disabled = !n;
          f.mas.disabled = n >= MAX_POR_EXTRA;
        });
        const ne = totalExtras();
        estadoExtras.className = "etiqueta-estado " + (ne ? "listo" : "opcional");
        estadoExtras.textContent = ne ? ne + " " + (ne > 1 ? "elegidos" : "elegido") : "Opcional";
        salidaCant.textContent = String(cant);
        menosCant.disabled = cant <= 1;
        const unitario = p.precio + Array.from(conteo).reduce((s, x) => s + POR_ID.get(x[0]).precio * x[1], 0);
        contar(precioBoton, redondear(unitario * cant));
        mensaje.textContent = "";
      }

      boton.addEventListener("click", () => {
        if (p.opciones.length && !opcion) {
          bloqueOpcion.classList.remove("error"); void bloqueOpcion.offsetWidth; bloqueOpcion.classList.add("error");
          mensaje.textContent = "Elige " + listaOpciones(p.opciones).toLowerCase() + " para continuar.";
          bloqueOpcion.scrollIntoView({ block: "center", behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
          vibrar(30);
          return;
        }
        const extras = [];
        conteo.forEach((n, id) => { for (let i = 0; i < n; i++) extras.push(id); });
        vibrar(12);
        cerrar();
        cambiar(p.id, opcion, cant, extras);
        volarAlPedido(document.querySelector('.producto[data-pid="' + CSS.escape(p.id) + '"] img, .destacado[data-pid="' + CSS.escape(p.id) + '"] img'));
        avisar("Agregaste " + (cant > 1 ? cant + " " : "") + p.nombre + (opcion ? " (" + opcion + ")" : ""));
      });

      reemplazar(hoja, h("div", { class: "personalizar" },
        cabeza,
        h("div", { class: "personalizar-cuerpo" },
          h("div", { class: "personalizar-titulo" }, h("h2", null, p.nombre), h("span", { class: "precio num" }, usd(p.precio)), p.desc ? h("p", null, p.desc) : null),
          bloqueOpcion, bloqueExtras),
        h("div", { class: "hoja-pie" },
          h("div", { class: "hoja-pie-fila" }, h("span", { class: "paso grande" }, menosCant, salidaCant, masCant), boton),
          mensaje)));
      hoja.setAttribute("aria-label", "Elegir " + p.nombre);
      hacerArrastrable(hoja, cerrar, cabeza);
      refrescar();
      precioBoton.textContent = usd(Number(precioBoton.dataset.valor));
    }, { historial: true });
  }

  /* ───────── Pedido ───────── */
  const vistasPedido = new Set();

  function crearPedido(conf) {
    const enHoja = conf.enHoja, cerrarHoja = conf.cerrar;
    let paso = 1;
    const contadorCabeza = h("span", { class: "num" });
    const pasos = enHoja ? h("div", { class: "pasos", role: "group", "aria-label": "Pasos del pedido" }) : null;
    const cabeza = h("div", { class: "pedido-cabeza" },
      h("div", { class: "pedido-cabeza-fila" }, h("h2", null, h("span", null, "Tu pedido"), " ", contadorCabeza),
        enHoja ? h("button", { class: "cerrar-hoja", type: "button", "aria-label": "Cerrar pedido", onclick: () => cerrarHoja && cerrarHoja() }, icono("x", 20)) : null),
      pasos);
    const cuerpo = h("div", { class: "pedido-cuerpo" });
    const pie = h("div", { class: "hoja-pie" });
    const totalTexto = h("strong", { class: "num" });
    const totalBs = h("small", { class: "num" });
    const mensaje = h("p", { class: "falta", role: "status" });
    const avisoCerrado = h("p", { class: "aviso-cerrado", hidden: true });
    const botonEnviar = h("a", { class: "boton verde toca", href: "https://wa.me/" + EU.whatsapp(), target: "_blank", rel: "noopener", role: "button", "data-eu-boton": "", onclick: enviar },
      icono("enviar", 20), h("span", null, "Enviar por WhatsApp"));
    const precioContinuar = h("span", { class: "num" });
    const botonContinuar = h("button", { class: "boton rojo toca", type: "button", onclick: () => irPaso(2) }, h("span", null, "Continuar"), h("span", { "aria-hidden": "true" }, "·"), precioContinuar);
    const botonVolver = h("button", { class: "volver", type: "button", "aria-label": "Volver a los productos", onclick: () => irPaso(1) }, icono("flecha_izq", 22));

    const sufijo = enHoja ? "h" : "l";
    const campoNombre = h("input", { class: "campo", id: "nombre-" + sufijo, value: cliente.nombre, autocomplete: "name", autocapitalize: "words", spellcheck: "false", enterkeyhint: "done", maxLength: 60, placeholder: "¿A nombre de quién?" });
    const campoDir = h("input", { class: "campo", id: "dir-" + sufijo, value: cliente.direccion, autocomplete: "street-address", autocapitalize: "sentences", enterkeyhint: "done", maxLength: 200, placeholder: "Calle, casa o edificio y una referencia" });
    const campoNotas = h("textarea", { class: "campo", id: "notas-" + sufijo, rows: 2, maxLength: NOTA_MAX, placeholder: "Sin cebolla, salsas aparte…" });
    campoNotas.value = cliente.notas;
    const contador = h("span", { class: "num" });
    const notaDelivery = envio ? envio.nota() : EU.costoDelivery() ? "El delivery cuesta " + usd(EU.costoDelivery()) + "." : String(c.pedidos.notaDelivery || "");
    const bloqueDir = h("div", null,
      h("label", { class: "etiqueta", for: campoDir.id }, "Dirección"), campoDir,
      notaDelivery ? h("p", { class: "ayuda" }, notaDelivery) : null,
      envio ? envio.caja({ alCambiar: () => refrescarTodas() }) : null);
    const botonesTipo = tiposOfrecidos.map((k) => h("button", {
      class: "tipo", type: "button", "aria-pressed": String(cliente.tipo === k), dataset: { tipo: k },
      onclick: () => {
        cliente.tipo = k;
        if (!pagosPara(k).some((m) => m.id === cliente.pago)) cliente.pago = ""; // en delivery no van todas
        vibrar(6); guardar(); refrescarTodas();
        campoNombre.setAttribute("enterkeyhint", k === "delivery" ? "next" : "done");
      },
    }, icono(TIPOS[k].icono, 22), TIPOS[k].nombre));
    campoNombre.addEventListener("input", () => { cliente.nombre = campoNombre.value; refrescarDatos(true); });
    campoNombre.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (cliente.tipo === "delivery" && !cliente.direccion.trim()) campoDir.focus(); else campoNombre.blur();
    });
    campoDir.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); campoDir.blur(); } });
    campoDir.addEventListener("input", () => { cliente.direccion = campoDir.value; refrescarDatos(true); });
    campoNotas.addEventListener("input", () => { cliente.notas = campoNotas.value; refrescarDatos(true); });

    // Quien ya pidió aquí: sus datos ya están escritos, con la opción de borrarlos (teléfono compartido)
    const nota = recordado && !EU.enPanel ? h("p", { class: "eu-recordado" }, h("span", null, "Pusimos los datos de tu último pedido."), " ",
      h("button", { type: "button", onclick: () => {
        memoria.olvidar();
        cliente.nombre = ""; cliente.direccion = "";
        vistasPedido.forEach((v) => v.borrarNota());
        refrescarTodas();
        avisar("Listo, borramos tus datos de este teléfono.");
      } }, "Borrarlos")) : null;

    const cupon = ofertas.caja({ subtotal, alCambiar: () => refrescarTodas() });
    const cajaPagos = h("div", { class: "pagos", role: "group", "aria-label": "Forma de pago" });
    const ayudaPagos = h("p", { class: "ayuda" });
    const detallePago = h("div");
    const bloquePagos = h("fieldset", { class: "bloque-pagos" }, h("legend", { class: "etiqueta" }, "¿Cómo vas a pagar?"), cajaPagos, ayudaPagos, detallePago);
    function pintarPagos() {
      const lista = pagosPara(cliente.tipo);
      bloquePagos.hidden = !lista.length;
      reemplazar(cajaPagos, lista.map((m) => h("button", { class: "pago", type: "button", "aria-pressed": String(cliente.pago === m.id), onclick: () => {
        cliente.pago = m.id; bloquePagos.classList.remove("error"); vibrar(6); guardar(); refrescarTodas();
      } }, m.nombre)));
      const todos = pagosPara("llevar");
      ayudaPagos.textContent = cliente.tipo === "delivery" && lista.length && lista.length < todos.length ? "En delivery aceptamos " + listaNombres(lista) + "." : "";
      ayudaPagos.hidden = !ayudaPagos.textContent;
      detallePago.innerHTML = cliente.pago ? EU.pagos.detalle(cliente.pago, total()) : ""; // escapa los datos del dueño
    }

    const datos = h("div", { class: "pedido-datos" },
      h("div", null, h("label", { class: "etiqueta", for: campoNombre.id }, "Nombre"), campoNombre, nota),
      tiposOfrecidos.length > 1 ? h("fieldset", null, h("legend", { class: "etiqueta" }, "¿Cómo lo quieres?"),
        h("div", { class: "tipos", style: { gridTemplateColumns: "repeat(" + tiposOfrecidos.length + ", 1fr)" } }, botonesTipo)) : null,
      bloqueDir, cupon, bloquePagos,
      h("div", null,
        h("label", { class: "etiqueta", for: campoNotas.id }, h("span", null, "Notas para la cocina"), " ", h("span", { style: { fontWeight: 500, color: "var(--gris)" } }, "(opcional)")),
        campoNotas,
        h("p", { class: "ayuda", style: { textAlign: "right" }, "aria-hidden": "true" }, contador, "/" + NOTA_MAX)),
      avisoCerrado);

    const raiz = h("div", { class: "pedido" }, cabeza, cuerpo, pie);

    function irPaso(n) {
      if (n === 2 && !cuenta()) return;
      paso = n;
      vibrar(6);
      refrescar();
      const hoja = raiz.closest(".hoja");
      if (hoja) hoja.scrollTo({ top: 0 });
      if (n === 2 && !cliente.nombre.trim() && !matchMedia("(pointer: coarse)").matches) campoNombre.focus();
    }

    function listaProductos() {
      if (!cuenta()) {
        return h("div", { class: "vacio" }, svgDe(SVG_BOLSA),
          h("b", null, "Tu pedido está vacío"),
          h("p", null, "Elige algo rico del menú y aparecerá aquí."),
          DESTACADOS.length ? h("button", { class: "boton rojo toca", type: "button", onclick: () => {
            if (cerrarHoja) cerrarHoja();
            setTimeout(() => { const d = $("destacados"); if (d) d.scrollIntoView({ behavior: SIN_MOVIMIENTO() ? "auto" : "smooth", block: "start" }); }, enHoja ? 220 : 0);
          } }, limpiar(textosMenu.tituloDestacados, 30) || "🔥 Lo más pedido") : null);
      }
      return h("ul", { class: "pedido-lineas" }, lineas().map((l) =>
        h("li", null,
          l.producto.foto ? imagen(chica(l.producto.foto), { clase: "linea-foto", sizes: "52px", ancho: 52, alto: 52, emoji: emojiDe(l.producto) }) : h("span", { class: "linea-foto", "aria-hidden": "true" }, emojiDe(l.producto)),
          h("div", { class: "linea-texto" }, h("b", null, nombreLinea(l)),
            textoExtras(l) ? h("span", { class: "linea-extras" }, textoExtras(l)) : null,
            h("span", { class: "num" }, usd(l.cant * l.unitario))),
          h("span", { class: "paso" },
            h("button", { type: "button", "aria-label": (l.cant === 1 ? "Eliminar " : "Quitar ") + nombreLinea(l), onclick: () => { vibrar(6); cambiar(l.id, l.opcion, -1, l.extras); } }, icono(l.cant === 1 ? "basura" : "menos", 17)),
            h("output", { class: "num" }, String(l.cant)),
            h("button", { type: "button", "aria-label": "Agregar " + nombreLinea(l), onclick: () => { vibrar(6); cambiar(l.id, l.opcion, 1, l.extras); } }, icono("mas", 17))))));
    }

    function sugerencias() {
      const enPedido = new Set(lineas().map((l) => l.id));
      const lista = SUGERENCIAS.filter((p) => !enPedido.has(p.id));
      if (!cuenta() || !lista.length) return null;
      return h("div", { class: "sugerencias" }, h("h3", null, limpiar(textosMenu.tituloSugerencias, 30) || "Te puede gustar"),
        h("div", { class: "sugerencias-carril" }, lista.map((p) =>
          h("button", { class: "sugerencia", type: "button", "aria-label": "Agregar " + p.nombre + ", " + usd(p.precio), onclick: (e) => {
            if (p.opciones.length) { abrirPersonalizar(p); return; }
            const foto = e.currentTarget.querySelector("img");
            vibrar(); cambiar(p.id, "", 1); volarAlPedido(foto); avisar("Agregaste " + p.nombre);
          } },
            p.foto ? imagen(chica(p.foto), { sizes: "36px", ancho: 36, alto: 36, emoji: emojiDe(p) }) : h("span", { class: "sug-emoji" }, emojiDe(p)),
            h("span", null, p.nombre), h("span", { class: "num" }, "+" + usd(p.precio))))));
    }

    function resumen() {
      if (!cuenta()) return null;
      const d = descuento(), env = delivery();
      const filas = [];
      if (d.monto > 0 || env > 0) filas.push(h("div", null, h("span", null, "Subtotal"), h("span", { class: "num" }, usd(subtotal()))));
      if (env > 0) filas.push(h("div", null, h("span", null, "Delivery"), h("span", { class: "num" }, usd(env))));
      if (d.monto > 0) filas.push(h("div", { class: "descuento" }, h("span", null, d.texto), h("span", { class: "num" }, "-" + usd(d.monto))));
      return [filas.length ? h("div", { class: "resumen-lineas" }, filas) : null,
        h("div", { class: "total-fila" }, h("b", null, "Total a pagar"), h("span", { class: "tot" }, totalTexto, EU.tasa() > 0 ? totalBs : null))];
    }

    function refrescarDatos(soloTexto) {
      botonesTipo.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tipo === cliente.tipo)));
      bloqueDir.hidden = cliente.tipo !== "delivery";
      if (!soloTexto) { pintarPagos(); cupon.actualizar(); }
      contador.textContent = String(cliente.notas.length);
      vistasPedido.forEach((v) => { if (v !== vista) v.sincronizar(); });
      const est = EU.estado();
      avisoCerrado.hidden = est.abierto || !cuenta();
      avisoCerrado.textContent = est.abierto ? "" : est.texto + ". Puedes enviar tu pedido y te respondemos al abrir.";
      const f = falta();
      mensaje.textContent = f;
      botonEnviar.setAttribute("aria-disabled", String(!cuenta() || !!f));
    }

    function refrescar() {
      sincronizar();
      const n = cuenta();
      if (!n) paso = 1;
      contadorCabeza.textContent = n ? "(" + n + ")" : "";
      if (pasos) {
        pasos.hidden = !n;
        reemplazar(pasos,
          h("button", { type: "button", "aria-current": paso === 1 ? "step" : null, onclick: () => irPaso(1) }, h("span", { class: "num-paso" }, "1"), h("span", null, "Productos")),
          h("button", { type: "button", "aria-current": paso === 2 ? "step" : null, onclick: () => irPaso(2) }, h("span", { class: "num-paso" }, "2"), h("span", null, "Entrega")));
      }
      if (!enHoja) {
        reemplazar(cuerpo, h("div", { class: "pedido-paso" }, listaProductos(), sugerencias(), n ? h("div", { style: { marginTop: "18px" } }, datos) : null));
        reemplazar(pie, resumen(), n ? h("div", { class: "hoja-pie-fila" }, botonEnviar) : null, mensaje);
        pie.hidden = !n;
      } else if (paso === 1) {
        reemplazar(cuerpo, h("div", { class: "pedido-paso" }, listaProductos(), sugerencias()));
        reemplazar(pie, resumen(), n ? h("div", { class: "hoja-pie-fila" }, botonContinuar) : null);
        pie.hidden = !n;
      } else {
        reemplazar(cuerpo, h("div", { class: "pedido-paso" }, datos));
        reemplazar(pie, resumen(), h("div", { class: "hoja-pie-fila" }, botonVolver, botonEnviar), mensaje);
        pie.hidden = false;
      }
      contar(totalTexto, total());
      contar(precioContinuar, total());
      totalBs.textContent = EU.bs(total());
      refrescarDatos();
    }

    // Si el cliente escribe en una vista (hoja o columna), la otra se pone al día sin perder lo escrito
    function sincronizar() {
      if (document.activeElement !== campoNombre) campoNombre.value = cliente.nombre;
      if (document.activeElement !== campoDir) campoDir.value = cliente.direccion;
      if (document.activeElement !== campoNotas) campoNotas.value = cliente.notas;
      botonesTipo.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tipo === cliente.tipo)));
      bloqueDir.hidden = cliente.tipo !== "delivery";
      pintarPagos();
    }

    const vista = { raiz, refrescar, refrescarDatos: () => refrescarDatos(), sincronizar, cabeza, borrarNota: () => { if (nota) nota.remove(); } };
    vistasPedido.add(vista);
    refrescar();
    return vista;
  }
  function refrescarTodas() { vistasPedido.forEach((v) => v.refrescar()); actualizarBarra(false); }

  let cerrarHojaPedido = null;
  function abrirPedido() {
    if (cerrarHojaPedido) return;
    const viejo = document.querySelector(".aviso-flotante");
    if (viejo) viejo.remove();
    let vista;
    cerrarHojaPedido = abrirHoja("Tu pedido", (cuerpo, cerrar, hoja) => {
      vista = crearPedido({ enHoja: true, cerrar });
      reemplazar(hoja, h("span", { class: "asa", "aria-hidden": "true" }), vista.raiz); // la hoja del pedido trae su propia cabecera
      hacerArrastrable(hoja, cerrar, vista.cabeza);
    }, { historial: true, alCerrar: () => { vistasPedido.delete(vista); cerrarHojaPedido = null; } });
  }

  function actualizarBarra(saltarBarra) {
    const n = cuenta();
    const barra = $("barra-pedido");
    if (!barra.dataset.armada) {
      barra.dataset.armada = "1";
      reemplazar(barra,
        h("span", { class: "barra-icono" }, icono("bolsa", 22), h("span", { class: "bolsa-cuenta num", hidden: true }, "0")),
        h("span", { class: "barra-textos" }, h("b"), h("small")),
        h("span", { class: "barra-total" }, h("span", { class: "num" }, usd(0)), icono("flecha_der", 18)));
    }
    barra.classList.toggle("vacia", n === 0);
    barra.querySelector(".barra-textos b").textContent = n ? tr("Ver tu pedido") : tr("Arma tu pedido");
    barra.querySelector(".barra-textos small").textContent = n ? n + " " + tr(n > 1 ? "productos" : "producto") : tr("Toca un producto para empezar");
    const burbuja = barra.querySelector(".bolsa-cuenta");
    burbuja.hidden = n === 0;
    burbuja.textContent = String(n);
    barra.querySelector(".barra-total").hidden = n === 0;
    contar(barra.querySelector(".barra-total .num"), total());
    barra.setAttribute("aria-label", n ? tr("Ver tu pedido") + ": " + n + " · " + usd(total()) : tr("Tu pedido está vacío"));
    const insignia = $("bolsa-cuenta");
    insignia.hidden = n === 0;
    insignia.textContent = String(n);
    $("boton-bolsa").setAttribute("aria-label", n ? "Ver pedido, " + n + " " + (n > 1 ? "productos" : "producto") : "Ver tu pedido");
    if (saltarBarra) { saltar(barra); saltar(burbuja); saltar(insignia); }
  }

  function actualizarTarjetas(id, sumo) {
    const p = POR_ID.get(id);
    if (!p) return;
    const n = cantidadDe(id);
    document.querySelectorAll('[data-pid="' + CSS.escape(id) + '"]').forEach((t) => {
      const b = t.querySelector(".cuenta-tarjeta");
      if (b) { b.hidden = !n; b.textContent = String(n); if (sumo && n) saltar(b); }
      t.setAttribute("aria-label", etiquetaAccion(p));
    });
  }
  function actualizarTodo(idCambiado, sumo) {
    if (idCambiado) actualizarTarjetas(idCambiado, sumo);
    const rep = $("repetir");
    if (rep) rep.hidden = cuenta() > 0;
    vistasPedido.forEach((v) => v.refrescar());
    actualizarBarra(sumo);
  }

  /* ───────── Enviar por WhatsApp ───────── */
  function codigoPedido() {
    const letras = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let azar;
    try { azar = Array.from(crypto.getRandomValues(new Uint8Array(4))); } catch (_) { azar = [0, 0, 0, 0].map(() => Math.floor(Math.random() * 256)); }
    return azar.map((b) => letras[b % letras.length]).join("");
  }
  function armarMensaje(codigo) {
    const nota = limpiar(cliente.notas, NOTA_MAX);
    const env = delivery();
    return [
      "*¡Nuevo pedido en " + sitio.nombre + "!* 🔥",
      "*Código:* " + codigo,
      LINEA,
      "*Cliente:* " + limpiar(cliente.nombre, 60),
      "*Tipo:* " + TIPOS[cliente.tipo].nombre,
    ].concat(cliente.tipo === "delivery" ? ["*Dirección:* " + limpiar(cliente.direccion, 200)].concat(envio ? envio.lineas() : []) : [],
      [LINEA, "*Detalle del pedido:*"],
      lineas().reduce((a, l) => a.concat(["- " + l.cant + "x " + nombreLinea(l) + " - " + usd(l.cant * l.unitario)], textoExtras(l) ? ["   " + textoExtras(l)] : []), []),
      env ? ["- Delivery - " + usd(env)] : [],
      ofertas.lineas(subtotal()),
      [LINEA, "*Total a pagar:* " + usd(total()) + " USD"],
      EU.pagos.lineas(cliente.pago, total()),
      cliente.tipo === "delivery" && !EU.costoDelivery() ? ["_(más costo de delivery)_"] : [],
      [LINEA],
      nota ? ["📝 *Notas para la cocina:* " + nota, LINEA] : [],
      ["¡Quedo a la espera de su confirmación!"]).join("\n");
  }

  function enviar(evento) {
    const pedido = evento.currentTarget.closest(".pedido");
    if (!cuenta() || falta()) {
      evento.preventDefault();
      vibrar(30);
      if (!cliente.nombre.trim()) { const i = pedido && pedido.querySelector('input[id^="nombre-"]'); if (i) i.focus(); }
      else if (cliente.tipo === "delivery" && !cliente.direccion.trim()) { const i = pedido && pedido.querySelector('input[id^="dir-"]'); if (i) i.focus(); }
      else if (!cliente.pago) {
        const bloque = pedido && pedido.querySelector(".bloque-pagos");
        if (bloque) { bloque.scrollIntoView({ block: "center", behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" }); bloque.classList.remove("error"); void bloque.offsetWidth; bloque.classList.add("error"); }
      }
      return;
    }
    if (EU.enPanel) { evento.preventDefault(); avisar("En la vista previa no se envían pedidos."); return; }
    const codigo = codigoPedido();
    const ls = lineas();
    EU.registrarPedido({
      items: ls.map((l) => ({ nombre: nombreLinea(l) + (textoExtras(l) ? " " + textoExtras(l) : ""), cantidad: l.cant, precio: l.unitario })),
      total: total(), tipo: TIPOS[cliente.tipo].nombre, pago: cliente.pago,
    });
    memoria.recordar({
      nombre: cliente.nombre, direccion: cliente.direccion, tipo: cliente.tipo, pago: cliente.pago,
      pedido: { resumen: ls.map((l) => ({ nombre: nombreLinea(l), cantidad: l.cant })), total: total(),
        datos: { lineas: ls.map((l) => ({ id: l.id, opcion: l.opcion, extras: l.extras, cant: l.cant })), tipo: cliente.tipo } },
    });
    ss.poner(CLAVE + ":repetir-oculto", true);
    const url = EU.wa(armarMensaje(codigo));
    evento.currentTarget.href = url; // el navegador abre WhatsApp con este enlace al terminar el clic
    setTimeout(() => mostrarEnviado(codigo, url), 0);
  }

  function mostrarEnviado(codigo, url) {
    if (cerrarHojaPedido) cerrarHojaPedido();
    abrirHoja("¡Ya casi!", (cuerpo, cerrar) => {
      poner(cuerpo,
        h("div", { class: "vacio", style: { paddingTop: "4px" } }, svgDe(SVG_BOLSA),
          h("b", null, "Se abrió WhatsApp con tu pedido"),
          h("p", null, "Toca enviar en el chat para que te lo confirmemos."),
          h("p", { class: "num", style: { fontWeight: 600, color: "var(--tinta)" } }, "Código de tu pedido: " + codigo)),
        h("div", { style: { display: "grid", gap: "10px", marginTop: "8px" } },
          h("a", { class: "boton verde ancho toca", href: url, target: "_blank", rel: "noopener" }, icono("enviar", 20), h("span", null, "Abrir WhatsApp otra vez")),
          h("button", { class: "boton suave ancho toca", type: "button", onclick: () => {
            const ids = Array.from(new Set(lineas().map((l) => l.id)));
            carrito.clear();
            cliente.notas = "";
            guardar();
            ids.forEach((id) => actualizarTarjetas(id));
            actualizarTodo();
            cerrar();
            avisar("Listo para un pedido nuevo");
          } }, "Empezar otro pedido")));
    }, { historial: true });
  }

  /* ───────── Repetir el último pedido (clientes que vuelven) ───────── */
  function tarjetaRepetir() {
    if (EU.enPanel || ss.leer(CLAVE + ":repetir-oculto", false)) return null;
    const u = memoria.ultimo ? memoria.ultimo() : null;
    const previas = (u && u.datos && Array.isArray(u.datos.lineas) ? u.datos.lineas : []).map(lineaValida).filter(Boolean);
    if (!previas.length) return null;
    const unidades = previas.reduce((s, l) => s + l.cant, 0);
    const totalPrevio = redondear(previas.reduce((s, l) => s + (POR_ID.get(l.id).precio + l.extras.reduce((t, e) => t + POR_ID.get(e).precio, 0)) * l.cant, 0));
    const primera = previas[0], pp = POR_ID.get(primera.id);
    const nombre = (primera.cant > 1 ? primera.cant + "× " : "") + pp.nombre + (primera.opcion ? " (" + primera.opcion + ")" : "");
    const resto = previas.length - 1;
    const caja = h("div", { class: "repetir", id: "repetir", hidden: cuenta() > 0 },
      h("span", { class: "repetir-icono", "aria-hidden": "true" }, icono("repetir", 22)),
      h("span", { class: "repetir-textos" },
        h("b", null, "¿Lo mismo de la última vez?"),
        h("span", { class: "repetir-detalle" },
          h("span", { class: "repetir-nombre" }, resto ? nombre + " " + tr("y") + " " + resto + " " + tr("más") : nombre),
          h("span", { class: "num" }, "· " + usd(totalPrevio)))),
      h("button", { class: "boton rojo toca", type: "button", "aria-label": tr("Repetir tu último pedido") + ": " + unidades + " · " + usd(totalPrevio), onclick: () => {
        vibrar(12);
        previas.forEach((l) => {
          const k = claveLinea(l.id, l.opcion, l.extras);
          carrito.set(k, { id: l.id, opcion: l.opcion, extras: l.extras.slice(), cant: Math.min(99, (carrito.has(k) ? carrito.get(k).cant : 0) + l.cant) });
        });
        if (tiposOfrecidos.indexOf(u.datos.tipo) >= 0) cliente.tipo = u.datos.tipo;
        guardar();
        new Set(previas.map((l) => l.id)).forEach((id) => actualizarTarjetas(id, true));
        actualizarTodo(null, true);
        avisar("Pedido anterior agregado");
        if (ES_ESCRITORIO()) saltar($("pedido-lateral")); else abrirPedido();
      } }, "Repetir"),
      h("button", { class: "repetir-cerrar", type: "button", "aria-label": "Ocultar", onclick: () => { ss.poner(CLAVE + ":repetir-oculto", true); caja.remove(); } }, icono("x", 16)));
    return caja;
  }

  /* ───────── Arranque ───────── */
  document.querySelectorAll("[data-ico]").forEach((el) => el.replaceWith(icono(el.dataset.ico, Number(el.dataset.tam) || 20)));
  $("boton-bolsa").addEventListener("click", () => {
    if (ES_ESCRITORIO()) { const caja = $("pedido-lateral"); caja.scrollIntoView({ behavior: "smooth", block: "nearest" }); saltar(caja); }
    else abrirPedido();
  });
  $("barra-pedido").addEventListener("click", () => { vibrar(6); abrirPedido(); });
  const conBuscador = textosMenu.buscador !== false && PRODUCTOS.length > 0;
  $("buscador").hidden = !conBuscador;
  $("boton-buscar").hidden = !conBuscador;
  $("boton-buscar").addEventListener("click", () => {
    const b = $("buscar");
    const destino = $("buscador").getBoundingClientRect().top + scrollY - $("cabecera").offsetHeight - 8;
    scrollTo({ top: destino, behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
    b.focus({ preventScroll: true });
  });
  let temporizadorBusqueda;
  $("buscar").addEventListener("input", (e) => { clearTimeout(temporizadorBusqueda); temporizadorBusqueda = setTimeout(() => filtrar(e.target.value), 120); });
  $("buscar").addEventListener("keydown", (e) => { if (e.key === "Escape") limpiarBusqueda(false); if (e.key === "Enter") e.target.blur(); });
  $("buscar-limpiar").addEventListener("click", () => limpiarBusqueda(true));

  pintarMenu();
  actualizarBarra(false);

  // La columna del pedido solo existe en pantallas grandes; en el teléfono no se arma
  const pantallaGrande = matchMedia("(min-width: 1024px)");
  let lateralMontado = false;
  function montarLateral() {
    if (lateralMontado || !pantallaGrande.matches) return;
    lateralMontado = true;
    poner($("pedido-lateral"), crearPedido({ enHoja: false }).raiz);
  }
  montarLateral();
  if (pantallaGrande.addEventListener) pantallaGrande.addEventListener("change", montarLateral);
  else if (pantallaGrande.addListener) pantallaGrande.addListener(montarLateral);

  // Con el teclado abierto, la hoja se ajusta al espacio visible y el campo activo queda a la vista
  const vv = window.visualViewport;
  if (vv) {
    const raiz = document.documentElement;
    const ajustar = () => { raiz.style.setProperty("--vv-alto", Math.round(vv.height) + "px"); raiz.style.setProperty("--vv-top", Math.round(vv.offsetTop) + "px"); };
    vv.addEventListener("resize", ajustar);
    vv.addEventListener("scroll", ajustar);
    ajustar();
  }
  document.addEventListener("focusin", (e) => {
    const campo = e.target;
    if (!campo.matches || !campo.matches(".hoja input, .hoja textarea")) return;
    setTimeout(() => campo.scrollIntoView({ block: "center", behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" }), 320);
  });

  // La portada (mascota, partículas) deja de animarse cuando no se ve
  const portada = $("portada");
  if ("IntersectionObserver" in window) new IntersectionObserver((e) => portada.classList.toggle("pausada", !e[0].isIntersecting)).observe(portada);

  refrescarHorario();
  setInterval(refrescarHorario, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescarHorario(); });

  const medir = () => document.documentElement.style.setProperty("--alto-cabecera", $("cabecera").offsetHeight + "px");
  medir();
  if ("ResizeObserver" in window) new ResizeObserver(medir).observe($("cabecera")); else addEventListener("resize", medir);
  const sombraCabecera = () => $("cabecera").classList.toggle("con-sombra", scrollY > 8);
  addEventListener("scroll", sombraCabecera, { passive: true });
  sombraCabecera();

  /* ───────── Textos de esta plantilla en inglés, portugués e italiano (core/idiomas.js) ───────── */
  function textosPropios() {
    if (!EU.idiomaAgregar) return;
    const D = {
      "Abierto ahora": ["Open now", "Aberto agora", "Aperto ora"],
      "Buscar en el menú": ["Search the menu", "Buscar no cardápio", "Cerca nel menù"],
      "Busca hamburguesa, perro, papas…": ["Search burger, hot dog, fries…", "Busque hambúrguer, cachorro-quente, batata…", "Cerca hamburger, hot dog, patatine…"],
      "Borrar búsqueda": ["Clear search", "Limpar busca", "Cancella ricerca"],
      "Categorías del menú": ["Menu categories", "Categorias do cardápio", "Categorie del menù"],
      "Desliza para ver más": ["Swipe to see more", "Deslize para ver mais", "Scorri per vedere di più"],
      "🔥 Lo más pedido": ["🔥 Most ordered", "🔥 Os mais pedidos", "🔥 I più ordinati"],
      "Te puede gustar": ["You might like", "Você pode gostar", "Potrebbe piacerti"],
      "Agotado por ahora": ["Sold out for now", "Esgotado por enquanto", "Esaurito per ora"],
      "agotado por ahora": ["sold out for now", "esgotado por enquanto", "esaurito per ora"],
      "precio por confirmar": ["price to be confirmed", "preço a confirmar", "prezzo da confermare"],
      "Este producto todavía no tiene precio": ["This item doesn't have a price yet", "Este produto ainda não tem preço", "Questo prodotto non ha ancora un prezzo"],
      "Elegir y agregar": ["Choose and add", "Escolher e adicionar", "Scegli e aggiungi"],
      "en tu pedido": ["in your order", "no seu pedido", "nel tuo ordine"],
      "opción": ["option", "opção", "opzione"],
      "No encontramos eso": ["We couldn't find that", "Não encontramos isso", "Non l'abbiamo trovato"],
      "Prueba con otra palabra o revisa cómo la escribiste.": ["Try another word or check the spelling.", "Tente outra palavra ou revise como escreveu.", "Prova un'altra parola o controlla come l'hai scritta."],
      "Ver todo el menú": ["See the whole menu", "Ver todo o cardápio", "Vedi tutto il menù"],
      "Pronto publicaremos el menú.": ["We'll publish the menu soon.", "Em breve publicaremos o cardápio.", "Presto pubblicheremo il menù."],
      "Escríbenos por WhatsApp y te contamos qué hay hoy.": ["Message us on WhatsApp and we'll tell you what's on today.", "Fale conosco pelo WhatsApp e contamos o que tem hoje.", "Scrivici su WhatsApp e ti diciamo cosa c'è oggi."],
      "Escríbenos por WhatsApp": ["Message us on WhatsApp", "Fale conosco pelo WhatsApp", "Scrivici su WhatsApp"],
      "Mascota bailarina, tócala para que salte": ["Dancing mascot, tap it to make it jump", "Mascote dançarino, toque para ele pular", "Mascotte ballerina, toccala per farla saltare"],
      "Elige una opción": ["Choose an option", "Escolha uma opção", "Scegli un'opzione"],
      "Obligatorio": ["Required", "Obrigatório", "Obbligatorio"],
      "✓ Listo": ["✓ Done", "✓ Pronto", "✓ Fatto"],
      "Opcional": ["Optional", "Opcional", "Facoltativo"],
      "¿Le agregas algo?": ["Add something?", "Quer adicionar algo?", "Vuoi aggiungere qualcosa?"],
      "Uno menos": ["One less", "Um a menos", "Uno in meno"],
      "Uno más": ["One more", "Mais um", "Uno in più"],
      "Pasos del pedido": ["Order steps", "Etapas do pedido", "Passaggi dell'ordine"],
      "Productos": ["Items", "Produtos", "Prodotti"],
      "Entrega": ["Delivery details", "Entrega", "Consegna"],
      "Continuar": ["Continue", "Continuar", "Continua"],
      "Volver a los productos": ["Back to items", "Voltar aos produtos", "Torna ai prodotti"],
      "Cerrar pedido": ["Close order", "Fechar pedido", "Chiudi ordine"],
      "Enviar por WhatsApp": ["Send via WhatsApp", "Enviar pelo WhatsApp", "Invia su WhatsApp"],
      "¿A nombre de quién?": ["Whose name is it under?", "Em nome de quem?", "A nome di chi?"],
      "Calle, casa o edificio y una referencia": ["Street, house or building and a landmark", "Rua, casa ou prédio e uma referência", "Via, casa o palazzo e un riferimento"],
      "Sin cebolla, salsas aparte…": ["No onion, sauces on the side…", "Sem cebola, molhos à parte…", "Senza cipolla, salse a parte…"],
      "¿Cómo lo quieres?": ["How do you want it?", "Como você quer?", "Come lo vuoi?"],
      "¿Cómo vas a pagar?": ["How will you pay?", "Como vai pagar?", "Come pagherai?"],
      "Forma de pago": ["Payment method", "Forma de pagamento", "Metodo di pagamento"],
      "Notas para la cocina": ["Notes for the kitchen", "Observações para a cozinha", "Note per la cucina"],
      "(opcional)": ["(optional)", "(opcional)", "(facoltativo)"],
      "Pusimos los datos de tu último pedido.": ["We filled in the details from your last order.", "Preenchemos os dados do seu último pedido.", "Abbiamo inserito i dati del tuo ultimo ordine."],
      "Borrarlos": ["Delete them", "Apagá-los", "Cancellali"],
      "Listo, borramos tus datos de este teléfono.": ["Done, we deleted your details from this phone.", "Pronto, apagamos seus dados deste telefone.", "Fatto, abbiamo cancellato i tuoi dati da questo telefono."],
      "Escribe tu nombre para enviar el pedido.": ["Type your name to send the order.", "Escreva seu nome para enviar o pedido.", "Scrivi il tuo nome per inviare l'ordine."],
      "Escribe la dirección para el delivery.": ["Type the delivery address.", "Escreva o endereço para a entrega.", "Scrivi l'indirizzo per la consegna."],
      "Tu pedido está vacío": ["Your order is empty", "Seu pedido está vazio", "Il tuo ordine è vuoto"],
      "Elige algo rico del menú y aparecerá aquí.": ["Pick something tasty from the menu and it'll show up here.", "Escolha algo gostoso do cardápio e ele aparecerá aqui.", "Scegli qualcosa di buono dal menù e apparirà qui."],
      "Ver tu pedido": ["View your order", "Ver seu pedido", "Vedi il tuo ordine"],
      "Arma tu pedido": ["Build your order", "Monte seu pedido", "Componi il tuo ordine"],
      "Toca un producto para empezar": ["Tap an item to start", "Toque um produto para começar", "Tocca un prodotto per iniziare"],
      "producto": ["item", "produto", "prodotto"],
      "productos": ["items", "produtos", "prodotti"],
      "¡Ya casi!": ["Almost there!", "Quase lá!", "Ci siamo quasi!"],
      "Se abrió WhatsApp con tu pedido": ["WhatsApp opened with your order", "O WhatsApp abriu com seu pedido", "WhatsApp si è aperto con il tuo ordine"],
      "Toca enviar en el chat para que te lo confirmemos.": ["Tap send in the chat so we can confirm it.", "Toque em enviar no chat para confirmarmos.", "Tocca invia nella chat così te lo confermiamo."],
      "Abrir WhatsApp otra vez": ["Open WhatsApp again", "Abrir o WhatsApp de novo", "Apri di nuovo WhatsApp"],
      "Empezar otro pedido": ["Start a new order", "Começar outro pedido", "Inizia un altro ordine"],
      "Listo para un pedido nuevo": ["Ready for a new order", "Pronto para um novo pedido", "Pronto per un nuovo ordine"],
      "¿Lo mismo de la última vez?": ["The same as last time?", "O mesmo da última vez?", "Lo stesso dell'ultima volta?"],
      "Repetir": ["Repeat", "Repetir", "Ripeti"],
      "Repetir tu último pedido": ["Repeat your last order", "Repetir seu último pedido", "Ripeti il tuo ultimo ordine"],
      "Ocultar": ["Hide", "Ocultar", "Nascondi"],
      "Pedido anterior agregado": ["Previous order added", "Pedido anterior adicionado", "Ordine precedente aggiunto"],
      "y": ["and", "e", "e"],
      "más": ["more", "mais", "altri"],
      "Subtotal": ["Subtotal", "Subtotal", "Subtotale"],
      "Todos los días": ["Every day", "Todos os dias", "Tutti i giorni"],
      "Hoy cerrado": ["Closed today", "Fechado hoje", "Chiuso oggi"],
      "En la vista previa no se envían pedidos.": ["Orders aren't sent from the preview.", "Na pré-visualização não se enviam pedidos.", "Dall'anteprima non si inviano ordini."],
    };
    const col = EU.idiomaCol;
    const DIAS = { Lun: ["Mon", "Seg", "Lun"], Mar: ["Tue", "Ter", "Mar"], "Mié": ["Wed", "Qua", "Mer"], Jue: ["Thu", "Qui", "Gio"], Vie: ["Fri", "Sex", "Ven"], "Sáb": ["Sat", "Sáb", "Sab"], Dom: ["Sun", "Dom", "Dom"] };
    const dia = (x) => (DIAS[x] ? DIAS[x][col] : x);
    const PAT = [
      [/^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom)(?: (a|y) (Lun|Mar|Mié|Jue|Vie|Sáb|Dom))?: (.+)$/, (m) =>
        dia(m[1]) + (m[2] ? (m[2] === "a" ? ["–", " a ", "–"][col] : [" & ", " e ", " e "][col]) + dia(m[3]) : "") + ": " + m[4]],
      [/^Todos los días: (.+)$/, ["Every day: $1", "Todos os dias: $1", "Tutti i giorni: $1"]],
      [/^Hoy: (.+)$/, ["Today: $1", "Hoje: $1", "Oggi: $1"]],
      [/^Agregaste (\d+) (.+)$/, ["You added $1 $2", "Você adicionou $1 $2", "Hai aggiunto $1 $2"]],
      [/^Agregaste (.+)$/, ["You added $1", "Você adicionou $1", "Hai aggiunto $1"]],
      [/^(.+) está agotado por ahora$/, ["$1 is sold out for now", "$1 está esgotado por enquanto", "$1 è esaurito per ora"]],
      [/^(\d+) opciones$/, ["$1 options", "$1 opções", "$1 opzioni"]],
      [/^(\d+) opción$/, ["$1 option", "$1 opção", "$1 opzione"]],
      [/^(\d+) resultados? para “(.+)”$/, ["$1 results for “$2”", "$1 resultados para “$2”", "$1 risultati per “$2”"]],
      [/^Máximo (\d+) adicionales por producto$/, ["Up to $1 add-ons per item", "Máximo de $1 adicionais por produto", "Massimo $1 aggiunte per prodotto"]],
      [/^Elige (.+) para continuar\.$/, ["Choose $1 to continue.", "Escolha $1 para continuar.", "Scegli $1 per continuare."]],
      [/^Elegir (.+)$/, ["Choose $1", "Escolher $1", "Scegli $1"]],
      [/^Código de tu pedido: (\S+)$/, ["Your order code: $1", "Código do seu pedido: $1", "Codice del tuo ordine: $1"]],
      [/^En delivery aceptamos (.+)\.$/, ["For delivery we accept $1.", "Na entrega aceitamos $1.", "Per la consegna accettiamo $1."]],
      [/^Ver pedido, (\d+) productos?$/, ["View order, $1 items", "Ver pedido, $1 produtos", "Vedi ordine, $1 prodotti"]],
      [/^(.+)\. Puedes enviar tu pedido y te respondemos al abrir\.$/, (m) => (EU.t(m[1]) + ". " + ["You can send your order and we'll reply when we open.", "Você pode enviar seu pedido e respondemos ao abrir.", "Puoi inviare l'ordine e ti rispondiamo all'apertura."][col])],
    ];
    EU.idiomaAgregar(D, PAT);
  }
});
