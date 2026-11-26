/* Portada de EU Digital: plantillas con su descripción, planes con sus precios, formas de pago e instalar la app.
   Primero se pinta con los valores de siempre y después con los de verdad (precios, días de prueba,
   formas de pago y si el registro está abierto), que se cambian en el panel de administración. */
(function () {
  "use strict";
  const C = window.EU_CONFIG;
  const EU = window.EU;
  const P = window.EU_PLANTILLAS || {};
  const ORDEN = ["pizzeria", "arepera", "burgers", "sushi", "boutique"];
  const METODOS_BASE = ["Pago Móvil", "Zelle", "Binance", "Efectivo"];
  let pl = EU.planes.leer();
  let ciclo = "mensual";

  function el(tag, props, ...hijos) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    hijos.flat().forEach((x) => { if (x != null && x !== false) e.append(x.nodeType ? x : String(x)); });
    return e;
  }
  const todos = (sel) => document.querySelectorAll(sel);
  const dinero = EU.planes.dinero;
  const waNumero = () => pl.whatsapp || String(C.whatsappMarca || "").replace(/\D+/g, "");
  const enlaceWa = (texto) => "https://wa.me/" + waNumero() + "?text=" + encodeURIComponent(texto);
  const telVisible = () => {
    let d = waNumero();
    if (/^58\d{10}$/.test(d)) d = "0" + d.slice(2);
    return d.length === 11 ? d.slice(0, 4) + "-" + d.slice(4, 7) + "-" + d.slice(7) : d;
  };
  // Con el registro abierto, los botones llevan al registro; cerrado, a escribirnos por WhatsApp
  const destino = (plantilla, nombre) => {
    if (pl.registroAbierto) {
      const q = new URLSearchParams();
      if (plantilla) q.set("plantilla", plantilla);
      if (nombre) q.set("nombre", nombre);
      return { href: "/registro/" + (q.toString() ? "?" + q : ""), target: null };
    }
    return { href: enlaceWa("Hola, quiero una página de pedidos para " + (nombre ? "mi negocio " + nombre : "mi negocio") + (plantilla && P[plantilla] ? " con la plantilla " + P[plantilla].nombre : "") + "."), target: "_blank" };
  };
  // Nombre que la persona escribió en "Mira tu negocio aquí": las demos y los botones lo llevan
  let nombreMira = "";
  const demo = (k) => "/t/" + k + "/" + (nombreMira ? "?prueba=" + encodeURIComponent(nombreMira) : "");

  /* ---------- Plantillas ---------- */
  function pintarPlantillas() {
    const cont = document.getElementById("lista-plantillas");
    cont.replaceChildren(...ORDEN.filter((k) => P[k]).map((k) => {
      const t = P[k];
      const d = destino(k, nombreMira);
      return el("article", { class: "ld-pl" },
        el("a", { class: "ld-pl-foto", href: demo(k), "aria-label": "Ver la demo de " + t.nombre },
          el("img", { src: t.vistaPrevia, alt: "Vista de la plantilla " + t.nombre, loading: "lazy", width: "390", height: "640" })),
        el("div", { class: "ld-pl-txt" },
          el("h3", {}, t.nombre),
          el("p", { class: "ld-pl-desc" }, t.descripcion),
          t.ideal ? el("p", { class: "ld-pl-ideal" }, "Ideal para " + t.ideal.charAt(0).toLowerCase() + t.ideal.slice(1) + ".") : null,
          Array.isArray(t.puntos) && t.puntos.length ? el("ul", { class: "plan-puntos" }, t.puntos.map((x) => el("li", {}, x))) : null,
          el("div", { class: "acciones" },
            el("a", { class: "btn btn-sec btn-chico", href: demo(k) }, nombreMira ? "Ver con mi nombre" : "Ver demo"),
            el("a", { class: "btn btn-chico", href: d.href, target: d.target, rel: d.target ? "noopener" : null },
              pl.registroAbierto ? "Probar esta gratis" : "Pedir esta"))));
    }));
  }

  /* ---------- Mira tu negocio aquí ----------
     La persona escribe el nombre de su negocio, elige una plantilla y la ve al instante dentro del
     teléfono, con su nombre (la demo recibe ?prueba=Nombre). La demo de verdad solo se carga cuando
     toca "Ver mi página"; antes se muestra la foto de la plantilla, que pesa poco. */
  function mira() {
    const form = document.getElementById("mira-form");
    if (!form) return;
    const entrada = document.getElementById("mira-nombre");
    const img = document.getElementById("mira-img"), marco = document.getElementById("mira-frame");
    const acciones = document.getElementById("mira-acciones"), crear = document.getElementById("mira-crear"), abrir = document.getElementById("mira-abrir");
    const titulo = document.getElementById("mira-tel-titulo");
    const tel = document.querySelector(".mira-tel");
    let elegida = P.burgers ? "burgers" : ORDEN.find((k) => P[k]);
    let viva = false;
    document.getElementById("mira-plantillas").replaceChildren(...ORDEN.filter((k) => P[k]).map((k) =>
      el("label", { class: "mira-chip" },
        el("input", { type: "radio", name: "mira-pl", value: k, checked: k === elegida, onchange: () => { elegida = k; viva ? ver(false) : foto(); } }),
        el("span", {}, P[k].nombre))));
    function foto() { img.src = P[elegida].vistaPrevia; img.alt = "Vista de la plantilla " + P[elegida].nombre; titulo.textContent = "Plantilla " + P[elegida].nombre; }
    function ver(desplazar) {
      nombreMira = entrada.value.replace(/\s+/g, " ").trim().slice(0, 40);
      viva = true;
      const url = demo(elegida);
      if (marco.getAttribute("src") !== url) marco.src = url;
      marco.hidden = false; img.hidden = true; document.getElementById("mira-pista").hidden = true;
      titulo.textContent = nombreMira ? "Así se vería " + nombreMira : "Plantilla " + P[elegida].nombre;
      abrir.href = url;
      const d = destino(elegida, nombreMira);
      crear.href = d.href;
      if (d.target) { crear.target = d.target; crear.rel = "noopener"; } else { crear.removeAttribute("target"); crear.removeAttribute("rel"); }
      crear.textContent = pl.registroAbierto ? (nombreMira ? "Crear " + nombreMira + " gratis" : "Crear mi página gratis") : "Pedir mi página";
      acciones.hidden = false;
      pintarPlantillas();
      if (desplazar && tel.getBoundingClientRect().top > innerHeight * 0.5) tel.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
    form.addEventListener("submit", (e) => { e.preventDefault(); ver(true); });
    foto();
  }

  /* ---------- Planes ---------- */
  function boleto(id, animar) {
    const premium = id === "premium";
    const d = destino();
    let precio, unidad, equiv = "", sello = null, para, puntos;
    if (id === "prueba") {
      precio = "Gratis"; unidad = "por " + pl.diasPrueba + " días"; para = "Para conocerla con tu menú, sin pagar nada.";
      puntos = ["Una plantilla de tu elección", "Tu página en línea con su propio enlace", "El panel completo: precios, fotos y tasa del día", "Sin tarjeta: al terminar eliges tu plan"];
    } else {
      const info = EU.planes.lista(pl).find((x) => x.id === id);
      const mes = EU.planes.precio(pl, id, "mensual"), anio = EU.planes.precio(pl, id, "anual"), ahorro = EU.planes.ahorro(pl, id);
      para = info.para; puntos = info.puntos;
      if (ciclo === "anual") {
        precio = dinero(anio); unidad = "al año";
        equiv = "Te queda en " + dinero(Math.round((anio / 12) * 100) / 100) + " al mes.";
        if (ahorro > 0) sello = el("span", { class: "sello verde" + (animar ? " golpe" : "") }, "Ahorras " + dinero(ahorro));
      } else {
        precio = dinero(mes); unidad = "al mes";
        equiv = ahorro > 0 ? "O " + dinero(anio) + " pagando el año." : "";
      }
    }
    return el("div", { class: "boleto-sombra" },
      el("article", { class: "boleto" + (premium ? " boleto-premium" : ""), "aria-label": id === "prueba" ? "Prueba gratis" : "Plan " + EU.planes.nombres[id] },
        sello,
        el("h3", {}, id === "prueba" ? "Prueba gratis" : EU.planes.nombres[id]),
        el("p", { class: "boleto-para" }, para),
        el("div", { class: "boleto-precio" }, el("b", {}, precio), el("span", {}, unidad)),
        el("p", { class: "boleto-equiv" }, equiv),
        el("hr", { class: "boleto-corte" }),
        el("ul", { class: "plan-puntos" }, puntos.map((x) => el("li", {}, x))),
        el("a", { class: "btn" + (id === "prueba" ? " btn-wa" : ""), href: d.href, target: d.target, rel: d.target ? "noopener" : null },
          !pl.registroAbierto ? "Pedir mi página" : id === "prueba" ? "Empezar gratis" : "Empezar con la prueba")));
  }
  function pintarPlanes(animar) {
    document.getElementById("boletos").replaceChildren(...["prueba", "basico", "premium"].map((id) => boleto(id, animar)));
    todos("[data-ciclo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ciclo === ciclo)));
    const mayor = Math.max(EU.planes.ahorro(pl, "basico"), EU.planes.ahorro(pl, "premium"));
    document.getElementById("ahorro-anual").textContent = mayor > 0 ? "Pagando el año ahorras hasta " + dinero(mayor) + "." : "";
    document.getElementById("nota-planes").textContent = pl.registroAbierto
      ? "Todos empiezan con la prueba gratis. Durante la prueba o al terminar, eliges Básico o Premium en tu panel, en Mi suscripción. Con Premium puedes tener hasta " + pl.maxPaginas + " páginas: una por sucursal o por marca."
      : "Escríbenos y te creamos tu página con el plan que elijas. Con Premium puedes tener hasta " + pl.maxPaginas + " páginas: una por sucursal o por marca.";
  }
  todos("[data-ciclo]").forEach((b) => b.addEventListener("click", () => {
    if (ciclo === b.dataset.ciclo) return;
    ciclo = b.dataset.ciclo;
    pintarPlanes(ciclo === "anual");
  }));

  /* ---------- Formas de pago ---------- */
  function pintarMetodos() {
    const lista = pl.metodos.length ? pl.metodos : METODOS_BASE;
    document.getElementById("metodos").replaceChildren(...lista.map((m) => el("li", {}, el("span", {}, m), el("span", {}, "Aceptado"))));
  }

  /* ---------- Textos que dependen de los ajustes ---------- */
  function pintarTextos() {
    todos("[data-dias]").forEach((x) => { x.textContent = String(pl.diasPrueba); });
    todos("[data-max]").forEach((x) => { x.textContent = String(pl.maxPaginas); });
    todos("[data-wa-visible]").forEach((x) => { x.textContent = telVisible(); });
    todos("[data-wa]").forEach((a) => { a.href = enlaceWa("Hola, quiero saber más de las páginas de pedidos."); });
    const d = destino();
    todos("[data-cta=registro]").forEach((a) => {
      a.href = d.href;
      if (d.target) { a.target = d.target; a.rel = "noopener"; a.textContent = "Pedir mi página por WhatsApp"; }
    });
    document.getElementById("nota-hero").textContent = pl.registroAbierto
      ? "Sin tarjeta y sin contrato. Tu página queda en línea apenas te registras."
      : "Escríbenos y te creamos tu página. Al principio la pruebas " + pl.diasPrueba + " días gratis.";
  }

  /* ---------- Instalar la app ---------- */
  todos("[data-instalar]").forEach((b) => b.addEventListener("click", () => {
    if (EU.app) EU.app.abrir(); else location.href = "/panel/";
  }));

  function pintarTodo(animar) {
    pintarTextos();
    pintarPlantillas();
    pintarPlanes(animar);
    pintarMetodos();
  }
  pintarTodo(false);
  mira();
  // Selector de idioma de la plataforma (core/idiomas.js) en el encabezado
  const nav = document.querySelector(".ld-cab nav");
  if (nav && EU.selectorIdiomas) nav.prepend(EU.selectorIdiomas());

  const base = String(C.supabaseUrl || "").replace(/\/+$/, "");
  if (base) {
    fetch(base + "/rest/v1/rpc/eu_planes_publicos", {
      method: "POST", body: "{}",
      headers: { apikey: C.supabaseKey, Authorization: "Bearer " + C.supabaseKey, "Content-Type": "application/json" },
    }).then((r) => (r.ok ? r.json() : null)).then((datos) => {
      if (!datos) return;
      pl = EU.planes.leer(datos);
      pintarTodo(false);
    }).catch(() => { /* sin conexión con la base: quedan los valores de siempre */ });
  }
})();
