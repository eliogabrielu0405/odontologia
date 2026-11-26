/* Panel de EU Digital: clientes, pagos, suspensiones y ajustes de la plataforma. */
(function () {
  "use strict";
  const C = window.EU_CONFIG;
  const EU = window.EU;
  const h = EU.h;
  const api = EU.crearApi({ llave: "eu:admin", almacen: "sesion" });
  const app = document.getElementById("app");
  const ORDEN = ["pizzeria", "arepera", "burgers", "delicias", "sushi", "boutique"];
  const plantillas = () => ORDEN.map((id) => (window.EU_PLANTILLAS || {})[id]).filter(Boolean);
  const nombrePlantilla = (id) => ((window.EU_PLANTILLAS || {})[id] || { nombre: id }).nombre;
  const D = { sitios: [], cuentas: {}, pagos: [], notas: {}, ajustes: {}, seccion: "resumen", filtro: "todos", buscar: "" };
  let refs = {};

  /* ---------- Ayudas ---------- */
  const sitioDe = (id) => D.sitios.find((s) => s.id === id);
  // Una cuenta = la página principal (lleva el usuario y la suscripción) más sus páginas adicionales (plan Premium)
  const principales = () => D.sitios.filter((s) => !s.principal);
  const principalDe = (s) => (s.principal && sitioDe(s.principal)) || s;
  const paginasDe = (s) => D.sitios.filter((x) => x.principal === s.id);
  const cuentaDe = (s) => D.cuentas[s.principal || s.id] || {};
  const estadoDe = (s) => EU.estadoCuenta(s, cuentaDe(s), D.ajustes.diasGracia);
  const PL = () => EU.planes.leer(D.ajustes);
  const planDe = (s) => cuentaDe(s).plan || "basico";
  const cicloDe = (s) => cuentaDe(s).ciclo || "mensual";
  // Lo que paga la cuenta en cada periodo (una prueba todavía no paga: se muestra el Básico mensual)
  const precioDe = (s) => (planDe(s) === "prueba" ? EU.planes.precio(PL(), "basico", "mensual") : EU.planes.precio(PL(), planDe(s), cicloDe(s)));
  const planTxt = (s) => (planDe(s) === "prueba" ? "Prueba gratis" : EU.planes.nombres[planDe(s)] + (cicloDe(s) === "anual" ? " anual" : " mensual"));
  const selloPlan = (s) => h("span", { class: "chip-plan chip-" + planDe(s) }, planDe(s) === "prueba" ? "Prueba" : EU.planes.nombres[planDe(s)]);
  const tiempoPago = (p) => { const n = Number(p.meses) || 1; return p.ciclo === "anual" || n === 12 ? "1 año" : n + (n === 1 ? " mes" : " meses"); };
  const SEL_SITIOS = "select=id,slug,nombre,plantilla,estado,dominio,creado,actualizado,dueno,principal&order=creado.desc";
  const enlaceSitio = (s) => (s.dominio ? "https://" + s.dominio : location.origin + "/?n=" + encodeURIComponent(s.slug));
  const enlacePanel = (s) => location.origin + "/panel/?u=" + encodeURIComponent(s.slug);
  const telWa = (t) => { let d = EU.soloNumeros(t); if (d.length === 11 && d.startsWith("0")) d = "58" + d.slice(1); return d; };
  const wa = (tel, texto) => "https://wa.me/" + telWa(tel) + "?text=" + encodeURIComponent(texto);
  const montoTxt = (p) => (p.moneda === "VES" ? "Bs " + EU.fmtBs.format(p.monto) : EU.usd(p.monto));
  const pendientes = () => D.pagos.filter((p) => p.estado === "pendiente");
  const RESERVADOS = ["admin", "panel", "registro", "planes", "www", "app", "api", "core", "img", "sql", "tools", "eudigital", "eu-digital",
    "soporte", "ayuda", "demo", "prueba", "test", "login", "entrar", "pizzeria", "arepera", "burgers", "delicias", "sushi", "boutique", "t"];
  const sumarDias = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const OP_PLAN = [{ id: "basico", nombre: "Básico" }, { id: "premium", nombre: "Premium" }];
  const OP_CICLO = [{ id: "mensual", nombre: "Por mes" }, { id: "anual", nombre: "Por año" }];
  function cargando(t) { app.replaceChildren(h("div", { class: "cargando-pantalla" }, h("p", {}, h("span", { class: "punto-carga" }), t || "Cargando"))); }
  function irA(seccion, filtro) { D.seccion = seccion; if (filtro) D.filtro = filtro; pintarNav(); pintarSeccion(); scrollTo({ top: 0 }); }

  /* ---------- Entrada ---------- */
  function pantallaEntrada(mensaje) {
    document.title = "EU Digital: entrar";
    const usuario = h("input", { class: "entrada", id: "usuario", type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: false, value: C.usuarioAdmin || "" });
    const clave = h("input", { class: "entrada", id: "clave", type: "password", autocomplete: "current-password" });
    const error = h("p", { class: "banda rojo", role: "alert", hidden: !mensaje }, mensaje || "");
    const boton = h("button", { class: "btn btn-ancho", type: "submit" }, "Entrar");
    const form = h("form", { class: "hoja entrada-hoja", novalidate: true },
      h("div", { class: "marca-eu" }, h("img", { src: "/img/favicon.svg", alt: "" }), C.marca || "EU Digital"),
      h("div", { class: "hoja-cab" }, h("h1", {}, "Panel de administración"), h("p", {}, "Solo para EU Digital. La sesión se cierra al cerrar esta pestaña.")),
      h("div", { class: "campos" },
        h("div", { class: "campo" }, h("label", { for: "usuario" }, "Usuario"), usuario),
        h("div", { class: "campo" }, h("label", { for: "clave" }, "Contraseña"), clave)),
      error, boton);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      boton.disabled = true; boton.textContent = "Entrando";
      try { await api.entrar(usuario.value.trim(), clave.value); await cargar(); }
      catch (err) { error.textContent = err.status === 400 ? "El usuario o la contraseña no son correctos." : err.message; error.hidden = false; boton.disabled = false; boton.textContent = "Entrar"; }
    });
    app.replaceChildren(h("main", { class: "entrada-pantalla" }, form));
    (usuario.value ? clave : usuario).focus();
  }

  async function salir() { await api.salir(); pantallaEntrada(); }

  /* ---------- Datos ---------- */
  /* Los comprobantes de pago (capturas y PDF) ocupan espacio en Supabase y no se vuelven a mirar.
     Una vez al día, al abrir el panel, se borran los de pagos ya revisados con más de 6 meses.
     El pago queda en el historial, solo sin la captura. */
  async function limpiarComprobantes() {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem("eu:limpieza-comprobantes") === hoy) return;
      const limite = new Date(Date.now() - 183 * 86400000).toISOString();
      const viejos = (await api.select("eu_pagos", "select=id,comprobante&comprobante=not.is.null&estado=neq.pendiente&creado=lt." + encodeURIComponent(limite) + "&limit=200")) || [];
      if (viejos.length) {
        await api.borrarArchivos("eu-pagos", viejos.map((p) => p.comprobante));
        await api.actualizar("eu_pagos", "id=in.(" + viejos.map((p) => p.id).join(",") + ")", { comprobante: null });
        viejos.forEach((v) => { const p = D.pagos.find((x) => x.id === v.id); if (p) p.comprobante = null; });
      }
      localStorage.setItem("eu:limpieza-comprobantes", hoy);
    } catch (_) { /* no es grave: se intenta la próxima vez */ }
  }

  async function cargar() {
    cargando("Abriendo el panel");
    try {
      const esAdmin = await api.rpc("eu_es_admin", {});
      if (esAdmin !== true) { await api.salir(); return pantallaEntrada("Esta cuenta no es de EU Digital. Los clientes entran por /panel."); }
      const [sitios, cuentas, pagos, notas, ajustes] = await Promise.all([
        api.select("eu_sitios", SEL_SITIOS),
        api.select("eu_cuentas", "select=*"),
        api.select("eu_pagos", "select=*&order=creado.desc&limit=500"),
        api.select("eu_notas", "select=*"),
        api.select("eu_ajustes", "select=*&id=eq.eu"),
      ]);
      D.sitios = sitios || [];
      D.cuentas = Object.fromEntries((cuentas || []).map((c) => [c.sitio_id, c]));
      D.pagos = pagos || [];
      D.notas = Object.fromEntries((notas || []).map((n) => [n.sitio_id, n]));
      D.ajustes = (ajustes && ajustes[0] && ajustes[0].datos) || {};
      await revisarAvisos();
      if (location.hash === "#pagos") { D.seccion = "pagos"; history.replaceState(null, "", location.pathname + location.search); }
      if (location.hash === "#clientes") { D.seccion = "clientes"; D.filtro = "prueba"; history.replaceState(null, "", location.pathname + location.search); }
      pintar();
      limpiarComprobantes();
    } catch (err) {
      if (err.status === 401) { await api.salir(); return pantallaEntrada("Tu sesión venció. Vuelve a entrar."); }
      app.replaceChildren(h("main", { class: "entrada-pantalla" }, h("div", { class: "hoja entrada-hoja" },
        h("h1", {}, "No se pudo abrir el panel"), h("p", { class: "suave" }, err.message),
        h("div", { class: "acciones" }, h("button", { class: "btn", type: "button", onclick: cargar }, "Intentar de nuevo"), h("button", { class: "btn btn-sec", type: "button", onclick: salir }, "Salir")))));
    }
  }

  /* ---------- Estructura ---------- */
  const SECCIONES = [
    { id: "resumen", titulo: "Resumen" },
    { id: "pagos", titulo: "Pagos" },
    { id: "clientes", titulo: "Clientes" },
    { id: "nuevo", titulo: "Nuevo cliente" },
    { id: "plantillas", titulo: "Plantillas" },
    { id: "ajustes", titulo: "Ajustes" },
  ];
  function pintar() {
    document.title = "EU Digital: administración";
    refs = { nav: h("div", { class: "adm-nav-in", role: "navigation", "aria-label": "Secciones" }), main: h("main", { class: "adm-main" }) };
    app.replaceChildren(
      h("div", { class: "adm-arriba" },
        h("header", { class: "adm-cab" }, h("div", { class: "marca-eu" }, h("img", { src: "/img/favicon.svg", alt: "" }), D.ajustes.marca || C.marca || "EU Digital"),
          h("div", { class: "acciones" }, h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: cargar }, "Actualizar"), h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: salir }, "Salir"))),
        h("nav", {}, refs.nav)),
      refs.main);
    pintarNav();
    pintarSeccion();
  }
  function pintarNav() {
    const n = pendientes().length;
    refs.nav.replaceChildren(...SECCIONES.map((s) => h("button", {
      type: "button", "aria-current": s.id === D.seccion ? "page" : null, onclick: () => irA(s.id),
    }, s.titulo, s.id === "pagos" && n ? h("span", { class: "cuenta", "aria-label": n + " por revisar" }, String(n)) : null)));
  }
  function pintarSeccion() {
    const f = { resumen, pagos: seccionPagos, clientes, nuevo: nuevoCliente, plantillas: seccionPlantillas, ajustes }[D.seccion] || resumen;
    refs.main.replaceChildren(...[].concat(f()));
  }
  const titulo = (t, sub, extra) => h("div", { class: "adm-titulo" }, h("div", {}, h("h1", {}, t), sub ? h("p", {}, sub) : null), extra || null);

  /* ---------- Resumen ---------- */
  function resumen() {
    const cuenta = { activa: 0, porvencer: 0, vencida: 0, suspendida: 0 };
    const cuentas = principales();
    cuentas.forEach((s) => { cuenta[estadoDe(s).id]++; });
    const enPrueba = cuentas.filter((s) => planDe(s) === "prueba" && s.estado === "activo").length;
    const mes = EU.hoyISO().slice(0, 7);
    const delMes = D.pagos.filter((p) => p.estado === "aprobado" && String(p.revisado || p.creado).slice(0, 7) === mes);
    const usd = delMes.filter((p) => p.moneda !== "VES").reduce((a, p) => a + Number(p.monto), 0);
    const ves = delMes.filter((p) => p.moneda === "VES").reduce((a, p) => a + Number(p.monto), 0);
    // Lo que entra al mes con los planes pagos activos (un plan anual cuenta como su doceava parte)
    const mensual = cuentas.filter((s) => s.estado === "activo" && planDe(s) !== "prueba").reduce((a, s) => a + precioDe(s) / (cicloDe(s) === "anual" ? 12 : 1), 0);
    const cifra = (n, t, tono, accion) => h(accion ? "button" : "div", { class: "cifra " + (tono || ""), type: accion ? "button" : null, onclick: accion || null }, h("b", {}, String(n)), h("span", {}, t));
    const proximas = cuentas.filter((s) => { const d = EU.diasHasta(cuentaDe(s).vence); return s.estado === "activo" && d != null && d <= 7; })
      .sort((a, b) => String(cuentaDe(a).vence).localeCompare(String(cuentaDe(b).vence)));
    return [
      titulo("Resumen", "Hoy es " + EU.fecha(EU.hoyISO(), true) + "."),
      h("div", { class: "cifras" },
        cifra(pendientes().length, "Pagos por revisar", pendientes().length ? "ambar" : "", () => irA("pagos")),
        cifra(cuenta.activa + cuenta.porvencer, "Cuentas al día", "verde", () => irA("clientes", "activas")),
        cifra(enPrueba, "En prueba gratis", "", () => irA("clientes", "prueba")),
        cifra(cuenta.porvencer, "Vencen en 5 días", cuenta.porvencer ? "ambar" : "", () => irA("clientes", "porvencer")),
        cifra(cuenta.vencida, "Vencidas", cuenta.vencida ? "rojo" : "", () => irA("clientes", "vencidas")),
        cifra(cuenta.suspendida, "Suspendidas", "", () => irA("clientes", "suspendidas"))),
      ...[invitarAvisos()].filter(Boolean),
      h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Cobrado este mes"), h("p", {}, "Pagos aprobados desde el día 1.")),
        h("div", { class: "talon-fila", style: "display:flex;gap:24px;flex-wrap:wrap;align-items:flex-end" },
          h("div", {}, h("p", { class: "cifra-txt suave" }, "En dólares"), h("p", { class: "monto-grande", style: "font:800 32px/1 var(--titulos)" }, EU.usd(usd))),
          ves ? h("div", {}, h("p", { class: "suave" }, "En bolívares"), h("p", { style: "font:800 32px/1 var(--titulos)" }, "Bs " + EU.fmtBs.format(ves))) : null,
          h("div", {}, h("p", { class: "suave" }, "Lo que suman los planes pagos activos"), h("p", { style: "font:800 32px/1 var(--titulos)" }, EU.usd(mensual) + " al mes")))),
      h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Vencen esta semana"), h("p", {}, "Planes por renovar y pruebas gratis por terminar. Mándales un recordatorio por WhatsApp con un toque.")),
        proximas.length ? h("div", { class: "fichas" }, proximas.map(ficha)) : h("p", { class: "suave" }, "Ninguna cuenta vence en los próximos 7 días.")),
      registrosNuevos(cuentas),
    ];
  }

  // Los que se registraron solos en las últimas dos semanas: para escribirles mientras prueban
  function registrosNuevos(cuentas) {
    const desde = sumarDias(EU.hoyISO(), -14);
    const nuevos = cuentas.filter((s) => cuentaDe(s).origen === "registro" && String(s.creado).slice(0, 10) >= desde)
      .sort((a, b) => String(b.creado).localeCompare(String(a.creado))).slice(0, 8);
    const pl = PL();
    return h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Registros nuevos"),
        h("p", {}, pl.registroAbierto ? "Los que crearon su página solos en las últimas dos semanas. Escríbeles mientras prueban." : "El registro está cerrado. Lo abres en Ajustes > Planes y precios.")),
      nuevos.length ? h("div", { class: "fichas" }, nuevos.map(ficha)) : h("p", { class: "suave" }, "Nadie se ha registrado en las últimas dos semanas."));
  }

  function recordatorio(s) {
    const c = cuentaDe(s);
    const saludo = "Hola" + (c.contacto ? " " + c.contacto : "") + ", te escribimos de " + (D.ajustes.marca || C.marca || "EU Digital") + ". ";
    if (planDe(s) === "prueba") {
      const pl = PL();
      return saludo + "La prueba gratis de tu página " + s.nombre + (c.vence ? (EU.diasHasta(c.vence) < 0 ? " terminó el " : " termina el ") + EU.fecha(c.vence) : " está por terminar") + ". " +
        "Para que siga en línea elige tu plan: Básico por " + EU.planes.dinero(EU.planes.precio(pl, "basico", "mensual")) + " al mes o Premium por " + EU.planes.dinero(EU.planes.precio(pl, "premium", "mensual")) + " al mes. " +
        "Lo eliges y reportas el pago en tu panel: " + enlacePanel(s);
    }
    return saludo + "El plan " + EU.planes.nombres[planDe(s)] + " de tu página " + s.nombre + (c.vence ? " vence el " + EU.fecha(c.vence) : " está por vencer") + ". " +
      "El pago es de " + EU.usd(precioDe(s)) + (cicloDe(s) === "anual" ? " por el año" : " por el mes") + ". Cuando pagues, repórtalo en tu panel: " + enlacePanel(s);
  }

  /* ---------- Fichas de clientes ---------- */
  function ficha(s) {
    const est = estadoDe(s), c = cuentaDe(s), extra = paginasDe(s).length;
    const prueba = planDe(s) === "prueba";
    return h("button", { class: "ficha", type: "button", onclick: () => abrirCliente(s) },
      h("span", {}, h("b", {}, s.nombre), h("br"), h("span", { class: "suave" }, s.slug + ", " + nombrePlantilla(s.plantilla) + (extra ? " y " + extra + (extra === 1 ? " página más" : " páginas más") : ""))),
      h("span", { class: "sello " + est.tono }, est.sello),
      h("span", { class: "suave", style: "grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap" }, selloPlan(s),
        c.idioma && c.idioma !== "es" ? h("span", { class: "sello azul", title: "Idioma que eligió al registrarse" }, "🌐 " + ({ en: "Inglés", pt: "Portugués", it: "Italiano" }[c.idioma] || c.idioma)) : null,
        (c.vence ? (prueba ? "Prueba hasta el " : "Fecha de corte: ") + EU.fecha(c.vence, true) : "Sin fecha de corte") + (prueba ? "." : ". " + EU.usd(precioDe(s)) + (cicloDe(s) === "anual" ? " al año." : " al mes."))));
  }

  function clientes() {
    const FILTROS = [["todos", "Todos"], ["activas", "Al día"], ["prueba", "En prueba"], ["porvencer", "Por vencer"], ["vencidas", "Vencidas"], ["suspendidas", "Suspendidas"]];
    const buscar = h("input", { class: "entrada", type: "search", placeholder: "Buscar por nombre, usuario o teléfono", value: D.buscar, "aria-label": "Buscar clientes" });
    const lista = h("div", { class: "fichas" });
    const chips = h("div", { class: "chips", role: "group", "aria-label": "Filtrar" });
    const pintarLista = () => {
      const q = D.buscar.trim().toLowerCase();
      const ok = principales().filter((s) => {
        const est = estadoDe(s).id;
        const f = D.filtro;
        if (f === "prueba" && planDe(s) !== "prueba") return false;
        if (f === "activas" && !(est === "activa" || est === "porvencer")) return false;
        if (f === "porvencer" && est !== "porvencer") return false;
        if (f === "vencidas" && est !== "vencida") return false;
        if (f === "suspendidas" && est !== "suspendida") return false;
        if (!q) return true;
        const c = cuentaDe(s);
        return [s.nombre, s.slug, s.dominio, c.contacto, c.telefono, ...paginasDe(s).flatMap((x) => [x.nombre, x.slug, x.dominio])].filter(Boolean).join(" ").toLowerCase().includes(q);
      });
      lista.replaceChildren(...(ok.length ? ok.map(ficha) : [h("p", { class: "vacio-adm", style: "grid-column:1/-1" }, D.sitios.length ? "Ningún cliente coincide." : "Todavía no tienes clientes. Crea el primero en Nuevo cliente o comparte tu enlace de registro.")]));
      chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.f === D.filtro)));
    };
    FILTROS.forEach(([id, t]) => chips.append(h("button", { class: "chip", type: "button", "data-f": id, onclick: () => { D.filtro = id; pintarLista(); } }, t)));
    buscar.addEventListener("input", () => { D.buscar = buscar.value; pintarLista(); });
    pintarLista();
    const nC = principales().length, nP = D.sitios.length;
    return [titulo("Clientes", nC + (nC === 1 ? " cuenta" : " cuentas") + (nP > nC ? " con " + nP + " páginas" : "") + " en total.", h("button", { class: "btn", type: "button", onclick: () => irA("nuevo") }, "Nuevo cliente")),
      h("div", { class: "filtros" }, buscar, chips), lista];
  }

  /* ---------- Pagos ---------- */
  function seccionPagos() {
    const pend = pendientes();
    const historial = D.pagos.filter((p) => p.estado !== "pendiente").slice(0, 60);
    return [
      titulo("Pagos", pend.length ? "Revisa la referencia en tu banco antes de aprobar." : "No hay pagos esperando revisión."),
      pend.length ? h("div", { class: "recibos" }, pend.map(reciboPendiente)) : h("p", { class: "vacio-adm" }, "Todo revisado. Cuando un cliente reporte un pago, aparece aquí."),
      h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Historial"), h("p", {}, "Los últimos pagos revisados.")),
        historial.length ? h("div", {}, historial.map((p) => lineaPago(p))) : h("p", { class: "suave" }, "Todavía no hay pagos revisados.")),
    ];
  }
  function lineaPago(p, conCliente = true) {
    const s = sitioDe(p.sitio_id);
    const sello = { aprobado: ["Pagado", "verde"], rechazado: ["Rechazado", "rojo"], pendiente: ["En revisión", "ambar"] }[p.estado] || [p.estado, "gris"];
    return h("div", { class: "dato", style: "align-items:flex-start" },
      h("div", { style: "flex:1;min-width:0" },
        h("b", { class: "num" }, montoTxt(p) + " por " + (p.plan ? "plan " + (EU.planes.nombres[p.plan] || p.plan) + ", " : "") + tiempoPago(p)),
        h("p", { class: "suave chico" }, [conCliente && s ? s.nombre : "", p.metodo, p.referencia ? "Ref. " + p.referencia : "", EU.fechaHora(p.creado)].filter(Boolean).join(", ")),
        p.respuesta ? h("p", { class: "chico", style: "color:var(--rojo);font-weight:700" }, "Motivo: " + p.respuesta) : null),
      h("span", { class: "sello " + sello[1] }, sello[0]));
  }
  function reciboPendiente(p) {
    const s = sitioDe(p.sitio_id);
    const c = s ? cuentaDe(s) : {};
    // Lo que el cliente dijo que paga; se puede corregir antes de aprobar
    const actual = s ? planDe(s) : "basico";
    const meses = { m: String(p.meses || 1), plan: p.plan || (actual === "premium" ? "premium" : "basico"), ciclo: p.ciclo || (Number(p.meses) >= 12 ? "anual" : "mensual") };
    const pl = PL();
    const debe = h("p", { class: "suave chico" });
    const pintarDebe = () => {
      const total = meses.ciclo === "anual" ? EU.planes.precio(pl, meses.plan, "anual") : EU.planes.precio(pl, meses.plan, "mensual") * (Number(meses.m) || 1);
      debe.textContent = "Ese plan cuesta " + EU.usd(total) + (meses.ciclo === "anual" ? " por el año." : " por " + meses.m + (meses.m === "1" ? " mes." : " meses.")) +
        (s && meses.plan === "basico" && paginasDe(s).length ? " Al pasar a Básico se pausan sus páginas adicionales." : "");
    };
    const ed = EU.crearEditor({ raiz: () => meses, alCambiar: pintarDebe });
    const selMeses = h("div", { class: "campos" },
      h("div", { class: "dos-col" },
        ed.campo({ tipo: "selector", ruta: "plan", etiqueta: "Plan", opciones: [{ id: "basico", nombre: "Básico" }, { id: "premium", nombre: "Premium" }] }),
        ed.campo({ tipo: "selector", ruta: "ciclo", etiqueta: "Paga", opciones: [{ id: "mensual", nombre: "Mes a mes" }, { id: "anual", nombre: "Un año" }] })),
      ed.campo({ tipo: "selector", ruta: "m", etiqueta: "Meses que se suman", lista: true, si: { ruta: "ciclo", igual: "mensual" }, opciones: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), nombre: i + 1 + (i ? " meses" : " mes") })) }),
      debe);
    pintarDebe();
    const selloPos = h("span", { class: "sello-pos" }, h("span", { class: "sello ambar" }, "En revisión"));
    const acciones = h("div", { class: "acciones" });
    const tarjeta = h("article", { class: "recibo-pago" },
      selloPos,
      h("p", { class: "monto" }, montoTxt(p)),
      h("p", { class: "quien" }, s ? s.nombre : "Página eliminada"),
      p.plan ? h("p", { class: "chico", style: "font-weight:700" }, "Dice que paga: plan " + (EU.planes.nombres[p.plan] || p.plan) + ", " + tiempoPago(p) + ".") : null,
      h("p", { class: "suave chico" }, [p.metodo, p.referencia ? "Ref. " + p.referencia : "Sin referencia", "Reportado el " + EU.fechaHora(p.creado)].join(". ")),
      s ? h("p", { class: "suave chico" }, "Hoy tiene: " + planTxt(s) + ". " + (c.vence ? (actual === "prueba" ? "La prueba termina el " : "Fecha de corte actual: ") + EU.fecha(c.vence, true) + "." : "")) : null,
      p.nota ? h("p", { class: "nota" }, "Nota del cliente: " + p.nota) : null,
      p.comprobante ? h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => verComprobante(p) }, "Ver comprobante") : h("p", { class: "suave chico" }, "Sin comprobante."),
      selMeses, acciones);
    const aprobar = h("button", { class: "btn btn-verde", type: "button" }, "Aprobar");
    const rechazar = h("button", { class: "btn btn-peligro", type: "button" }, "Rechazar");
    aprobar.addEventListener("click", async () => {
      aprobar.disabled = rechazar.disabled = true; aprobar.textContent = "Aprobando";
      try {
        const nMeses = meses.ciclo === "anual" ? 12 : Number(meses.m) || p.meses;
        const vence = await api.rpc("eu_admin_aprobar_pago", { p_pago: p.id, p_meses: nMeses, p_plan: meses.plan, p_ciclo: meses.ciclo });
        p.estado = "aprobado"; p.meses = nMeses; p.plan = meses.plan; p.ciclo = meses.ciclo; p.revisado = new Date().toISOString();
        if (s) {
          D.cuentas[s.id] = Object.assign(D.cuentas[s.id] || { sitio_id: s.id }, { vence, plan: meses.plan, ciclo: meses.ciclo });
          s.estado = "activo";
          paginasDe(s).forEach((x) => { x.estado = meses.plan === "premium" ? "activo" : "suspendido"; });
        }
        selloPos.replaceChildren(h("span", { class: "sello grande verde golpe" }, "Pagado"));
        selMeses.hidden = true;
        acciones.replaceChildren(h("p", { class: "banda verde", style: "width:100%" }, "Aprobado: plan " + EU.planes.nombres[meses.plan] + ". Nueva fecha de corte: " + EU.fecha(vence, true) + "."),
          s && c.telefono ? h("a", { class: "btn btn-sec btn-chico", href: wa(c.telefono, "Hola" + (c.contacto ? " " + c.contacto : "") + ", recibimos tu pago. Tu página " + s.nombre + " queda con el plan " + EU.planes.nombres[meses.plan] + " hasta el " + EU.fecha(vence, true) + ". ¡Gracias!"), target: "_blank", rel: "noopener" }, "Avisarle por WhatsApp") : null);
        pintarNav();
      } catch (err) { EU.aviso(err.message, true); aprobar.disabled = rechazar.disabled = false; aprobar.textContent = "Aprobar"; }
    });
    rechazar.addEventListener("click", () => {
      const d = { motivo: "" };
      const ed2 = EU.crearEditor({ raiz: () => d });
      EU.modal({
        titulo: "Rechazar pago",
        construir: (m) => {
          m.cuerpo.append(h("p", {}, "El cliente ve el motivo en su panel."), ed2.campo({ tipo: "area", ruta: "motivo", etiqueta: "Motivo", max: 300, placeholder: "Ej: No encontramos la referencia en el banco." }));
          const ok = h("button", { class: "btn btn-peligro lleno", type: "button" }, "Rechazar pago");
          ok.addEventListener("click", async () => {
            ok.disabled = true;
            try {
              await api.rpc("eu_admin_rechazar_pago", { p_pago: p.id, p_respuesta: d.motivo.trim() || null });
              p.estado = "rechazado"; p.respuesta = d.motivo.trim() || null;
              selloPos.replaceChildren(h("span", { class: "sello grande rojo golpe" }, "Rechazado"));
              selMeses.hidden = true;
              acciones.replaceChildren(h("p", { class: "banda rojo", style: "width:100%" }, "Rechazado." + (p.respuesta ? " Motivo: " + p.respuesta : "")));
              pintarNav(); m.cerrar();
            } catch (err) { EU.aviso(err.message, true); ok.disabled = false; }
          });
          m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: () => m.cerrar() }, "Cancelar"), ok);
        },
      });
    });
    acciones.append(aprobar, rechazar);
    return tarjeta;
  }
  async function verComprobante(p) {
    const m = EU.modal({ titulo: "Comprobante", ancho: true, construir: (x) => x.cuerpo.append(h("p", { class: "suave" }, "Cargando comprobante")) });
    try {
      const blob = await api.descargar("eu-pagos", p.comprobante);
      const url = URL.createObjectURL(blob);
      m.d.addEventListener("close", () => URL.revokeObjectURL(url));
      m.cuerpo.replaceChildren(
        /^image\//.test(blob.type) ? h("img", { class: "comprobante", src: url, alt: "Comprobante de pago" }) : h("p", {}, "Es un PDF."),
        h("a", { class: "btn btn-sec", href: url, target: "_blank", rel: "noopener", download: p.comprobante.split("/").pop() }, "Abrir o descargar"));
    } catch (err) { m.cuerpo.replaceChildren(h("p", { class: "banda rojo" }, err.message)); }
  }

  /* ---------- Detalle de un cliente ---------- */
  function abrirCliente(s) {
    EU.modal({
      titulo: s.nombre, ancho: true,
      alCerrar: () => pintarSeccion(),
      construir: (m) => pintarCliente(m, s),
    });
  }
  function pintarCliente(m, s) {
    const c = cuentaDe(s), est = estadoDe(s), extra = paginasDe(s);
    const copiarBtn = (txt, etiqueta) => { const b = h("button", { class: "btn btn-sec btn-chico", type: "button" }, etiqueta); b.addEventListener("click", () => EU.copiar(txt, b)); return b; };
    const pagosCliente = D.pagos.filter((p) => p.sitio_id === s.id);
    const origen = c.origen === "registro" ? " Se registró solo el " + EU.fecha(String(c.creado || s.creado).slice(0, 10)) + "." : "";
    m.cuerpo.replaceChildren(
      h("div", { class: "hoja-fila" },
        h("div", {}, h("p", { class: "suave" }, "Usuario " + s.slug + ". Plantilla " + nombrePlantilla(s.plantilla) + "." + origen
            + " Idioma: " + ({ es: "español", en: "inglés", pt: "portugués", it: "italiano" }[c.idioma || "es"] || c.idioma) + "."),
          h("p", { class: "linea-plan" }, selloPlan(s), planDe(s) === "prueba" ? "Todavía no ha pagado."
            : (cicloDe(s) === "anual" ? "Paga por año: " + EU.usd(precioDe(s)) + "." : "Paga por mes: " + EU.usd(precioDe(s)) + ".")),
          h("p", {}, est.texto)),
        h("span", { class: "sello grande " + est.tono }, est.sello)),
      h("div", { class: "acciones" },
        h("a", { class: "btn btn-sec btn-chico", href: enlaceSitio(s), target: "_blank", rel: "noopener" }, "Ver página"),
        copiarBtn(enlaceSitio(s), "Copiar enlace"),
        copiarBtn(enlacePanel(s), "Copiar enlace del panel"),
        c.telefono ? h("a", { class: "btn btn-sec btn-chico", href: wa(c.telefono, recordatorio(s)), target: "_blank", rel: "noopener" }, planDe(s) === "prueba" ? "Escribirle por su prueba" : "Recordarle el pago") : null),
      pedidosDelCliente(s),
      extra.length || planDe(s) === "premium" ? seccionPaginas(s, m) : null,
      seccionRegistrarPago(s),
      seccionCuenta(s),
      h("section", { class: "campos" },
        h("h3", { style: "font-size:17px" }, "Acciones"),
        h("div", { class: "acciones" },
          s.estado === "activo"
            ? h("button", { class: "btn btn-peligro", type: "button", onclick: () => cambiarEstado(s, "suspendido", m) }, extra.length ? "Suspender cuenta" : "Suspender página")
            : h("button", { class: "btn btn-verde", type: "button", onclick: () => cambiarEstado(s, "activo", m) }, extra.length ? "Reactivar cuenta" : "Reactivar página"),
          h("button", { class: "btn btn-sec", type: "button", onclick: () => nuevaClave(s) }, "Nueva contraseña"),
          h("button", { class: "btn btn-sec", type: "button", onclick: () => cambiarPlantilla(s, m) }, "Cambiar plantilla"),
          h("button", { class: "btn btn-peligro", type: "button", onclick: () => eliminar(s, m) }, extra.length ? "Eliminar cuenta" : "Eliminar página"))),
      h("section", { class: "campos" },
        h("h3", { style: "font-size:17px" }, "Pagos de este cliente"),
        pagosCliente.length ? h("div", {}, pagosCliente.map((p) => lineaPago(p, false))) : h("p", { class: "suave" }, "Sin pagos registrados.")));
  }

  // Páginas adicionales de una cuenta Premium: cada una con su enlace y su plantilla
  function seccionPaginas(s, m) {
    const extra = paginasDe(s), premium = planDe(s) === "premium";
    const fila = (x) => {
      const est = x.estado === "activo" ? ["Activa", "verde"] : premium ? ["Suspendida", "rojo"] : ["En pausa", "ambar"];
      const copiar = h("button", { class: "btn btn-sec btn-chico", type: "button" }, "Copiar enlace");
      copiar.addEventListener("click", () => EU.copiar(enlaceSitio(x), copiar));
      return h("div", { class: "pagina-adm" },
        h("div", { class: "pagina-adm-cab" },
          h("div", {}, h("b", {}, x.nombre), h("p", { class: "suave chico" }, x.slug + ", " + nombrePlantilla(x.plantilla))),
          h("span", { class: "sello " + est[1] }, est[0])),
        h("div", { class: "acciones" },
          h("a", { class: "btn btn-sec btn-chico", href: enlaceSitio(x), target: "_blank", rel: "noopener" }, "Ver página"),
          copiar,
          h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => cambiarPlantilla(x, m, s) }, "Cambiar plantilla"),
          h("button", { class: "btn btn-peligro btn-chico", type: "button", onclick: () => eliminar(x, m, s) }, "Eliminar")));
    };
    return h("section", { class: "campos" },
      h("h3", { style: "font-size:17px" }, "Páginas de la cuenta"),
      h("p", { class: "suave chico" }, "La principal (" + s.slug + ") lleva el usuario y el plan. " +
        (extra.length ? "Tiene " + extra.length + (extra.length === 1 ? " página adicional." : " páginas adicionales.") : "Todavía no tiene páginas adicionales: las crea el cliente desde su panel.") +
        (!premium && extra.length ? " Están en pausa porque su plan no es Premium; vuelven solas si paga Premium." : "")),
      extra.length ? h("div", { class: "paginas-adm" }, extra.map(fila)) : null);
  }

  // Cuántos pedidos le llegan por su página: sirve para mostrarle al cliente lo que gana con la suscripción
  function pedidosDelCliente(s) {
    const caja = h("p", { class: "banda azul", hidden: true });
    api.rpc("eu_resumen_pedidos", { p_sitio: s.id }).then((r) => {
      if (!r) return;
      const n = (x) => Number(x && x.n) || 0;
      const total = Number(r.historico) || 0;
      caja.textContent = total
        ? "Pedidos por su página: " + n(r.mes) + " este mes (" + EU.usd(Number(r.mes && r.mes.total) || 0) + "), " + n(r.semana) + " en los últimos 7 días y " + total + " en total."
        : "Todavía no le han llegado pedidos por su página.";
      caja.hidden = false;
    }).catch(() => { /* sin datos de pedidos: no se muestra */ });
    return caja;
  }

  function seccionRegistrarPago(s) {
    const pl = PL();
    const metodos = (D.ajustes.pagos || []).map((x) => x.metodo).filter(Boolean);
    const d = { plan: planDe(s) === "premium" ? "premium" : "basico", ciclo: cicloDe(s), monto: 0, moneda: "USD", metodo: metodos[0] || "Efectivo", meses: "1", referencia: "", nota: "" };
    const sugerido = () => (d.ciclo === "anual" ? EU.planes.precio(pl, d.plan, "anual") : EU.planes.precio(pl, d.plan, "mensual") * (Number(d.meses) || 1));
    d.monto = sugerido();
    let montoTocado = false, campoMonto = null;
    const ed = EU.crearEditor({
      raiz: () => d,
      alCambiar: (def) => {
        if (def.ruta === "monto") { montoTocado = true; return; }
        // mientras no lo escriba a mano, el monto sigue al plan elegido
        if (!montoTocado && d.moneda === "USD" && ["plan", "ciclo", "meses", "moneda"].includes(def.ruta)) {
          d.monto = sugerido();
          const inp = campoMonto && campoMonto.querySelector("input");
          if (inp) inp.value = d.monto.toFixed(2);
        }
      },
    });
    campoMonto = ed.campo({ tipo: "dinero", ruta: "monto", etiqueta: "Monto" });
    const boton = h("button", { class: "btn btn-verde", type: "button" }, "Registrar y aprobar");
    const caja = h("details", { class: "hoja", style: "box-shadow:none;display:block" },
      h("summary", { style: "cursor:pointer;font-weight:700" }, "Registrar un pago que te hicieron por fuera"),
      h("div", { class: "campos", style: "margin-top:14px" },
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "selector", ruta: "plan", etiqueta: "Plan", opciones: OP_PLAN }),
          ed.campo({ tipo: "selector", ruta: "ciclo", etiqueta: "Paga", opciones: OP_CICLO })),
        h("div", { class: "dos-col" },
          campoMonto,
          ed.campo({ tipo: "selector", ruta: "moneda", etiqueta: "Moneda", opciones: [{ id: "USD", nombre: "Dólares" }, { id: "VES", nombre: "Bolívares" }] })),
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "selector", ruta: "meses", etiqueta: "Meses", lista: true, si: { ruta: "ciclo", igual: "mensual" }, opciones: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), nombre: i + 1 + (i ? " meses" : " mes") })) }),
          ed.campo({ tipo: "selector", ruta: "metodo", etiqueta: "Método", lista: true, opciones: [...new Set([...metodos, "Efectivo", "Otro"])] })),
        ed.campo({ tipo: "texto", ruta: "referencia", etiqueta: "Referencia (opcional)", max: 80 }),
        ed.campo({ tipo: "texto", ruta: "nota", etiqueta: "Nota (opcional)", max: 300 }),
        h("div", {}, boton)));
    boton.addEventListener("click", async () => {
      if (!(d.monto > 0)) { EU.aviso("Escribe el monto.", true); return; }
      boton.disabled = true; boton.textContent = "Registrando";
      const args = { p_sitio: s.id, p_monto: d.monto, p_metodo: d.metodo, p_meses: d.ciclo === "anual" ? 12 : Number(d.meses) || 1, p_moneda: d.moneda,
        p_referencia: d.referencia || null, p_nota: d.nota || null, p_plan: d.plan, p_ciclo: d.ciclo };
      try {
        const vence = await api.rpc("eu_admin_registrar_pago", args);
        EU.aviso("Pago registrado: plan " + EU.planes.nombres[d.plan] + ". Nueva fecha de corte: " + EU.fecha(vence, true) + ".");
        await recargarDatos();
        caja.closest("dialog").close();
      } catch (err) { EU.aviso(err.message, true); boton.disabled = false; boton.textContent = "Registrar y aprobar"; }
    });
    return caja;
  }

  function seccionCuenta(s) {
    const c = cuentaDe(s);
    const d = {
      plan: planDe(s), ciclo: cicloDe(s),
      contacto: c.contacto || "", telefono: c.telefono || "", dominio: s.dominio || "", nota: (D.notas[s.id] && D.notas[s.id].texto) || "",
    };
    const ed = EU.crearEditor({ raiz: () => d });
    const vence = h("input", { class: "entrada", type: "date", id: "vence-" + s.id, value: c.vence || "" });
    const boton = h("button", { class: "btn", type: "button" }, "Guardar datos de la cuenta");
    boton.addEventListener("click", async () => {
      const dom = d.dominio.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
      if (dom && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(dom)) { EU.aviso("Ese dominio no es válido. Escríbelo así: minegocio.com", true); return; }
      boton.disabled = true; boton.textContent = "Guardando";
      try {
        const antes = planDe(s);
        const fila = { sitio_id: s.id, plan: d.plan, ciclo: d.plan === "prueba" ? "mensual" : d.ciclo, precio_mensual: EU.planes.precio(PL(), d.plan === "premium" ? "premium" : "basico", "mensual"),
          vence: vence.value || null, contacto: d.contacto.trim() || null, telefono: d.telefono.trim() || null };
        const r = await api.guardarFila("eu_cuentas", fila, "sitio_id");
        D.cuentas[s.id] = (r && r[0]) || Object.assign({}, c, fila);
        // las páginas adicionales solo se ven con Premium
        const extra = paginasDe(s);
        if (antes !== d.plan && extra.length) {
          const estado = d.plan === "premium" && s.estado === "activo" ? "activo" : "suspendido";
          await api.actualizar("eu_sitios", "principal=eq." + s.id, { estado });
          extra.forEach((x) => { x.estado = estado; });
        }
        if ((s.dominio || "") !== dom) { await api.actualizar("eu_sitios", "id=eq." + s.id, { dominio: dom || null }); s.dominio = dom || null; }
        const nota = { sitio_id: s.id, texto: d.nota.slice(0, 2000), actualizado: new Date().toISOString() };
        if (d.nota || D.notas[s.id]) { await api.guardarFila("eu_notas", nota, "sitio_id"); D.notas[s.id] = nota; }
        EU.aviso("Datos guardados.");
      } catch (err) { EU.aviso(err.code === "23505" || err.codigo === "23505" ? "Ese dominio ya lo usa otra página." : err.message, true); }
      boton.disabled = false; boton.textContent = "Guardar datos de la cuenta";
    });
    return h("details", { class: "hoja", style: "box-shadow:none;display:block" },
      h("summary", { style: "cursor:pointer;font-weight:700" }, "Datos de la cuenta"),
      h("div", { class: "campos", style: "margin-top:14px" },
        h("p", { class: "ayuda" }, "Para cobrar usa Registrar un pago: corre la fecha y cambia el plan solo. Aquí lo cambias a mano, por ejemplo para regalarle días de prueba."),
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "selector", ruta: "plan", etiqueta: "Plan", opciones: [{ id: "prueba", nombre: "Prueba" }, ...OP_PLAN] }),
          ed.campo({ tipo: "selector", ruta: "ciclo", etiqueta: "Paga", si: { ruta: "plan", distinto: "prueba" }, opciones: OP_CICLO })),
        h("div", { class: "campo" }, h("label", { for: vence.id }, "Fecha de corte"), vence, h("p", { class: "ayuda" }, "Hasta qué día está pagada o, en prueba, el último día de la prueba.")),
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "texto", ruta: "contacto", etiqueta: "Persona de contacto", max: 80 }),
          ed.campo({ tipo: "texto", ruta: "telefono", etiqueta: "Teléfono de contacto", max: 30, placeholder: "Ej: 0414-123-4567" })),
        ed.campo({ tipo: "texto", ruta: "dominio", etiqueta: "Dominio propio (opcional)", max: 120, placeholder: "Ej: minegocio.com", ayuda: "Si el cliente compra su dominio, apúntalo a esta web en Cloudflare y escríbelo aquí." }),
        ed.campo({ tipo: "area", ruta: "nota", etiqueta: "Nota interna", max: 2000, filas: 3, ayuda: "Solo la ves tú." }),
        h("div", {}, boton)));
  }

  async function recargarDatos() {
    const [sitios, cuentas, pagos] = await Promise.all([
      api.select("eu_sitios", SEL_SITIOS),
      api.select("eu_cuentas", "select=*"),
      api.select("eu_pagos", "select=*&order=creado.desc&limit=500"),
    ]);
    D.sitios = sitios || []; D.cuentas = Object.fromEntries((cuentas || []).map((c) => [c.sitio_id, c])); D.pagos = pagos || [];
    pintarNav();
  }

  async function cambiarEstado(s, estado, m) {
    const extra = paginasDe(s);
    const cuantas = extra.length ? " y sus " + extra.length + (extra.length === 1 ? " página adicional" : " páginas adicionales") : "";
    if (estado === "suspendido" && !confirm("¿Suspender " + s.nombre + cuantas + "? Deja de verse hasta que la reactives.")) return;
    try {
      await api.actualizar("eu_sitios", "id=eq." + s.id, { estado });
      s.estado = estado;
      // la base de datos hace lo mismo: las adicionales se suspenden con la principal y solo vuelven con Premium
      extra.forEach((x) => { if (estado === "suspendido" || planDe(s) === "premium") x.estado = estado; });
      EU.aviso(estado === "activo" ? "Página reactivada." : "Página suspendida.");
      pintarCliente(m, s);
    } catch (err) { EU.aviso(err.message, true); }
  }

  function credencialesTexto(s, clave, saludo) {
    const c = cuentaDe(s);
    return (saludo || "¡Hola" + (c.contacto ? " " + c.contacto : "") + "! Tu página " + s.nombre + " ya está lista.") + "\n\n" +
      "Tu página: " + enlaceSitio(s) + "\n" +
      "Panel para editarla: " + enlacePanel(s) + "\n" +
      "Usuario: " + s.slug + "\n" +
      "Contraseña: " + clave + "\n\n" +
      "Desde el panel cambias precios, fotos, la tasa del día y más. Cualquier duda, escríbenos.";
  }
  function mostrarCredenciales(s, clave, tituloTxt, saludo) {
    const texto = credencialesTexto(s, clave, saludo);
    const c = cuentaDe(s);
    EU.modal({
      titulo: tituloTxt,
      construir: (m) => {
        const copiar = h("button", { class: "btn btn-sec", type: "button" }, "Copiar todo");
        copiar.addEventListener("click", () => EU.copiar(texto, copiar));
        m.cuerpo.append(h("p", {}, "Guárdala o envíasela al cliente ahora: la contraseña no se vuelve a mostrar."), h("pre", { class: "credenciales" }, texto));
        m.pie.append(copiar, c.telefono ? h("a", { class: "btn btn-verde", href: wa(c.telefono, texto), target: "_blank", rel: "noopener" }, "Enviar por WhatsApp") : h("button", { class: "btn", type: "button", onclick: () => m.cerrar() }, "Listo"));
      },
    });
  }

  async function nuevaClave(s) {
    if (!confirm("Se le pondrá una contraseña nueva a " + s.nombre + " y se cerrará su sesión. ¿Seguir?")) return;
    const clave = EU.claveAzar(10);
    try {
      await api.rpc("eu_admin_cambiar_clave", { p_sitio: s.id, p_clave: clave });
      mostrarCredenciales(s, clave, "Contraseña nueva", "Hola, te cambiamos la contraseña del panel de " + s.nombre + ".");
    } catch (err) { EU.aviso(err.message, true); }
  }

  function cambiarPlantilla(s, mPadre, principal) {
    let elegida = s.plantilla;
    EU.modal({
      titulo: "Cambiar plantilla de " + s.nombre, ancho: true,
      construir: (m) => {
        const tarjetas = plantillas().map((P) => h("button", { class: "plantilla", type: "button", "aria-pressed": String(P.id === elegida), onclick: (e) => { elegida = P.id; m.cuerpo.querySelectorAll(".plantilla").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); } },
          h("img", { src: P.vistaPrevia, alt: "", loading: "lazy" }), h("b", {}, P.nombre, P.premium ? h("span", { class: "premium-pill" }, "★ Premium") : null), h("p", {}, P.rubro)));
        m.cuerpo.append(h("p", { class: "banda ambar" }, "La página pasa a la plantilla nueva. Se conservan el nombre, el contacto, la dirección, el horario, las formas de pago y la tasa. El menú de la plantilla de ahora queda guardado: si vuelve a ella, lo recupera."),
          h("div", { class: "plantillas" }, tarjetas));
        const ok = h("button", { class: "btn", type: "button" }, "Cambiar plantilla");
        ok.addEventListener("click", async () => {
          if (elegida === s.plantilla) { m.cerrar(); return; }
          ok.disabled = true;
          try {
            await api.rpc("eu_cambiar_plantilla", { p_sitio: s.id, p_plantilla: elegida });
            s.plantilla = elegida;
            EU.aviso("Plantilla cambiada a " + nombrePlantilla(elegida) + ".");
            m.cerrar(); pintarCliente(mPadre, principal || s);
          } catch (err) { EU.aviso(err.message, true); ok.disabled = false; }
        });
        m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: () => m.cerrar() }, "Cancelar"), ok);
      },
    });
  }

  function eliminar(s, mPadre, principal) {
    const todas = principal ? [s] : [s, ...paginasDe(s)];
    EU.modal({
      titulo: "Eliminar " + s.nombre,
      construir: (m) => {
        const inp = h("input", { class: "entrada", type: "text", id: "confirma-" + s.id, autocomplete: "off", autocapitalize: "none" });
        const ok = h("button", { class: "btn btn-peligro lleno", type: "button", disabled: true }, "Eliminar para siempre");
        inp.addEventListener("input", () => { ok.disabled = inp.value.trim().toLowerCase() !== s.slug; });
        m.cuerpo.append(
          h("p", { class: "banda rojo" }, principal
            ? "Se borran esta página y sus fotos. El resto de la cuenta de " + principal.nombre + " sigue igual. No se puede deshacer."
            : todas.length > 1 ? "Se borra la cuenta entera: sus " + todas.length + " páginas, sus fotos, sus pagos y su usuario. No se puede deshacer."
              : "Se borran la página, sus fotos, sus pagos y su usuario. No se puede deshacer."),
          h("div", { class: "campo" }, h("label", { for: inp.id }, "Escribe " + s.slug + " para confirmar"), inp));
        ok.addEventListener("click", async () => {
          ok.disabled = true; ok.textContent = "Eliminando";
          try {
            for (const x of todas) {
              for (const bucket of ["eu-media", "eu-pagos"]) {
                try {
                  const archivos = await api.listar(bucket, x.id);
                  const rutas = (archivos || []).filter((a) => a && a.name && a.id !== null).map((a) => x.id + "/" + a.name);
                  if (rutas.length) await api.borrarArchivos(bucket, rutas);
                } catch (_) { /* si fallan las fotos, igual se borra la página */ }
              }
            }
            await api.rpc("eu_admin_eliminar_sitio", { p_sitio: s.id });
            const ids = new Set(todas.map((x) => x.id));
            D.sitios = D.sitios.filter((x) => !ids.has(x.id));
            D.pagos = D.pagos.filter((p) => !ids.has(p.sitio_id));
            ids.forEach((id) => { delete D.cuentas[id]; });
            EU.aviso(todas.length > 1 ? "Cuenta eliminada." : "Página eliminada.");
            m.cerrar();
            if (principal) pintarCliente(mPadre, principal); else mPadre.cerrar();
            pintarNav();
          } catch (err) { EU.aviso(err.message, true); ok.disabled = false; ok.textContent = "Eliminar para siempre"; }
        });
        m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: () => m.cerrar() }, "Cancelar"), ok);
      },
    });
  }

  /* ---------- Nuevo cliente ---------- */
  function nuevoCliente() {
    const hoy = EU.hoyISO();
    const pl = PL();
    const d = { nombre: "", slug: "", clave: EU.claveAzar(10), plantilla: "", whatsapp: "", contacto: "", telefono: "", plan: "basico", ciclo: "mensual" };
    let slugTocado = false;
    const venceSugerido = () => (d.plan === "prueba" ? sumarDias(hoy, pl.diasPrueba) : EU.sumarMeses(hoy, d.ciclo === "anual" ? 12 : 1));
    const precioTxt = h("p", { class: "ayuda" });
    const pintarPrecio = () => {
      precioTxt.textContent = d.plan === "prueba"
        ? "Prueba gratis de " + pl.diasPrueba + " días. Al terminar, la página se suspende sola si no elige un plan."
        : "Plan " + EU.planes.nombres[d.plan] + ": " + EU.usd(EU.planes.precio(pl, d.plan, d.ciclo)) + (d.ciclo === "anual" ? " al año." : " al mes.");
    };
    const ed = EU.crearEditor({
      raiz: () => d,
      alCambiar: (def) => {
        if (def.ruta === "nombre" && !slugTocado) { d.slug = EU.slug(d.nombre); campoSlug.querySelector("input").value = d.slug; }
        if (def.ruta === "slug") slugTocado = true;
        if (def.ruta === "plan" || def.ruta === "ciclo") { vence.value = venceSugerido(); pintarPrecio(); }
      },
    });
    const campoSlug = ed.campo({ tipo: "texto", ruta: "slug", etiqueta: "Usuario", max: 40, ayuda: "Solo letras minúsculas, números y guiones. Es el usuario del panel y va en el enlace de la página." });
    const vence = h("input", { class: "entrada", type: "date", id: "nuevo-vence", value: venceSugerido() });
    pintarPrecio();
    const tarjetas = h("div", { class: "plantillas", role: "group", "aria-label": "Plantilla" }, plantillas().map((P) => h("button", {
      class: "plantilla", type: "button", "aria-pressed": "false",
      onclick: (e) => { d.plantilla = P.id; tarjetas.querySelectorAll(".plantilla").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); },
    }, h("img", { src: P.vistaPrevia, alt: "", loading: "lazy" }), h("b", {}, P.nombre, P.premium ? h("span", { class: "premium-pill" }, "★ Premium") : null), h("p", {}, P.rubro))));
    const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
    const boton = h("button", { class: "btn", type: "submit" }, "Crear página");
    const form = h("form", { class: "campos", novalidate: true },
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "El negocio")),
        h("div", { class: "campos" },
          ed.campo({ tipo: "texto", ruta: "nombre", etiqueta: "Nombre del negocio", max: 80 }),
          campoSlug,
          ed.campo({ tipo: "texto", ruta: "clave", etiqueta: "Contraseña del panel", max: 60, ayuda: "Ya va una al azar. Puedes cambiarla; mínimo 8 caracteres." }),
          ed.campo({ tipo: "telefono", ruta: "whatsapp", etiqueta: "WhatsApp donde recibe los pedidos", ayuda: "El cliente lo puede cambiar luego en su panel." }))),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Plantilla"), h("p", {}, "La de su página principal. Con Premium puede crear más páginas desde su panel.")), tarjetas),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Plan")),
        h("div", { class: "campos" },
          h("div", { class: "dos-col" },
            ed.campo({ tipo: "selector", ruta: "plan", etiqueta: "Empieza con", opciones: [{ id: "prueba", nombre: "Prueba gratis" }, ...OP_PLAN] }),
            ed.campo({ tipo: "selector", ruta: "ciclo", etiqueta: "Paga", si: { ruta: "plan", distinto: "prueba" }, opciones: OP_CICLO })),
          precioTxt,
          h("div", { class: "campo" }, h("label", { for: "nuevo-vence" }, "Pagada hasta"), vence, h("p", { class: "ayuda" }, "Si ya te pagó, deja la fecha que sale. En prueba es el último día de la prueba.")),
          h("div", { class: "dos-col" },
            ed.campo({ tipo: "texto", ruta: "contacto", etiqueta: "Persona de contacto", max: 80 }),
            ed.campo({ tipo: "texto", ruta: "telefono", etiqueta: "Teléfono de contacto", max: 30, placeholder: "Ej: 0414-123-4567", ayuda: "Para mandarle los datos y los recordatorios." })))),
      error, h("div", {}, boton));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      const slug = d.slug.trim().toLowerCase();
      const falta = !d.nombre.trim() ? "Escribe el nombre del negocio."
        : !/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) ? "El usuario solo puede tener letras minúsculas, números y guiones (sin espacios ni acentos)."
        : RESERVADOS.includes(slug) ? "Ese usuario está reservado. Elige otro."
        : D.sitios.some((s) => s.slug === slug) ? "Ese usuario ya lo tiene otra página."
        : d.clave.length < 8 ? "La contraseña debe tener al menos 8 caracteres."
        : !d.plantilla ? "Elige una plantilla." : "";
      if (falta) { error.textContent = falta; error.hidden = false; error.scrollIntoView({ block: "center" }); return; }
      boton.disabled = true; boton.textContent = "Creando";
      try {
        // la página arranca con el menú de muestra, pero sin la dirección ni las redes de la muestra
        const contenido = { negocio: { whatsapp: EU.soloNumeros(d.whatsapp), direccion: "", referencia: "", ciudad: "", mapa: "", instagram: "", tiktok: "", facebook: "" } };
        const id = await api.rpc("eu_admin_crear_cliente", {
          p_slug: slug, p_nombre: d.nombre.trim(), p_plantilla: d.plantilla, p_clave: d.clave, p_contenido: contenido,
          p_precio: EU.planes.precio(pl, d.plan === "premium" ? "premium" : "basico", "mensual"), p_vence: vence.value || null,
          p_contacto: d.contacto.trim() || null, p_telefono: d.telefono.trim() || null,
          p_plan: d.plan, p_ciclo: d.plan === "prueba" ? "mensual" : d.ciclo,
        });
        await recargarDatos();
        const s = sitioDe(id) || { id, slug, nombre: d.nombre.trim(), plantilla: d.plantilla, estado: "activo" };
        D.seccion = "clientes"; D.filtro = "todos";
        pintarNav(); pintarSeccion();
        mostrarCredenciales(s, d.clave, "Página creada");
      } catch (err) {
        error.textContent = err.message; error.hidden = false;
        boton.disabled = false; boton.textContent = "Crear página";
      }
    });
    return [titulo("Nuevo cliente", "Crea la página y el usuario de tu cliente."), form];
  }

  /* ---------- Plantillas ---------- */
  function seccionPlantillas() {
    return [titulo("Plantillas", "Ábrelas para mostrárselas a tus clientes. Los pedidos de prueba llegan a tu WhatsApp."),
      h("div", { class: "plantillas" }, plantillas().map((P) => {
        const enlace = location.origin + "/t/" + P.id + "/";
        const copiar = h("button", { class: "btn btn-sec btn-chico", type: "button" }, "Copiar enlace");
        copiar.addEventListener("click", () => EU.copiar(enlace, copiar));
        return h("article", { class: "plantilla" },
          h("img", { src: P.vistaPrevia, alt: "Vista de la plantilla " + P.nombre, loading: "lazy" }),
          h("b", {}, P.nombre, P.premium ? h("span", { class: "premium-pill" }, "★ Premium") : null), h("p", {}, P.descripcion),
          P.premium ? h("p", { class: "suave chico" }, "Solo para el plan Premium (y en la prueba gratis).") : null,
          P.ideal ? h("p", { class: "suave chico" }, "Ideal para: " + P.ideal + ".") : null,
          h("p", { class: "suave chico" }, ((n) => n + (n === 1 ? " página la usa." : " páginas la usan."))(D.sitios.filter((s) => s.plantilla === P.id).length)),
          h("div", { class: "acciones" }, h("a", { class: "btn btn-chico", href: enlace, target: "_blank", rel: "noopener" }, "Ver demo"), copiar));
      }))];
  }

  /* ---------- Ajustes ---------- */
  function ajustes() {
    const d = EU.clonar(D.ajustes);
    if (!Array.isArray(d.pagos)) d.pagos = [];
    if (d.diasGracia == null) d.diasGracia = 3;
    // Planes: si todavía no están guardados, se muestran los de siempre
    const pl = PL();
    d.precios = pl.precios;
    if (d.diasPrueba == null) d.diasPrueba = pl.diasPrueba;
    if (d.maxPaginasPremium == null) d.maxPaginasPremium = pl.maxPaginas;
    if (d.registroAbierto == null) d.registroAbierto = true;
    // Frenos del registro (la base de datos usa estos mismos valores por defecto)
    if (d.topeRegistrosHora == null) d.topeRegistrosHora = 100;
    if (d.topeRegistrosDia == null) d.topeRegistrosDia = 500;
    if (d.topeRegistrosConexion == null) d.topeRegistrosConexion = 6;
    const ed = EU.crearEditor({ raiz: () => d });
    const enlaceRegistro = location.origin + "/registro/";
    const copiarRegistro = h("button", { class: "btn btn-sec btn-chico", type: "button" }, "Copiar enlace");
    copiarRegistro.addEventListener("click", () => EU.copiar(enlaceRegistro, copiarRegistro));
    const boton = h("button", { class: "btn", type: "button" }, "Guardar ajustes");
    boton.addEventListener("click", async () => {
      boton.disabled = true; boton.textContent = "Guardando";
      const malo = ["basico", "premium"].flatMap((p) => ["mensual", "anual"].map((c) => d.precios[p][c])).some((n) => !(Number(n) > 0));
      if (malo) { EU.aviso("Revisa los precios de los planes: ninguno puede quedar en cero.", true); boton.disabled = false; boton.textContent = "Guardar ajustes"; return; }
      try {
        await api.guardarFila("eu_ajustes", { id: "eu", datos: d, actualizado: new Date().toISOString() }, "id");
        D.ajustes = EU.clonar(d);
        EU.aviso("Ajustes guardados.");
      } catch (err) { EU.aviso(err.message, true); }
      boton.disabled = false; boton.textContent = "Guardar ajustes";
    });
    return [titulo("Ajustes", "Tus datos, tus planes y cómo te pagan."),
      ...(C.avisos ? [seccionAvisos()] : []),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Tu marca")),
        ed.campos([
          { tipo: "texto", ruta: "marca", etiqueta: "Nombre de tu marca", max: 60 },
          { tipo: "telefono", ruta: "whatsapp", etiqueta: "Tu WhatsApp", ayuda: "Ahí te escriben los clientes desde su panel." },
          { tipo: "texto", ruta: "whatsappVisible", etiqueta: "Cómo se muestra tu número", max: 30, placeholder: "Ej: 0414-474-1237" },
        ])),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Planes y precios"), h("p", {}, "Lo que ven en la portada, en el registro y en el panel de cada cliente. Los precios nuevos valen para los próximos pagos.")),
        h("div", { class: "campos" },
          h("div", { class: "dos-col" },
            ed.campo({ tipo: "dinero", ruta: "precios.basico.mensual", etiqueta: "Básico, por mes" }),
            ed.campo({ tipo: "dinero", ruta: "precios.basico.anual", etiqueta: "Básico, por año" })),
          h("div", { class: "dos-col" },
            ed.campo({ tipo: "dinero", ruta: "precios.premium.mensual", etiqueta: "Premium, por mes" }),
            ed.campo({ tipo: "dinero", ruta: "precios.premium.anual", etiqueta: "Premium, por año" })),
          h("div", { class: "dos-col" },
            ed.campo({ tipo: "numero", ruta: "diasPrueba", etiqueta: "Días de prueba gratis", min: 1, max: 90, sufijo: "días" }),
            ed.campo({ tipo: "numero", ruta: "maxPaginasPremium", etiqueta: "Páginas con Premium", min: 1, max: 20, sufijo: "páginas", ayuda: "Contando la principal." })),
          ed.campo({ tipo: "interruptor", ruta: "registroAbierto", etiqueta: "Registro abierto", ayuda: "Cualquiera puede crear su página desde la portada y probarla gratis. Si lo apagas, solo tú creas clientes." }),
          h("div", { class: "dos-col" },
            ed.campo({ tipo: "numero", ruta: "topeRegistrosHora", etiqueta: "Registros por hora, como máximo", min: 10, max: 1000, sufijo: "por hora", si: { ruta: "registroAbierto" } }),
            ed.campo({ tipo: "numero", ruta: "topeRegistrosDia", etiqueta: "Registros por día, como máximo", min: 20, max: 5000, sufijo: "por día", si: { ruta: "registroAbierto" } })),
          ed.campo({ tipo: "numero", ruta: "topeRegistrosConexion", etiqueta: "Registros desde una misma conexión al día", min: 1, max: 50, sufijo: "cuentas", si: { ruta: "registroAbierto" },
            ayuda: "Frena a quien crea cuentas en masa. Si haces una charla o un evento donde varios se registran con el mismo wifi, súbelo ese día. Cuando se pasa un tope, el registro dice «Estamos recibiendo muchos registros» y se puede intentar más tarde." }),
          h("div", { class: "dato" }, h("div", { style: "flex:1;min-width:0" }, h("b", {}, "Enlace de registro"), h("p", { class: "suave chico", style: "overflow-wrap:anywhere" }, enlaceRegistro)), copiarRegistro))),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Cobros")),
        ed.campos([
          { tipo: "interruptor", ruta: "autoSuspender", etiqueta: "Suspender solas las páginas vencidas", ayuda: "Todas las noches, a las 12:30 am, se suspenden las páginas que pasaron los días de gracia sin pagar. Las pruebas gratis que terminaron se suspenden siempre, sin días de gracia." },
          { tipo: "numero", ruta: "diasGracia", etiqueta: "Días de gracia", min: 0, max: 30, sufijo: "días", ayuda: "Cuántos días después del corte sigue visible la página." },
        ])),
      h("section", { class: "hoja" },
        ed.campos([{ tipo: "lista", ruta: "pagos", etiqueta: "Cómo te pagan tus clientes", item: "método", titulo: "metodo", prefijoId: "m", maximo: 8,
          ayuda: "Tus clientes ven estos datos en su panel, con botón para copiarlos.",
          nuevo: { metodo: "Nuevo método", datos: "" }, sub: "datos",
          campos: [
            { tipo: "texto", clave: "metodo", etiqueta: "Método", max: 40, requerido: true },
            { tipo: "area", clave: "datos", etiqueta: "Datos", max: 400, filas: 4, ayuda: "Un dato por línea, así: Banco: Venezuela" },
          ] }])),
      h("div", {}, boton)];
  }

  /* ---------- Avisos al teléfono ----------
     El navegador se suscribe al servicio de avisos (Web Push) y la suscripción se guarda en eu_avisos.
     Cuando un cliente reporta un pago, la función eu-avisos le manda la notificación a cada dispositivo. */
  const AV = {
    soportado: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    instalada: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
    activo: false,
  };
  const bytesDe = (b64u) => {
    const t = String(b64u).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
  };
  function nombreDispositivo() {
    const u = navigator.userAgent;
    const so = /Android/.test(u) ? "Android" : AV.ios ? "iPhone o iPad" : /Windows/.test(u) ? "Windows" : /Mac OS X/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "Otro equipo";
    const nav = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /SamsungBrowser/.test(u) ? "Samsung Internet" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "navegador";
    return so + " · " + nav;
  }
  async function suscripcionActual() {
    const reg = await navigator.serviceWorker.getRegistration("/admin/");
    return reg ? reg.pushManager.getSubscription() : null;
  }
  async function revisarAvisos() {
    AV.activo = false;
    if (!AV.soportado) return false;
    try { AV.activo = Notification.permission === "granted" && !!(await suscripcionActual()); } catch (_) { /* sin avisos */ }
    return AV.activo;
  }
  async function activarAvisos() {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      throw new Error(permiso === "denied"
        ? "Este navegador tiene bloqueados los avisos de esta página. Toca el candado junto a la dirección, permite las notificaciones y prueba de nuevo."
        : "No diste permiso para los avisos.");
    }
    const reg = await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
    await navigator.serviceWorker.ready;
    const { clave } = await api.funcion("eu-avisos", { accion: "clave" });
    const llave = bytesDe(clave);
    let sub = await reg.pushManager.getSubscription();
    // Una suscripción hecha con otra clave ya no sirve: se rehace
    const vieja = sub && sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (sub && vieja && (vieja.length !== llave.length || vieja.some((b, i) => b !== llave[i]))) { await sub.unsubscribe(); sub = null; }
    if (!sub) {
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llave }); }
      catch (_) { throw new Error("Este navegador no pudo conectarse al servicio de avisos. Revisa tu internet o prueba con Chrome."); }
    }
    const j = sub.toJSON();
    await api.guardarFila("eu_avisos", { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, dispositivo: nombreDispositivo() }, "endpoint");
    AV.activo = true;
  }
  async function desactivarAvisos() {
    const sub = await suscripcionActual();
    if (sub) {
      await api.borrar("eu_avisos", "endpoint=eq." + encodeURIComponent(sub.endpoint)).catch(() => { /* ya no estaba */ });
      await sub.unsubscribe();
    }
    AV.activo = false;
  }
  async function probarAviso() {
    const r = await api.funcion("eu-avisos", { accion: "prueba" });
    if (r && r.enviados > 0) EU.aviso("Aviso de prueba enviado. Te llega en unos segundos.");
    else if (r && !r.dispositivos) EU.aviso("No quedó ningún dispositivo con avisos. Actívalos de nuevo.", true);
    else EU.aviso("El servicio de avisos no aceptó el envío. Desactiva los avisos y vuelve a activarlos.", true);
  }
  // Botón que hace algo y vuelve a pintar; mientras tanto se bloquea para no repetir el toque
  function botonAviso(texto, clase, accion, despues) {
    const b = h("button", { class: "btn " + (clase || ""), type: "button" }, texto);
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await accion(); } catch (err) { EU.aviso(err.message || "No se pudo.", true); }
      b.disabled = false;
      if (despues) despues();
    });
    return b;
  }
  // Invitación en el Resumen mientras este dispositivo no tenga los avisos
  function invitarAvisos() {
    if (!C.avisos || !AV.soportado || AV.activo) return null;
    return h("section", { class: "hoja aviso-invita" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Entérate al momento cuando te paguen"),
        h("p", {}, "Activa los avisos y te llega una notificación a este dispositivo cada vez que un cliente reporta un pago.")),
      h("div", { class: "acciones" }, botonAviso("Activar avisos", "", async () => { await activarAvisos(); EU.aviso("Avisos activados en este dispositivo."); }, pintarSeccion)));
  }
  function seccionAvisos() {
    const caja = h("section", { class: "hoja" });
    const cab = h("div", { class: "hoja-cab" }, h("h2", {}, "Avisos de pagos"),
      h("p", {}, "Una notificación en tu teléfono o computadora cada vez que un cliente reporta un pago, aunque tengas el panel cerrado."));
    async function llenar() {
      if (!AV.soportado) {
        caja.replaceChildren(cab, h("p", { class: "banda ambar" }, AV.ios && !AV.instalada
          ? "En iPhone, primero agrega este panel a tu pantalla de inicio: toca Compartir y luego \"Agregar a inicio\". Ábrelo desde ese ícono y vuelve a esta sección."
          : "Este navegador no puede recibir avisos. Abre el panel con Chrome."));
        return;
      }
      await revisarAvisos();
      let lista = [];
      try { lista = (await api.select("eu_avisos", "select=id,dispositivo,creado&order=creado.desc")) || []; } catch (_) { /* se muestra sin la lista */ }
      const estado = AV.activo
        ? h("p", { class: "banda verde" }, "Los avisos están activados en este dispositivo.")
        : h("p", { class: "banda azul" }, lista.length ? "En este dispositivo no están activados." : "Todavía no los activas en ningún dispositivo.");
      const botones = AV.activo
        ? [botonAviso("Mandar aviso de prueba", "", probarAviso, llenar), botonAviso("Desactivar aquí", "btn-sec", async () => { await desactivarAvisos(); EU.aviso("Avisos desactivados en este dispositivo."); }, llenar)]
        : [botonAviso("Activar avisos", "", async () => { await activarAvisos(); EU.aviso("Avisos activados en este dispositivo."); }, llenar)];
      caja.replaceChildren(cab, estado, h("div", { class: "acciones" }, botones),
        lista.length ? h("p", { class: "suave chico" }, "Dispositivos con avisos: " + lista.map((x) => (x.dispositivo || "Dispositivo") + " (desde el " + EU.fecha(x.creado) + ")").join(", ") + ".") : null,
        h("p", { class: "suave chico" }, "Actívalos en cada dispositivo donde quieras recibirlos. En el teléfono, usa Chrome y deja que la página muestre notificaciones."));
    }
    llenar();
    return caja;
  }
  // Al tocar una notificación con el panel abierto, el aviso manda directo a Pagos con los datos al día
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (!e.data || e.data.eu !== "aviso") return;
      if (!api.conectado) return;
      // un registro nuevo abre Clientes > En prueba; un pago, la lista de pagos
      if (String(e.data.url || "").includes("#clientes")) { D.seccion = "clientes"; D.filtro = "prueba"; } else D.seccion = "pagos";
      cargar();
    });
  }
  addEventListener("hashchange", () => { if ((location.hash === "#pagos" || location.hash === "#clientes") && api.conectado) cargar(); });

  /* ---------- Arranque ---------- */
  EU.reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (api.conectado) cargar(); else pantallaEntrada();
})();
