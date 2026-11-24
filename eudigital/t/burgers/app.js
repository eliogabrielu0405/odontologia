/* Plantilla Burgers: cartel con hamburguesa que se abre al bajar, menú por categorías y pedido por WhatsApp. */
EU.alListo(function (sitio) {
  "use strict";
  const c = sitio.c;
  const $ = (id) => document.getElementById(id);
  const esc = EU.esc;
  const usd = EU.usd;
  const LINEA = "----------------------------------------";
  const NOTA_MAX = 200;
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } },
  };

  /* ---------- Menú desde los datos del negocio ---------- */
  const CATS = (c.catalogo.categorias || []).filter((k) => k && k.id && k.nombre);
  const PRODS = (c.catalogo.productos || []).filter((p) => p && p.id && p.nombre && CATS.some((k) => k.id === p.cat))
    .map((p) => Object.assign({}, p, { precio: Math.max(0, Number(p.precio) || 0) }));
  const CON_PRODUCTOS = CATS.filter((k) => PRODS.some((p) => p.cat === k.id));
  const buscar = (id) => PRODS.find((p) => p.id === id);
  const emojiDe = (catId) => ((CATS.find((k) => k.id === catId) || {}).emoji || "🍔");
  const sePuede = (p) => p && p.precio > 0 && !p.agotado;
  const TIPOS = [
    { id: "aqui", nombre: "Comer aquí", icono: "i-cubiertos" },
    { id: "llevar", nombre: "Para llevar", icono: "i-bolsa" },
    { id: "delivery", nombre: "Delivery", icono: "i-moto" },
  ];
  const tiposOfrecidos = (c.pedidos.tipos || []).map((id) => TIPOS.find((t) => t.id === id)).filter(Boolean);
  if (!tiposOfrecidos.length) tiposOfrecidos.push(TIPOS[1]);

  /* ---------- Estado del pedido (sobrevive si la página se recarga) ---------- */
  const CLAVE = "eu:burgers:" + (sitio.slug || "demo");
  const guardado = (() => { try { return JSON.parse(ss.get(CLAVE) || "null"); } catch (_) { return null; } })() || {};
  const qty = {};
  Object.entries(guardado.qty || {}).forEach(([id, n]) => { if (sePuede(buscar(id)) && n > 0) qty[id] = Math.min(99, Math.floor(n)); });
  let cat = CON_PRODUCTOS.some((k) => k.id === guardado.cat) ? guardado.cat : (CON_PRODUCTOS[0] || {}).id;
  let tipo = tiposOfrecidos.some((t) => t.id === guardado.tipo) ? guardado.tipo : tiposOfrecidos[0].id;
  let pago = "";
  const guardar = () => ss.set(CLAVE, JSON.stringify({ qty, cat, tipo }));
  const lineas = () => PRODS.filter((p) => qty[p.id]).map((p) => Object.assign({}, p, { cant: qty[p.id] }));
  const cuenta = () => lineas().reduce((s, l) => s + l.cant, 0);
  const subtotal = () => lineas().reduce((s, l) => s + l.cant * l.precio, 0);
  const delivery = () => (tipo === "delivery" && cuenta() ? EU.costoDelivery() : 0);
  const total = () => subtotal() + delivery();

  /* ---------- Encabezado ---------- */
  $("nombre").textContent = sitio.nombre;
  $("lema").textContent = c.negocio.eslogan || "";
  $("lema").hidden = !c.negocio.eslogan;
  const logo = EU.url(c.negocio.logo);
  const fotoLogo = (caja) => {
    if (!logo) return;
    const im = document.createElement("img");
    im.src = logo; im.alt = ""; im.onerror = () => im.remove();
    caja.appendChild(im);
  };
  fotoLogo($("logo"));
  if (c.animaciones.temporada === "navidad") document.documentElement.classList.add("navidad");

  /* ---------- Portada: hamburguesa que se abre al bajar ---------- */
  const conHamburguesa = !(c.portada && c.portada.hamburguesa === false);
  $("hbAviso").textContent = (c.portada && c.portada.aviso) || "";
  if (!conHamburguesa) {
    $("hb").hidden = true;
    $("portada").hidden = false;
    $("portadaNombre").textContent = sitio.nombre;
    $("portadaTxt").textContent = c.negocio.descripcion || c.negocio.eslogan || "";
    fotoLogo($("logoGrande"));
  } else {
    const CUADROS = 63, W = 640, H = 480;
    const ruta = (i) => `/t/burgers/img/hamburguesa/f${String(i + 1).padStart(2, "0")}.webp`;
    const ctx = $("lienzo").getContext("2d");
    const fuera = $("hb"), fijo = fuera.querySelector(".hb-fijo");
    if (EU.reducido) fuera.classList.add("quieta");
    const cuadros = Array.from({ length: CUADROS }, (_, i) => { const im = new Image(); im.decoding = "async"; im.src = ruta(EU.reducido ? CUADROS - 1 : i); return im; });
    let actual = -1, raf = 0;
    const dibujar = (i) => {
      for (let k = i; k >= 0; k--) { const im = cuadros[k]; if (im.complete && im.naturalWidth) { ctx.drawImage(im, 0, 0, W, H); return; } }
    };
    const avanzar = () => {
      raf = 0;
      let p = 1; // con "reducir movimiento" se muestra abierta
      if (!EU.reducido) {
        const r = fuera.getBoundingClientRect();
        const tope = parseFloat(getComputedStyle(fijo).top) || 96;
        const largo = Math.max(1, r.height - fijo.offsetHeight - tope);
        p = Math.min(1, Math.max(0, (tope - r.top) / largo));
      }
      const i = Math.round(p * (CUADROS - 1));
      if (i !== actual) { actual = i; dibujar(i); }
      $("hbAviso").classList.toggle("fuera", p >= 0.04 || EU.reducido);
    };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(avanzar); };
    cuadros.forEach((im) => { im.onload = () => { actual = -1; pedir(); }; });
    addEventListener("scroll", pedir, { passive: true });
    addEventListener("resize", pedir);
    pedir();
  }
  document.querySelectorAll("[data-ir-menu]").forEach((b) => b.addEventListener("click", () => $("menu").scrollIntoView({ behavior: EU.reducido ? "auto" : "smooth" })));

  /* ---------- Categorías y productos ---------- */
  function renderCats() {
    $("cats").innerHTML = CON_PRODUCTOS.map((k) =>
      `<button class="cat sticker toca" type="button" data-cat="${esc(k.id)}" aria-pressed="${k.id === cat}"><span aria-hidden="true">${esc(k.emoji || "")}</span>${esc(k.nombre)}</button>`).join("");
    $("cats").hidden = CON_PRODUCTOS.length < 2;
  }
  const iconoMas = `<svg class="ic"><use href="#i-mas"/></svg>`;
  const iconoMenos = `<svg class="ic"><use href="#i-menos"/></svg>`;
  const cantidadHTML = (id, n) => `<div class="cant"><button class="sticker toca" type="button" data-menos="${esc(id)}" aria-label="Quitar uno">${iconoMenos}</button><b>${n}</b><button class="sticker toca" type="button" data-mas="${esc(id)}" aria-label="Agregar uno">${iconoMas}</button></div>`;
  function accionHTML(p) {
    const n = qty[p.id] || 0;
    if (n > 0) return cantidadHTML(p.id, n);
    const txt = p.agotado ? "Agotado por hoy" : p.precio > 0 ? `${iconoMas} Agregar al pedido` : "Sin precio todavía";
    return `<button class="agregar sticker toca" type="button" data-mas="${esc(p.id)}"${sePuede(p) ? "" : " disabled"}>${txt}</button>`;
  }
  function renderGrid() {
    const items = PRODS.filter((p) => p.cat === cat);
    if (!items.length) { $("grid").innerHTML = `<p class="vacio">Pronto publicaremos el menú.</p>`; return; }
    $("grid").innerHTML = items.map((p) => {
      const foto = EU.url(p.foto);
      return `<article class="prod sticker${p.agotado ? " agotado" : ""}" data-eu-producto>
        <div class="foto" aria-hidden="true">${esc(emojiDe(p.cat))}${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
        <div class="prod-txt"><h3>${esc(p.nombre)}</h3>${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ""}
          <p class="precio${p.precio > 0 ? "" : " sin"}">${p.precio > 0 ? usd(p.precio) + (EU.tasa() > 0 ? `<small>${EU.bs(p.precio)}</small>` : "") : "Precio por confirmar"}</p></div>
        <div class="prod-acc" data-acc="${esc(p.id)}">${accionHTML(p)}</div>
      </article>`;
    }).join("");
  }

  /* ---------- Pedido ---------- */
  $("tipos").innerHTML = tiposOfrecidos.map((t) =>
    `<button class="tipo sticker toca" type="button" data-tipo="${t.id}" aria-pressed="${t.id === tipo}"><svg class="ic"><use href="#${t.icono}"/></svg>${t.nombre}</button>`).join("");
  $("tipos").style.gridTemplateColumns = `repeat(${tiposOfrecidos.length},minmax(0,1fr))`;
  $("tipos").closest("fieldset").hidden = tiposOfrecidos.length < 2;
  $("notaDelivery").textContent = EU.costoDelivery() ? `El delivery cuesta ${usd(EU.costoDelivery())}.` : (c.pedidos.notaDelivery || "");
  const est = EU.estado();
  if (!est.abierto) { $("cerrado").textContent = est.texto + ". Puedes enviar tu pedido y te respondemos apenas abramos."; $("cerrado").hidden = false; }
  $("info").innerHTML = EU.htmlInfo();

  function falta() {
    if (!cuenta()) return "";
    if (!$("cliente").value.trim()) return "Escribe tu nombre para confirmar.";
    if (tipo === "delivery" && !$("direccion").value.trim()) return "Escribe la dirección del delivery.";
    if (EU.pagos.disponibles(tipo).length && !pago) return "Elige cómo vas a pagar.";
    return "";
  }
  function renderPago() {
    if (!EU.pagos.disponibles(tipo).some((m) => m.id === pago)) pago = "";
    $("pago").innerHTML = EU.pagos.html(tipo, pago, "pago");
    $("pagoDetalle").innerHTML = pago ? EU.pagos.detalle(pago, total()) : "";
  }
  function renderEstadoEnvio() {
    const f = falta();
    $("enviar").disabled = !cuenta() || !!f;
    $("falta").textContent = f; $("falta").hidden = !f;
  }
  function renderPedido() {
    const ls = lineas();
    $("cuenta").textContent = cuenta();
    $("lineas").innerHTML = ls.length
      ? `<ul>${ls.map((l) => `<li><div class="txt"><b>${esc(l.nombre)}</b><span>${usd(l.cant * l.precio)}</span></div>${cantidadHTML(l.id, l.cant)}<button class="borrar" type="button" data-borrar="${esc(l.id)}" aria-label="Eliminar ${esc(l.nombre)}"><svg class="ic"><use href="#i-basura"/></svg></button></li>`).join("")}${delivery() ? `<li><div class="txt"><b>Delivery</b><span>${usd(delivery())}</span></div></li>` : ""}</ul>`
      : `<p class="ped-vacio">Aún no hay productos. Elige algo del menú para empezar.</p>`;
    $("total").textContent = usd(total());
    $("totalBs").textContent = EU.bs(total());
    $("campoDir").hidden = tipo !== "delivery";
    document.querySelectorAll("[data-tipo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tipo === tipo)));
    renderPago();
    renderEstadoEnvio();
    const n = cuenta();
    $("bolsaN").hidden = !n; $("bolsaN").textContent = n;
    $("bolsa").setAttribute("aria-label", `Ver pedido, ${n} productos`);
    $("barraN").textContent = n; $("barraTotal").textContent = usd(total());
    $("barra").hidden = !n || $("lado").classList.contains("abierto");
    guardar();
  }
  function actualizarProducto(id) {
    const caja = document.querySelector(`[data-acc="${CSS.escape(id)}"]`);
    const p = buscar(id);
    if (caja && p) caja.innerHTML = accionHTML(p);
  }
  function sumar(id, d) {
    const p = buscar(id);
    if (!p) return;
    if (d > 0 && !sePuede(p)) return;
    if (d > 0) EU.mascotaBrinca();
    const n = (qty[id] || 0) + d;
    if (n > 0) qty[id] = Math.min(99, n); else delete qty[id];
    actualizarProducto(id);
    renderPedido();
  }

  function mensaje() {
    const t = tiposOfrecidos.find((x) => x.id === tipo) || TIPOS[1];
    const nota = $("notas").value.replace(/\s+/g, " ").trim().slice(0, NOTA_MAX);
    const out = [
      `*¡Nuevo pedido en ${sitio.nombre}!* 🍔`,
      LINEA,
      `*Cliente:* ${$("cliente").value.trim()}`,
      `*Tipo:* ${t.nombre}`,
      ...(tipo === "delivery" ? [`*Dirección:* ${$("direccion").value.trim()}`] : []),
      LINEA,
      "*Detalle del pedido:*",
      ...lineas().map((l) => `- ${l.cant}x ${l.nombre} - ${usd(l.cant * l.precio)}`),
      ...(delivery() ? [`- Delivery - ${usd(delivery())}`] : []),
      LINEA,
      `*Total a pagar:* ${usd(total())} USD`,
      ...EU.pagos.lineas(pago, total()),
      ...(tipo === "delivery" && !EU.costoDelivery() ? ["_(más costo de delivery)_"] : []),
      LINEA,
      ...(nota ? [`📝 *Notas para la cocina:* ${nota}`, LINEA] : []),
      "¡Quedo a la espera de su confirmación!",
    ];
    return out.join("\n");
  }
  let avisoT;
  function aviso(t) { const el = $("avisoFlota"); el.textContent = t; el.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(() => { el.hidden = true; }, 2200); }

  function abrir() { $("lado").classList.add("abierto"); $("barra").hidden = true; document.body.style.overflow = "hidden"; $("cerrar").focus(); }
  function cerrar() { $("lado").classList.remove("abierto"); document.body.style.overflow = ""; renderPedido(); }

  /* ---------- Eventos ---------- */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat],[data-mas],[data-menos],[data-borrar],[data-tipo]");
    if (!b) return;
    if (b.dataset.cat) { cat = b.dataset.cat; renderCats(); renderGrid(); guardar(); return; }
    if (b.dataset.mas) { sumar(b.dataset.mas, 1); return; }
    if (b.dataset.menos) { sumar(b.dataset.menos, -1); return; }
    if (b.dataset.borrar) { delete qty[b.dataset.borrar]; actualizarProducto(b.dataset.borrar); renderPedido(); return; }
    if (b.dataset.tipo) { tipo = b.dataset.tipo; renderPedido(); }
  });
  $("bolsa").addEventListener("click", abrir);
  $("barra").addEventListener("click", abrir);
  $("cerrar").addEventListener("click", cerrar);
  $("lado").addEventListener("click", (e) => { if (e.target === $("lado")) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("lado").classList.contains("abierto")) cerrar(); });
  $("form").addEventListener("input", (e) => {
    if (e.target.id === "notas") $("contador").textContent = `${e.target.value.length}/${NOTA_MAX}`;
    renderEstadoEnvio();
  });
  $("form").addEventListener("change", (e) => { if (e.target.name === "pago") { pago = e.target.value; renderPago(); renderEstadoEnvio(); } });
  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = falta();
    if (!cuenta() || f) { renderEstadoEnvio(); return; }
    if (EU.enPanel) { aviso("En la vista previa no se envían pedidos."); return; }
    const t = tiposOfrecidos.find((x) => x.id === tipo) || TIPOS[1];
    EU.registrarPedido({ items: lineas().map((l) => ({ nombre: l.nombre, cantidad: l.cant, precio: l.precio })), total: total(), tipo: t && t.nombre, pago });
    window.open(EU.wa(mensaje()), "_blank", "noopener");
  });

  renderCats();
  renderGrid();
  renderPedido();
});
