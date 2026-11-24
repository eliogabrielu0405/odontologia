/* Panel del cliente: aquí el dueño del negocio cambia su página y paga su suscripción. */
(function () {
  "use strict";
  const C = window.EU_CONFIG;
  const K = window.EU_CATALOGOS;
  const EU = window.EU;
  const h = EU.h;
  const api = EU.crearApi({ llave: "eu:panel", almacen: "local" });
  const app = document.getElementById("app");
  const params = new URLSearchParams(location.search);
  const WA_EU = EU.soloNumeros(C.whatsappMarca);

  const S = {
    sitio: null, cuenta: null, pagos: [], ajustes: {}, P: null,
    borrador: null, nombre: "", guardado: "", seccion: "hoy", subiendo: 0, subidas: new Set(),
    editor: null, vistaPendiente: false, guardando: false,
  };

  /* ---------- Utilidades ---------- */
  const firma = () => JSON.stringify({ n: S.nombre, c: S.borrador });
  const sucio = () => S.borrador && firma() !== S.guardado;
  const llaveBorrador = () => "eu:borrador:" + S.sitio.id;
  const enlacePagina = () => location.origin + "/?n=" + encodeURIComponent(S.sitio.slug);
  const waEU = (texto) => "https://wa.me/" + WA_EU + "?text=" + encodeURIComponent(texto);
  function cargando(texto) { app.replaceChildren(h("div", { class: "cargando-pantalla" }, h("p", {}, h("span", { class: "punto-carga" }), texto || "Cargando"))); }

  /* ---------- Entrada ---------- */
  function pantallaEntrada(mensaje) {
    document.title = "Entra a tu página";
    const usuario = h("input", { class: "entrada", id: "usuario", type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: false, value: params.get("u") || "", required: true });
    const clave = h("input", { class: "entrada", id: "clave", type: "password", autocomplete: "current-password", required: true });
    const ver = h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => { clave.type = clave.type === "password" ? "text" : "password"; ver.textContent = clave.type === "password" ? "Mostrar" : "Ocultar"; } }, "Mostrar");
    const error = h("p", { class: "banda rojo", role: "alert", hidden: !mensaje }, mensaje || "");
    const boton = h("button", { class: "btn btn-ancho", type: "submit" }, "Entrar");
    const form = h("form", { class: "hoja entrada-hoja", novalidate: true },
      h("div", { class: "marca-eu" }, h("img", { src: "/img/favicon.svg", alt: "" }), C.marca || "EU Digital"),
      h("div", { class: "hoja-cab" }, h("h1", {}, "Entra a tu página"), h("p", {}, "Con el usuario y la contraseña que te dio EU Digital.")),
      h("div", { class: "campos" },
        h("div", { class: "campo" }, h("label", { for: "usuario" }, "Usuario"), usuario),
        h("div", { class: "campo" }, h("div", { class: "hoja-fila" }, h("label", { for: "clave", style: "font-weight:700" }, "Contraseña"), ver), clave)),
      error, boton,
      h("p", { class: "chico suave" }, "¿Se te olvidó la contraseña? ", h("a", { href: waEU("Hola, olvidé la contraseña del panel de mi página."), target: "_blank", rel: "noopener" }, "Escríbenos por WhatsApp"), "."));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      if (!usuario.value.trim() || !clave.value) { error.textContent = "Escribe tu usuario y tu contraseña."; error.hidden = false; return; }
      boton.disabled = true; boton.textContent = "Entrando";
      try { await api.entrar(usuario.value.trim(), clave.value); await cargar(); }
      catch (err) {
        error.textContent = err.codigo === "invalid_credentials" || err.status === 400 ? "El usuario o la contraseña no son correctos." : err.message;
        error.hidden = false; boton.disabled = false; boton.textContent = "Entrar";
      }
    });
    app.replaceChildren(h("main", { class: "entrada-pantalla" }, form));
    (usuario.value ? clave : usuario).focus();
  }

  /* ---------- Carga de datos ---------- */
  async function cargar() {
    cargando("Abriendo tu página");
    try {
      const uid = api.sesion.uid;
      const sitios = await api.select("eu_sitios", "select=id,slug,nombre,plantilla,estado,contenido,actualizado,dominio&dueno=eq." + uid + "&limit=1");
      if (!sitios || !sitios.length) return pantallaSinPagina();
      S.sitio = sitios[0];
      const [cuentas, pagos, ajustes] = await Promise.all([
        api.select("eu_cuentas", "select=*&sitio_id=eq." + S.sitio.id),
        api.select("eu_pagos", "select=*&sitio_id=eq." + S.sitio.id + "&order=creado.desc&limit=40"),
        api.select("eu_ajustes", "select=datos&id=eq.eu").catch(() => []),
      ]);
      S.cuenta = (cuentas && cuentas[0]) || null;
      S.pagos = pagos || [];
      S.ajustes = (ajustes && ajustes[0] && ajustes[0].datos) || {};
      S.P = (window.EU_PLANTILLAS || {})[S.sitio.plantilla];
      if (!S.P) throw new Error("No encontramos la plantilla de tu página. Escríbele a EU Digital.");
      S.borrador = K.combinar(S.P.defaults, S.sitio.contenido || {});
      S.nombre = S.sitio.nombre;
      S.guardado = firma();
      recuperarBorrador();
      pintarPanel();
    } catch (err) {
      if (err.status === 401 || err.status === 403) { await api.salir(); return pantallaEntrada("Tu sesión venció. Vuelve a entrar."); }
      app.replaceChildren(h("main", { class: "entrada-pantalla" }, h("div", { class: "hoja entrada-hoja" },
        h("h1", {}, "No pudimos abrir tu panel"), h("p", { class: "suave" }, err.message),
        h("div", { class: "acciones" }, h("button", { class: "btn", type: "button", onclick: cargar }, "Intentar de nuevo"), h("button", { class: "btn btn-sec", type: "button", onclick: salir }, "Salir")))));
    }
  }

  function pantallaSinPagina() {
    app.replaceChildren(h("main", { class: "entrada-pantalla" }, h("div", { class: "hoja entrada-hoja" },
      h("h1", {}, "Esta cuenta no tiene página"),
      h("p", { class: "suave" }, "Si eres de EU Digital, entra por el panel de administración."),
      h("div", { class: "acciones" }, h("a", { class: "btn", href: "/admin/" }, "Ir al panel de EU Digital"), h("button", { class: "btn btn-sec", type: "button", onclick: salir }, "Salir")))));
  }

  async function salir() {
    if (S.borrador && sucio() && !confirm("Tienes cambios sin guardar. ¿Salir de todas formas?")) return;
    await api.salir();
    S.borrador = null;
    pantallaEntrada();
  }

  /* Copia de seguridad del borrador en el teléfono, por si se cierra la pestaña */
  function respaldar() {
    try {
      if (sucio()) localStorage.setItem(llaveBorrador(), JSON.stringify({ base: S.sitio.actualizado, n: S.nombre, c: S.borrador, t: Date.now() }));
      else localStorage.removeItem(llaveBorrador());
    } catch (_) { /* sin espacio: no pasa nada */ }
  }
  function recuperarBorrador() {
    S.respaldo = null;
    try {
      const r = JSON.parse(localStorage.getItem(llaveBorrador()) || "null");
      if (r && r.base === S.sitio.actualizado && r.c && Date.now() - r.t < 7 * 86400000) S.respaldo = r;
      else localStorage.removeItem(llaveBorrador());
    } catch (_) { S.respaldo = null; }
  }

  /* ---------- Fotos ---------- */
  async function subirFoto(archivo, { max = 1000 } = {}) {
    if (!/^image\//.test(archivo.type)) throw new Error("Ese archivo no es una foto.");
    if (archivo.size > 25 * 1024 * 1024) throw new Error("Esa foto pesa demasiado. Prueba con otra.");
    S.subiendo++; pintarBarra();
    try {
      const blob = await EU.comprimirImagen(archivo, { max, calidad: 0.84 });
      if (blob.size > 3 * 1024 * 1024) throw new Error("La foto sigue muy pesada. Prueba con otra más pequeña.");
      const ruta = S.sitio.id + "/" + EU.idNuevo() + "." + EU.extension(blob);
      await api.subir("eu-media", ruta, blob);
      S.subidas.add(ruta);
      return api.urlPublica("eu-media", ruta);
    } finally { S.subiendo--; pintarBarra(); }
  }
  // Borra las fotos que ya no usa la página (las de hace más de media hora o las subidas en esta visita)
  async function limpiarFotos() {
    try {
      const archivos = await api.listar("eu-media", S.sitio.id);
      const texto = JSON.stringify(S.borrador);
      const viejo = Date.now() - 30 * 60000;
      const borrar = (archivos || []).filter((a) => a && a.name && a.id !== null).map((a) => ({ ruta: S.sitio.id + "/" + a.name, creado: Date.parse(a.created_at || "") || 0 }))
        .filter((a) => !texto.includes(a.ruta) && (S.subidas.has(a.ruta) || a.creado < viejo)).map((a) => a.ruta);
      if (borrar.length) await api.borrarArchivos("eu-media", borrar);
      borrar.forEach((r) => S.subidas.delete(r));
    } catch (_) { /* no es grave: se intenta en el próximo guardado */ }
  }

  /* ---------- Secciones ---------- */
  function secciones() {
    const P = S.P;
    const hoy = {
      id: "hoy", titulo: "Hoy", intro: "Lo que cambias casi todos los días.",
      hojas: [
        { titulo: "Tasa del día", campos: [{ tipo: "tasa", ruta: "tasa", etiqueta: "Bolívares por dólar", ayuda: "Con la tasa, tus clientes ven los precios también en bolívares." }] },
        { titulo: "Avisos", campos: [
          { tipo: "interruptor", ruta: "hoy.cerrado", etiqueta: "Hoy no abrimos", peligro: true, ayuda: "Mientras esté encendido, la página avisa que hoy no hay servicio. Apágalo cuando vuelvas a abrir." },
          { tipo: "area", ruta: "hoy.aviso", etiqueta: "Aviso del día", max: 160, filas: 2, placeholder: "Ej: Hoy tenemos 2x1 en perros calientes", ayuda: "Sale en una franja amarilla arriba de tu página. Déjalo vacío para quitarlo." },
        ] },
        ...(P.agotados || []).map((a) => ({ titulo: null, campos: [{ tipo: "agotados", ruta: a.ruta, titulo: a.titulo + " agotados hoy", ayuda: a.ayuda }] })),
      ],
    };
    const propias = (P.secciones || []).map((s) => {
      const hojas = [];
      let suelta = null;
      (s.campos || []).forEach((c) => {
        if (c.tipo === "lista") { suelta = null; hojas.push({ titulo: null, campos: [c] }); }
        else { if (!suelta) { suelta = { titulo: null, campos: [] }; hojas.push(suelta); } suelta.campos.push(c); }
      });
      return { id: s.id, titulo: s.titulo, intro: s.intro || "", hojas };
    });
    const negocio = {
      id: "negocio", titulo: "Mi negocio", intro: "Nombre, logo, contacto, dirección y horario.",
      hojas: [
        { titulo: "Datos del negocio", campos: [
          { tipo: "texto", ruta: "$nombre", etiqueta: "Nombre del negocio", max: 60, requerido: true },
          { tipo: "texto", ruta: "negocio.eslogan", etiqueta: "Frase corta", max: 60, placeholder: "Ej: Las mejores arepas de la ciudad" },
          { tipo: "area", ruta: "negocio.descripcion", etiqueta: "Descripción", max: 240, filas: 3 },
          { tipo: "foto", ruta: "negocio.logo", etiqueta: "Logo", forma: "redonda", cubre: true, max: 600, ayuda: "Mejor cuadrado. Sale arriba en tu página." },
        ] },
        { titulo: "Contacto", campos: [
          { tipo: "telefono", ruta: "negocio.whatsapp", etiqueta: "WhatsApp que recibe los pedidos", ayuda: "Con el código del país y sin el 0. Ej: 584141234567." },
          { tipo: "texto", ruta: "negocio.telefono", etiqueta: "Teléfono que se muestra (opcional)", max: 30, placeholder: "Ej: 0414-123-4567" },
          { tipo: "texto", ruta: "negocio.instagram", etiqueta: "Instagram", max: 80, placeholder: "Ej: @minegocio" },
          { tipo: "texto", ruta: "negocio.tiktok", etiqueta: "TikTok", max: 80, placeholder: "Ej: @minegocio" },
          { tipo: "texto", ruta: "negocio.facebook", etiqueta: "Facebook", max: 120, placeholder: "Usuario o enlace de la página" },
        ] },
        { titulo: "Dirección", campos: [
          { tipo: "texto", ruta: "negocio.direccion", etiqueta: "Dirección", max: 140 },
          { tipo: "texto", ruta: "negocio.referencia", etiqueta: "Punto de referencia", max: 140 },
          { tipo: "texto", ruta: "negocio.ciudad", etiqueta: "Ciudad", max: 60 },
          { tipo: "texto", ruta: "negocio.mapa", etiqueta: "Enlace de Google Maps (opcional)", max: 400, ayuda: "En Google Maps toca Compartir y pega aquí el enlace. Si lo dejas vacío, se busca la dirección." },
        ] },
        { titulo: "Horario", campos: [{ tipo: "horario", ruta: "negocio.horario", etiqueta: "Días y horas de atención", ayuda: "Si cierras después de la medianoche, pon la hora tal cual (por ejemplo, de 6 pm a 1 am)." }] },
      ],
    };
    const pedidos = {
      id: "pedidos", titulo: P.sinTipos ? "Pagos" : "Pedidos y pagos", intro: "Cómo te piden y cómo te pagan.",
      hojas: [
        ...(P.sinTipos ? [] : [{ titulo: "Pedidos", campos: [
          { tipo: "multi", ruta: "pedidos.tipos", etiqueta: "Cómo pueden pedir", minimo: 1, opciones: [{ id: "delivery", nombre: "Delivery" }, { id: "llevar", nombre: "Para llevar" }, { id: "aqui", nombre: "Comer en el local" }] },
          { tipo: "dinero", ruta: "pedidos.delivery", etiqueta: "Costo del delivery", ayuda: "Déjalo en 0 si cambia según la zona: la página avisa que tiene un costo adicional." },
          { tipo: "texto", ruta: "pedidos.notaDelivery", etiqueta: "Nota sobre el delivery", max: 120 },
        ] }]),
        { titulo: null, campos: [{
          tipo: "lista", ruta: "pagos", etiqueta: "Formas de pago", item: "forma de pago", titulo: "nombre", prefijoId: "pg", maximo: 10,
          ayuda: "Los datos (banco, teléfono, correo) le salen al cliente con un botón para copiarlos.",
          nuevo: { nombre: "Nueva forma de pago", datos: [], nota: "", delivery: true, local: true, bs: false },
          campos: [
            { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 30, requerido: true },
            { tipo: "pares", clave: "datos", etiqueta: "Datos para pagar", max: 6, placeholderA: "Ej: Banco", placeholderB: "Ej: 0102 Venezuela" },
            { tipo: "texto", clave: "nota", etiqueta: "Nota", max: 140, placeholder: "Ej: Envía la captura por WhatsApp" },
            ...(P.sinTipos ? [] : [
              { tipo: "interruptor", clave: "delivery", etiqueta: "Se acepta en delivery" },
              { tipo: "interruptor", clave: "local", etiqueta: "Se acepta en el local y para llevar" },
            ]),
            { tipo: "interruptor", clave: "bs", etiqueta: "Se cobra en bolívares", ayuda: "Muestra el monto en Bs con la tasa del día." },
          ],
        }] },
      ],
    };
    const apariencia = {
      id: "apariencia", titulo: "Apariencia", intro: "Colores, letras y animaciones.",
      hojas: [
        { titulo: "Colores", campos: [
          { tipo: "temas", etiqueta: "Tema", ayuda: "Cada tema cambia los colores de toda la página." },
          { tipo: "grupo", etiqueta: "Colores propios (opcional)", ayuda: "Pintan encima del tema. Úsalos para poner los colores de tu marca.", campos: [
            { tipo: "color", ruta: "tema.colores.principal", etiqueta: "Color principal", opcional: true },
            { tipo: "color", ruta: "tema.colores.acento", etiqueta: "Color de acento", opcional: true },
            { tipo: "color", ruta: "tema.colores.fondo", etiqueta: "Color de fondo", opcional: true },
          ] },
          { tipo: "selector", ruta: "tema.fuente", etiqueta: "Letra de los títulos", opciones: K.fuentes, lista: true },
          { tipo: "selector", ruta: "tema.modo", etiqueta: "Claro u oscuro", opciones: [{ id: "", nombre: "Como el teléfono" }, { id: "claro", nombre: "Siempre claro" }, { id: "oscuro", nombre: "Siempre oscuro" }] },
        ] },
        { titulo: "Animaciones", campos: [
          { tipo: "selector", ruta: "animaciones.portada", etiqueta: "Animación de la portada", opciones: K.portada, lista: true },
          { tipo: "texto", ruta: "animaciones.emoji", etiqueta: "Emojis que caen", max: 16, placeholder: "Ej: 🍔🍟", si: { ruta: "animaciones.portada", igual: "emojis" } },
          { tipo: "selector", ruta: "animaciones.logo", etiqueta: "Animación del logo", opciones: K.logo, lista: true },
          { tipo: "selector", ruta: "animaciones.productos", etiqueta: "Cómo aparecen los productos", opciones: K.productos, lista: true },
          { tipo: "selector", ruta: "animaciones.boton", etiqueta: "Animación del botón principal", opciones: K.boton, lista: true },
          { tipo: "selector", ruta: "animaciones.temporada", etiqueta: "Decoración de temporada", opciones: K.temporada, lista: true, ayuda: "Agrega nieve, confeti o corazones y un saludo arriba de la página." },
          ...(P.tieneMascota ? [{ tipo: "interruptor", ruta: "animaciones.mascota", etiqueta: "Mostrar la mascota bailarina" }] : []),
        ] },
        { titulo: "Cinta de promoción", campos: [
          { tipo: "texto", ruta: "banner.texto", etiqueta: "Texto", max: 90, placeholder: "Ej: Martes de 2x1 en hamburguesas", ayuda: "Sale en una cinta de color arriba de tu página. Déjalo vacío para quitarla." },
          { tipo: "selector", ruta: "banner.estilo", etiqueta: "Movimiento", opciones: K.banner },
        ] },
        ...((P.apariencia || []).length ? [{ titulo: "Detalles de tu plantilla", campos: P.apariencia }] : []),
      ],
    };
    return [hoy, ...propias, negocio, pedidos, apariencia, { id: "suscripcion", titulo: "Mi suscripción", intro: "Tu plan, cómo pagar y tu contraseña.", especial: true }];
  }

  /* ---------- Pantalla principal ---------- */
  let refs = {};
  function pintarPanel() {
    const P = S.P;
    document.title = "Panel de " + S.nombre;
    const iframe = h("iframe", { title: "Vista previa de tu página", src: "/t/" + S.sitio.plantilla + "/?vista=borrador&n=" + encodeURIComponent(S.sitio.slug) });
    const cubre = h("div", { class: "cubre" }, "Cargando vista previa");
    const vista = h("aside", { class: "pnl-vista", "aria-label": "Vista previa" },
      h("div", { class: "vista-cab" }, h("b", {}, "Así se ve"), h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => cerrarVista() }, "Volver a editar")),
      h("div", { class: "telefono" }, iframe, cubre),
      h("p", { class: "vista-nota" }, "Vista previa con tus cambios. Tus clientes los ven cuando guardas."));
    const logo = EU.url(S.borrador.negocio.logo);
    refs = {
      iframe, cubre, vista,
      nombre: h("b", {}, S.nombre),
      logo: h("img", { class: "logo", src: logo || "/img/favicon.svg", alt: "" }),
      nav: h("div", { class: "pnl-nav-in", role: "navigation", "aria-label": "Secciones del panel" }),
      editor: h("section", { class: "pnl-editor", "aria-live": "polite" }),
      estado: h("p", { class: "estado-ok" }, "Todo guardado"),
      guardar: h("button", { class: "btn", type: "button", onclick: guardar }, "Guardar"),
      descartar: h("button", { class: "btn btn-sec", type: "button", onclick: descartar, hidden: true }, "Descartar"),
      verVista: h("button", { class: "btn btn-sec btn-vista", type: "button", onclick: abrirVista }, "Vista previa"),
    };
    refs.barra = h("div", { class: "pnl-guardar" }, h("div", { class: "pnl-guardar-in" }, refs.estado, refs.verVista, refs.descartar, refs.guardar));
    app.replaceChildren(
      h("div", { class: "pnl-arriba" },
        h("header", { class: "pnl-cab" }, h("div", { class: "pnl-cab-in" },
          h("div", { class: "pnl-marca" }, refs.logo, h("div", {}, refs.nombre, h("span", {}, "Plantilla " + P.nombre))),
          h("div", { class: "acciones" },
            h("a", { class: "btn btn-sec btn-chico", href: enlacePagina(), target: "_blank", rel: "noopener" }, "Ver página"),
            h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: salir }, "Salir")))),
        h("nav", { class: "pnl-nav" }, refs.nav)),
      h("main", { class: "pnl-main" }, refs.editor, vista),
      refs.barra);
    S.editor = EU.crearEditor({
      raiz: () => S.borrador,
      plantilla: P,
      galeria: P.galeria || [],
      subirFoto,
      nombre: (v) => { if (v === undefined) return S.nombre; S.nombre = v; refs.nombre.textContent = v || "Sin nombre"; },
      alCambiar,
    });
    pintarNav();
    pintarSeccion();
    pintarBarra();
  }

  function pintarNav() {
    const est = EU.estadoCuenta(S.sitio, S.cuenta, S.ajustes.diasGracia);
    refs.nav.replaceChildren(...secciones().map((s) => h("button", {
      type: "button", "aria-current": s.id === S.seccion ? "page" : null,
      onclick: () => { S.seccion = s.id; pintarNav(); pintarSeccion(); scrollTo({ top: 0, behavior: EU.reducido ? "auto" : "smooth" }); },
    }, s.titulo, s.id === "suscripcion" && est.id !== "activa" ? h("span", { class: "punto", "aria-label": "Revisa" }) : null)));
    const act = refs.nav.querySelector('[aria-current="page"]');
    if (act) act.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function pintarSeccion() {
    const s = secciones().find((x) => x.id === S.seccion) || secciones()[0];
    S.seccion = s.id;
    const cont = [];
    cont.push(h("div", { class: "pnl-titulo" }, h("h1", {}, s.titulo), s.intro ? h("p", {}, s.intro) : null));
    if (S.respaldo) cont.push(bandaRespaldo());
    const est = EU.estadoCuenta(S.sitio, S.cuenta, S.ajustes.diasGracia);
    if (est.id !== "activa" && s.id !== "suscripcion") {
      cont.push(h("p", { class: "banda " + (est.tono === "rojo" ? "rojo" : "ambar") }, est.texto + " ",
        h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => { S.seccion = "suscripcion"; pintarNav(); pintarSeccion(); } }, "Ver cómo pagar")));
    }
    if (s.especial) cont.push(...pintarSuscripcion());
    else s.hojas.forEach((hj) => cont.push(h("section", { class: "hoja" },
      hj.titulo ? h("div", { class: "hoja-cab" }, h("h2", {}, hj.titulo), hj.ayuda ? h("p", {}, hj.ayuda) : null) : null,
      S.editor.campos(hj.campos))));
    refs.editor.replaceChildren(...cont);
  }

  function bandaRespaldo() {
    return h("div", { class: "banda ambar" },
      h("p", { style: "margin-bottom:8px" }, "Tienes cambios de la última vez que no guardaste."),
      h("div", { class: "acciones" },
        h("button", { class: "btn btn-chico", type: "button", onclick: () => { S.borrador = S.respaldo.c; S.nombre = S.respaldo.n; S.respaldo = null; refs.nombre.textContent = S.nombre; pintarSeccion(); pintarBarra(); recargarVista(); } }, "Recuperarlos"),
        h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => { S.respaldo = null; try { localStorage.removeItem(llaveBorrador()); } catch (_) { /* nada */ } pintarSeccion(); } }, "Descartarlos")));
  }

  /* ---------- Cambios, vista previa y guardado ---------- */
  let vistaT;
  function alCambiar(def, extra) {
    const ruta = (def && (def.ruta || "")) || "";
    if (ruta.startsWith("tema.") || (def && def.tipo === "temas")) enviarTema();
    else if (!(extra && extra.vivo)) recargarVista();
    if (ruta === "negocio.logo") refs.logo.src = EU.url(S.borrador.negocio.logo) || "/img/favicon.svg";
    pintarBarra();
    respaldar();
  }
  function enviarTema() {
    const w = refs.iframe.contentWindow;
    if (w) w.postMessage({ tipo: "eu:tema", tema: S.borrador.tema }, location.origin);
  }
  function vistaVisible() { return matchMedia("(min-width: 1024px)").matches || refs.vista.classList.contains("abierta"); }
  function recargarVista() {
    clearTimeout(vistaT);
    if (!vistaVisible()) { S.vistaPendiente = true; return; }
    vistaT = setTimeout(() => {
      const w = refs.iframe.contentWindow;
      refs.cubre.hidden = false; refs.cubre.textContent = "Actualizando";
      if (w) w.postMessage({ tipo: "eu:recargar" }, location.origin);
    }, 900);
  }
  function abrirVista() {
    refs.vista.classList.add("abierta");
    document.body.style.overflow = "hidden";
    refs.cubre.hidden = false;
    const w = refs.iframe.contentWindow;
    if (w) w.postMessage({ tipo: "eu:recargar" }, location.origin);
    S.vistaPendiente = false;
  }
  function cerrarVista() { refs.vista.classList.remove("abierta"); document.body.style.overflow = ""; }
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || !refs.iframe || e.source !== refs.iframe.contentWindow) return;
    if (e.data.tipo === "eu:pedir-borrador") {
      e.source.postMessage({ tipo: "eu:borrador", sitio: { id: S.sitio.id, slug: S.sitio.slug, nombre: S.nombre || S.sitio.nombre, plantilla: S.sitio.plantilla, contenido: S.borrador } }, location.origin);
    }
    if (e.data.tipo === "eu:montado") refs.cubre.hidden = true;
  });
  matchMedia("(min-width: 1024px)").addEventListener("change", () => { if (refs.vista && S.vistaPendiente && vistaVisible()) { S.vistaPendiente = false; recargarVista(); } });

  function pintarBarra() {
    if (!refs.barra) return;
    const s = sucio();
    refs.barra.classList.toggle("sucio", s);
    refs.estado.textContent = S.subiendo ? "Subiendo fotos" : s ? "Tienes cambios sin guardar" : "Todo guardado";
    refs.guardar.disabled = !s || !!S.subiendo || S.guardando;
    refs.descartar.hidden = !s || S.guardando;
  }

  async function guardar() {
    if (S.subiendo) { EU.aviso("Espera a que terminen de subir las fotos.", true); return; }
    const nombre = String(S.nombre || "").trim();
    if (!nombre) { S.seccion = "negocio"; pintarNav(); pintarSeccion(); EU.aviso("Escribe el nombre de tu negocio.", true); return; }
    const contenido = S.borrador;
    const tam = JSON.stringify(contenido).length;
    if (tam > 580000) { EU.aviso("Tu página tiene demasiada información para guardarla. Borra algunos productos o textos largos.", true); return; }
    S.guardando = true; refs.guardar.textContent = "Guardando"; pintarBarra();
    try {
      const filas = await api.actualizar("eu_sitios", "id=eq." + S.sitio.id, { nombre, contenido });
      if (!filas || !filas.length) throw new Error("No se pudo guardar. Sal y vuelve a entrar.");
      S.sitio = Object.assign({}, S.sitio, filas[0]);
      S.nombre = nombre;
      S.guardado = firma();
      try { localStorage.removeItem(llaveBorrador()); } catch (_) { /* nada */ }
      EU.aviso("Cambios guardados. Ya se ven en tu página.");
      limpiarFotos();
    } catch (err) {
      if (err.status === 401) { EU.aviso("Tu sesión venció. Copia tus cambios importantes y vuelve a entrar.", true); }
      else EU.aviso(err.message || "No se pudo guardar.", true);
    } finally {
      S.guardando = false; refs.guardar.textContent = "Guardar"; pintarBarra();
    }
  }

  function descartar() {
    if (!confirm("¿Descartar los cambios que no has guardado?")) return;
    S.borrador = K.combinar(S.P.defaults, S.sitio.contenido || {});
    S.nombre = S.sitio.nombre;
    refs.nombre.textContent = S.nombre;
    try { localStorage.removeItem(llaveBorrador()); } catch (_) { /* nada */ }
    pintarSeccion(); pintarBarra(); recargarVista(); enviarTema();
    EU.aviso("Cambios descartados.");
  }

  addEventListener("beforeunload", (e) => { if (S.borrador && (sucio() || S.subiendo)) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Mi suscripción ---------- */
  function pintarSuscripcion() {
    const est = EU.estadoCuenta(S.sitio, S.cuenta, S.ajustes.diasGracia);
    const precio = Number(S.cuenta && S.cuenta.precio_mensual) || Number(S.ajustes.precioBase) || 0;
    const pendientes = S.pagos.filter((p) => p.estado === "pendiente");
    const out = [];

    out.push(h("section", { class: "hoja talon" },
      h("div", { class: "talon-fila" },
        h("div", {}, h("p", { class: "suave" }, "Tu plan"), h("p", { class: "talon-monto" }, EU.usd(precio), h("small", {}, " al mes"))),
        h("span", { class: "sello grande " + est.tono }, est.sello)),
      h("p", {}, est.texto),
      S.cuenta && S.cuenta.vence ? h("p", { class: "suave" }, "Fecha de corte: " + EU.fecha(S.cuenta.vence, true) + ".") : null,
      h("p", { class: "suave chico" }, "Plantilla " + S.P.nombre + ". Tu página: ", h("a", { href: enlacePagina(), target: "_blank", rel: "noopener" }, enlacePagina().replace(/^https?:\/\//, "")))));

    const metodos = (S.ajustes.pagos || []).filter((m) => m && m.metodo);
    out.push(h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Cómo pagar"), h("p", {}, "Paga por cualquiera de estas vías y luego repórtalo aquí abajo.")),
      metodos.length ? h("div", { class: "campos" }, metodos.map((m) => h("div", { class: "metodo-eu" }, h("h3", {}, m.metodo),
        String(m.datos || "").split(/\n|·/).map((x) => x.trim()).filter(Boolean).map((linea) => {
          const i = linea.indexOf(":");
          const k = i > 0 ? linea.slice(0, i).trim() : "", v = i > 0 ? linea.slice(i + 1).trim() : linea;
          const b = h("button", { class: "btn btn-sec btn-chico", type: "button" }, "Copiar");
          b.addEventListener("click", () => EU.copiar(v, b));
          return h("div", { class: "dato" }, k ? h("span", {}, k) : null, h("b", {}, v), b);
        })))) : h("p", { class: "suave" }, "Escríbenos para saber cómo pagar."),
      WA_EU ? h("a", { class: "btn btn-sec", href: waEU("Hola, quiero pagar la suscripción de mi página " + S.sitio.slug + "."), target: "_blank", rel: "noopener" }, "Escribir a EU Digital por WhatsApp") : null));

    out.push(formularioPago(precio, pendientes.length));

    out.push(h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Pagos que has reportado")),
      S.pagos.length ? h("div", {}, S.pagos.map((p) => {
        const sello = { pendiente: ["En revisión", "ambar"], aprobado: ["Pagado", "verde"], rechazado: ["Rechazado", "rojo"] }[p.estado] || [p.estado, "gris"];
        return h("div", { class: "recibo" },
          h("div", {}, h("b", {}, (p.moneda === "VES" ? "Bs " + EU.fmtBs.format(p.monto) : EU.usd(p.monto)) + " por " + p.meses + (p.meses === 1 ? " mes" : " meses")),
            h("p", { class: "suave" }, [p.metodo, p.referencia ? "Ref. " + p.referencia : "", EU.fechaHora(p.creado)].filter(Boolean).join(", "))),
          h("span", { class: "sello " + sello[1] }, sello[0]),
          p.estado === "rechazado" && p.respuesta ? h("p", { class: "respuesta" }, "Motivo: " + p.respuesta) : null);
      })) : h("p", { class: "suave" }, "Todavía no has reportado pagos.")));

    out.push(formularioClave());
    return out;
  }

  function formularioPago(precio, pendientes) {
    const metodos = (S.ajustes.pagos || []).filter((m) => m && m.metodo).map((m) => m.metodo);
    const d = { monto: precio || 0, moneda: "USD", metodo: metodos[0] || "", referencia: "", meses: 1, nota: "" };
    const ed = EU.crearEditor({ raiz: () => d, alCambiar: (def) => { if (def.ruta === "meses" && precio) { d.monto = Math.round(precio * d.meses * 100) / 100; montoCampo.replaceWith(montoCampo = ed.campo(defMonto)); } } });
    const defMonto = { tipo: "dinero", ruta: "monto", etiqueta: "Monto que pagaste", ayuda: "Si pagaste en bolívares, escribe el monto en bolívares y elige Bs abajo." };
    let montoCampo = ed.campo(defMonto);
    const archivo = h("input", { type: "file", accept: "image/*,application/pdf", id: "comprobante" });
    const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
    const boton = h("button", { class: "btn", type: "submit" }, "Enviar reporte de pago");
    const form = h("form", { class: "hoja", novalidate: true },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Reportar un pago"), h("p", {}, "EU Digital lo revisa y tu fecha de corte se corre sola.")),
      pendientes >= 5 ? h("p", { class: "banda ambar" }, "Tienes 5 pagos esperando revisión. Espera a que los revisemos para reportar otro.") : null,
      h("div", { class: "campos" },
        ed.campo({ tipo: "selector", ruta: "meses", etiqueta: "Meses que pagas", lista: true, opciones: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, nombre: i + 1 + (i ? " meses" : " mes") + (precio ? " (" + EU.usd(precio * (i + 1)) + ")" : "") })) }),
        montoCampo,
        ed.campo({ tipo: "selector", ruta: "moneda", etiqueta: "Moneda", opciones: [{ id: "USD", nombre: "Dólares" }, { id: "VES", nombre: "Bolívares" }] }),
        metodos.length ? ed.campo({ tipo: "selector", ruta: "metodo", etiqueta: "Cómo pagaste", lista: true, opciones: [...metodos, "Otro"] }) : ed.campo({ tipo: "texto", ruta: "metodo", etiqueta: "Cómo pagaste", max: 40, requerido: true }),
        ed.campo({ tipo: "texto", ruta: "referencia", etiqueta: "Número de referencia", max: 80, placeholder: "Ej: 004512" }),
        h("div", { class: "campo" }, h("label", { for: "comprobante" }, "Captura o comprobante"), archivo, h("p", { class: "ayuda" }, "Foto o PDF. Opcional si pusiste la referencia.")),
        ed.campo({ tipo: "area", ruta: "nota", etiqueta: "Nota (opcional)", max: 300, filas: 2 })),
      error, boton);
    if (pendientes >= 5) boton.disabled = true;
    // el monto se recalcula cuando cambian los meses
    form.addEventListener("change", () => { error.hidden = true; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      const f = archivo.files && archivo.files[0];
      const falta = !(d.monto > 0) ? "Escribe el monto que pagaste." : !String(d.metodo).trim() ? "Elige cómo pagaste." : !d.referencia.trim() && !f ? "Escribe la referencia o sube la captura del pago." : "";
      if (falta) { error.textContent = falta; error.hidden = false; return; }
      boton.disabled = true; boton.textContent = "Enviando";
      try {
        let comprobante = null;
        if (f) {
          if (f.size > 12 * 1024 * 1024) throw new Error("El comprobante pesa demasiado.");
          const blob = /^image\//.test(f.type) ? await EU.comprimirImagen(f, { max: 1600, calidad: 0.8 }) : f;
          if (blob.size > 4 * 1024 * 1024) throw new Error("El comprobante pesa más de 4 MB. Prueba con una captura.");
          comprobante = S.sitio.id + "/" + EU.idNuevo() + "." + EU.extension(blob);
          await api.subir("eu-pagos", comprobante, blob);
        }
        const fila = { sitio_id: S.sitio.id, monto: d.monto, moneda: d.moneda, metodo: String(d.metodo).slice(0, 40), referencia: d.referencia.trim() || null, meses: Number(d.meses) || 1, nota: d.nota.trim() || null, comprobante, creado_por: api.sesion.uid };
        const r = await api.insertar("eu_pagos", fila);
        S.pagos.unshift((r && r[0]) || Object.assign({ estado: "pendiente", creado: new Date().toISOString() }, fila));
        EU.aviso("Pago enviado. Te avisamos cuando lo revisemos.");
        pintarSeccion();
      } catch (err) {
        error.textContent = err.message || "No se pudo enviar el pago."; error.hidden = false;
        boton.disabled = false; boton.textContent = "Enviar reporte de pago";
      }
    });
    return form;
  }

  function formularioClave() {
    const a = h("input", { class: "entrada", type: "password", id: "clave-nueva", autocomplete: "new-password", minlength: 8 });
    const b = h("input", { class: "entrada", type: "password", id: "clave-repite", autocomplete: "new-password", minlength: 8 });
    const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
    const boton = h("button", { class: "btn btn-sec", type: "submit" }, "Cambiar contraseña");
    const form = h("form", { class: "hoja", novalidate: true },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Tu contraseña"), h("p", {}, "Tu usuario es " + S.sitio.slug + ". La contraseña debe tener al menos 8 letras o números.")),
      h("div", { class: "dos-col" },
        h("div", { class: "campo" }, h("label", { for: "clave-nueva" }, "Contraseña nueva"), a),
        h("div", { class: "campo" }, h("label", { for: "clave-repite" }, "Repítela"), b)),
      error, h("div", {}, boton));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      const falta = a.value.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : a.value !== b.value ? "Las dos contraseñas no son iguales." : "";
      if (falta) { error.textContent = falta; error.hidden = false; return; }
      boton.disabled = true;
      try { await api.cambiarMiClave(a.value); a.value = ""; b.value = ""; EU.aviso("Contraseña cambiada."); }
      catch (err) { error.textContent = err.message; error.hidden = false; }
      boton.disabled = false;
    });
    return form;
  }

  /* ---------- Arranque ---------- */
  EU.reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (api.conectado) cargar(); else pantallaEntrada();
})();
