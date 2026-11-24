/* Plantilla Sushi: menú por categorías, carrito y pedido por WhatsApp. */
EU.alListo(function (sitio) {
  "use strict";
  const c = sitio.c;
  const $ = (s) => document.querySelector(s);
  const esc = EU.esc;
  const usd = EU.usd;
  const CATEGORIAS = (c.catalogo.categorias || []).filter((k) => k && k.id);
  const COLORES = { rojo: "var(--rojo)", salmon: "var(--salmon)", negro: "var(--negro)", sakura: "var(--sakura)" };
  const PRODUCTOS = (c.catalogo.productos || []).filter((p) => p && p.id && CATEGORIAS.some((k) => k.id === p.cat));
  const carrito = new Map();
  const buscar = (id) => PRODUCTOS.find((p) => p.id === id);
  const TIPOS = [
    { id: "aqui", nombre: "Comer aquí" },
    { id: "llevar", nombre: "Para llevar" },
    { id: "delivery", nombre: "Delivery" },
  ].filter((t) => (c.pedidos.tipos || []).includes(t.id));
  let pago = "";
  const tipoActual = () => (document.querySelector('input[name="tipo"]:checked') || {}).value || (TIPOS[0] && TIPOS[0].id) || "llevar";
  const subtotal = () => [...carrito].reduce((s, [id, n]) => s + (Number(buscar(id).precio) || 0) * n, 0);
  const delivery = () => (tipoActual() === "delivery" && carrito.size ? EU.costoDelivery() : 0);
  const total = () => subtotal() + delivery();
  const unidades = () => [...carrito.values()].reduce((a, b) => a + b, 0);

  /* ---------- Portada ---------- */
  const partes = sitio.nombre.trim().split(/\s+/);
  $("#nombre-local").innerHTML = partes.length > 1 ? `${esc(partes[0])} <span>${esc(partes.slice(1).join(" "))}</span>` : esc(partes[0]);
  $("#eslogan").textContent = c.negocio.eslogan || "";
  $("#eslogan").hidden = !c.negocio.eslogan;
  $("#descripcion").textContent = c.negocio.descripcion || "";
  $("#vert").textContent = (c.portada && c.portada.kanji) || "";
  const logo = EU.url(c.negocio.logo);
  if (logo) $("#hanko").outerHTML = `<img class="logo" id="hanko" src="${esc(logo)}" alt="Logo de ${esc(sitio.nombre)}" data-eu-logo>`;
  else $("#hanko").innerHTML = esc((c.portada && c.portada.sello) || "").split("").join("<br>");
  $("#pie").innerHTML = `<b>桜</b> ${esc((c.portada && c.portada.pie) || "")}`;
  if (EU.tasa() > 0) $("#pie").insertAdjacentHTML("beforeend", `<br>Tasa del día: Bs ${EU.fmtBs.format(EU.tasa())} por dólar`);
  $("#info").innerHTML = EU.htmlInfo();

  /* ---------- Menú ---------- */
  function iconoHTML(p, cat) {
    const foto = EU.url(p.foto);
    if (foto) return `<div class="plato-ico"><img src="${esc(foto)}" alt="" loading="lazy"></div>`;
    const color = COLORES[cat.color] || COLORES.rojo;
    const txt = cat.color === "sakura" ? "var(--negro)" : "#fff";
    return `<div class="plato-ico" style="background:${color};color:${txt}" aria-hidden="true">${esc(cat.kanji || "")}</div>`;
  }
  const stepperHTML = (id, n) => `<div class="stepper"><button type="button" data-menos="${esc(id)}" aria-label="Quitar uno">−</button><span>${n}</span><button class="plus" type="button" data-add="${esc(id)}" aria-label="Agregar otro">+</button></div>`;
  function controlHTML(p) {
    if (p.agotado) return `<span class="agotado-txt">Agotado</span>`;
    const n = carrito.get(p.id) || 0;
    if (!n) return `<button class="add" type="button" data-add="${esc(p.id)}" aria-label="Agregar ${esc(p.nombre)}">+</button>`;
    return stepperHTML(p.id, n);
  }
  function renderMenu() {
    const conPlatos = CATEGORIAS.filter((k) => PRODUCTOS.some((p) => p.cat === k.id));
    $("#tabs").innerHTML = conPlatos.map((k, i) =>
      `<button class="tab" type="button" data-cat="${esc(k.id)}" aria-pressed="${i === 0}">${esc(k.nombre)} <small>${esc(k.kanji || "")}</small></button>`).join("");
    $("#menu").innerHTML = conPlatos.map((k) => `
      <section class="cat" id="cat-${esc(k.id)}">
        <div class="cat-h"><h2>${esc(k.nombre)}</h2><span class="kanji">${esc(k.kanji || "")}</span>${k.nota ? `<span class="nota">${esc(k.nota)}</span>` : ""}</div>
        <div class="lista">${PRODUCTOS.filter((p) => p.cat === k.id).map((p) => `
          <article class="plato${p.agotado ? " agotado" : ""}" data-eu-producto>
            ${iconoHTML(p, k)}
            <div class="plato-info"><h3>${esc(p.nombre)}${p.etiqueta ? `<span class="etiq">${esc(p.etiqueta)}</span>` : ""}</h3>${p.desc ? `<p>${esc(p.desc)}</p>` : ""}</div>
            <div class="plato-acc"><span class="precio">${usd(p.precio)}${EU.tasa() > 0 ? `<small>${EU.bs(p.precio)}</small>` : ""}</span><div data-ctl="${esc(p.id)}">${controlHTML(p)}</div></div>
          </article>`).join("")}</div>
      </section>`).join("") || `<p class="vacio">Pronto publicaremos el menú.</p>`;
  }

  /* ---------- Carrito ---------- */
  function renderItems() {
    if (!carrito.size) {
      $("#items").innerHTML = `<div class="vacio"><b>空</b>Tu carrito está vacío. Agrega algo del menú.</div>`;
      return;
    }
    $("#items").innerHTML = [...carrito].map(([id, n]) => {
      const p = buscar(id);
      return `<div class="item">
        <div><h4>${esc(p.nombre)}</h4><div class="sub">${n} × ${usd(p.precio)} = ${usd(n * p.precio)}</div></div>
        <div class="der">${stepperHTML(id, n)}<button class="quitar" type="button" data-borrar="${esc(id)}">Eliminar</button></div></div>`;
    }).join("") + (delivery() ? `<div class="item"><div><h4>Delivery</h4></div><div class="der"><b>${usd(delivery())}</b></div></div>` : "");
  }
  function renderPago() {
    const tipo = tipoActual();
    const disp = EU.pagos.disponibles(tipo);
    if (!disp.some((m) => m.id === pago)) pago = "";
    $("#pago").innerHTML = EU.pagos.html(tipo, pago, "pago");
    $("#pago-detalle").innerHTML = pago ? EU.pagos.detalle(pago, total()) : "";
  }
  function mensaje() {
    const tipo = TIPOS.find((t) => t.id === tipoActual());
    const lineas = [...carrito].map(([id, n]) => { const p = buscar(id); return `• ${n} x ${p.nombre} — ${usd(n * p.precio)}`; });
    let m = `🌸 *Nuevo pedido — ${sitio.nombre}*\n\n`;
    m += `*Cliente:* ${$("#cliente").value.trim()}\n*Tipo:* ${tipo ? tipo.nombre : ""}\n`;
    if (tipoActual() === "delivery") m += `*Dirección:* ${$("#direccion").value.trim()}\n`;
    m += `\n*Detalle:*\n${lineas.join("\n")}\n`;
    if (delivery()) m += `• Delivery — ${usd(delivery())}\n`;
    const notas = $("#notas").value.trim();
    if (notas) m += `\n*Notas:* ${notas}\n`;
    m += `\n*Total: ${usd(total())}*`;
    EU.pagos.lineas(pago, total()).forEach((l) => { m += `\n${l}`; });
    if (tipoActual() === "delivery" && !EU.costoDelivery()) m += `\n_(más costo de delivery)_`;
    return m;
  }
  const armarEnlace = () => { $("#enviar").href = EU.wa(mensaje()); };
  function actualizar(id) {
    if (id) {
      const el = document.querySelector(`[data-ctl="${CSS.escape(id)}"]`);
      if (el) el.innerHTML = controlHTML(buscar(id));
    }
    $("#cuenta").textContent = unidades();
    $("#total-barra").textContent = usd(total());
    $("#total-panel").textContent = usd(total());
    $("#total-bs").textContent = EU.bs(total());
    $("#barra").classList.toggle("vacia", unidades() === 0);
    renderItems();
    renderPago();
    armarEnlace();
  }
  function validar() {
    if (!carrito.size) return "Agrega al menos un producto.";
    if (!$("#cliente").value.trim()) return "Escribe tu nombre para el pedido.";
    if (tipoActual() === "delivery" && !$("#direccion").value.trim()) return "Escribe la dirección de entrega.";
    if (EU.pagos.disponibles(tipoActual()).length && !pago) return "Elige cómo vas a pagar.";
    return "";
  }
  let toastT;
  function toast(t) {
    const el = $("#toast");
    el.textContent = t; el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.hidden = true; }, 1400);
  }
  function abrirCarrito() { $("#velo").hidden = false; $("#panel").hidden = false; document.body.style.overflow = "hidden"; actualizar(); }
  function cerrarCarrito() { $("#velo").hidden = true; $("#panel").hidden = true; $("#error").hidden = true; document.body.style.overflow = ""; }
  function sincronizarTipo() {
    $("#campo-dir").hidden = tipoActual() !== "delivery";
    $("#error").hidden = true;
    actualizar();
  }

  /* Tipo de pedido según lo que ofrece el negocio */
  $("#tipos").innerHTML = TIPOS.map((t, i) => `<input type="radio" name="tipo" id="t-${t.id}" value="${t.id}"${i === 0 ? " checked" : ""}><label for="t-${t.id}">${t.nombre}</label>`).join("");
  $("#tipos").style.gridTemplateColumns = `repeat(${Math.max(1, TIPOS.length)},1fr)`;
  $("#nota-delivery").textContent = EU.costoDelivery() ? `El delivery cuesta ${usd(EU.costoDelivery())}.` : (c.pedidos.notaDelivery || "");
  if (!EU.estado().abierto) $("#cerrado").textContent = EU.estado().texto + ". Puedes enviar tu pedido y te respondemos apenas abramos.";
  $("#cerrado").hidden = EU.estado().abierto;

  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-cerrar],[data-abrir],[data-add],[data-menos],[data-borrar],[data-cat],#enviar");
    if (!el) return;
    if (el.hasAttribute("data-cerrar")) { cerrarCarrito(); return; }
    if (el.hasAttribute("data-abrir")) { abrirCarrito(); return; }
    if (el.hasAttribute("data-add")) EU.mascotaBrinca();
    if (el.id === "enviar") {
      const err = validar();
      if (err) { e.preventDefault(); $("#error").textContent = err; $("#error").hidden = false; return; }
      armarEnlace();
      const t = TIPOS.find((x) => x.id === tipoActual());
      EU.registrarPedido({
        items: [...carrito].map(([id, n]) => { const p = buscar(id) || {}; return { nombre: p.nombre, cantidad: n, precio: p.precio }; }),
        total: total(), tipo: t && t.nombre, pago,
      });
      return;
    }
    if (el.dataset.add) {
      const id = el.dataset.add, p = buscar(id), nuevo = !carrito.has(id);
      if (!p || p.agotado) return;
      carrito.set(id, (carrito.get(id) || 0) + 1);
      actualizar(id);
      if (nuevo) toast("Agregado al pedido");
      return;
    }
    if (el.dataset.menos) {
      const id = el.dataset.menos, n = (carrito.get(id) || 0) - 1;
      if (n > 0) carrito.set(id, n); else carrito.delete(id);
      actualizar(id);
      return;
    }
    if (el.dataset.borrar) { carrito.delete(el.dataset.borrar); actualizar(el.dataset.borrar); return; }
    if (el.dataset.cat) {
      const sec = document.getElementById("cat-" + el.dataset.cat);
      if (sec) sec.scrollIntoView({ behavior: EU.reducido ? "auto" : "smooth" });
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#panel").hidden) cerrarCarrito(); });
  $("#form").addEventListener("change", (e) => {
    if (e.target.name === "pago") { pago = e.target.value; $("#error").hidden = true; actualizar(); return; }
    sincronizarTipo();
  });
  $("#form").addEventListener("input", (e) => { if (e.target.name !== "pago" && e.target.name !== "tipo") armarEnlace(); });
  $("#form").addEventListener("submit", (e) => e.preventDefault());

  /* Pestaña activa al bajar */
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id.replace("cat-", "");
        document.querySelectorAll(".tab").forEach((tb) => tb.setAttribute("aria-pressed", tb.dataset.cat === id));
        const act = document.querySelector(`.tab[data-cat="${CSS.escape(id)}"]`);
        if (act) act.parentElement.scrollTo({ left: act.offsetLeft - act.parentElement.offsetLeft - 16, behavior: EU.reducido ? "auto" : "smooth" });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    setTimeout(() => document.querySelectorAll("section.cat").forEach((s) => obs.observe(s)), 0);
  }

  renderMenu();
  actualizar();
  cerrarCarrito();
});
