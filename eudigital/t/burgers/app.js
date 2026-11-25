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
  } else if (EU.url(c.portada && c.portada.foto)) {
    // Foto propia del cliente en el mismo recuadro, en lugar de la hamburguesa animada
    const fuera = $("hb");
    fuera.classList.add("quieta");
    fuera.setAttribute("aria-label", "Portada");
    $("hbAviso").textContent = "";
    const im = new Image();
    im.className = "hb-foto"; im.decoding = "async"; im.alt = sitio.nombre || "";
    im.src = EU.url(c.portada.foto);
    $("lienzo").replaceWith(im);
  } else {
    const CUADROS = 63, W = 640, H = 480;
    const ruta = (i) => `/t/burgers/img/hamburguesa/f${String(i + 1).padStart(2, "0")}.webp`;
    const ctx = $("lienzo").getContext("2d", { willReadFrequently: true });
    const fuera = $("hb"), fijo = fuera.querySelector(".hb-fijo");
    if (EU.reducido) fuera.classList.add("quieta");
    const cuadros = new Array(CUADROS).fill(null), listos = new Array(CUADROS).fill(false);
    let actual = -1, raf = 0;

    /* Letrero en la pared del fondo: el nombre que el cliente quiera, pintado detrás de la hamburguesa.
       Las fotos traen la pared limpia; "pared.webp" es esa franja sin nada delante. Donde el cuadro
       coincide con la pared se ve el letrero; donde algo de la hamburguesa la tapa, no. */
    const P = c.portada || {};
    const textoLetrero = P.letreroVer === false ? "" : String((P.letrero || "").trim() || sitio.nombre || "").slice(0, 40);
    const ALTO = 96; // la franja de pared encima de la raya amarilla
    let capa = null, pared = null;
    const armarLetrero = () => {
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = ALTO;
      const x = cv.getContext("2d");
      const fuente = (n) => `${n}px "Caveat Brush", "Comic Sans MS", cursive`;
      let n = 74;
      x.font = fuente(n);
      const ancho = x.measureText(textoLetrero).width, max = W - 90;
      if (ancho > max) { n = Math.max(24, Math.floor(n * max / ancho)); x.font = fuente(n); }
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillStyle = EU.color(P.letreroColor) || "#1E1E1E";
      if ("filter" in x) x.filter = "blur(1.2px)"; // la pared está un poco desenfocada en la foto
      x.fillText(textoLetrero, W / 2, 48);
      capa = x.getImageData(0, 0, W, ALTO);
    };
    const pintarLetrero = () => {
      if (!capa || !pared) return;
      const f = ctx.getImageData(0, 0, W, ALTO), d = f.data, t = capa.data, p = pared.data;
      for (let j = 0; j < d.length; j += 4) {
        let a = t[j + 3];
        if (!a) continue;
        const dif = Math.max(Math.abs(d[j] - p[j]), Math.abs(d[j + 1] - p[j + 1]), Math.abs(d[j + 2] - p[j + 2]));
        const visible = dif <= 14 ? 1 : dif >= 34 ? 0 : (34 - dif) / 20; // 0 = la hamburguesa tapa la pared
        a = (a / 255) * visible;
        if (!a) continue;
        d[j] += (t[j] - d[j]) * a; d[j + 1] += (t[j + 1] - d[j + 1]) * a; d[j + 2] += (t[j + 2] - d[j + 2]) * a;
      }
      ctx.putImageData(f, 0, 0);
    };
    if (textoLetrero) {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = W; cv.height = ALTO;
        const x = cv.getContext("2d");
        x.drawImage(im, 0, 0, W, ALTO);
        pared = x.getImageData(0, 0, W, ALTO);
        actual = -1; pedir();
      };
      im.src = "/t/burgers/img/hamburguesa/pared.webp";
      const listo = () => { armarLetrero(); actual = -1; pedir(); };
      if (document.fonts && document.fonts.load) document.fonts.load('74px "Caveat Brush"', textoLetrero).then(listo, listo);
      else listo();
    }

    // Dibuja la foto pedida o, si todavía no llegó, la más cercana que ya esté lista
    const dibujar = (i) => {
      for (let k = 0; k < CUADROS; k++) {
        for (const j of k ? [i - k, i + k] : [i]) {
          if (j >= 0 && j < CUADROS && listos[j]) { ctx.drawImage(cuadros[j], 0, 0, W, H); pintarLetrero(); return; }
        }
      }
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
    /* Las 63 fotos no se piden de una vez (son casi 1,5 MB y frenaban la página con internet lento).
       Primero va solo la que se ve arriba. Cuando la página terminó de cargar, o apenas la persona
       empieza a bajar, llegan una de cada cuatro, después las del medio y al final el resto,
       de a tres a la vez para no quitarle velocidad a las fotos del menú. Con "ahorro de datos"
       solo se bajan las principales: la animación sigue funcionando, un poco menos fluida. */
    const pedirCuadro = (i) => new Promise((fin) => {
      if (cuadros[i]) return fin();
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { listos[i] = true; actual = -1; pedir(); fin(); };
      im.onerror = () => fin();
      im.src = ruta(i);
      cuadros[i] = im;
    });
    if (EU.reducido) pedirCuadro(CUADROS - 1); // con "reducir movimiento" se muestra abierta, sin animación
    else {
      pedirCuadro(0);
      const ahorro = !!(navigator.connection && navigator.connection.saveData);
      const orden = [];
      for (const paso of ahorro ? [4] : [4, 2, 1]) {
        for (let i = paso; i < CUADROS; i += paso) if (!orden.includes(i)) orden.push(i);
        if (!orden.includes(CUADROS - 1)) orden.push(CUADROS - 1);
      }
      let empezado = false;
      const resto = () => {
        if (empezado) return;
        empezado = true;
        const hilo = async () => { while (orden.length) await pedirCuadro(orden.shift()); };
        for (let n = 0; n < 3; n++) hilo();
      };
      if (document.readyState === "complete") resto();
      else addEventListener("load", resto, { once: true });
      addEventListener("scroll", resto, { passive: true, once: true });
    }
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
    EU.cliente.recordar({
      nombre: $("cliente").value, direccion: $("direccion").value, tipo, pago,
      pedido: { resumen: lineas().map((l) => ({ nombre: l.nombre, cantidad: l.cant })), total: total(), datos: { qty: Object.assign({}, qty), tipo } },
    });
    window.open(EU.wa(mensaje()), "_blank", "noopener");
  });

  /* ---------- Quien ya compró aquí: sus datos y "Repetir pedido" ---------- */
  const yo = EU.cliente.datos();
  if (!guardado.tipo && tiposOfrecidos.some((t) => t.id === yo.tipo)) tipo = yo.tipo;
  if (EU.pagos.disponibles(tipo).some((m) => m.id === yo.pago)) pago = yo.pago;

  renderCats();
  renderGrid();
  renderPedido();
  EU.cliente.rellenar({ nombre: $("cliente"), direccion: $("direccion") });
  if (!cuenta()) {
    EU.cliente.ofrecerRepetir((datos) => {
      let n = 0;
      Object.entries((datos && datos.qty) || {}).forEach(([id, k]) => {
        if (sePuede(buscar(id)) && k > 0) { qty[id] = Math.min(99, Math.floor(k)); n++; }
      });
      if (!n) return 0;
      if (tiposOfrecidos.some((t) => t.id === datos.tipo)) tipo = datos.tipo;
      renderGrid();
      renderPedido();
      abrir();
      return n;
    });
  }
});
