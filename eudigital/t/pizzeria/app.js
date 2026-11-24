/* Plantilla Pizzería: menú con tamaños, mitad y mitad, armador con ingredientes reales y pedido por WhatsApp. */
EU.alListo(function (sitio) {
  "use strict";
  const c = sitio.c;
  const $ = (s) => document.querySelector(s);
  const money = EU.usd;
  const bs = EU.bs;
  const esc = EU.esc;
  const reduced = EU.reducido;
  const IMG = "/t/pizzeria/img/";
  const VACIA = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const num = (v) => Math.max(0, Number(v) || 0);
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } },
  };

  /* ===== Menú desde los datos del negocio ===== */
  const PZ = c.pizza || {};
  const lista = (x) => (Array.isArray(x) ? x.filter((o) => o && o.id && o.nombre) : []);
  const tamanos = lista(PZ.tamanos);
  const SIZES = (tamanos.length ? tamanos : [{ id: "u", nombre: "Única", detalle: "", recargo: 0 }]).map((t, i, arr) => ({
    id: String(t.id), name: t.nombre, cm: t.detalle || "", mult: 1 + num(t.recargo) / 100,
    scale: arr.length > 1 ? 0.74 + (0.26 * i) / (arr.length - 1) : 1,
  }));
  const MASAS = (lista(PZ.masas).length ? lista(PZ.masas) : [{ id: "trad", nombre: "Tradicional", precio: 0 }]).map((m) => ({ id: String(m.id), name: m.nombre, price: num(m.precio) }));
  const SALSAS = (lista(PZ.salsas).length ? lista(PZ.salsas) : [{ id: "tomate", nombre: "Tomate", base: "tomate" }]).map((s) => ({ id: String(s.id), name: s.nombre, base: ["tomate", "bbq", "blanca"].includes(s.base) ? s.base : "tomate" }));
  const QUESOS = (lista(PZ.quesos).length ? lista(PZ.quesos) : [{ id: "mozz", nombre: "Mozzarella", precio: 0, estilo: "normal" }]).map((q) => ({ id: String(q.id), name: q.nombre, price: num(q.precio), estilo: q.estilo || "normal" }));
  const TOPS = lista(c.catalogo.ingredientes).map((t) => ({ id: String(t.id), name: t.nombre, g: t.grupo || "Ingredientes", price: num(t.precio), n: Math.max(4, Math.min(20, Number(t.n) || 10)), tam: Math.max(1, Math.min(4, Number(t.tam) || 2.4)), foto: EU.url(t.foto), agotado: !!t.agotado }));
  const TOP = Object.fromEntries(TOPS.map((t) => [t.id, t]));
  const primero = (arr) => arr[0].id;
  const valida = (arr, id) => (arr.some((x) => x.id === id) ? id : primero(arr));
  const MENU = lista(c.catalogo.pizzas).map((p) => ({
    id: String(p.id), name: p.nombre, desc: p.desc || "", price: num(p.precio), tag: p.etiqueta || "", foto: EU.url(p.foto), agotado: !!p.agotado,
    cfg: { salsa: valida(SALSAS, p.salsa), queso: valida(QUESOS, p.queso), masa: valida(MASAS, p.masa), tops: (p.ingredientes || []).map(String).filter((id) => TOP[id]) },
  }));
  let BASE_PRICE = num(PZ.base);
  const CON_MITAD = PZ.mitad !== false;
  const TAM_B = c.bebidasTam || {};
  const DRINK_SIZES = [{ id: "1l", name: TAM_B.chica || "Pequeña" }, { id: "2l", name: TAM_B.grande || "Grande" }];
  const DRINKS = lista(c.catalogo.bebidas).map((d) => ({ id: String(d.id), name: d.nombre, foto: EU.url(d.foto), agotado: !!d.agotado, precios: { "1l": num(d.precioChica), "2l": num(d.precio) } }));

  const S = {
    tasa: EU.tasa(),
    mitadCobro: PZ.mitadCobro === "cara" ? "cara" : "promedio",
    agotPizzas: MENU.filter((p) => p.agotado).map((p) => p.id),
    agotTops: TOPS.filter((t) => t.agotado).map((t) => t.id),
  };
  const deliveryCosto = EU.costoDelivery();

  /* ===== Encabezado y textos ===== */
  $("#brandName").textContent = sitio.nombre;
  $("#titulo").textContent = (c.portada && c.portada.titulo) || sitio.nombre;
  $("#descripcion").textContent = c.negocio.descripcion || "";
  $("#descripcion").hidden = !c.negocio.descripcion;
  const logo = EU.url(c.negocio.logo);
  if (logo) { $("#logo").src = logo; $("#logo").alt = "Logo de " + sitio.nombre; $("#logo").hidden = false; }
  $("#tamanosTxt").textContent = "Precios en dólares" + (SIZES.length > 1 ? " · " + SIZES.map((s) => s.name + (s.cm ? " " + s.cm : "")).join(" · ") : "");
  const conDosTam = DRINKS.some((d) => d.precios["1l"] > 0 && d.precios["2l"] > 0);
  $("#bebidasTxt").textContent = conDosTam ? `En ${DRINK_SIZES[0].name} y ${DRINK_SIZES[1].name}.` : "";
  $("#info").innerHTML = EU.htmlInfo();

  /* ===== Mascota ===== */
  const party = () => EU.mascotaBrinca();

  /* ===== Dibujo de pizzas ===== */
  const newHalf = (salsa = SALSAS[0].id, queso = QUESOS[0].id, tops = []) => ({ salsa, queso, tops: [...tops] });
  function setupCanvas(cv) { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height; cv.width = w * dpr; cv.height = h * dpr; const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { c: ctx, w, h }; }
  function normCfg(x) {
    x = x || {};
    if (Array.isArray(x.halves) && x.halves.length) return { masa: x.masa || MASAS[0].id, mitad: !!x.mitad && x.halves.length > 1, halves: x.halves.map((h) => newHalf(h.salsa, h.queso, h.tops || [])) };
    return { masa: x.masa || MASAS[0].id, mitad: false, halves: [newHalf(x.salsa, x.queso, x.tops || [])] };
  }
  // side: null = toda la pizza, 0 = mitad izquierda, 1 = mitad derecha
  function layoutTops(tops, inner, side = null) {
    const pieces = [], placed = [];
    tops.forEach((id) => {
      const t = TOP[id];
      if (!t) return;
      const r = rng(hash(id) + 7 + (side === 0 ? 57 : side === 1 ? 101 : 0));
      let count = Math.max(4, Math.round(t.n * (tops.length > 3 ? 0.75 : 1)));
      if (side !== null) count = Math.max(3, Math.round(count * 0.55));
      const gap = inner * 0.075 * t.tam * 0.5 + inner * 0.03;
      for (let i = 0; i < count; i++) {
        let best = null, bd = -1;
        for (let k = 0; k < 18; k++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r()) * inner * 0.78; let x = Math.cos(a) * d; const y = Math.sin(a) * d;
          if (side !== null) { x = Math.abs(x); if (x < gap) x = gap + x * 0.5; if (side === 0) x = -x; }
          if (Math.hypot(x, y) > inner * 0.82) continue;
          let md = 1e9; for (const p of placed) md = Math.min(md, Math.hypot(p.x - x, p.y - y));
          if (md > bd) { bd = md; best = { x, y }; }
        }
        if (!best) continue;
        placed.push(best); pieces.push({ type: id, x: best.x, y: best.y, rot: r() * 6.28, seed: hash(id) + i, half: side });
      }
    });
    return pieces;
  }
  function drawPizza(cv, cfg, scale = 1) {
    const n = normCfg(cfg); const { c: ctx, w, h } = setupCanvas(cv); ctx.clearRect(0, 0, w, h); ctx.save(); ctx.translate(w / 2, h / 2);
    const R = (Math.min(w, h) / 2) * 0.96 * scale; const inner = drawBase(ctx, R, n); const s = inner * 0.075;
    const ps = n.mitad ? [...layoutTops(n.halves[0].tops, inner, 0), ...layoutTops(n.halves[1].tops, inner, 1)] : layoutTops(n.halves[0].tops, inner, null);
    ps.forEach((p) => drawTopping(ctx, p.type, p.x, p.y, s, p.rot)); ctx.restore();
  }

  /* ===== Fotos de ingredientes y bases ===== */
  const TOPIMG = {}, BASEIMG = {};
  const cargar = (src) => { const i = new Image(); i.src = src; return i; };
  TOPS.forEach((t) => { if (t.foto) TOPIMG[t.id] = cargar(t.foto); });
  TOPIMG.__mozz = cargar(IMG + "ingredientes/mozz.webp");
  TOPIMG.__feta = cargar(IMG + "ingredientes/feta.webp");
  ["tomate", "bbq", "blanca"].forEach((b) => { BASEIMG[b] = cargar(IMG + "bases/" + b + ".webp"); });
  const IMG_READY = Promise.all([...Object.values(TOPIMG), ...Object.values(BASEIMG)].map((i) => i.decode().catch(() => {})));
  const tamDe = (type) => (type === "__mozz" ? 2.6 : type === "__feta" ? 1.3 : (TOP[type] && TOP[type].tam) || 2.4);
  function drawTopping(ctx, type, x, y, s, rot) {
    const im = TOPIMG[type]; if (!im || !im.complete || !im.naturalWidth) return;
    const D = s * tamDe(type), k = D / Math.max(im.naturalWidth, im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.shadowColor = "rgba(50,20,0,.45)"; ctx.shadowBlur = s * 0.5; ctx.shadowOffsetY = s * 0.18;
    ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  }
  function drawIcon(cv, type) {
    const { c: ctx, w, h } = setupCanvas(cv); const im = TOPIMG[type]; if (!im || !im.naturalWidth) return;
    const k = Math.min(w / im.naturalWidth, h / im.naturalHeight) * 0.92; ctx.drawImage(im, (w - im.naturalWidth * k) / 2, (h - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
  }
  const baseDe = (salsa) => (SALSAS.find((x) => x.id === salsa) || SALSAS[0]).base;
  function drawBaseImg(ctx, R, salsa, shadow) {
    const im = BASEIMG[baseDe(salsa)] || BASEIMG.tomate; ctx.save();
    if (shadow) { ctx.shadowColor = "rgba(40,20,0,.45)"; ctx.shadowBlur = R * 0.08; ctx.shadowOffsetY = R * 0.035; }
    if (im.naturalWidth) ctx.drawImage(im, -R, -R, R * 2, R * 2); ctx.restore();
  }
  function drawCheese(ctx, inner, queso, salsa, side) {
    const q = QUESOS.find((x) => x.id === queso);
    const estilo = q ? q.estilo : "normal";
    if (estilo !== "extra" && estilo !== "cuatro") return;
    const r = rng(hash(estilo + salsa + (side === null ? "" : String(side)))), s = inner * 0.075;
    let l = estilo === "extra" ? Array(8).fill("__mozz") : Array.from({ length: 14 }, (_, i) => (i % 3 === 0 ? "__mozz" : "__feta"));
    if (side !== null) l = l.slice(0, Math.ceil(l.length * 0.55));
    l.forEach((t) => { const a = r() * 6.28, d = Math.sqrt(r()) * inner * 0.78; let x = Math.cos(a) * d; if (side === 0) x = -Math.abs(x); else if (side === 1) x = Math.abs(x); drawTopping(ctx, t, x, Math.sin(a) * d, s, r() * 6.28); });
  }
  function drawBase(ctx, R, cfg) {
    const inner = R * 0.8, hs = cfg.halves;
    if (!cfg.mitad) { drawBaseImg(ctx, R, hs[0].salsa, true); drawCheese(ctx, inner, hs[0].queso, hs[0].salsa, null); return inner; }
    ctx.save(); ctx.shadowColor = "rgba(40,20,0,.45)"; ctx.shadowBlur = R * 0.08; ctx.shadowOffsetY = R * 0.035; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); ctx.fillStyle = "#c98a4b"; ctx.fill(); ctx.restore();
    [0, 1].forEach((side) => {
      ctx.save(); ctx.beginPath(); if (side === 0) ctx.rect(-R * 1.1, -R * 1.1, R * 1.1, R * 2.2); else ctx.rect(0, -R * 1.1, R * 1.1, R * 2.2); ctx.clip();
      drawBaseImg(ctx, R, hs[side].salsa, false); drawCheese(ctx, inner, hs[side].queso, hs[side].salsa, side); ctx.restore();
    });
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(66,32,8,.6)"; ctx.lineWidth = Math.max(1.5, R * 0.016); ctx.beginPath(); ctx.moveTo(0, -R * 0.92); ctx.lineTo(0, R * 0.92); ctx.stroke();
    ctx.strokeStyle = "rgba(255,236,200,.4)"; ctx.lineWidth = Math.max(1, R * 0.006); ctx.beginPath(); ctx.moveTo(R * 0.014, -R * 0.88); ctx.lineTo(R * 0.014, R * 0.88); ctx.stroke();
    ctx.restore(); return inner;
  }

  /* Las pizzas sin foto se dibujan con sus ingredientes */
  const DIBUJOS = {};
  const fotoPizza = (p) => p.foto || DIBUJOS[p.id] || VACIA;
  function dibujarMenu() {
    MENU.forEach((p) => {
      if (p.foto || DIBUJOS[p.id]) return;
      try { const cv = document.createElement("canvas"); cv.width = 360; cv.height = 360; drawPizza(cv, p.cfg); DIBUJOS[p.id] = cv.toDataURL("image/webp", 0.85); }
      catch (_) { /* sin canvas */ }
    });
  }

  function pizzaFalta(p) {
    if (S.agotPizzas.includes(p.id)) return "Agotada";
    const f = p.cfg.tops.filter((t) => S.agotTops.includes(t));
    return f.length ? "Hoy sin " + f.map((t) => TOP[t].name.toLowerCase()).join(" ni ") : null;
  }

  /* ===== Menú ===== */
  const menuState = {};
  const sizeMedia = SIZES[Math.min(1, SIZES.length - 1)].id;
  function renderMenu() {
    const grid = $("#menuGrid"); grid.innerHTML = "";
    if (!MENU.length) grid.innerHTML = `<p class="vacio">Pronto publicaremos las pizzas de la casa.</p>`;
    MENU.forEach((p) => {
      if (!SIZES.some((s) => s.id === menuState[p.id])) menuState[p.id] = sizeMedia;
      const falta = pizzaFalta(p);
      const el = document.createElement("article"); el.className = "card" + (falta ? " soldout" : ""); el.setAttribute("data-eu-producto", "");
      el.innerHTML = `<div class="pic">${falta ? `<span class="tag sold">${falta === "Agotada" ? "Agotada" : "No disponible"}</span>` : p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}<img class="${p.foto ? "" : "dibujo"}" data-pz="${esc(p.id)}" src="${esc(fotoPizza(p))}" alt="Pizza ${esc(p.name)}" width="400" height="400" loading="lazy"></div>
        <h3>${esc(p.name)}</h3><p class="desc">${esc(p.desc)}${falta && falta !== "Agotada" ? `<b class="falta">${esc(falta)}</b>` : ""}</p>
        <div class="sizes"${SIZES.length < 2 ? " hidden" : ""}>${SIZES.map((s) => `<button class="size" type="button" data-s="${esc(s.id)}" aria-pressed="${menuState[p.id] === s.id}">${esc(s.name)}<small>${esc(s.cm)}</small></button>`).join("")}</div>
        <div class="card-foot"><span class="price-wrap"><span class="price"></span><span class="bs"></span></span><button class="icon-btn" type="button" data-edit>Personalizar</button><button class="add" type="button" data-add>Agregar</button></div>`;
      grid.appendChild(el);
      const img = el.querySelector(".pic img");
      const upd = () => { const s = SIZES.find((x) => x.id === menuState[p.id]); el.querySelector(".price").textContent = money(p.price * s.mult); el.querySelector(".bs").textContent = bs(p.price * s.mult); el.querySelectorAll(".size").forEach((b) => b.setAttribute("aria-pressed", b.dataset.s === s.id)); };
      upd();
      el.querySelectorAll(".size").forEach((b) => { b.onclick = () => { menuState[p.id] = b.dataset.s; upd(); }; });
      if (falta) { el.querySelector("[data-add]").disabled = true; el.querySelector("[data-add]").textContent = "Agotada"; el.querySelector("[data-edit]").disabled = true; }
      el.querySelector("[data-add]").onclick = () => {
        const s = SIZES.find((x) => x.id === menuState[p.id]);
        addToCart({ name: p.name, size: s.id, cfg: p.cfg, photo: p.id, unit: p.price * s.mult, detail: p.desc }, img);
      };
      el.querySelector("[data-edit]").onclick = () => {
        B.size = menuState[p.id]; B.masa = p.cfg.masa; B.mitad = false; B.act = 0; B.halves = [newHalf(p.cfg.salsa, p.cfg.queso, p.cfg.tops), newHalf()];
        go("arma"); buildUI(); refreshBuilder(); setStep(4); window.scrollTo({ top: $(".tabs").offsetTop, behavior: reduced ? "auto" : "smooth" });
      };
    });
    const ma = MENU[0], mb = MENU[1] || MENU[0];
    $("#mitadBanner").hidden = !CON_MITAD || !ma;
    if (ma) { $("#mbA").src = fotoPizza(ma); $("#mbB").src = fotoPizza(mb); }
  }

  /* ===== Bebidas ===== */
  const drinkSel = {};
  const drinkAvail = (dr, z) => !dr.agotado && dr.precios[z] > 0;
  const drinkImg = (dr) => dr.foto || VACIA;
  function renderDrinks() {
    const el = $("#drinks"); el.innerHTML = "";
    $("#drinksHead").hidden = !DRINKS.length; $("#saltos").hidden = !DRINKS.length;
    DRINKS.forEach((dr) => {
      const zs = DRINK_SIZES.filter((z) => dr.precios[z.id] > 0);
      if (!zs.length) return;
      const avail = zs.filter((z) => drinkAvail(dr, z.id)), sold = !avail.length;
      if (!drinkSel[dr.id] || !zs.some((z) => z.id === drinkSel[dr.id])) drinkSel[dr.id] = (zs.find((z) => z.id === "2l") || zs[0]).id;
      const card = document.createElement("article"); card.className = "drink" + (sold ? " soldout" : ""); card.setAttribute("data-eu-producto", "");
      card.innerHTML = `<div class="drink-pic">${sold ? '<span class="tag sold">Agotada</span>' : ""}<img src="${esc(drinkImg(dr))}" alt="${esc(dr.name)}" width="360" height="600" loading="lazy"></div>
        <h3>${esc(dr.name)}</h3>
        <div class="dsizes"${zs.length < 2 ? " hidden" : ""}>${zs.map((z) => `<button class="size" type="button" data-z="${z.id}" aria-pressed="false" ${drinkAvail(dr, z.id) ? "" : "disabled"}>${esc(z.name)}${drinkAvail(dr, z.id) ? "" : "<small>Agotado</small>"}</button>`).join("")}</div>
        <div class="drink-foot"><span class="price-wrap"><span class="price"></span><span class="bs"></span></span><button class="add round" type="button" data-add ${sold ? "disabled" : ""} aria-label="Agregar ${esc(dr.name)}">+</button></div>`;
      el.appendChild(card);
      const upd = () => {
        const pr = dr.precios[drinkSel[dr.id]]; card.querySelector(".price").textContent = money(pr); card.querySelector(".bs").textContent = bs(pr);
        card.querySelectorAll(".size").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.z === drinkSel[dr.id])));
      };
      upd();
      card.querySelectorAll(".size").forEach((b) => { b.onclick = () => { drinkSel[dr.id] = b.dataset.z; upd(); }; });
      card.querySelector("[data-add]").onclick = () => addDrink(dr.id, drinkSel[dr.id], card.querySelector(".drink-pic img"));
    });
  }
  function addDrink(id, z, fromEl) {
    const dr = DRINKS.find((d) => d.id === id), zz = DRINK_SIZES.find((x) => x.id === z);
    if (!dr || !zz || !drinkAvail(dr, z)) return;
    const dosTam = dr.precios["1l"] > 0 && dr.precios["2l"] > 0;
    addToCart({ kind: "drink", drink: id, name: dosTam ? `${dr.name} ${zz.name}` : dr.name, size: z, cfg: { drink: id, z }, unit: dr.precios[z], detail: "" }, fromEl);
  }
  document.querySelectorAll("[data-jump]").forEach((b) => { b.onclick = () => document.getElementById(b.dataset.jump).scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); });

  /* ===== Constructor ===== */
  const ejemplo = TOPS.find((t) => !t.agotado);
  const B = { size: sizeMedia, masa: MASAS[0].id, mitad: false, act: 0, halves: [newHalf(SALSAS[0].id, QUESOS[0].id, ejemplo ? [ejemplo.id] : []), newHalf()] };
  const sideNow = () => (B.mitad ? B.act : null);
  const halfOf = (side) => B.halves[side === null ? 0 : side];
  const H = () => halfOf(sideNow());
  let pieces = [], baseCanvas = null, baseKey = "", popStart = 0, curScale = SIZES.find((s) => s.id === B.size).scale, targetScale = curScale, lastInner = 0;
  const dim = [0, 0];
  const bcv = $("#builderCanvas");
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const flavorOf = (h) => MENU.find((p) => p.cfg.salsa === h.salsa && p.cfg.queso === h.queso && sameSet(p.cfg.tops, h.tops));
  const halfPct = () => (B.mitad && S.mitadCobro !== "cara" ? 0.5 : 1);
  const OPTS = [["#optSize", () => B.size, (v) => { B.size = v; }], ["#optMasa", () => B.masa, (v) => { B.masa = v; }], ["#optSalsa", () => H().salsa, (v) => { H().salsa = v; }], ["#optQueso", () => H().queso, (v) => { H().queso = v; }]];
  function opts(i, l, extra) {
    const [sel, get, set] = OPTS[i], el = $(sel);
    el.innerHTML = l.map((o) => `<button class="opt" type="button" data-v="${esc(o.id)}" aria-pressed="${get() === o.id}">${esc(o.name)}<small>${esc(extra(o))}</small></button>`).join("");
    el.querySelectorAll(".opt").forEach((b) => { b.onclick = () => { set(b.dataset.v); refreshBuilder(); }; });
  }
  function syncOptions() { OPTS.forEach(([sel, get]) => document.querySelectorAll(sel + " .opt").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === get())))); }
  function builderPrice() {
    const m = SIZES.find((x) => x.id === B.size).mult;
    const cost = (h) => (QUESOS.find((q) => q.id === h.queso) || { price: 0 }).price * m + h.tops.reduce((a, t) => a + (TOP[t] ? TOP[t].price : 0) * m, 0);
    let p = BASE_PRICE * m + (MASAS.find((x) => x.id === B.masa) || { price: 0 }).price * m;
    if (!B.mitad) p += cost(B.halves[0]);
    else { const a = cost(B.halves[0]), b = cost(B.halves[1]); p += S.mitadCobro === "cara" ? Math.max(a, b) : (a + b) / 2; }
    return Math.round(p * 100) / 100;
  }
  function buildUI() {
    const pct = halfPct();
    opts(0, SIZES, (o) => `${o.cm ? o.cm + " · " : ""}${money(BASE_PRICE * o.mult)}`);
    opts(1, MASAS, (o) => (o.price ? `+${money(o.price)}` : "Incluida"));
    opts(2, SALSAS, () => "Incluida");
    opts(3, QUESOS, (o) => (o.price ? `+${money(o.price * pct)}` : "Incluido"));
    const groups = [...new Set(TOPS.map((t) => t.g))];
    $("#optTops").innerHTML = TOPS.length ? `<div class="tops">` + groups.map((g) => `<div class="group-label">${esc(g)}</div>${TOPS.filter((t) => t.g === g).map((t) => `<button class="top" type="button" data-t="${esc(t.id)}" aria-pressed="false"><canvas width="40" height="40" aria-hidden="true"></canvas>${esc(t.name)}<small></small></button>`).join("")}`).join("") + `</div>` : `<p class="vacio">Pronto agregaremos ingredientes.</p>`;
    document.querySelectorAll(".top").forEach((b) => { drawIcon(b.querySelector("canvas"), b.dataset.t); b.onclick = () => toggleTop(b.dataset.t); });
    $("#flavors").innerHTML = MENU.map((p) => `<button class="flavor" type="button" data-f="${esc(p.id)}" aria-pressed="false" ${pizzaFalta(p) ? "disabled" : ""}><img src="${esc(fotoPizza(p))}" alt="">${esc(p.name)}</button>`).join("");
    $(".flavor-wrap").hidden = !MENU.length;
    document.querySelectorAll(".flavor").forEach((b) => { b.onclick = () => setFlavor(b.dataset.f); });
    syncTopButtons();
  }
  function syncTopButtons() {
    const h = H(), pct = halfPct();
    document.querySelectorAll(".top").forEach((b) => {
      const id = b.dataset.t, t = TOP[id], ag = S.agotTops.includes(id);
      b.disabled = ag; b.setAttribute("aria-pressed", String(h.tops.includes(id))); b.querySelector("small").textContent = ag ? "Agotado" : "+" + money(t.price * pct);
    });
    const f = flavorOf(h);
    document.querySelectorAll(".flavor").forEach((b) => b.setAttribute("aria-pressed", String(!!f && f.id === b.dataset.f)));
    $("#flavorLabel").textContent = B.mitad ? `Sabor de la casa para la mitad ${B.act + 1}` : "Empieza con un sabor de la casa";
  }
  function innerR() { return (bcv.clientWidth / 2) * 0.96 * 0.8; }
  function dropTop(id, side, delay = 0) {
    const h = halfOf(side); if (!h.tops.includes(id)) h.tops.push(id);
    const t0 = performance.now() + delay; pieces.push(...layoutTops([id], innerR(), side).map((p, i) => ({ ...p, t0: t0 + i * 45 })));
  }
  function liftTop(id, side) {
    const h = halfOf(side); h.tops = h.tops.filter((t) => t !== id);
    const now = performance.now(); pieces.forEach((p) => { if (p.type === id && p.half === side && !p.out) p.out = now; });
  }
  function toggleTop(id) {
    const side = sideNow(), h = halfOf(side);
    if (h.tops.includes(id)) liftTop(id, side);
    else { if (S.agotTops.includes(id)) return; dropTop(id, side); }
    syncTopButtons(); updateBuilderInfo();
  }
  function redropAll() {
    pieces = []; let i = 0;
    (B.mitad ? [0, 1] : [null]).forEach((side) => halfOf(side).tops.forEach((id) => {
      const t0 = performance.now() + (reduced ? 0 : 120 + i++ * 140);
      pieces.push(...layoutTops([id], innerR(), side).map((p, j) => ({ ...p, t0: t0 + j * 45 })));
    }));
  }
  function setFlavor(pid) {
    const p = MENU.find((x) => x.id === pid); if (!p || pizzaFalta(p)) return;
    const side = sideNow(), h = halfOf(side);
    [...h.tops].forEach((id) => liftTop(id, side));
    h.salsa = p.cfg.salsa; h.queso = p.cfg.queso;
    p.cfg.tops.forEach((id, i) => dropTop(id, side, reduced ? 0 : 260 + i * 170));
    refreshBuilder();
    if (B.mitad && B.act === 0 && !B.halves[1].tops.length)
      setTimeout(() => { if (B.mitad && B.act === 0) { setAct(1); toast("Ahora elige la mitad 2"); } }, reduced ? 0 : 900);
  }
  function setMitad(on) {
    if (on === B.mitad) return;
    if (on) { B.halves = [clone(B.halves[0]), clone(B.halves[0])]; B.mitad = true; B.act = 1; }
    else { B.halves = [B.halves[0], newHalf()]; B.mitad = false; B.act = 0; }
    baseKey = ""; buildUI(); redropAll(); refreshBuilder();
    if (on) { if (isMobile()) setStep(4); toast("Listo. Ahora elige la mitad 2"); }
    else toast("Quedó entera, como la mitad 1");
  }
  function setAct(i) { if (!B.mitad || B.act === i) return; B.act = i; renderModeUI(); syncOptions(); syncTopButtons(); updateBuilderInfo(); }
  function renderModeUI() {
    document.querySelectorAll("[data-forma]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.forma === "mitad") === B.mitad)));
    document.querySelectorAll(".half-pill").forEach((b) => { b.hidden = !B.mitad; b.setAttribute("aria-pressed", String(+b.dataset.half === B.act)); });
    document.querySelectorAll("[data-half-tag]").forEach((el) => { el.textContent = B.mitad ? `Mitad ${B.act + 1}` : ""; });
    bcv.style.cursor = B.mitad ? "pointer" : "";
  }
  function refreshBuilder() {
    targetScale = SIZES.find((s) => s.id === B.size).scale; popStart = performance.now();
    renderModeUI(); syncOptions(); syncTopButtons(); updateBuilderInfo();
  }
  const nombreDe = (arr, id) => (arr.find((x) => x.id === id) || { name: "" }).name;
  const halfShort = (h) => { const f = flavorOf(h); return f ? f.name : h.tops.length ? `${h.tops.length} ingrediente${h.tops.length > 1 ? "s" : ""}` : "solo queso"; };
  function updateBuilderInfo() {
    const s = SIZES.find((x) => x.id === B.size), price = builderPrice(), masa = nombreDe(MASAS, B.masa);
    $("#bPrice").textContent = money(price); $("#bBs").textContent = bs(price);
    if (B.mitad) $("#bSummary").textContent = `${s.name} · ${masa} · ½ ${halfShort(B.halves[0])} + ½ ${halfShort(B.halves[1])}`;
    else { const h = B.halves[0]; $("#bSummary").textContent = `${s.name} · ${masa} · Salsa ${nombreDe(SALSAS, h.salsa).toLowerCase()} · ${nombreDe(QUESOS, h.queso)}` + (h.tops.length ? ` · ${h.tops.length} ingrediente${h.tops.length > 1 ? "s" : ""}` : ""); }
    renderStepbar();
    const n = H().tops.length;
    $("#topHint").textContent = (B.mitad ? `Mitad ${B.act + 1} · ` : "") + (n ? `${n} elegido${n > 1 ? "s" : ""}` : "Elige los que quieras");
    $("#topHint").classList.toggle("half", B.mitad);
  }
  const easeOutBack = (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
  function frame(now) {
    const w = bcv.clientWidth, h = bcv.clientHeight;
    if (!$("#view-arma").hidden && w > 0) {
      if (bcv.width !== Math.round(w * Math.min(2, devicePixelRatio || 1))) setupCanvas(bcv);
      const ni = innerR(); if (lastInner && Math.abs(ni - lastInner) > 0.5) { const f = ni / lastInner; pieces.forEach((p) => { p.x *= f; p.y *= f; }); } lastInner = ni;
      const ctx = bcv.getContext("2d"); const dpr = bcv.width / w; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      curScale += (targetScale - curScale) * (reduced ? 1 : 0.14);
      const pop = reduced ? 0 : Math.max(0, 1 - (now - popStart) / 500);
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(pop * pop * 0.6); const sc = curScale * (1 + Math.sin(pop * Math.PI) * 0.04); ctx.scale(sc, sc);
      const R = (w / 2) * 0.96, key = JSON.stringify([B.masa, B.mitad, B.halves.map((x) => [x.salsa, x.queso]), w]);
      if (key !== baseKey) { baseCanvas = document.createElement("canvas"); baseCanvas.width = w * dpr; baseCanvas.height = h * dpr; const bc = baseCanvas.getContext("2d"); bc.scale(dpr, dpr); bc.translate(w / 2, h / 2); drawBase(bc, R, B); baseKey = key; }
      ctx.drawImage(baseCanvas, -w / 2, -h / 2, w, h);
      const inner = innerR(), s = inner * 0.075;
      pieces = pieces.filter((p) => !(p.out && now - p.out > 300));
      for (const p of pieces) {
        const k = reduced ? 1 : Math.min(1, Math.max(0, (now - (p.t0 || 0)) / 420)); if (k <= 0) continue;
        let alpha = 1, drop = 0, scl = 1;
        if (k < 1) { drop = -(1 - k) * (1 - k) * inner * 0.6; scl = 0.4 + easeOutBack(k) * 0.6; alpha = Math.min(1, k * 3); }
        if (p.out) { const o = Math.min(1, (now - p.out) / 300); alpha = 1 - o; scl = 1 + o * 0.4; }
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y + drop); ctx.scale(scl, scl);
        drawTopping(ctx, p.type, 0, 0, s, p.rot); ctx.restore();
      }
      // en mitad y mitad, la mitad que no se está editando se ve un poco más oscura
      [0, 1].forEach((side) => {
        const target = B.mitad && B.act !== side ? 0.34 : 0; dim[side] += (target - dim[side]) * (reduced ? 1 : 0.2);
        if (dim[side] < 0.01) return;
        ctx.save(); ctx.beginPath(); if (side === 0) ctx.rect(-R * 1.1, -R * 1.1, R * 1.1, R * 2.2); else ctx.rect(0, -R * 1.1, R * 1.1, R * 2.2); ctx.clip();
        ctx.beginPath(); ctx.arc(0, 0, R * 0.94, 0, 7); ctx.fillStyle = `rgba(22,10,2,${dim[side].toFixed(3)})`; ctx.fill(); ctx.restore();
      });
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  bcv.addEventListener("click", (e) => { if (!B.mitad) return; const r = bcv.getBoundingClientRect(); setAct(e.clientX < r.left + r.width / 2 ? 0 : 1); });
  document.querySelectorAll(".half-pill").forEach((b) => { b.onclick = () => setAct(+b.dataset.half); });
  document.querySelectorAll("[data-forma]").forEach((b) => { b.onclick = () => setMitad(b.dataset.forma === "mitad"); });
  $("#forma").hidden = !CON_MITAD;

  /* ===== Carrito ===== */
  const CLAVE = "eu:pizza:" + (sitio.slug || "demo");
  let cart = [];
  try { cart = JSON.parse(ss.get(CLAVE) || "[]"); if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
  const MODOS_ALL = [["delivery", "Delivery", () => (deliveryCosto ? `+${money(deliveryCosto)}` : "A domicilio")], ["llevar", "Para llevar", () => "Retiras tú"], ["aqui", "Comer aquí", () => "En el local"]];
  const MODOS = (c.pedidos.tipos || []).map((id) => MODOS_ALL.find((m) => m[0] === id)).filter(Boolean);
  if (!MODOS.length) MODOS.push(MODOS_ALL[1]);
  let modo = MODOS[0][0], pago = "";
  function save() { ss.set(CLAVE, JSON.stringify(cart)); }
  function addToCart(item, fromEl, src) {
    const key = item.name + item.size + JSON.stringify(item.cfg);
    const ex = cart.find((x) => x.key === key); if (ex) ex.qty++; else cart.push({ ...item, key, qty: 1 });
    save(); document.querySelector(".bar").hidden = false;
    fly(fromEl, src); party(); toast(`${item.name} agregada`);
    setTimeout(renderCart, reduced ? 0 : 650);
  }
  function fly(el, src) {
    if (reduced || !el) return;
    const a = el.getBoundingClientRect(), b = $("#cartBtn").getBoundingClientRect();
    if (!src) { if (el.tagName === "IMG") src = el.src; else { try { src = el.toDataURL(); } catch (_) { return; } } }
    const img = new Image(); img.src = src; img.className = "flyer"; Object.assign(img.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.appendChild(img);
    const dx = b.left + 30 - a.left - a.width / 2, dy = b.top + b.height / 2 - a.top - a.height / 2;
    img.animate([{ transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 140}px) scale(.55) rotate(240deg)`, opacity: 1, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) scale(.08) rotate(540deg)`, opacity: 0.7 }], { duration: 700, easing: "cubic-bezier(.45,.05,.4,1)" })
      .onfinish = () => { img.remove(); const cb = $("#cartBtn"); cb.classList.remove("bump"); void cb.offsetWidth; cb.classList.add("bump"); };
  }
  const sizeName = (x) => (SIZES.find((s) => s.id === x.size) || { name: "" }).name;
  const subtotal = () => cart.reduce((a, x) => a + x.unit * x.qty, 0);
  const deliveryAhora = () => (cart.length && modo === "delivery" ? deliveryCosto : 0);
  const total = () => subtotal() + deliveryAhora();
  const fotoLinea = (x) => {
    if (x.kind === "drink") { const d = DRINKS.find((y) => y.id === x.drink); return d && d.foto ? `<img class="dthumb" src="${esc(d.foto)}" alt="">` : `<canvas aria-hidden="true"></canvas>`; }
    const p = x.photo && MENU.find((y) => y.id === x.photo);
    return p ? `<img src="${esc(fotoPizza(p))}" alt="">` : `<canvas data-i="${cart.indexOf(x)}"></canvas>`;
  };
  function renderCart() {
    const n = cart.reduce((a, x) => a + x.qty, 0);
    $("#cartCount").textContent = n; $("#cartTot").textContent = money(total()); $("#cartBs").textContent = bs(total()); $("#cartBtn").disabled = !n; document.querySelector(".bar").hidden = !n;
    const L = $("#lines");
    const hasPizza = cart.some((x) => x.kind !== "drink"), hasDrink = cart.some((x) => x.kind === "drink"), up = $("#upsell");
    up.hidden = !(hasPizza && !hasDrink && DRINKS.length);
    if (!up.hidden) {
      $("#ups").innerHTML = DRINKS.map((dr) => {
        const z = ["2l", "1l"].find((zz) => drinkAvail(dr, zz));
        return z ? `<button class="up" type="button" data-up="${esc(dr.id)}" data-z="${z}"><img src="${esc(drinkImg(dr))}" alt=""><span><b>${esc(dr.name)}</b><small>${esc(DRINK_SIZES.find((x) => x.id === z).name)} · ${money(dr.precios[z])}</small></span><span class="plus" aria-hidden="true">+</span></button>` : "";
      }).join("");
      $("#ups").querySelectorAll("[data-up]").forEach((b) => { b.onclick = () => { addDrink(b.dataset.up, b.dataset.z, null); renderCart(); }; });
    }
    if (!cart.length) { L.innerHTML = `<p class="empty">Tu pedido está vacío. Agrega una pizza del menú o arma la tuya.</p>`; $("#checkout").hidden = true; return; }
    $("#checkout").hidden = false;
    L.innerHTML = cart.map((x, i) => `<div class="line">${fotoLinea(x)}<div><b>${esc(x.name)}</b><div class="meta">${x.kind === "drink" ? "Bebida" : `${esc(sizeName(x))} · ${esc(x.detail)}`}</div>
      <div class="qty"><button type="button" data-m="${i}" aria-label="Quitar una">−</button><span>${x.qty}</span><button type="button" data-p="${i}" aria-label="Agregar una">+</button></div></div><div class="lp">${money(x.unit * x.qty)}</div></div>`).join("")
      + (deliveryAhora() ? `<div class="line"><span></span><div class="meta">Delivery</div><div class="lp">${money(deliveryAhora())}</div></div>` : "");
    L.querySelectorAll("canvas[data-i]").forEach((cv) => { const it = cart[cv.dataset.i]; if (it) drawPizza(cv, it.cfg); });
    L.querySelectorAll("[data-m]").forEach((b) => { b.onclick = () => { const x = cart[b.dataset.m]; x.qty--; if (!x.qty) cart.splice(b.dataset.m, 1); save(); renderCart(); }; });
    L.querySelectorAll("[data-p]").forEach((b) => { b.onclick = () => { cart[b.dataset.p].qty++; save(); renderCart(); }; });
    $("#sheetTot").textContent = money(total()); $("#sheetBs").textContent = bs(total());
    const est = EU.estado(); $("#closedNote").hidden = est.abierto; $("#closedNote").textContent = `${est.texto}. Puedes enviar tu pedido y te respondemos apenas abramos.`;
    renderPagos(); updateMsg();
  }
  function buildMsg() {
    const lines = cart.map((x) => (x.kind === "drink" ? `• ${x.qty} x ${x.name} — ${money(x.unit * x.qty)}` : `• ${x.qty} x ${x.name} (${sizeName(x)}) — ${money(x.unit * x.qty)}\n   ${x.detail}`)).join("\n");
    const modoTxt = modo === "delivery" ? `Delivery${deliveryCosto ? ": " + money(deliveryCosto) : " (costo según la zona)"}\nDirección: ${$("#cAddr").value || "—"}` : modo === "llevar" ? "Para llevar (retiro en el local)" : "Para comer en el local";
    let m = `Hola ${sitio.nombre}, quiero hacer un pedido:\n\n${lines}\n\n${modoTxt}\nNombre: ${$("#cName").value || "—"}${$("#cNote").value ? `\nNotas: ${$("#cNote").value}` : ""}\n\nTotal: ${money(total())}`;
    EU.pagos.lineas(pago, total()).forEach((l) => { m += "\n" + l; });
    return m;
  }
  function updateMsg() { const m = buildMsg(); $("#msgPreview").textContent = m; $("#waBtn").href = EU.wa(m); }
  function renderModo() {
    $("#modo").innerHTML = MODOS.map(([v, n, s]) => `<button class="opt" type="button" data-v="${v}" aria-pressed="${modo === v}">${n}<small>${esc(s())}</small></button>`).join("");
    $("#modo").hidden = MODOS.length < 2;
    $("#addrWrap").hidden = modo !== "delivery";
    $("#modo").querySelectorAll(".opt").forEach((b) => { b.onclick = () => { modo = b.dataset.v; renderModo(); renderCart(); }; });
    renderPagos();
  }
  function renderPagos() {
    if (!EU.pagos.disponibles(modo).some((m) => m.id === pago)) pago = "";
    $("#payOpts").innerHTML = EU.pagos.html(modo, pago, "pago");
    $("#payInfo").innerHTML = pago ? EU.pagos.detalle(pago, total()) : "";
  }
  $("#form").addEventListener("change", (e) => { if (e.target.name === "pago") { pago = e.target.value; $("#formErr").hidden = true; renderPagos(); updateMsg(); } });
  $("#form").addEventListener("submit", (e) => e.preventDefault());
  ["#cName", "#cAddr", "#cNote"].forEach((s) => $(s).addEventListener("input", updateMsg));
  $("#waBtn").addEventListener("click", (e) => {
    const miss = !$("#cName").value.trim() ? "Escribe tu nombre para el pedido." : (modo === "delivery" && !$("#cAddr").value.trim()) ? "Escribe la dirección de entrega." : (EU.pagos.disponibles(modo).length && !pago) ? "Elige cómo vas a pagar." : "";
    $("#formErr").hidden = !miss; $("#formErr").textContent = miss;
    if (miss) { e.preventDefault(); $("#formErr").scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); return; }
    updateMsg();
    EU.registrarPedido({
      items: cart.map((x) => ({ nombre: x.kind === "drink" ? x.name : `${x.name} (${sizeName(x)})`, cantidad: x.qty, precio: x.unit })),
      total: total(), tipo: (MODOS.find((m) => m[0] === modo) || [])[1], pago,
    });
  });
  $("#copyMsg").onclick = async () => {
    try { await navigator.clipboard.writeText(buildMsg()); toast("Mensaje copiado"); }
    catch (_) { const r = document.createRange(); r.selectNodeContents($("#msgPreview")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selecciona y copia el mensaje"); }
  };
  function openSheet() { $("#scrim").hidden = false; $("#sheet").hidden = false; renderCart(); requestAnimationFrame(() => { $("#scrim").classList.add("open"); $("#sheet").classList.add("open"); }); $("#closeSheet").focus(); }
  function closeSheet() { $("#scrim").classList.remove("open"); $("#sheet").classList.remove("open"); setTimeout(() => { $("#scrim").hidden = true; $("#sheet").hidden = true; }, 300); }
  $("#cartBtn").onclick = openSheet; $("#closeSheet").onclick = closeSheet; $("#scrim").onclick = closeSheet;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 1600); }

  /* ===== Estado del local en la portada ===== */
  function renderEstado() {
    const e = EU.estado();
    $("#heroStatus").classList.toggle("closed", !e.abierto); $("#heroStatus span").textContent = e.texto;
  }
  renderEstado(); setInterval(renderEstado, 60000);

  /* ===== Pasos en móvil ===== */
  const isMobile = () => matchMedia("(max-width:760px)").matches;
  const STEPS = [...document.querySelectorAll(".step")]; let stepIdx = 0;
  const stepbar = document.createElement("div"); stepbar.className = "stepbar"; stepbar.setAttribute("aria-label", "Pasos");
  document.querySelector(".steps").before(stepbar);
  const STEP_NAMES = ["Tamaño", "Masa", "Salsa", "Queso", "Ingredientes"];
  function stepValue(i) {
    const per = (fn) => (B.mitad ? B.halves.map(fn).join(" / ") : fn(B.halves[0]));
    if (i === 0) return nombreDe(SIZES, B.size);
    if (i === 1) return nombreDe(MASAS, B.masa);
    if (i === 2) return per((h) => nombreDe(SALSAS, h.salsa));
    if (i === 3) return per((h) => nombreDe(QUESOS, h.queso));
    if (B.mitad) return B.halves.map((h) => h.tops.length).join(" + ") + " ingr.";
    const n = B.halves[0].tops.length; return n ? `${n} elegido${n > 1 ? "s" : ""}` : "Ninguno";
  }
  function renderStepbar() {
    stepbar.innerHTML = STEP_NAMES.map((n, i) => `<button type="button" data-i="${i}" ${i === stepIdx ? 'aria-current="step"' : ""}>${i + 1}. ${n}<small>${esc(stepValue(i))}</small></button>`).join("");
    stepbar.querySelectorAll("button").forEach((b) => { b.onclick = () => setStep(+b.dataset.i); });
  }
  function setStep(i) {
    stepIdx = i; STEPS.forEach((s, k) => s.classList.toggle("active", k === i)); renderStepbar();
    const cur = stepbar.querySelector('[aria-current="step"]'); if (cur) cur.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
  }
  STEPS.forEach((s, i) => { if (i < STEPS.length - 1) { const n = document.createElement("button"); n.type = "button"; n.className = "next"; n.textContent = "Siguiente: " + STEP_NAMES[i + 1]; n.onclick = () => setStep(i + 1); s.appendChild(n); } });
  document.querySelectorAll("#optSize,#optMasa,#optSalsa,#optQueso").forEach((el, i) => el.addEventListener("click", (e) => { if (e.target.closest(".opt") && isMobile() && !(B.mitad && i >= 2)) setTimeout(() => setStep(i + 1), 380); }));
  setStep(0);

  /* ===== Navegación ===== */
  function go(v) {
    $("#view-menu").hidden = v !== "menu"; $("#view-arma").hidden = v !== "arma"; $("#view-info").hidden = v !== "info";
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.go === v));
    if (v === "arma") requestAnimationFrame(() => { setupCanvas(bcv); baseKey = ""; lastInner = innerR(); redropAll(); });
  }
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { go(b.dataset.go); if (b.classList.contains("btn")) window.scrollTo({ top: $(".tabs").offsetTop, behavior: reduced ? "auto" : "smooth" }); }));

  const halfDesc = (h) => { const f = flavorOf(h); return f ? f.name : ["salsa " + nombreDe(SALSAS, h.salsa).toLowerCase(), nombreDe(QUESOS, h.queso).toLowerCase(), ...h.tops.map((t) => (TOP[t] ? TOP[t].name.toLowerCase() : ""))].filter(Boolean).join(", "); };
  function cleanRender(cfg) { try { const off = document.createElement("canvas"), w = bcv.clientWidth || 300; off.width = w; off.height = w; drawPizza(off, cfg, curScale); return off.toDataURL(); } catch (_) { return null; } }
  $("#bAdd").onclick = () => {
    const s = SIZES.find((x) => x.id === B.size), masa = nombreDe(MASAS, B.masa);
    const cfg = { size: B.size, masa: B.masa, mitad: B.mitad, halves: B.mitad ? clone(B.halves) : [clone(B.halves[0])] };
    let name = "Pizza a tu gusto", detail;
    if (B.mitad) {
      const [a, b] = B.halves, fa = flavorOf(a), fb = flavorOf(b);
      name = fa && fb && fa !== fb ? `Mitad ${fa.name} / mitad ${fb.name}` : "Pizza mitad y mitad";
      detail = `Masa ${masa.toLowerCase()} · Mitad 1: ${halfDesc(a)} · Mitad 2: ${halfDesc(b)}`;
    } else { const h = B.halves[0]; detail = [masa, "salsa " + nombreDe(SALSAS, h.salsa).toLowerCase(), nombreDe(QUESOS, h.queso), ...h.tops.map((t) => (TOP[t] ? TOP[t].name : ""))].filter(Boolean).join(", "); }
    addToCart({ name, size: s.id, cfg, unit: builderPrice(), detail }, bcv, cleanRender(cfg));
  };
  $("#bClear").onclick = () => { const side = sideNow(); [...halfOf(side).tops].forEach((id) => liftTop(id, side)); syncTopButtons(); updateBuilderInfo(); };
  $("#mitadBanner").onclick = () => {
    B.mitad = true; B.act = 0; B.halves = [newHalf(), newHalf()];
    go("arma"); buildUI(); refreshBuilder(); setStep(4); window.scrollTo({ top: $(".tabs").offsetTop, behavior: reduced ? "auto" : "smooth" }); toast("Elige el sabor de la mitad 1");
  };

  // Lo que ya estaba en el pedido y ahora está agotado se quita
  cart = cart.filter((x) => (x.kind === "drink" ? DRINKS.some((d) => d.id === x.drink && drinkAvail(d, x.size)) : !(x.photo && S.agotPizzas.includes(x.photo))));
  save();
  renderMenu(); renderDrinks(); renderModo();
  IMG_READY.then(() => {
    dibujarMenu();
    document.querySelectorAll("img[data-pz]").forEach((im) => { const p = MENU.find((x) => x.id === im.dataset.pz); if (p) im.src = fotoPizza(p); });
    if (MENU[0]) { $("#mbA").src = fotoPizza(MENU[0]); $("#mbB").src = fotoPizza(MENU[1] || MENU[0]); }
    buildUI(); refreshBuilder(); baseKey = ""; renderCart();
  });
  renderCart(); requestAnimationFrame(frame);
});
