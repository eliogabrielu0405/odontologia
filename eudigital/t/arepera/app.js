/* Plantilla Arma tu Arepa: el cliente apila rellenos reales, suma bebidas y pide por WhatsApp. */
EU.alListo(function (sitio) {
  "use strict";
  const c = sitio.c;
  const $ = (id) => document.getElementById(id);
  const esc = EU.esc;
  const money = EU.usd;
  const IMG = "/t/arepera/img/";
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } },
  };

  /* ---------- Menú desde los datos del negocio ---------- */
  const NOMBRE = String((c.arepa && c.arepa.nombre) || "Arepa").trim() || "Arepa";
  const BASE = Math.max(0, Number(c.arepa && c.arepa.precio) || 0);
  const CATS = (c.catalogo.categorias || []).filter((k) => k && k.id && k.nombre).slice(0, 5).map((k) => ({
    id: String(k.id), name: String(k.nombre),
    free: Math.max(0, Math.floor(Number(k.incluidos) || 0)),
    add: Math.max(0, Number(k.adicional) || 0),
    nota: String(k.nota || ""),
  }));
  const CATI = Object.fromEntries(CATS.map((k) => [k.id, k]));
  const INGS = (c.catalogo.ingredientes || []).filter((i) => i && i.id && i.nombre && CATI[i.cat]);
  const ALL = Object.fromEntries(INGS.map((i) => [String(i.id), i]));
  const BEBIDAS = (c.catalogo.bebidas || []).filter((d) => d && d.id && d.nombre).map((d) => Object.assign({}, d, { precio: Math.max(0, Number(d.precio) || 0) }));
  const DRINK = Object.fromEntries(BEBIDAS.map((d) => [String(d.id), d]));
  const GRUPOS = [...new Set(BEBIDAS.map((d) => d.grupo || "Bebidas"))].map((g) => ({ name: g, items: BEBIDAS.filter((d) => (d.grupo || "Bebidas") === g) }));
  const TAB_BEBIDAS = "__bebidas";
  const TABS = CATS.filter((k) => INGS.some((i) => i.cat === k.id)).concat(BEBIDAS.length ? [{ id: TAB_BEBIDAS, name: "Bebidas" }] : []);
  const FRASES = ((c.mascota && c.mascota.frases) || []).filter((f) => typeof f === "string" && f.trim());
  const CHEERS = FRASES.length ? FRASES : ["¡Qué rico!"];
  const nameOf = (id) => (ALL[id] || DRINK[id] || {}).nombre || "";
  const isOut = (id) => !!((ALL[id] && ALL[id].agotado) || (DRINK[id] && DRINK[id].agotado));

  /* ---------- Encabezado ---------- */
  const palabras = sitio.nombre.trim().split(/\s+/);
  $("titulo").innerHTML = palabras.length > 1 ? `${esc(palabras.slice(0, -1).join(" "))} <span>${esc(palabras[palabras.length - 1])}</span>` : esc(palabras[0]);
  $("precioBase").textContent = `${NOMBRE} ${money(BASE)}` + (EU.tasa() > 0 ? ` · ${EU.bs(BASE)}` : "");
  const logo = EU.url(c.negocio.logo);
  if (logo) { $("logo").src = logo; $("logo").alt = "Logo de " + sitio.nombre; $("logo").hidden = false; }
  $("ctaTxt").textContent = "Agregar " + NOMBRE.toLowerCase();
  $("stage").setAttribute("aria-label", "Tu " + NOMBRE.toLowerCase());
  $("waShow").textContent = EU.telefonoVisible();
  const est = EU.estado();
  $("puntoEstado").classList.toggle("cerrado", !est.abierto);
  $("openInfo").setAttribute("aria-label", est.texto + ". Ver horario, dirección, redes y formas de pago");
  $("info").innerHTML = EU.htmlInfo({ redes: false });
  if (c.negocio.descripcion) { $("infoDesc").textContent = c.negocio.descripcion; $("infoDesc").hidden = false; }

  /* ---------- Pedido del cliente (sobrevive si la página se recarga) ---------- */
  const CLAVE = "eu:arepa:" + (sitio.slug || "demo");
  let current = [];
  let order = [];
  let drinks = {};
  let activeCat = TABS[0] ? TABS[0].id : "";
  const saved = (() => { try { return JSON.parse(ss.get(CLAVE) || "null"); } catch (_) { return null; } })();
  if (saved) {
    current = (saved.current || []).filter((id) => ALL[id] && !isOut(id));
    order = (saved.order || []).map((a) => (a || []).filter((id) => ALL[id] && !isOut(id)));
    drinks = Object.fromEntries(Object.entries(saved.drinks || {}).filter(([id, n]) => DRINK[id] && !isOut(id) && n > 0));
    if (TABS.some((t) => t.id === saved.activeCat)) activeCat = saved.activeCat;
  } else {
    // Arepa de ejemplo para empezar: la primera carne y el primer queso disponibles
    CATS.slice(0, 2).forEach((k) => { const i = INGS.find((x) => x.cat === k.id && !isOut(x.id) && x.foto); if (i) current.push(i.id); });
  }
  const saveCart = () => ss.set(CLAVE, JSON.stringify({ current, order, drinks, activeCat }));

  const drinkCount = () => Object.values(drinks).reduce((s, n) => s + n, 0);
  const priceOf = (ids) => {
    const used = {};
    return ids.reduce((s, id) => {
      const k = CATI[ALL[id].cat];
      used[k.id] = (used[k.id] || 0) + 1;
      return s + (used[k.id] > k.free ? k.add : 0);
    }, BASE);
  };
  const drinksTotal = () => Object.entries(drinks).reduce((s, [id, n]) => s + n * DRINK[id].precio, 0);
  const subtotal = () => order.reduce((s, a) => s + priceOf(a), 0) + drinksTotal();

  function itemLabel(id) {
    if (isOut(id)) return "Agotado";
    const k = CATI[ALL[id].cat];
    const sel = current.filter((x) => ALL[x].cat === k.id);
    const pos = current.includes(id) ? sel.indexOf(id) : sel.length;
    if (pos < k.free) return "Incluido";
    return k.add > 0 ? "+" + money(k.add) : "Sin costo";
  }
  const describe = (ids) => (ids.length ? ids.map((id) => ALL[id].nombre).join(", ") : NOMBRE + " sola");
  function hintDe(k) {
    if (k.nota) return k.nota;
    if (k.free > 0) return `Tu ${NOMBRE.toLowerCase()} de ${money(BASE)} incluye ${k.free} de aquí. ` + (k.add > 0 ? `Cada uno de más suma ${money(k.add)}.` : "Los demás no tienen costo.");
    return k.add > 0 ? `Cada uno suma ${money(k.add)}.` : "Sin costo adicional.";
  }

  /* ---------- Fotos y cómo se apilan ---------- */
  const RATIO = { "tapa-arriba": 225, "tapa-abajo": 215, mechada: 210, pollo: 217, reina: 228, pernil: 194, perico: 210, caraotas: 202, chicharron: 214, chorizo: 198,
    jamon: 216, "carne-asada": 183, blanco: 171, guayanes: 204, demano: 178, amarillo: 170, aguacate: 174, tajadas: 176, huevo: 199, tomate: 138, ajo: 122, picante: 88 };
  for (const k in RATIO) RATIO[k] /= 560;
  const LAYOUT = { "tapa-abajo": { k: 0.62 }, "tapa-arriba": { sink: 0.1 }, tomate: { k: 0.5 }, ajo: { wf: 0.9 }, picante: { wf: 0.9 },
    mechada: { wf: 1.04 }, pollo: { wf: 1.04 }, reina: { wf: 1.04 }, perico: { wf: 1.04 }, caraotas: { wf: 1.04 }, blanco: { wf: 1.04 }, chicharron: { wf: 1.04 } };
  const propia = (f) => { const m = /^\/t\/arepera\/img\/([a-z0-9-]+)\.webp$/.exec(f || ""); return m && RATIO[m[1]] ? m[1] : null; };
  const fotoDe = (id) => (id === "tapa-abajo" || id === "tapa-arriba" ? IMG + id + ".webp" : EU.url(ALL[id] && ALL[id].foto));
  const miniDe = (id) => { const f = fotoDe(id), b = propia(f); return b ? IMG + b + "-mini.webp" : f; };
  const medidas = {};
  function medir(f) {
    if (!f || propia(f) || medidas[f]) return;
    medidas[f] = 0.35;
    const im = new Image();
    im.onload = () => { if (im.naturalWidth) { medidas[f] = Math.min(1.2, Math.max(0.12, im.naturalHeight / im.naturalWidth)); renderArepa(); } };
    im.src = f;
  }
  INGS.forEach((i) => medir(EU.url(i.foto)));
  const ratioDe = (id) => { const f = fotoDe(id), b = propia(f); return b ? RATIO[b] : medidas[f] || 0.35; };
  function layoutDe(id) {
    const b = propia(fotoDe(id));
    const base = Object.assign({}, LAYOUT[id] || (b && LAYOUT[b]) || {});
    if (ALL[id] && ALL[id].capa === "salsa") { base.drizzle = true; base.wf = base.wf || 0.9; }
    return base;
  }
  const thumb = (id) => { const f = miniDe(id); return f ? `<img src="${esc(f)}" alt="" loading="lazy">` : `<span class="sin-foto" aria-hidden="true">🫓</span>`; };
  const drinkThumb = (d) => { const f = EU.url(d.foto); return f ? `<img class="dimg${d.chico ? " sm" : ""}" src="${esc(f)}" alt="" loading="lazy">` : `<span class="demoji" aria-hidden="true">🥤</span>`; };

  function computeStack(ids, W) {
    const seq = ["tapa-abajo", ...ids.filter((id) => fotoDe(id)), "tapa-arriba"];
    let seat = 0, top = 0, drz = 0;
    const items = seq.map((id, z) => {
      const p = layoutDe(id);
      const w = W * (p.wf || 1), h = w * ratioDe(id);
      let bottom;
      if (p.drizzle) { bottom = Math.max(0, seat - h * (0.8 + 0.35 * drz)); drz++; }
      else { bottom = seat - (p.sink || 0) * h; seat = bottom + h * (1 - (p.k != null ? p.k : 0.55)); drz = 0; }
      top = Math.max(top, bottom + h);
      return { id, w, h, left: (W - w) / 2, bottom, z: z + 1 };
    });
    return { items, height: top };
  }

  function miniArepa(ids, maxW, maxH) {
    let W = maxW, L = computeStack(ids, W);
    if (L.height > maxH) { W = (W * maxH) / L.height; L = computeStack(ids, W); }
    return `<div class="mini" style="width:${W.toFixed(1)}px;height:${L.height.toFixed(1)}px">${L.items.map((it) =>
      `<img src="${esc(fotoDe(it.id))}" alt="" style="width:${it.w.toFixed(1)}px;left:${it.left.toFixed(1)}px;bottom:${it.bottom.toFixed(1)}px;z-index:${it.z}">`).join("")}</div>`;
  }


  /* ---------- Tienda ---------- */
  $("tabs").style.gridTemplateColumns = `repeat(${Math.max(1, TABS.length)},minmax(0,1fr))`;
  function renderTabs() {
    $("tabs").innerHTML = TABS.map((k) => {
      const n = k.id === TAB_BEBIDAS ? drinkCount() : current.filter((id) => ALL[id].cat === k.id).length;
      return `<button class="tab" role="tab" type="button" id="tab-${esc(k.id)}" data-cat="${esc(k.id)}" aria-controls="list" aria-selected="${k.id === activeCat}">${esc(k.name)}${n ? `<span class="n">${n}</span>` : ""}</button>`;
    }).join("");
  }

  function ingCard(i) {
    const out = isOut(i.id), lab = itemLabel(i.id);
    return `<button class="ing${out ? " out" : ""}" type="button" data-id="${esc(i.id)}" aria-pressed="${current.includes(i.id)}"${out ? " disabled" : ""} data-eu-producto>
      <span class="th">${thumb(i.id)}</span>
      <span class="txt"><b>${esc(i.nombre)}</b><span class="p${out || lab[0] === "+" ? "" : " inc"}">${lab}</span></span>
      <span class="ok" aria-hidden="true">✓</span>
    </button>`;
  }

  function drinkCard(d) {
    const out = isOut(d.id), n = drinks[d.id] || 0;
    const label = out ? `${d.nombre}, agotado` : `Agregar ${d.nombre}, ${money(d.precio)}${n ? `. Llevas ${n}` : ""}`;
    return `<div class="ing drink${n ? " on" : ""}${out ? " out" : ""}" data-drink="${esc(d.id)}" data-eu-producto>
      <button class="add" type="button" aria-label="${esc(label)}"${out ? " disabled" : ""}>
        <span class="th">${drinkThumb(d)}</span>
        <span class="txt"><b>${esc(d.nombre)}</b><span class="p">${out ? "Agotado" : money(d.precio)}</span></span>
      </button>
      <span class="qty" aria-hidden="true"${n ? "" : " hidden"}>${n}</span>
      <button class="minus" type="button" aria-label="Quitar ${esc(d.nombre)}"${n ? "" : " hidden"}>−</button>
    </div>`;
  }

  function renderList(keepScroll) {
    const k = TABS.find((x) => x.id === activeCat);
    const top = $("list").scrollTop;
    if (!k) { $("list").innerHTML = `<p class="vacio">Pronto publicaremos el menú.</p>`; return; }
    $("list").setAttribute("aria-labelledby", "tab-" + k.id);
    const body = k.id === TAB_BEBIDAS
      ? `<p class="hint">Toca para sumarlas al pedido.</p>` + GRUPOS.map((g) => `<h3 class="group">${esc(g.name)}</h3><div class="grid">${g.items.map(drinkCard).join("")}</div>`).join("")
      : `<p class="hint">${esc(hintDe(k))}</p><div class="grid">${INGS.filter((i) => i.cat === k.id).map(ingCard).join("")}</div>`;
    $("list").innerHTML = body;
    $("list").scrollTop = keepScroll ? top : 0;
  }

  /* La arepa del escenario: cada pieza conserva su nodo para animar al subir o bajar */
  const nodes = new Map();
  function renderArepa(newId) {
    const stage = $("stage"), pos = $("arepaPos"), box = $("arepa");
    if (!stage.clientHeight) return;
    const maxW = Math.min(stage.clientWidth * 0.64, 270);
    const avail = stage.clientHeight - 24 - 64;
    let W = maxW, L = computeStack(current, W);
    if (L.height > avail) { W = (W * avail) / L.height; L = computeStack(current, W); }
    pos.style.width = W + "px"; pos.style.height = L.height + "px";
    const keep = new Set(L.items.map((i) => i.id));
    nodes.forEach((el, id) => {
      if (keep.has(id)) return;
      nodes.delete(id);
      el.classList.remove("drop"); el.classList.add("out");
      setTimeout(() => el.remove(), 300);
    });
    L.items.forEach((it) => {
      let el = nodes.get(it.id);
      const fresh = !el;
      if (fresh) {
        el = document.createElement("img");
        el.className = "piece"; el.alt = ""; el.dataset.id = it.id; el.src = fotoDe(it.id);
        box.appendChild(el); nodes.set(it.id, el);
      }
      el.style.width = it.w + "px"; el.style.left = it.left + "px"; el.style.bottom = it.bottom + "px"; el.style.zIndex = it.z;
      if (fresh && it.id === newId) {
        el.classList.add("drop");
        el.addEventListener("animationend", () => el.classList.remove("drop"), { once: true });
      }
    });
    box.classList.toggle("empty", current.length === 0);
    box.setAttribute("aria-label", current.length ? NOMBRE + " con " + describe(current).toLowerCase() : NOMBRE + " sola");
  }

  function syncUI() {
    document.querySelectorAll(".ing[data-id]").forEach((b) => {
      b.setAttribute("aria-pressed", current.includes(b.dataset.id));
      const p = b.querySelector(".p"), lab = itemLabel(b.dataset.id);
      p.textContent = lab; p.classList.toggle("inc", !isOut(b.dataset.id) && lab[0] !== "+");
    });
    renderTabs();
    $("ctaPrice").textContent = money(priceOf(current));
    saveCart();
  }

  function say(text) { const b = $("bubble"); b.textContent = text; restart(b, "pop"); }
  function celebrate() { restart($("arepa"), "squish"); EU.mascotaBrinca(); }

  function toggle(id) {
    if (isOut(id) || !ALL[id]) return;
    if (current.includes(id)) {
      current = current.filter((x) => x !== id);
      say(`Sin ${ALL[id].nombre.toLowerCase()}`);
      renderArepa(); syncUI();
      setTimeout(celebrate, 200);
    } else {
      current.push(id);
      say(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
      renderArepa(id); syncUI();
      setTimeout(celebrate, 420);
    }
  }

  function updateDrinkCard(id) {
    const card = document.querySelector(`.drink[data-drink="${CSS.escape(id)}"]`);
    if (!card) return;
    const n = drinks[id] || 0, d = DRINK[id];
    card.classList.toggle("on", n > 0);
    const q = card.querySelector(".qty"); q.hidden = !n; q.textContent = n; if (n) restart(q, "pop");
    card.querySelector(".minus").hidden = !n;
    card.querySelector(".add").setAttribute("aria-label", `Agregar ${d.nombre}, ${money(d.precio)}${n ? `. Llevas ${n}` : ""}`);
  }

  /* La bebida vuela hasta la bolsita del pedido */
  function flyToCart(fromEl) {
    if (!fromEl || EU.reducido) { restart($("orderCount"), "bump"); return; }
    const a = fromEl.getBoundingClientRect(), b = $("openOrder").getBoundingClientRect();
    const g = fromEl.cloneNode(true);
    g.classList.add("flyer");
    Object.assign(g.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.appendChild(g);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = g.animate([
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${dx * 0.45}px,${dy * 0.45 - 70}px) scale(.9)`, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(.35)`, opacity: 0.3 },
    ], { duration: 650, easing: "cubic-bezier(.45,0,.55,1)" });
    anim.onfinish = () => { g.remove(); restart($("orderCount"), "bump"); };
  }

  function addDrink(id, fromEl) {
    if (isOut(id) || !DRINK[id]) return;
    drinks[id] = (drinks[id] || 0) + 1;
    updateDrinkCard(id); renderTabs(); renderOrder();
    say(DRINK[id].frase || CHEERS[0]); EU.mascotaBrinca();
    flyToCart(fromEl);
  }
  function removeDrink(id) {
    drinks[id] = (drinks[id] || 0) - 1;
    if (drinks[id] <= 0) delete drinks[id];
    updateDrinkCard(id); renderTabs(); renderOrder();
  }

  /* ---------- Datos del cliente, pago y mensaje ---------- */
  const TIPOS = [
    { id: "llevar", nombre: "Para llevar" },
    { id: "delivery", nombre: "Delivery" },
    { id: "aqui", nombre: "Comer aquí" },
  ].filter((t) => (c.pedidos.tipos || []).includes(t.id));
  const ordenTipos = (c.pedidos.tipos || []).filter((id) => TIPOS.some((t) => t.id === id));
  TIPOS.sort((a, b) => ordenTipos.indexOf(a.id) - ordenTipos.indexOf(b.id));
  let pago = "";
  $("tipos").innerHTML = TIPOS.map((t, i) => `<input type="radio" name="tipo" id="t-${t.id}" value="${t.id}"${i === 0 ? " checked" : ""}><label for="t-${t.id}">${t.nombre}</label>`).join("");
  $("tipos").style.gridTemplateColumns = `repeat(${Math.max(1, TIPOS.length)},1fr)`;
  $("tipos").closest("fieldset").hidden = TIPOS.length < 2;
  $("nota-delivery").textContent = EU.costoDelivery() ? `El delivery cuesta ${money(EU.costoDelivery())}.` : (c.pedidos.notaDelivery || "");
  if (!est.abierto) { $("cerrado").textContent = est.texto + ". Puedes enviar tu pedido y te respondemos apenas abramos."; $("cerrado").hidden = false; }

  const tipoActual = () => (document.querySelector('input[name="tipo"]:checked') || {}).value || (TIPOS[0] && TIPOS[0].id) || "llevar";
  const count = () => order.length + drinkCount();
  const delivery = () => (tipoActual() === "delivery" && count() ? EU.costoDelivery() : 0);
  const grandTotal = () => subtotal() + delivery();

  function arepaLines(a) {
    const used = {}, extra = {};
    a.forEach((id) => { const k = CATI[ALL[id].cat]; used[k.id] = (used[k.id] || 0) + 1; extra[id] = used[k.id] > k.free && k.add > 0; });
    const lines = CATS.map((k) => {
      const ids = a.filter((id) => ALL[id].cat === k.id);
      return ids.length ? `${k.name}: ${ids.map((id) => ALL[id].nombre + (extra[id] ? ` (+${money(k.add)})` : "")).join(", ")}` : null;
    }).filter(Boolean);
    return lines.length ? lines : [NOMBRE + " sola"];
  }
  function orderMessage() {
    const tipo = TIPOS.find((t) => t.id === tipoActual());
    const out = [`*Nuevo pedido — ${sitio.nombre}*`, ""];
    const cliente = $("cliente").value.trim();
    if (cliente) out.push(`*Cliente:* ${cliente}`);
    if (tipo) out.push(`*Tipo:* ${tipo.nombre}`);
    if (tipoActual() === "delivery" && $("direccion").value.trim()) out.push(`*Dirección:* ${$("direccion").value.trim()}`);
    out.push("");
    order.forEach((a, k) => { out.push(`*${NOMBRE} ${k + 1}* · ${money(priceOf(a))}`, ...arepaLines(a), ""); });
    const dl = Object.entries(drinks);
    if (dl.length) { out.push("*Bebidas*", ...dl.map(([id, n]) => `${n} x ${DRINK[id].nombre} · ${money(n * DRINK[id].precio)}`), ""); }
    if (delivery()) out.push(`Delivery · ${money(delivery())}`, "");
    const notas = $("notas").value.trim();
    if (notas) out.push(`*Notas:* ${notas}`, "");
    out.push(`*Total: ${money(grandTotal())}*`);
    EU.pagos.lineas(pago, grandTotal()).forEach((l) => out.push(l));
    if (tipoActual() === "delivery" && !EU.costoDelivery()) out.push("_(más costo de delivery)_");
    return out.join("\n");
  }

  function renderPago() {
    const tipo = tipoActual();
    if (!EU.pagos.disponibles(tipo).some((m) => m.id === pago)) pago = "";
    $("pago").innerHTML = EU.pagos.html(tipo, pago, "pago");
    $("pago-detalle").innerHTML = pago ? EU.pagos.detalle(pago, grandTotal()) : "";
  }

  function validar() {
    if (!count()) return "Agrega al menos una " + NOMBRE.toLowerCase() + " o una bebida.";
    if (!$("cliente").value.trim()) return "Escribe tu nombre para el pedido.";
    if (tipoActual() === "delivery" && !$("direccion").value.trim()) return "Escribe la dirección de entrega.";
    if (EU.pagos.disponibles(tipoActual()).length && !pago) return "Elige cómo vas a pagar.";
    return "";
  }

  function renderOrder() {
    const arepaRows = order.map((a, k) => `
      <li><span class="pic">${miniArepa(a, 62, 56)}</span>
        <span class="d"><strong>${esc(NOMBRE)} #${k + 1}</strong>${esc(describe(a))}</span>
        <span class="p">${money(priceOf(a))}<button class="rm" type="button" data-rm="${k}" aria-label="Quitar ${esc(NOMBRE.toLowerCase())} ${k + 1}">Quitar</button></span></li>`).join("");
    const drinkRows = Object.entries(drinks).map(([id, n]) => {
      const d = DRINK[id];
      return `<li><span class="pic">${drinkThumb(d)}</span>
        <span class="d"><strong>${esc(d.nombre)}</strong>${money(d.precio)} c/u</span>
        <span class="p">${money(n * d.precio)}<span class="step"><button type="button" data-dminus="${esc(id)}" aria-label="Quitar ${esc(d.nombre)}">−</button><b>${n}</b><button type="button" data-dplus="${esc(id)}" aria-label="Sumar ${esc(d.nombre)}">+</button></span></span></li>`;
    }).join("");
    const deliveryRow = delivery() ? `<li><span class="pic" aria-hidden="true">🛵</span><span class="d"><strong>Delivery</strong></span><span class="p">${money(delivery())}</span></li>` : "";
    $("orderList").innerHTML = arepaRows + drinkRows + deliveryRow;
    const n = count();
    $("orderEmpty").hidden = n > 0;
    $("form").hidden = n === 0;
    $("total").textContent = "Total " + money(grandTotal());
    $("totalBs").textContent = EU.bs(grandTotal());
    $("copy").disabled = n === 0;
    $("emptyOrder").disabled = n === 0;
    renderPago();
    const wa = $("sendWa");
    wa.href = n ? EU.wa(orderMessage()) : "#";
    wa.classList.toggle("off", n === 0);
    wa.setAttribute("aria-disabled", String(n === 0));
    const badge = $("orderCount");
    badge.hidden = n === 0;
    badge.textContent = n;
    saveCart();
  }

  let partyTimer;
  function showParty(ids, n) {
    const p = $("party");
    $("partyArepa").innerHTML = miniArepa(ids, 140, 150);
    $("partyText").textContent = `¡${NOMBRE} #${n} al pedido!`;
    p.querySelectorAll(".confetti").forEach((x) => x.remove());
    const colors = ["var(--chili)", "var(--leaf)", "var(--ray-a)", "var(--toast)", "var(--plate)"];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      s.style.left = Math.random() * 100 + "%";
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = Math.random() * 0.4 + "s";
      p.appendChild(s);
    }
    p.hidden = false;
    clearTimeout(partyTimer);
    partyTimer = setTimeout(() => { p.hidden = true; }, 2100);
  }

  function flash(msg, ms = 2600) { $("toast").textContent = msg; clearTimeout(flash.t); flash.t = setTimeout(() => { $("toast").textContent = ""; }, ms); }

  let abierta = null;
  function openSheet(id, foco) {
    if (abierta) closeSheet(true);
    abierta = $(id);
    if (id === "sheet") renderOrder();
    abierta.classList.add("on"); $("scrim").classList.add("on");
    abierta.setAttribute("aria-hidden", "false");
    abierta.scrollTop = 0;
    $(foco).focus();
  }
  function closeSheet(sinFoco) {
    if (!abierta) return;
    const era = abierta.id;
    abierta.classList.remove("on"); $("scrim").classList.remove("on");
    abierta.setAttribute("aria-hidden", "true");
    abierta = null;
    $("copyBox").hidden = true;
    $("error").hidden = true;
    if (!sinFoco) $(era === "sheet" ? "openOrder" : "openInfo").focus();
  }

  /* ---------- Eventos ---------- */
  $("tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t || t.dataset.cat === activeCat) return;
    activeCat = t.dataset.cat; renderTabs(); renderList(); saveCart();
  });
  $("list").addEventListener("click", (e) => {
    const add = e.target.closest(".drink .add");
    if (add) { addDrink(add.closest(".drink").dataset.drink, add.querySelector(".th")); return; }
    const minus = e.target.closest(".drink .minus");
    if (minus) { removeDrink(minus.closest(".drink").dataset.drink); return; }
    const b = e.target.closest(".ing[data-id]");
    if (b) toggle(b.dataset.id);
  });
  $("clear").addEventListener("click", () => { current = []; renderArepa(); syncUI(); celebrate(); say(NOMBRE + " sola, ¡a rellenar!"); });
  $("add").addEventListener("click", () => {
    const built = [...current];
    order.push(built);
    renderOrder(); restart($("orderCount"), "bump");
    showParty(built, order.length);
    current = []; renderArepa(); syncUI();
    say("¡Arma otra!");
  });
  $("dancer").addEventListener("click", () => { EU.mascotaBrinca(); say("¡A bailar!"); });
  $("party").addEventListener("click", () => { $("party").hidden = true; });
  $("openOrder").addEventListener("click", () => openSheet("sheet", "closeOrder"));
  $("openInfo").addEventListener("click", () => openSheet("infoSheet", "closeInfo"));
  $("closeOrder").addEventListener("click", () => closeSheet());
  $("closeInfo").addEventListener("click", () => closeSheet());
  $("scrim").addEventListener("click", () => closeSheet());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && abierta) closeSheet(); });
  $("orderList").addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.rm !== undefined) { order.splice(+t.dataset.rm, 1); renderOrder(); }
    else if (t.dataset.dminus) { removeDrink(t.dataset.dminus); if (activeCat === TAB_BEBIDAS) renderList(true); }
    else if (t.dataset.dplus) { addDrink(t.dataset.dplus); if (activeCat === TAB_BEBIDAS) renderList(true); }
  });
  $("form").addEventListener("change", (e) => {
    if (e.target.name === "pago") pago = e.target.value;
    if (e.target.name === "tipo") $("campo-dir").hidden = tipoActual() !== "delivery";
    $("error").hidden = true;
    renderOrder();
  });
  $("form").addEventListener("input", (e) => { if (e.target.name !== "pago" && e.target.name !== "tipo") $("sendWa").href = count() ? EU.wa(orderMessage()) : "#"; });
  $("form").addEventListener("submit", (e) => e.preventDefault());
  $("sendWa").addEventListener("click", (e) => {
    const err = validar();
    if (err) {
      e.preventDefault();
      $("error").textContent = err; $("error").hidden = false;
      $("error").scrollIntoView({ block: "center", behavior: EU.reducido ? "auto" : "smooth" });
      return;
    }
    $("sendWa").href = EU.wa(orderMessage());
    EU.registrarPedido({
      items: [
        ...order.map((a) => ({ nombre: `${NOMBRE}: ${describe(a)}`, cantidad: 1, precio: priceOf(a) })),
        ...Object.entries(drinks).filter(([id]) => DRINK[id]).map(([id, n]) => ({ nombre: DRINK[id].nombre, cantidad: n, precio: DRINK[id].precio })),
      ],
      total: grandTotal(), tipo: (TIPOS.find((t) => t.id === tipoActual()) || {}).nombre, pago,
    });
    flash(`Se abrió WhatsApp con tu pedido. Si no se abrió, cópialo y envíalo al ${EU.telefonoVisible()}.`, 7000);
  });
  $("copy").addEventListener("click", () => {
    const t = orderMessage();
    const fallback = () => { const box = $("copyBox"); box.value = t; box.hidden = false; box.focus(); box.select(); flash("Cópialo desde aquí abajo"); };
    try { navigator.clipboard.writeText(t).then(() => { $("copyBox").hidden = true; flash("Pedido copiado. Pégalo en WhatsApp."); }, fallback); }
    catch (_) { fallback(); }
  });
  let emptyArmed = 0;
  $("emptyOrder").addEventListener("click", () => {
    const b = $("emptyOrder");
    if (Date.now() - emptyArmed < 3000) {
      order = []; drinks = {}; emptyArmed = 0; b.textContent = "Vaciar pedido";
      renderOrder(); renderTabs(); if (activeCat === TAB_BEBIDAS) renderList(true);
      flash("Pedido vacío");
      return;
    }
    emptyArmed = Date.now(); b.textContent = "¿Seguro? Toca otra vez";
    setTimeout(() => { if (Date.now() - emptyArmed >= 3000) b.textContent = "Vaciar pedido"; }, 3100);
  });
  let resizeT;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => renderArepa(), 120); });

  renderTabs(); renderList(); renderArepa(); syncUI(); renderOrder();
  if (!TABS.length) $("add").disabled = true;
  /* Precargar las fotos para que caigan al instante */
  ["tapa-abajo", "tapa-arriba", ...INGS.map((i) => i.id)].forEach((id) => { const f = fotoDe(id); if (f) { const im = new Image(); im.src = f; } });
});
