/* Panel de EU Digital: clientes, pagos, suspensiones y ajustes de la plataforma. */
(function () {
  "use strict";
  const C = window.EU_CONFIG;
  const EU = window.EU;
  const h = EU.h;
  const api = EU.crearApi({ llave: "eu:admin", almacen: "sesion" });
  const app = document.getElementById("app");
  const ORDEN = ["pizzeria", "arepera", "burgers", "sushi", "boutique"];
  const plantillas = () => ORDEN.map((id) => (window.EU_PLANTILLAS || {})[id]).filter(Boolean);
  const nombrePlantilla = (id) => ((window.EU_PLANTILLAS || {})[id] || { nombre: id }).nombre;
  const D = { sitios: [], cuentas: {}, pagos: [], notas: {}, ajustes: {}, seccion: "resumen", filtro: "todos", buscar: "" };
  let refs = {};

  /* ---------- Ayudas ---------- */
  const sitioDe = (id) => D.sitios.find((s) => s.id === id);
  const cuentaDe = (s) => D.cuentas[s.id] || {};
  const estadoDe = (s) => EU.estadoCuenta(s, cuentaDe(s), D.ajustes.diasGracia);
  const enlaceSitio = (s) => (s.dominio ? "https://" + s.dominio : location.origin + "/?n=" + encodeURIComponent(s.slug));
  const enlacePanel = (s) => location.origin + "/panel/?u=" + encodeURIComponent(s.slug);
  const telWa = (t) => { let d = EU.soloNumeros(t); if (d.length === 11 && d.startsWith("0")) d = "58" + d.slice(1); return d; };
  const wa = (tel, texto) => "https://wa.me/" + telWa(tel) + "?text=" + encodeURIComponent(texto);
  const montoTxt = (p) => (p.moneda === "VES" ? "Bs " + EU.fmtBs.format(p.monto) : EU.usd(p.monto));
  const pendientes = () => D.pagos.filter((p) => p.estado === "pendiente");
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
  async function cargar() {
    cargando("Abriendo el panel");
    try {
      const esAdmin = await api.rpc("eu_es_admin", {});
      if (esAdmin !== true) { await api.salir(); return pantallaEntrada("Esta cuenta no es de EU Digital. Los clientes entran por /panel."); }
      const [sitios, cuentas, pagos, notas, ajustes] = await Promise.all([
        api.select("eu_sitios", "select=id,slug,nombre,plantilla,estado,dominio,creado,actualizado,dueno&order=creado.desc"),
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
      pintar();
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
    D.sitios.forEach((s) => { cuenta[estadoDe(s).id]++; });
    const mes = EU.hoyISO().slice(0, 7);
    const delMes = D.pagos.filter((p) => p.estado === "aprobado" && String(p.revisado || p.creado).slice(0, 7) === mes);
    const usd = delMes.filter((p) => p.moneda !== "VES").reduce((a, p) => a + Number(p.monto), 0);
    const ves = delMes.filter((p) => p.moneda === "VES").reduce((a, p) => a + Number(p.monto), 0);
    const mensual = D.sitios.filter((s) => s.estado === "activo").reduce((a, s) => a + (Number(cuentaDe(s).precio_mensual) || 0), 0);
    const cifra = (n, t, tono, accion) => h(accion ? "button" : "div", { class: "cifra " + (tono || ""), type: accion ? "button" : null, onclick: accion || null }, h("b", {}, String(n)), h("span", {}, t));
    const proximas = D.sitios.filter((s) => { const d = EU.diasHasta(cuentaDe(s).vence); return s.estado === "activo" && d != null && d <= 7; })
      .sort((a, b) => String(cuentaDe(a).vence).localeCompare(String(cuentaDe(b).vence)));
    return [
      titulo("Resumen", "Hoy es " + EU.fecha(EU.hoyISO(), true) + "."),
      h("div", { class: "cifras" },
        cifra(pendientes().length, "Pagos por revisar", pendientes().length ? "ambar" : "", () => irA("pagos")),
        cifra(cuenta.activa + cuenta.porvencer, "Páginas al día", "verde", () => irA("clientes", "activas")),
        cifra(cuenta.porvencer, "Vencen en 5 días", cuenta.porvencer ? "ambar" : "", () => irA("clientes", "porvencer")),
        cifra(cuenta.vencida, "Vencidas", cuenta.vencida ? "rojo" : "", () => irA("clientes", "vencidas")),
        cifra(cuenta.suspendida, "Suspendidas", "", () => irA("clientes", "suspendidas"))),
      h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Cobrado este mes"), h("p", {}, "Pagos aprobados desde el día 1.")),
        h("div", { class: "talon-fila", style: "display:flex;gap:24px;flex-wrap:wrap;align-items:flex-end" },
          h("div", {}, h("p", { class: "cifra-txt suave" }, "En dólares"), h("p", { class: "monto-grande", style: "font:800 32px/1 var(--titulos)" }, EU.usd(usd))),
          ves ? h("div", {}, h("p", { class: "suave" }, "En bolívares"), h("p", { style: "font:800 32px/1 var(--titulos)" }, "Bs " + EU.fmtBs.format(ves))) : null,
          h("div", {}, h("p", { class: "suave" }, "Lo que suman las suscripciones activas"), h("p", { style: "font:800 32px/1 var(--titulos)" }, EU.usd(mensual) + " al mes")))),
      h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Vencen esta semana"), h("p", {}, "Mándales un recordatorio por WhatsApp con un toque.")),
        proximas.length ? h("div", { class: "fichas" }, proximas.map(ficha)) : h("p", { class: "suave" }, "Ninguna página vence en los próximos 7 días.")),
    ];
  }

  function recordatorio(s) {
    const c = cuentaDe(s);
    const precio = Number(c.precio_mensual) || Number(D.ajustes.precioBase) || 0;
    return "Hola" + (c.contacto ? " " + c.contacto : "") + ", te escribimos de " + (D.ajustes.marca || C.marca || "EU Digital") + ". " +
      "La suscripción de tu página " + s.nombre + (c.vence ? " vence el " + EU.fecha(c.vence) : " está por vencer") + ". " +
      "El pago es de " + EU.usd(precio) + ". Cuando pagues, repórtalo en tu panel: " + enlacePanel(s);
  }

  /* ---------- Fichas de clientes ---------- */
  function ficha(s) {
    const est = estadoDe(s), c = cuentaDe(s);
    return h("button", { class: "ficha", type: "button", onclick: () => abrirCliente(s) },
      h("span", {}, h("b", {}, s.nombre), h("br"), h("span", { class: "suave" }, s.slug + ", " + nombrePlantilla(s.plantilla))),
      h("span", { class: "sello " + est.tono }, est.sello),
      h("span", { class: "suave", style: "grid-column:1/-1" }, (c.vence ? "Fecha de corte: " + EU.fecha(c.vence, true) : "Sin fecha de corte") + (c.precio_mensual != null ? ". " + EU.usd(c.precio_mensual) + " al mes." : "")));
  }

  function clientes() {
    const FILTROS = [["todos", "Todos"], ["activas", "Al día"], ["porvencer", "Por vencer"], ["vencidas", "Vencidas"], ["suspendidas", "Suspendidas"]];
    const buscar = h("input", { class: "entrada", type: "search", placeholder: "Buscar por nombre, usuario o teléfono", value: D.buscar, "aria-label": "Buscar clientes" });
    const lista = h("div", { class: "fichas" });
    const chips = h("div", { class: "chips", role: "group", "aria-label": "Filtrar" });
    const pintarLista = () => {
      const q = D.buscar.trim().toLowerCase();
      const ok = D.sitios.filter((s) => {
        const est = estadoDe(s).id;
        const f = D.filtro;
        if (f === "activas" && !(est === "activa" || est === "porvencer")) return false;
        if (f === "porvencer" && est !== "porvencer") return false;
        if (f === "vencidas" && est !== "vencida") return false;
        if (f === "suspendidas" && est !== "suspendida") return false;
        if (!q) return true;
        const c = cuentaDe(s);
        return [s.nombre, s.slug, s.dominio, c.contacto, c.telefono].filter(Boolean).join(" ").toLowerCase().includes(q);
      });
      lista.replaceChildren(...(ok.length ? ok.map(ficha) : [h("p", { class: "vacio-adm", style: "grid-column:1/-1" }, D.sitios.length ? "Ningún cliente coincide." : "Todavía no tienes clientes. Crea el primero en Nuevo cliente.")]));
      chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.f === D.filtro)));
    };
    FILTROS.forEach(([id, t]) => chips.append(h("button", { class: "chip", type: "button", "data-f": id, onclick: () => { D.filtro = id; pintarLista(); } }, t)));
    buscar.addEventListener("input", () => { D.buscar = buscar.value; pintarLista(); });
    pintarLista();
    return [titulo("Clientes", D.sitios.length + (D.sitios.length === 1 ? " página" : " páginas") + " en total.", h("button", { class: "btn", type: "button", onclick: () => irA("nuevo") }, "Nuevo cliente")),
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
        h("b", { class: "num" }, montoTxt(p) + " por " + p.meses + (p.meses === 1 ? " mes" : " meses")),
        h("p", { class: "suave chico" }, [conCliente && s ? s.nombre : "", p.metodo, p.referencia ? "Ref. " + p.referencia : "", EU.fechaHora(p.creado)].filter(Boolean).join(", ")),
        p.respuesta ? h("p", { class: "chico", style: "color:var(--rojo);font-weight:700" }, "Motivo: " + p.respuesta) : null),
      h("span", { class: "sello " + sello[1] }, sello[0]));
  }
  function reciboPendiente(p) {
    const s = sitioDe(p.sitio_id);
    const c = s ? cuentaDe(s) : {};
    const meses = { m: String(p.meses || 1) };
    const ed = EU.crearEditor({ raiz: () => meses });
    const selMeses = ed.campo({ tipo: "selector", ruta: "m", etiqueta: "Meses que se suman", lista: true, opciones: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), nombre: i + 1 + (i ? " meses" : " mes") })) });
    const selloPos = h("span", { class: "sello-pos" }, h("span", { class: "sello ambar" }, "En revisión"));
    const acciones = h("div", { class: "acciones" });
    const tarjeta = h("article", { class: "recibo-pago" },
      selloPos,
      h("p", { class: "monto" }, montoTxt(p)),
      h("p", { class: "quien" }, s ? s.nombre : "Página eliminada"),
      h("p", { class: "suave chico" }, [p.metodo, p.referencia ? "Ref. " + p.referencia : "Sin referencia", "Reportado el " + EU.fechaHora(p.creado)].join(". ")),
      s ? h("p", { class: "suave chico" }, "Precio del plan: " + EU.usd(c.precio_mensual || D.ajustes.precioBase || 0) + " al mes. " + (c.vence ? "Fecha de corte actual: " + EU.fecha(c.vence, true) + "." : "")) : null,
      p.nota ? h("p", { class: "nota" }, "Nota del cliente: " + p.nota) : null,
      p.comprobante ? h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => verComprobante(p) }, "Ver comprobante") : h("p", { class: "suave chico" }, "Sin comprobante."),
      selMeses, acciones);
    const aprobar = h("button", { class: "btn btn-verde", type: "button" }, "Aprobar");
    const rechazar = h("button", { class: "btn btn-peligro", type: "button" }, "Rechazar");
    aprobar.addEventListener("click", async () => {
      aprobar.disabled = rechazar.disabled = true; aprobar.textContent = "Aprobando";
      try {
        const vence = await api.rpc("eu_admin_aprobar_pago", { p_pago: p.id, p_meses: Number(meses.m) || p.meses });
        p.estado = "aprobado"; p.meses = Number(meses.m) || p.meses; p.revisado = new Date().toISOString();
        if (s) { D.cuentas[s.id] = Object.assign(D.cuentas[s.id] || { sitio_id: s.id }, { vence }); s.estado = "activo"; }
        selloPos.replaceChildren(h("span", { class: "sello grande verde golpe" }, "Pagado"));
        selMeses.hidden = true;
        acciones.replaceChildren(h("p", { class: "banda verde", style: "width:100%" }, "Aprobado. Nueva fecha de corte: " + EU.fecha(vence, true) + "."),
          s && c.telefono ? h("a", { class: "btn btn-sec btn-chico", href: wa(c.telefono, "Hola" + (c.contacto ? " " + c.contacto : "") + ", recibimos tu pago. Tu página " + s.nombre + " queda al día hasta el " + EU.fecha(vence, true) + ". ¡Gracias!"), target: "_blank", rel: "noopener" }, "Avisarle por WhatsApp") : null);
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
    const c = cuentaDe(s), est = estadoDe(s);
    const copiarBtn = (txt, etiqueta) => { const b = h("button", { class: "btn btn-sec btn-chico", type: "button" }, etiqueta); b.addEventListener("click", () => EU.copiar(txt, b)); return b; };
    const pagosCliente = D.pagos.filter((p) => p.sitio_id === s.id);
    m.cuerpo.replaceChildren(
      h("div", { class: "hoja-fila" },
        h("div", {}, h("p", { class: "suave" }, "Usuario " + s.slug + ". Plantilla " + nombrePlantilla(s.plantilla) + "."), h("p", {}, est.texto)),
        h("span", { class: "sello grande " + est.tono }, est.sello)),
      h("div", { class: "acciones" },
        h("a", { class: "btn btn-sec btn-chico", href: enlaceSitio(s), target: "_blank", rel: "noopener" }, "Ver página"),
        copiarBtn(enlaceSitio(s), "Copiar enlace"),
        copiarBtn(enlacePanel(s), "Copiar enlace del panel"),
        c.telefono ? h("a", { class: "btn btn-sec btn-chico", href: wa(c.telefono, recordatorio(s)), target: "_blank", rel: "noopener" }, "Recordarle el pago") : null),
      seccionRegistrarPago(s),
      seccionCuenta(s),
      h("section", { class: "campos" },
        h("h3", { style: "font-size:17px" }, "Acciones"),
        h("div", { class: "acciones" },
          s.estado === "activo"
            ? h("button", { class: "btn btn-peligro", type: "button", onclick: () => cambiarEstado(s, "suspendido", m) }, "Suspender página")
            : h("button", { class: "btn btn-verde", type: "button", onclick: () => cambiarEstado(s, "activo", m) }, "Reactivar página"),
          h("button", { class: "btn btn-sec", type: "button", onclick: () => nuevaClave(s) }, "Nueva contraseña"),
          h("button", { class: "btn btn-sec", type: "button", onclick: () => cambiarPlantilla(s, m) }, "Cambiar plantilla"),
          h("button", { class: "btn btn-peligro", type: "button", onclick: () => eliminar(s, m) }, "Eliminar página"))),
      h("section", { class: "campos" },
        h("h3", { style: "font-size:17px" }, "Pagos de este cliente"),
        pagosCliente.length ? h("div", {}, pagosCliente.map((p) => lineaPago(p, false))) : h("p", { class: "suave" }, "Sin pagos registrados.")));
  }

  function seccionRegistrarPago(s) {
    const c = cuentaDe(s);
    const precio = Number(c.precio_mensual) || Number(D.ajustes.precioBase) || 0;
    const metodos = (D.ajustes.pagos || []).map((x) => x.metodo).filter(Boolean);
    const d = { monto: precio, moneda: "USD", metodo: metodos[0] || "Efectivo", meses: "1", referencia: "", nota: "" };
    const ed = EU.crearEditor({ raiz: () => d });
    const boton = h("button", { class: "btn btn-verde", type: "button" }, "Registrar y aprobar");
    const caja = h("details", { class: "hoja", style: "box-shadow:none;display:block" },
      h("summary", { style: "cursor:pointer;font-weight:700" }, "Registrar un pago que te hicieron por fuera"),
      h("div", { class: "campos", style: "margin-top:14px" },
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "dinero", ruta: "monto", etiqueta: "Monto" }),
          ed.campo({ tipo: "selector", ruta: "moneda", etiqueta: "Moneda", opciones: [{ id: "USD", nombre: "Dólares" }, { id: "VES", nombre: "Bolívares" }] })),
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "selector", ruta: "meses", etiqueta: "Meses", lista: true, opciones: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), nombre: i + 1 + (i ? " meses" : " mes") })) }),
          ed.campo({ tipo: "selector", ruta: "metodo", etiqueta: "Método", lista: true, opciones: [...new Set([...metodos, "Efectivo", "Otro"])] })),
        ed.campo({ tipo: "texto", ruta: "referencia", etiqueta: "Referencia (opcional)", max: 80 }),
        ed.campo({ tipo: "texto", ruta: "nota", etiqueta: "Nota (opcional)", max: 300 }),
        h("div", {}, boton)));
    boton.addEventListener("click", async () => {
      if (!(d.monto > 0)) { EU.aviso("Escribe el monto.", true); return; }
      boton.disabled = true; boton.textContent = "Registrando";
      const args = { p_sitio: s.id, p_monto: d.monto, p_metodo: d.metodo, p_meses: Number(d.meses) || 1, p_moneda: d.moneda, p_referencia: d.referencia || null, p_nota: d.nota || null };
      try {
        let vence;
        try { vence = await api.rpc("eu_admin_registrar_pago", args); }
        catch (err) {
          if (!(err.status === 404 || err.codigo === "PGRST202")) throw err;
          // la función nueva todavía no está en la base de datos: se hace en dos pasos
          const r = await api.insertar("eu_pagos", { sitio_id: s.id, monto: d.monto, moneda: d.moneda, metodo: d.metodo, meses: args.p_meses, referencia: args.p_referencia, nota: args.p_nota, creado_por: api.sesion.uid });
          vence = await api.rpc("eu_admin_aprobar_pago", { p_pago: r[0].id, p_meses: args.p_meses });
        }
        EU.aviso("Pago registrado. Nueva fecha de corte: " + EU.fecha(vence, true) + ".");
        await recargarDatos();
        caja.closest("dialog").close();
      } catch (err) { EU.aviso(err.message, true); boton.disabled = false; boton.textContent = "Registrar y aprobar"; }
    });
    return caja;
  }

  function seccionCuenta(s) {
    const c = cuentaDe(s);
    const d = {
      precio: Number(c.precio_mensual != null ? c.precio_mensual : D.ajustes.precioBase || 10),
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
        const fila = { sitio_id: s.id, precio_mensual: d.precio, vence: vence.value || null, contacto: d.contacto.trim() || null, telefono: d.telefono.trim() || null };
        const r = await api.guardarFila("eu_cuentas", fila, "sitio_id");
        D.cuentas[s.id] = (r && r[0]) || fila;
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
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "dinero", ruta: "precio", etiqueta: "Precio mensual" }),
          h("div", { class: "campo" }, h("label", { for: vence.id }, "Fecha de corte"), vence, h("p", { class: "ayuda" }, "Hasta qué día está pagada."))),
        h("div", { class: "dos-col" },
          ed.campo({ tipo: "texto", ruta: "contacto", etiqueta: "Persona de contacto", max: 80 }),
          ed.campo({ tipo: "texto", ruta: "telefono", etiqueta: "Teléfono de contacto", max: 30, placeholder: "Ej: 0414-123-4567" })),
        ed.campo({ tipo: "texto", ruta: "dominio", etiqueta: "Dominio propio (opcional)", max: 120, placeholder: "Ej: minegocio.com", ayuda: "Si el cliente compra su dominio, apúntalo a esta web en Cloudflare y escríbelo aquí." }),
        ed.campo({ tipo: "area", ruta: "nota", etiqueta: "Nota interna", max: 2000, filas: 3, ayuda: "Solo la ves tú." }),
        h("div", {}, boton)));
  }

  async function recargarDatos() {
    const [sitios, cuentas, pagos] = await Promise.all([
      api.select("eu_sitios", "select=id,slug,nombre,plantilla,estado,dominio,creado,actualizado,dueno&order=creado.desc"),
      api.select("eu_cuentas", "select=*"),
      api.select("eu_pagos", "select=*&order=creado.desc&limit=500"),
    ]);
    D.sitios = sitios || []; D.cuentas = Object.fromEntries((cuentas || []).map((c) => [c.sitio_id, c])); D.pagos = pagos || [];
    pintarNav();
  }

  async function cambiarEstado(s, estado, m) {
    if (estado === "suspendido" && !confirm("¿Suspender " + s.nombre + "? La página deja de verse hasta que la reactives.")) return;
    try {
      await api.actualizar("eu_sitios", "id=eq." + s.id, { estado });
      s.estado = estado;
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

  function cambiarPlantilla(s, mPadre) {
    let elegida = s.plantilla;
    EU.modal({
      titulo: "Cambiar plantilla", ancho: true,
      construir: (m) => {
        const tarjetas = plantillas().map((P) => h("button", { class: "plantilla", type: "button", "aria-pressed": String(P.id === elegida), onclick: (e) => { elegida = P.id; m.cuerpo.querySelectorAll(".plantilla").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); } },
          h("img", { src: P.vistaPrevia, alt: "", loading: "lazy" }), h("b", {}, P.nombre), h("p", {}, P.rubro)));
        m.cuerpo.append(h("p", { class: "banda ambar" }, "El menú y la apariencia pasan a ser los de la plantilla nueva. Se conservan el nombre, el contacto, la dirección, el horario, las formas de pago y la tasa."),
          h("div", { class: "plantillas" }, tarjetas));
        const ok = h("button", { class: "btn", type: "button" }, "Cambiar plantilla");
        ok.addEventListener("click", async () => {
          if (elegida === s.plantilla) { m.cerrar(); return; }
          ok.disabled = true;
          try {
            const filas = await api.select("eu_sitios", "select=contenido&id=eq." + s.id);
            const viejo = (filas && filas[0] && filas[0].contenido) || {};
            const contenido = {};
            ["negocio", "pagos", "tasa", "hoy", "pedidos", "banner"].forEach((k) => { if (viejo[k] !== undefined) contenido[k] = viejo[k]; });
            await api.actualizar("eu_sitios", "id=eq." + s.id, { plantilla: elegida, contenido });
            s.plantilla = elegida;
            EU.aviso("Plantilla cambiada a " + nombrePlantilla(elegida) + ".");
            m.cerrar(); pintarCliente(mPadre, s);
          } catch (err) { EU.aviso(err.message, true); ok.disabled = false; }
        });
        m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: () => m.cerrar() }, "Cancelar"), ok);
      },
    });
  }

  function eliminar(s, mPadre) {
    EU.modal({
      titulo: "Eliminar " + s.nombre,
      construir: (m) => {
        const inp = h("input", { class: "entrada", type: "text", id: "confirma-" + s.id, autocomplete: "off", autocapitalize: "none" });
        const ok = h("button", { class: "btn btn-peligro lleno", type: "button", disabled: true }, "Eliminar para siempre");
        inp.addEventListener("input", () => { ok.disabled = inp.value.trim().toLowerCase() !== s.slug; });
        m.cuerpo.append(
          h("p", { class: "banda rojo" }, "Se borran la página, sus fotos, sus pagos y su usuario. No se puede deshacer."),
          h("div", { class: "campo" }, h("label", { for: inp.id }, "Escribe " + s.slug + " para confirmar"), inp));
        ok.addEventListener("click", async () => {
          ok.disabled = true; ok.textContent = "Eliminando";
          try {
            for (const bucket of ["eu-media", "eu-pagos"]) {
              try {
                const archivos = await api.listar(bucket, s.id);
                const rutas = (archivos || []).filter((a) => a && a.name && a.id !== null).map((a) => s.id + "/" + a.name);
                if (rutas.length) await api.borrarArchivos(bucket, rutas);
              } catch (_) { /* si fallan las fotos, igual se borra la página */ }
            }
            await api.rpc("eu_admin_eliminar_sitio", { p_sitio: s.id });
            D.sitios = D.sitios.filter((x) => x.id !== s.id);
            D.pagos = D.pagos.filter((p) => p.sitio_id !== s.id);
            delete D.cuentas[s.id];
            EU.aviso("Página eliminada.");
            m.cerrar(); mPadre.cerrar(); pintarNav();
          } catch (err) { EU.aviso(err.message, true); ok.disabled = false; ok.textContent = "Eliminar para siempre"; }
        });
        m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: () => m.cerrar() }, "Cancelar"), ok);
      },
    });
  }

  /* ---------- Nuevo cliente ---------- */
  function nuevoCliente() {
    const hoy = EU.hoyISO();
    const d = { nombre: "", slug: "", clave: EU.claveAzar(10), plantilla: "", whatsapp: "", contacto: "", telefono: "", precio: Number(D.ajustes.precioBase) || 10 };
    let slugTocado = false;
    const ed = EU.crearEditor({
      raiz: () => d,
      alCambiar: (def) => {
        if (def.ruta === "nombre" && !slugTocado) { d.slug = EU.slug(d.nombre); campoSlug.querySelector("input").value = d.slug; }
        if (def.ruta === "slug") slugTocado = true;
      },
    });
    const campoSlug = ed.campo({ tipo: "texto", ruta: "slug", etiqueta: "Usuario", max: 40, ayuda: "Solo letras minúsculas, números y guiones. Es el usuario del panel y va en el enlace de la página." });
    const vence = h("input", { class: "entrada", type: "date", id: "nuevo-vence", value: EU.sumarMeses(hoy, 1) });
    const tarjetas = h("div", { class: "plantillas", role: "group", "aria-label": "Plantilla" }, plantillas().map((P) => h("button", {
      class: "plantilla", type: "button", "aria-pressed": "false",
      onclick: (e) => { d.plantilla = P.id; tarjetas.querySelectorAll(".plantilla").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); },
    }, h("img", { src: P.vistaPrevia, alt: "", loading: "lazy" }), h("b", {}, P.nombre), h("p", {}, P.rubro))));
    const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
    const boton = h("button", { class: "btn", type: "submit" }, "Crear página");
    const form = h("form", { class: "campos", novalidate: true },
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "El negocio")),
        h("div", { class: "campos" },
          ed.campo({ tipo: "texto", ruta: "nombre", etiqueta: "Nombre del negocio", max: 80 }),
          campoSlug,
          ed.campo({ tipo: "texto", ruta: "clave", etiqueta: "Contraseña del panel", max: 60, ayuda: "Ya va una al azar. Puedes cambiarla; mínimo 8 caracteres." }),
          ed.campo({ tipo: "telefono", ruta: "whatsapp", etiqueta: "WhatsApp donde recibe los pedidos", ayuda: "El cliente lo puede cambiar luego en su panel." }))),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Plantilla"), h("p", {}, "Una por suscripción.")), tarjetas),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Suscripción")),
        h("div", { class: "campos" },
          h("div", { class: "dos-col" },
            ed.campo({ tipo: "dinero", ruta: "precio", etiqueta: "Precio mensual" }),
            h("div", { class: "campo" }, h("label", { for: "nuevo-vence" }, "Pagada hasta"), vence, h("p", { class: "ayuda" }, "Si ya te pagó el primer mes, deja un mes desde hoy."))),
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
        : ["www", "app", "panel", "admin", "api", "t", "core", "img"].includes(slug) ? "Ese usuario está reservado. Elige otro."
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
          p_precio: d.precio, p_vence: vence.value || null, p_contacto: d.contacto.trim() || null, p_telefono: d.telefono.trim() || null,
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
          h("b", {}, P.nombre), h("p", {}, P.descripcion),
          h("p", { class: "suave chico" }, D.sitios.filter((s) => s.plantilla === P.id).length + " clientes la usan."),
          h("div", { class: "acciones" }, h("a", { class: "btn btn-chico", href: enlace, target: "_blank", rel: "noopener" }, "Ver demo"), copiar));
      }))];
  }

  /* ---------- Ajustes ---------- */
  function ajustes() {
    const d = EU.clonar(D.ajustes);
    if (!Array.isArray(d.pagos)) d.pagos = [];
    if (d.diasGracia == null) d.diasGracia = 3;
    const ed = EU.crearEditor({ raiz: () => d });
    const boton = h("button", { class: "btn", type: "button" }, "Guardar ajustes");
    boton.addEventListener("click", async () => {
      boton.disabled = true; boton.textContent = "Guardando";
      try {
        await api.guardarFila("eu_ajustes", { id: "eu", datos: d, actualizado: new Date().toISOString() }, "id");
        D.ajustes = EU.clonar(d);
        EU.aviso("Ajustes guardados.");
      } catch (err) { EU.aviso(err.message, true); }
      boton.disabled = false; boton.textContent = "Guardar ajustes";
    });
    return [titulo("Ajustes", "Tus datos, tus precios y cómo te pagan."),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Tu marca")),
        ed.campos([
          { tipo: "texto", ruta: "marca", etiqueta: "Nombre de tu marca", max: 60 },
          { tipo: "telefono", ruta: "whatsapp", etiqueta: "Tu WhatsApp", ayuda: "Ahí te escriben los clientes desde su panel." },
          { tipo: "texto", ruta: "whatsappVisible", etiqueta: "Cómo se muestra tu número", max: 30, placeholder: "Ej: 0414-474-1237" },
        ])),
      h("section", { class: "hoja" }, h("div", { class: "hoja-cab" }, h("h2", {}, "Cobros")),
        ed.campos([
          { tipo: "dinero", ruta: "precioBase", etiqueta: "Precio mensual para clientes nuevos" },
          { tipo: "interruptor", ruta: "autoSuspender", etiqueta: "Suspender solas las páginas vencidas", ayuda: "Todas las noches, a las 12:30 am, se suspenden las páginas que pasaron los días de gracia sin pagar." },
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

  /* ---------- Arranque ---------- */
  EU.reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (api.conectado) cargar(); else pantallaEntrada();
})();
