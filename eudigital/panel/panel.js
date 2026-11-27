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

  // Una cuenta puede tener varias páginas (plan Premium). "sitio" es la que se está editando;
  // "principal" es la que lleva el usuario y la suscripción.
  const S = {
    sitio: null, sitios: [], principal: null, cuenta: null, pagos: [], ajustes: {}, planes: EU.planes.leer(), P: null,
    borrador: null, nombre: "", guardado: "", seccion: "hoy", subiendo: 0, subidas: new Set(),
    editor: null, vistaPendiente: false, guardando: false,
    resumen: null, resumenT: 0, resumenError: "", pago: null,
  };
  const ORDEN = ["pizzeria", "arepera", "burgers", "delicias", "sushi", "boutique"];
  const PLANTILLAS = () => ORDEN.map((id) => (window.EU_PLANTILLAS || {})[id]).filter(Boolean);
  const LLAVE_PAGINA = "eu:panel:pagina";

  /* ---------- Utilidades ---------- */
  const firma = () => JSON.stringify({ n: S.nombre, c: S.borrador });
  const sucio = () => S.borrador && firma() !== S.guardado;
  const llaveBorrador = () => "eu:borrador:" + S.sitio.id;
  const enlacePagina = (s) => location.origin + "/?n=" + encodeURIComponent((s || S.sitio).slug);
  const plan = () => (S.cuenta && S.cuenta.plan) || "basico";
  // Plantilla del plan Premium en la página principal (con ella no se puede pagar el Básico)
  const premiumEnUso = () => [S.principal].map((s) => s && (window.EU_PLANTILLAS || {})[s.plantilla]).filter((P) => P && P.premium); // con el Básico solo queda en línea la principal
  const nombresPremium = () => premiumEnUso().map((P) => P.nombre).join(", ");
  const pildoraPremium = (P) => (P && P.premium ? h("span", { class: "premium-pill" }, "★ Premium") : null);
  const ciclo = () => (S.cuenta && S.cuenta.ciclo) || "mensual";
  const estadoCuenta = () => EU.estadoCuenta(S.principal || S.sitio, S.cuenta, S.ajustes.diasGracia);
  // Una página adicional queda en pausa cuando la cuenta baja a un plan de una sola página
  const enPausa = () => !!(S.sitio && S.sitio.principal && S.sitio.estado === "suspendido" && S.principal && S.principal.estado === "activo");
  const marca = () => S.ajustes.marca || C.marca || "Tiendo";
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
      h("div", { class: "hoja-fila" }, h("div", { class: "marca-eu" }, h("img", { src: "/img/favicon.svg", alt: "" }), C.marca || "Tiendo"),
        EU.selectorIdiomas ? EU.selectorIdiomas() : null),
      h("div", { class: "hoja-cab" }, h("h1", {}, "Entra a tu página"), h("p", {}, "Con tu usuario y tu contraseña.")),
      h("div", { class: "campos" },
        h("div", { class: "campo" }, h("label", { for: "usuario" }, "Usuario"), usuario),
        h("div", { class: "campo" }, h("div", { class: "hoja-fila" }, h("label", { for: "clave", style: "font-weight:700" }, "Contraseña"), ver), clave)),
      error, boton,
      h("p", { class: "chico suave" }, "¿Se te olvidó la contraseña? ", h("a", { href: waEU("Hola, olvidé la contraseña del panel de mi página."), target: "_blank", rel: "noopener" }, "Escríbenos por WhatsApp"), "."),
      h("hr", { class: "separa" }),
      h("div", { class: "acciones", style: "justify-content:space-between" },
        h("a", { class: "btn btn-sec btn-chico", href: "/registro/" }, "Crear mi página gratis"),
        EU.app && !EU.app.instalada ? h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => EU.app.abrir() }, "Instalar la app") : null));
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
  // Abre el panel en una de las páginas de la cuenta: la que se pide, la última que se editó o la principal.
  async function cargar(slug) {
    cargando("Abriendo tu página");
    try {
      const uid = api.sesion.uid;
      const sitios = await api.select("eu_sitios", "select=id,slug,nombre,plantilla,estado,actualizado,dominio,principal,creado&dueno=eq." + uid + "&order=creado.asc");
      if (!sitios || !sitios.length) return pantallaSinPagina();
      S.sitios = sitios;
      S.principal = sitios.find((x) => !x.principal) || sitios[0];
      let quiere = slug || params.get("p") || "";
      if (!quiere) { try { quiere = localStorage.getItem(LLAVE_PAGINA) || ""; } catch (_) { /* sin almacenamiento */ } }
      const elegido = sitios.find((x) => x.slug === quiere) || S.principal;
      const [contenido, cuentas, pagos, ajustes] = await Promise.all([
        api.select("eu_sitios", "select=contenido&id=eq." + elegido.id),
        api.select("eu_cuentas", "select=*&sitio_id=eq." + S.principal.id),
        api.select("eu_pagos", "select=*&sitio_id=eq." + S.principal.id + "&order=creado.desc&limit=40"),
        api.select("eu_ajustes", "select=datos&id=eq.eu").catch(() => []),
      ]);
      S.sitio = Object.assign({}, elegido, { contenido: (contenido && contenido[0] && contenido[0].contenido) || {} });
      try { localStorage.setItem(LLAVE_PAGINA, S.sitio.slug); } catch (_) { /* sin almacenamiento */ }
      S.cuenta = (cuentas && cuentas[0]) || null;
      S.pagos = pagos || [];
      S.ajustes = (ajustes && ajustes[0] && ajustes[0].datos) || {};
      S.planes = EU.planes.leer(S.ajustes);
      S.P = (window.EU_PLANTILLAS || {})[S.sitio.plantilla];
      if (!S.P) throw new Error("No encontramos la plantilla de tu página. Escríbele a Tiendo.");
      S.borrador = K.combinar(S.P.defaults, S.sitio.contenido || {});
      ponerMascota(S.borrador, S.P);
      S.nombre = S.sitio.nombre;
      S.guardado = firma();
      S.resumen = null; S.resumenT = 0; S.subidas = new Set(); S.pago = null;
      recuperarBorrador();
      // Idioma de la cuenta: recién registrado se guarda el que eligió; si no, el panel se abre en el de la cuenta
      const idiomaCuenta = (S.cuenta && S.cuenta.idioma) || "es";
      if (params.get("bienvenida")) { if (EU.idioma && EU.idioma !== idiomaCuenta) guardarIdioma(EU.idioma); }
      else if (EU.idiomaCambiar && !params.get("lang") && EU.idioma && idiomaCuenta !== EU.idioma) { EU.idiomaCambiar(idiomaCuenta); return; }
      pintarPanel();
      avisarRegistro();
      if (params.get("bienvenida")) { quitarParametro("bienvenida"); bienvenida(); }
    } catch (err) {
      if (err.status === 401 || err.status === 403) { await api.salir(); return pantallaEntrada("Tu sesión venció. Vuelve a entrar."); }
      app.replaceChildren(h("main", { class: "entrada-pantalla" }, h("div", { class: "hoja entrada-hoja" },
        h("h1", {}, "No pudimos abrir tu panel"), h("p", { class: "suave" }, err.message),
        h("div", { class: "acciones" }, h("button", { class: "btn", type: "button", onclick: () => cargar() }, "Intentar de nuevo"), h("button", { class: "btn btn-sec", type: "button", onclick: salir }, "Salir")))));
    }
  }
  function quitarParametro(nombre) {
    params.delete(nombre);
    const q = params.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
  }
  // El administrador se entera de cada registro nuevo (una sola vez por cuenta)
  function avisarRegistro() {
    if (!C.avisos || !S.cuenta || S.cuenta.origen !== "registro" || S.cuenta.aviso_alta) return;
    S.cuenta.aviso_alta = new Date().toISOString();
    api.funcion("eu-avisos", { accion: "registro" }).catch(() => { /* sin aviso: igual aparece en su lista de clientes */ });
  }
  // Pasa a editar otra página de la cuenta
  function cambiarPagina(slug) {
    if (slug === S.sitio.slug) { irA("hoy"); return; }
    if (S.subiendo) { EU.aviso("Espera a que terminen de subir las fotos.", true); return; }
    if (sucio() && !confirm("Tienes cambios sin guardar en " + S.nombre + ". ¿Cambiar de página de todas formas?")) return;
    try { localStorage.removeItem(llaveBorrador()); } catch (_) { /* nada */ }
    S.borrador = null; S.seccion = "hoy";
    cargar(slug);
  }

  function pantallaSinPagina() {
    app.replaceChildren(h("main", { class: "entrada-pantalla" }, h("div", { class: "hoja entrada-hoja" },
      h("h1", {}, "Esta cuenta no tiene página"),
      h("p", { class: "suave" }, "Si eres de " + (C.marca || "Tiendo") + ", entra por el panel de administración. Si quieres una página para tu negocio, créala gratis."),
      h("div", { class: "acciones" }, h("a", { class: "btn", href: "/registro/" }, "Crear mi página"), h("a", { class: "btn btn-sec", href: "/admin/" }, "Panel de administración"), h("button", { class: "btn btn-plano", type: "button", onclick: salir }, "Salir")))));
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
      const id = EU.idNuevo(), ext = EU.extension(blob);
      let ruta = S.sitio.id + "/" + id + "." + ext;
      // Versión chica (400 px) para las listas del menú: "id-g" es la grande y "id-p" la chica.
      // Las páginas usan la chica donde la foto sale pequeña y así gastan mucha menos transferencia.
      if (max > 480) {
        try {
          const chica = await EU.comprimirImagen(archivo, { max: 400, calidad: 0.8 });
          if (EU.extension(chica) === ext && chica.size < blob.size) {
            const rutaChica = S.sitio.id + "/" + id + "-p." + ext;
            await api.subir("eu-media", rutaChica, chica);
            S.subidas.add(rutaChica);
            ruta = S.sitio.id + "/" + id + "-g." + ext;
          }
        } catch (_) { /* sin versión chica: las páginas usan la grande */ }
      }
      await api.subir("eu-media", ruta, blob);
      S.subidas.add(ruta);
      return api.urlPublica("eu-media", ruta);
    } finally { S.subiendo--; pintarBarra(); }
  }
  // Borra las fotos que ya no usa la página (las de hace más de media hora o las subidas en esta visita)
  async function limpiarFotos() {
    try {
      // Si la página cambió de plantilla, las fotos del menú guardado de la otra plantilla no se tocan
      const guardadas = new Set((await api.rpc("eu_fotos_guardadas", { p_sitio: S.sitio.id })) || []);
      const archivos = await api.listar("eu-media", S.sitio.id);
      const texto = JSON.stringify(S.borrador);
      const viejo = Date.now() - 30 * 60000;
      const usada = (r) => texto.includes(r) || guardadas.has(r);
      // La versión chica ("-p") sigue mientras se use su grande ("-g")
      const enUso = (r) => usada(r) || (/-p\.\w+$/.test(r) && usada(r.replace(/-p\.(\w+)$/, "-g.$1")));
      const borrar = (archivos || []).filter((a) => a && a.name && a.id !== null).map((a) => ({ ruta: S.sitio.id + "/" + a.name, creado: Date.parse(a.created_at || "") || 0 }))
        .filter((a) => !enUso(a.ruta) && (S.subidas.has(a.ruta) || a.creado < viejo)).map((a) => a.ruta);
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
    /* Cada lista de la plantilla con "nombre" (productos, categorías, ingredientes…) suma una parte
       plegable "En otros idiomas": nombre y descripción en inglés, portugués e italiano (i18n). */
    const IDIOMAS_MENU = [["en", "inglés"], ["pt", "portugués"], ["it", "italiano"]];
    const conIdiomas = (c) => {
      if (c.tipo !== "lista" || !Array.isArray(c.campos)) return c;
      const nombre = c.campos.find((x) => x.clave === "nombre" && x.tipo === "texto");
      if (!nombre) return c;
      const desc = c.campos.find((x) => ["desc", "descripcion"].includes(x.clave) && ["area", "texto"].includes(x.tipo));
      const campos = [];
      IDIOMAS_MENU.forEach(([l, n]) => {
        campos.push({ tipo: "texto", clave: "i18n." + l + ".nombre", etiqueta: "Nombre en " + n, max: nombre.max || 60 });
        if (desc) campos.push({ tipo: desc.tipo, clave: "i18n." + l + "." + desc.clave, etiqueta: (desc.etiqueta || "Descripción") + " en " + n, max: desc.max || 200 });
      });
      return Object.assign({}, c, { campos: [...c.campos, { tipo: "plegable", etiqueta: "En otros idiomas (opcional)", ayuda: "Si alguien ve tu página en inglés, portugués o italiano, sale esto. Lo que dejes vacío sale en español.", campos }] });
    };
    const propias = (P.secciones || []).map((s) => {
      const hojas = [];
      let suelta = null;
      (s.campos || []).map(conIdiomas).forEach((c) => {
        if (c.tipo === "lista") { suelta = null; hojas.push({ titulo: null, campos: [c] }); }
        else { if (!suelta) { suelta = { titulo: null, campos: [] }; hojas.push(suelta); } suelta.campos.push(c); }
      });
      return { id: s.id, titulo: s.titulo, intro: s.intro || "", hojas };
    });
    const negocio = {
      id: "negocio", titulo: "Mi negocio", intro: "Nombre, logo, contacto, redes sociales, dirección y horario.",
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
        ] },
        { titulo: "Redes sociales", campos: [
          { tipo: "nota", texto: "Escribe tu usuario o pega el enlace de tu perfil. Las que dejes vacías no salen en tu página." },
          ...K.redes.map((r) => ({ tipo: "texto", ruta: "negocio." + r.id, etiqueta: r.nombre, max: 160, usuario: true, placeholder: r.id === "facebook" ? "Ej: minegocio o el enlace de la página" : "Ej: @minegocio" })),
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
      id: "pedidos", titulo: P.sinTipos ? "Pagos" : "Entregas y pagos", intro: "Cómo te piden y cómo te pagan.",
      hojas: [
        ...(P.sinTipos ? [] : [{ titulo: "Pedidos", campos: [
          { tipo: "multi", ruta: "pedidos.tipos", etiqueta: "Cómo pueden pedir", minimo: 1, opciones: [{ id: "delivery", nombre: "Delivery" }, { id: "llevar", nombre: "Para llevar" }, { id: "aqui", nombre: "Comer en el local" }] },
          { tipo: "selector", ruta: "pedidos.envio.modo", etiqueta: "Cómo cobras el delivery", opciones: [{ id: "fijo", nombre: "Precio fijo" }, { id: "distancia", nombre: "Según la distancia" }],
            ayuda: "Según la distancia: tu cliente comparte su ubicación y la página calcula los kilómetros y el precio con tu tabla." },
          { tipo: "dinero", ruta: "pedidos.delivery", etiqueta: "Costo del delivery", ayuda: "Déjalo en 0 si cambia según la zona: la página avisa que tiene un costo adicional.", si: { ruta: "pedidos.envio.modo", distinto: "distancia" } },
          { tipo: "texto", ruta: "pedidos.notaDelivery", etiqueta: "Nota sobre el delivery", max: 120, si: { ruta: "pedidos.envio.modo", distinto: "distancia" } },
          { tipo: "ubicacion", ruta: "pedidos.envio.local", etiqueta: "Dónde está tu local", textoGps: "Estoy en el local: usar mi ubicación", tituloMapa: "¿Dónde está tu local?",
            vacio: "Todavía no has marcado dónde está tu local. Sin esto, el delivery se cobra como precio fijo.",
            ayuda: "Desde aquí se miden los kilómetros hasta tu cliente.", si: { ruta: "pedidos.envio.modo", igual: "distancia" } },
          { tipo: "lista", ruta: "pedidos.envio.tramos", etiqueta: "Precios por distancia", item: "tramo", tituloDe: (t) => "Hasta " + String(t.hasta).replace(".", ",") + " km", precio: "precio", icono: "🛵", prefijoId: "km", maximo: 12,
            ayuda: "Ej: hasta 10 km $1, hasta 20 km $2. Se usa el primer tramo que alcance. Si el cliente está más lejos que el último, la página le dice que está fuera de tu zona y que le confirmas el costo por WhatsApp. La distancia es aproximada: en línea recta y un poco más por las calles.",
            nuevo: { hasta: 40, precio: 4 }, si: { ruta: "pedidos.envio.modo", igual: "distancia" },
            campos: [
              { tipo: "numero", clave: "hasta", etiqueta: "Hasta cuántos kilómetros", decimal: true, min: 0.5, max: 500, sufijo: "km" },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio del delivery" },
            ] },
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
    const TIPOS_DESC = [{ id: "porcentaje", nombre: "Porcentaje (%)" }, { id: "monto", nombre: "Monto fijo ($)" }];
    const promos = {
      id: "promos", titulo: "Promociones", intro: "Descuentos para todos y cupones para tus clientes.",
      hojas: [
        { titulo: "Descuento para todos", campos: [
          { tipo: "interruptor", ruta: "promos.auto.activa", etiqueta: "Activar el descuento", ayuda: "Se aplica solo, sin código, y sale anunciado arriba de tu página. Ej: 10% en pedidos desde $20." },
          { tipo: "selector", ruta: "promos.auto.tipo", etiqueta: "Tipo de descuento", opciones: TIPOS_DESC },
          { tipo: "numero", ruta: "promos.auto.valor", etiqueta: "Cuánto descuentas", decimal: true, min: 0, max: 100000, ayuda: "Si es porcentaje, de 1 a 100. Si es monto fijo, en dólares." },
          { tipo: "dinero", ruta: "promos.auto.minimo", etiqueta: "Compra mínima", ayuda: "Déjalo en 0 para que aplique a cualquier pedido." },
          { tipo: "fecha", ruta: "promos.auto.hasta", etiqueta: "Último día de la promoción", ayuda: "Opcional. Después de ese día se apaga sola." },
        ] },
        { titulo: null, campos: [{
          tipo: "lista", ruta: "promos.cupones", etiqueta: "Cupones", item: "cupón", titulo: "codigo", prefijoId: "cup", maximo: 20,
          ayuda: "Tu cliente escribe el código al hacer su pedido y el descuento sale en el total y en el mensaje que te llega. Si hay descuento para todos, se usa el que más le convenga al cliente (no se suman). Para mandar tu enlace con el cupón ya puesto, agrégale al final &cupon= y el código (ej: …?n=tu-negocio&cupon=AMIGO10).",
          nuevo: { codigo: "AMIGO", tipo: "porcentaje", valor: 10, minimo: 0, hasta: "", activo: true },
          campos: [
            { tipo: "texto", clave: "codigo", etiqueta: "Código", max: 20, requerido: true, placeholder: "Ej: AMIGO10", ayuda: "Letras y números, sin espacios. No importa si el cliente lo escribe en mayúsculas o minúsculas." },
            { tipo: "selector", clave: "tipo", etiqueta: "Tipo de descuento", opciones: TIPOS_DESC },
            { tipo: "numero", clave: "valor", etiqueta: "Cuánto descuenta", decimal: true, min: 0, max: 100000 },
            { tipo: "dinero", clave: "minimo", etiqueta: "Compra mínima", ayuda: "0 = cualquier pedido." },
            { tipo: "fecha", clave: "hasta", etiqueta: "Vence", ayuda: "Opcional. Después de ese día el cupón deja de funcionar." },
            { tipo: "interruptor", clave: "activo", etiqueta: "Cupón activo" },
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
        ] },
        { titulo: "Mascota bailarina", campos: [
          { tipo: "nota", texto: "Un personaje que baila en tu página y salta cuando tus clientes agregan algo al pedido." },
          { tipo: "mascotas", ruta: "animaciones.personaje", rutaBaile: "animaciones.baile", etiqueta: "Personaje" },
          { tipo: "selector", ruta: "animaciones.baile", etiqueta: "Baile", opciones: window.EU_MASCOTAS.bailes, lista: true, si: { ruta: "animaciones.personaje", distinto: "ninguna" } },
        ] },
        { titulo: "Cinta de promoción", campos: [
          { tipo: "texto", ruta: "banner.texto", etiqueta: "Texto", max: 90, placeholder: "Ej: Martes de 2x1 en hamburguesas", ayuda: "Sale en una cinta de color arriba de tu página. Déjalo vacío para quitarla." },
          { tipo: "selector", ruta: "banner.estilo", etiqueta: "Movimiento", opciones: K.banner },
        ] },
        { titulo: "Idiomas", campos: [
          { tipo: "interruptor", ruta: "idiomas.mostrar", etiqueta: "Selector de idioma arriba de tu página",
            ayuda: "Tus clientes pueden ver la página en español, inglés, portugués o italiano. Aunque lo ocultes, la página sale en el idioma del teléfono de quien la abre. Los botones y avisos se traducen solos; los nombres de tus productos, si los escribes en \"En otros idiomas\" dentro de cada producto. Los pedidos te llegan en español." },
        ] },
        ...((P.apariencia || []).length ? [{ titulo: "Detalles de tu plantilla", campos: P.apariencia }] : []),
      ],
    };
    return [
      hoy,
      { id: "pedidos-recibidos", titulo: "Mis pedidos", intro: "Los pedidos que te mandan desde tu página.", especial: "pedidos" },
      ...propias, negocio, pedidos, promos, apariencia,
      { id: "compartir", titulo: "Compartir", intro: "Tu enlace, cómo se ve en WhatsApp y tu código QR.", especial: "compartir" },
      { id: "paginas", titulo: "Mis páginas", intro: plan() === "premium" ? "Las páginas de tu cuenta, cada una con su enlace y su plantilla." : "Tu página y tu plantilla.", especial: "paginas" },
      { id: "suscripcion", titulo: "Mi suscripción", intro: "Tu plan, cómo pagar y tu contraseña.", especial: "suscripcion" },
    ];
  }
  // El personaje guardado manda. Las páginas de antes solo tenían un interruptor: se traduce a la lista nueva.
  function ponerMascota(b, P) {
    const a = (b.animaciones = b.animaciones || {});
    if (!a.personaje || !window.EU_MASCOTAS.existe(a.personaje)) a.personaje = a.personaje === "ninguna" || a.mascota === false ? "ninguna" : P.mascota || "ninguna";
    if (!window.EU_MASCOTAS.hayBaile(a.baile)) a.baile = "meneo";
    a.mascota = true;
  }
  function irA(id) { S.seccion = id; pintarNav(); pintarSeccion(); scrollTo({ top: 0, behavior: EU.reducido ? "auto" : "smooth" }); }

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
    const varias = S.sitios.length > 1;
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
          varias
            ? h("button", { class: "pnl-marca pnl-marca-btn", type: "button", "aria-label": "Cambiar de página. Estás en " + S.nombre, onclick: () => irA("paginas") }, refs.logo,
                h("div", {}, refs.nombre, h("span", {}, "Página " + (S.sitios.findIndex((x) => x.id === S.sitio.id) + 1) + " de " + S.sitios.length + ". Cambiar")))
            : h("div", { class: "pnl-marca" }, refs.logo, h("div", {}, refs.nombre, h("span", {}, "Plantilla " + P.nombre))),
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
    setTimeout(tarjetaInicial, 2500);
  }

  function pintarNav() {
    const est = estadoCuenta();
    refs.nav.replaceChildren(...secciones().map((s) => h("button", {
      type: "button", "aria-current": s.id === S.seccion ? "page" : null,
      onclick: () => { S.seccion = s.id; pintarNav(); pintarSeccion(); scrollTo({ top: 0, behavior: EU.reducido ? "auto" : "smooth" }); },
    }, s.titulo, s.especial === "suscripcion" && est.id !== "activa" ? h("span", { class: "punto", "aria-label": "Revisa" }) : null)));
    const act = refs.nav.querySelector('[aria-current="page"]');
    if (act) act.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function pintarSeccion() {
    const s = secciones().find((x) => x.id === S.seccion) || secciones()[0];
    S.seccion = s.id;
    const cont = [];
    cont.push(h("div", { class: "pnl-titulo" }, h("h1", {}, s.titulo), s.intro ? h("p", {}, s.intro) : null));
    if (S.respaldo) cont.push(bandaRespaldo());
    const est = estadoCuenta();
    if (s.id !== "suscripcion") {
      if (est.prueba && est.tono !== "rojo") {
        cont.push(h("p", { class: "banda " + (est.tono === "ambar" ? "ambar" : "azul") }, est.texto + " ",
          h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => irA("suscripcion") }, "Ver los planes")));
      } else if (est.id !== "activa") {
        cont.push(h("p", { class: "banda " + (est.tono === "rojo" ? "rojo" : "ambar") }, est.texto + " ",
          h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => irA("suscripcion") }, est.prueba ? "Elegir un plan" : "Ver cómo pagar")));
      }
      if (enPausa()) {
        cont.push(h("p", { class: "banda ambar" }, "Esta página está en pausa: tu plan incluye una sola página. Con el plan Premium vuelve a estar en línea. ",
          h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => irA("suscripcion") }, "Ver los planes")));
      }
    }
    if (s.id === "hoy") cont.push(invitarApp(), resumenHoy());
    if (s.especial === "suscripcion") cont.push(...pintarSuscripcion());
    else if (s.especial === "paginas") cont.push(...pintarPaginas());
    else if (s.especial === "pedidos") cont.push(...pintarPedidos());
    else if (s.especial === "compartir") cont.push(...pintarCompartir());
    else s.hojas.forEach((hj) => cont.push(h("section", { class: "hoja" },
      hj.titulo ? h("div", { class: "hoja-cab" }, h("h2", {}, hj.titulo), hj.ayuda ? h("p", {}, hj.ayuda) : null) : null,
      S.editor.campos(hj.campos))));
    refs.editor.replaceChildren(...cont.filter(Boolean));
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
    if (ruta === "animaciones.baile") document.querySelectorAll(".mascotas").forEach((c) => c._repintar && c._repintar());
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
      S.nombre = nombre;
      await prepararTarjeta();
      const filas = await api.actualizar("eu_sitios", "id=eq." + S.sitio.id, { nombre, contenido });
      if (!filas || !filas.length) throw new Error("No se pudo guardar. Sal y vuelve a entrar.");
      S.sitio = Object.assign({}, S.sitio, filas[0]);
      const enLista = S.sitios.find((x) => x.id === S.sitio.id);
      if (enLista) Object.assign(enLista, { nombre: S.sitio.nombre, actualizado: S.sitio.actualizado });
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
    ponerMascota(S.borrador, S.P);
    S.nombre = S.sitio.nombre;
    refs.nombre.textContent = S.nombre;
    try { localStorage.removeItem(llaveBorrador()); } catch (_) { /* nada */ }
    pintarSeccion(); pintarBarra(); recargarVista(); enviarTema();
    EU.aviso("Cambios descartados.");
  }

  addEventListener("beforeunload", (e) => { if (S.borrador && (sucio() || S.subiendo)) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Tarjeta para WhatsApp ----------
     Se dibuja con el nombre, el logo, una foto y los colores, y se sube como JPG. La página pública
     la usa cuando alguien comparte el enlace. Solo se rehace cuando cambia algo de eso. */
  async function prepararTarjeta() {
    try {
      if (!EU.datosTarjeta) return;
      const d = EU.datosTarjeta({ nombre: S.nombre, plantilla: S.P, contenido: S.borrador });
      const firmaT = JSON.stringify(d);
      const actual = S.borrador.compartir || {};
      if (actual.imagen && actual.firma === firmaT) return;
      const blob = await Promise.race([EU.tarjetaJPG(d), new Promise((_, mal) => setTimeout(() => mal(new Error("lento")), 9000))]);
      const ruta = S.sitio.id + "/compartir-" + EU.idNuevo() + ".jpg";
      await api.subir("eu-media", ruta, blob);
      S.subidas.add(ruta);
      S.borrador.compartir = { imagen: api.urlPublica("eu-media", ruta), firma: firmaT };
    } catch (_) { /* sin tarjeta nueva: WhatsApp muestra la anterior o solo el texto */ }
  }
  // Las páginas que todavía no tienen tarjeta la reciben la primera vez que el dueño abre el panel
  async function tarjetaInicial() {
    if (!S.borrador || S.guardando || sucio() || S.respaldo || (S.borrador.compartir && S.borrador.compartir.imagen)) return;
    const previo = S.borrador.compartir;
    await prepararTarjeta();
    const nueva = S.borrador.compartir;
    if (!nueva || nueva === previo || S.guardando) return;
    S.borrador.compartir = previo;
    const limpio = !sucio();
    S.borrador.compartir = nueva;
    if (!limpio) { pintarBarra(); return; } // se guarda junto con los cambios que está haciendo
    try {
      const filas = await api.actualizar("eu_sitios", "id=eq." + S.sitio.id, { contenido: S.borrador });
      if (filas && filas[0]) { S.sitio = Object.assign({}, S.sitio, filas[0]); S.guardado = firma(); }
    } catch (_) { /* se intenta de nuevo al guardar */ }
    pintarBarra();
  }

  /* ---------- Mis pedidos ---------- */
  const cuantos = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);
  async function cargarResumen(forzar) {
    if (!forzar && S.resumen && Date.now() - S.resumenT < 60000) return S.resumen;
    try {
      S.resumen = await api.rpc("eu_resumen_pedidos", { p_sitio: S.sitio.id });
      S.resumenT = Date.now(); S.resumenError = "";
    } catch (err) {
      if (err.status === 401) { EU.aviso("Tu sesión venció. Vuelve a entrar.", true); }
      S.resumenError = err.message || "No se pudo cargar.";
    }
    return S.resumen;
  }
  function cifra(etiqueta, x, extra) {
    const n = Number(x && x.n) || 0;
    return h("div", { class: "cifra" },
      h("span", {}, etiqueta),
      h("b", {}, String(n)),
      h("small", {}, cuantos(n, "pedido", "pedidos").replace(/^\d+ /, "") + " · " + EU.usd(Number(x && x.total) || 0)),
      extra || null);
  }
  // Visitas: personas que abrieron la página (una por teléfono por día)
  function cifraVisitas(etiqueta, n, extra) {
    n = Number(n) || 0;
    return h("div", { class: "cifra" }, h("span", {}, etiqueta), h("b", {}, String(n)), h("small", {}, n === 1 ? "persona" : "personas"), extra || null);
  }
  // De cada 100 personas que entraron, cuántas pidieron (con menos de 10 visitas el número engaña)
  function deCada100(pedidos, visitas) {
    pedidos = Number(pedidos) || 0; visitas = Number(visitas) || 0;
    if (visitas < 10) return null;
    return Math.min(100, Math.round((pedidos / visitas) * 100));
  }
  function resumenHoy() {
    const caja = h("section", { class: "hoja resumen-hoy", hidden: true });
    cargarResumen().then((r) => {
      if (!r) return;
      caja.replaceChildren(
        h("div", { class: "hoja-fila" }, h("h2", {}, "Pedidos por tu página"),
          h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => irA("pedidos-recibidos") }, "Ver mis pedidos")),
        h("div", { class: "cifras tres" }, cifraVisitas("Visitas hoy", r.visitas && r.visitas.hoy), cifra("Pedidos hoy", r.hoy), cifra("Este mes", r.mes)));
      caja.hidden = false;
    });
    return caja;
  }
  function cuandoFue(iso) {
    const d = new Date(iso);
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(d);
    const hoy = EU.hoyISO();
    const ayer = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date(Date.now() - 86400000));
    const hora = d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", timeZone: "America/Caracas" });
    if (dia === hoy) return "Hoy, " + hora;
    if (dia === ayer) return "Ayer, " + hora;
    return EU.fechaHora(iso);
  }
  function pintarPedidos() {
    const cuerpo = h("div", { class: "pedidos-cuerpo" }, h("section", { class: "hoja" }, h("p", { class: "suave" }, h("span", { class: "punto-carga" }), "Cargando tus pedidos")));
    const actualizar = h("button", { class: "btn btn-sec btn-chico", type: "button" }, "Actualizar");
    actualizar.addEventListener("click", async () => { actualizar.disabled = true; await cargarResumen(true); actualizar.disabled = false; llenar(); });
    async function llenar() {
      const r = await cargarResumen();
      if (S.seccion !== "pedidos-recibidos") return;
      if (!r) {
        cuerpo.replaceChildren(h("section", { class: "hoja" }, h("p", { class: "banda rojo" }, "No pudimos cargar tus pedidos. " + (S.resumenError || "")),
          h("div", { class: "acciones" }, actualizar)));
        return;
      }
      const V = r.visitas || {};
      const notaVisitas = h("p", { class: "suave chico" }, "Cuenta una visita por teléfono y por día. Tus propias visitas desde el teléfono donde abres este panel no cuentan. Empezamos a contarlas el 25 de noviembre de 2026.");
      if (!Number(r.historico)) {
        cuerpo.replaceChildren(h("section", { class: "hoja vacio-pedidos" },
          Number(V.historico) ? h("div", { class: "cifras tres" }, cifraVisitas("Visitas hoy", V.hoy), cifraVisitas("Últimos 7 días", V.semana), cifraVisitas("Este mes", V.mes)) : null,
          h("h2", {}, Number(V.semana) ? cuantos(Number(V.semana), "persona vio", "personas vieron") + " tu página esta semana, pero todavía no te han llegado pedidos" : "Todavía no te han llegado pedidos por tu página"),
          h("p", { class: "suave" }, "Cuando un cliente mande su pedido a tu WhatsApp desde tu página, aquí ves cuántos pedidos tienes, cuánto suman y lo que más te piden."),
          h("p", { class: "suave" }, "Para que empiecen a llegar, pon tu enlace en tu Instagram y en tus estados de WhatsApp."),
          h("div", { class: "acciones" }, h("button", { class: "btn", type: "button", onclick: () => irA("compartir") }, "Compartir mi página"), actualizar)));
        return;
      }
      const mp = Number(r.mesPasado && r.mesPasado.n) || 0, mn = Number(r.mes && r.mes.n) || 0;
      const comparar = mp ? h("em", { class: mn >= mp ? "sube" : "baja" }, (mn >= mp ? "+" : "") + Math.round(((mn - mp) / mp) * 100) + "% que el mes pasado") : null;
      const partes = [];
      partes.push(h("section", { class: "hoja" },
        h("div", { class: "hoja-fila" }, h("h2", {}, "Resumen"), actualizar),
        h("div", { class: "cifras tres" }, cifra("Hoy", r.hoy), cifra("Últimos 7 días", r.semana), cifra("Este mes", r.mes, comparar))));

      // Visitas: cuánta gente entra y cuántos de ellos piden
      const tasa = deCada100(r.semana && r.semana.n, V.semana);
      partes.push(h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Visitas a tu página"), h("p", {}, "Personas que abrieron tu página.")),
        h("div", { class: "cifras tres" }, cifraVisitas("Hoy", V.hoy), cifraVisitas("Últimos 7 días", V.semana), cifraVisitas("Este mes", V.mes)),
        tasa != null
          ? h("p", { class: "banda verde" }, "Esta semana, de cada 100 personas que entraron, ", h("b", {}, String(tasa)), " te hicieron un pedido.")
          : null,
        notaVisitas));

      const dias = r.dias || [];
      const max = Math.max(1, ...dias.map((x) => Number(x.n) || 0));
      const hoy = EU.hoyISO();
      const nombreDia = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("es-VE", { weekday: "short", day: "numeric" });
      partes.push(h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Pedidos por día"), h("p", {}, "Las últimas dos semanas.")),
        h("div", { class: "barras", role: "img", "aria-label": "Pedidos por día: " + dias.map((x) => nombreDia(x.dia) + ", " + cuantos(Number(x.n) || 0, "pedido", "pedidos")).join("; ") },
          dias.map((x) => {
            const n = Number(x.n) || 0;
            return h("div", { class: "barra-dia" + (x.dia === hoy ? " hoy" : ""), title: nombreDia(x.dia) + ": " + cuantos(n, "pedido", "pedidos") + ", " + EU.usd(Number(x.total) || 0) + " · " + cuantos(Number(x.visitas) || 0, "visita", "visitas") },
              h("span", { class: "barra-n" }, n ? String(n) : ""),
              h("i", { style: "height:" + Math.max(n ? 6 : 2, Math.round((n / max) * 100)) + "%" }),
              h("small", {}, String(Number(x.dia.slice(8)))));
          }))));

      if (Number(V.historico)) {
        const maxV = Math.max(1, ...dias.map((x) => Number(x.visitas) || 0));
        partes.push(h("section", { class: "hoja" },
          h("div", { class: "hoja-cab" }, h("h2", {}, "Visitas por día"), h("p", {}, "Las últimas dos semanas.")),
          h("div", { class: "barras visitas", role: "img", "aria-label": "Visitas por día: " + dias.map((x) => nombreDia(x.dia) + ", " + cuantos(Number(x.visitas) || 0, "visita", "visitas")).join("; ") },
            dias.map((x) => {
              const n = Number(x.visitas) || 0;
              return h("div", { class: "barra-dia" + (x.dia === hoy ? " hoy" : ""), title: nombreDia(x.dia) + ": " + cuantos(n, "visita", "visitas") },
                h("span", { class: "barra-n" }, n ? String(n) : ""),
                h("i", { style: "height:" + Math.max(n ? 6 : 2, Math.round((n / maxV) * 100)) + "%" }),
                h("small", {}, String(Number(x.dia.slice(8)))));
            }))));
      }

      const top = r.top || [];
      if (top.length) {
        partes.push(h("section", { class: "hoja" },
          h("div", { class: "hoja-cab" }, h("h2", {}, "Lo que más te piden"), h("p", {}, "En los últimos 30 días.")),
          h("ol", { class: "top-lista" }, top.map((t) => h("li", {},
            h("span", { class: "top-nombre" }, t.nombre),
            h("b", {}, "× " + t.cantidad),
            h("span", { class: "suave" }, EU.usd(Number(t.total) || 0)))))));
      }
      const tipos = Object.entries(r.tipos || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      const totalTipos = tipos.reduce((s, [, n]) => s + n, 0);
      if (tipos.length > 1) {
        partes.push(h("section", { class: "hoja" },
          h("div", { class: "hoja-cab" }, h("h2", {}, "Cómo te piden"), h("p", {}, "En los últimos 30 días.")),
          h("div", { class: "chips" }, tipos.map(([t, n]) => h("span", { class: "chip" }, (t === "otro" ? "Sin indicar" : t) + " · " + Math.round((n / totalTipos) * 100) + "%")))));
      }
      partes.push(h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Últimos pedidos")),
        h("div", { class: "lista-pedidos" }, (r.ultimos || []).map((p) => h("div", { class: "pedido-fila" },
          h("div", { class: "pedido-txt" },
            h("b", {}, (p.items || []).map((it) => it.cantidad + " " + it.nombre).join(", ")),
            h("span", { class: "suave" }, [cuandoFue(p.creado), p.tipo, p.pago].filter(Boolean).join(" · "))),
          h("b", { class: "pedido-total" }, EU.usd(Number(p.total) || 0))))),
        h("p", { class: "suave chico" }, "Aquí cuentan los pedidos que tus clientes mandaron a tu WhatsApp desde tu página. Si alguno no terminó de enviarlo, igual aparece. Se guardan los productos y el total, no los datos del cliente.")));
      cuerpo.replaceChildren(...partes);
    }
    llenar();
    return [cuerpo];
  }

  /* ---------- Compartir ---------- */
  function pintarCompartir() {
    const enlace = enlacePagina();
    const d = EU.datosTarjeta({ nombre: S.nombre, plantilla: S.P, contenido: S.borrador });
    const out = [];

    const copiar = h("button", { class: "btn btn-sec", type: "button" }, "Copiar enlace");
    copiar.addEventListener("click", () => EU.copiar(enlace, copiar));
    const compartir = navigator.share ? h("button", { class: "btn", type: "button" }, "Compartir") : null;
    if (compartir) compartir.addEventListener("click", () => navigator.share({ title: S.nombre, text: (d.frase ? d.frase + " " : "") + "Haz tu pedido aquí:", url: enlace }).catch(() => { /* lo cerró */ }));
    out.push(h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Tu enlace"), h("p", {}, "Ponlo en la biografía de tu Instagram, en tus estados de WhatsApp y en tus publicaciones.")),
      h("p", { class: "enlace-caja" }, enlace.replace(/^https?:\/\//, "")),
      h("div", { class: "acciones" }, compartir, copiar, h("a", { class: "btn btn-sec", href: enlace, target: "_blank", rel: "noopener" }, "Abrir mi página"))));

    const imagen = h("div", { class: "wa-imagen" }, h("span", { class: "suave chico" }, "Preparando la vista"));
    EU.dibujarTarjeta(d).then((cv) => { cv.setAttribute("aria-hidden", "true"); imagen.replaceChildren(cv); }).catch(() => { imagen.hidden = true; });
    out.push(h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Así se ve en WhatsApp"), h("p", {}, "Cuando mandas tu enlace, sale esta tarjeta con tu nombre, tu logo, una foto y tus colores. Se actualiza cada vez que guardas.")),
      h("div", { class: "wa-chat" }, h("div", { class: "wa-burbuja" },
        imagen,
        h("div", { class: "wa-texto" }, h("b", {}, d.nombre || "Tu negocio"), h("span", {}, d.frase || "Haz tu pedido en línea y envíalo por WhatsApp."), h("small", {}, location.host)),
        h("p", { class: "wa-enlace" }, enlace))),
      sucio() ? h("p", { class: "banda ambar" }, "Tienes cambios sin guardar. Tus clientes ven la tarjeta nueva cuando guardas.") : null));

    const qr = EU.dibujarQR(enlace, { tam: 330, margen: 3 });
    qr.className = "qr-vista"; qr.setAttribute("role", "img"); qr.setAttribute("aria-label", "Código QR de tu página");
    const cartel = h("button", { class: "btn", type: "button" }, "Descargar cartel para imprimir");
    cartel.addEventListener("click", async () => {
      cartel.disabled = true; cartel.textContent = "Preparando";
      try { await EU.descargarCanvas(await EU.dibujarCartelQR(d, enlace), "cartel-qr-" + S.sitio.slug + ".png"); }
      catch (_) { EU.aviso("No se pudo preparar el cartel. Prueba de nuevo.", true); }
      cartel.disabled = false; cartel.textContent = "Descargar cartel para imprimir";
    });
    const soloQR = h("button", { class: "btn btn-sec", type: "button" }, "Descargar solo el código");
    soloQR.addEventListener("click", () => EU.descargarCanvas(EU.dibujarQR(enlace, { tam: 1200, margen: 4 }), "qr-" + S.sitio.slug + ".png"));
    out.push(h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Código QR"), h("p", {}, "Imprímelo y ponlo en tus mesas, el mostrador, tus bolsas o tus volantes. Al escanearlo con la cámara, abren tu página.")),
      h("div", { class: "qr-fila" }, qr, h("div", { class: "qr-botones" }, cartel, soloQR,
        h("p", { class: "suave chico" }, "El cartel trae tu nombre, tu logo y el código listo para imprimir en media hoja.")))));
    return out;
  }

  /* ---------- Mi suscripción ---------- */
  const textoPago = (p) => {
    const n = Number(p.meses) || 1;
    const tiempo = p.ciclo === "anual" || n === 12 ? "1 año" : n + (n === 1 ? " mes" : " meses");
    return (p.plan ? "Plan " + (EU.planes.nombres[p.plan] || p.plan) + ", " : "") + tiempo;
  };
  const montoPago = (p) => (p.moneda === "VES" ? "Bs " + EU.fmtBs.format(p.monto) : EU.usd(p.monto));

  // Los dos planes, por mes o por año. Al elegir uno se llena el reporte de pago con ese plan.
  function hojaPlanes() {
    const pl = S.planes, actual = plan(), cicloActual = ciclo();
    let ver = (S.pago && S.pago.ciclo) || (actual !== "prueba" ? cicloActual : "mensual");
    const rejilla = h("div", { class: "planes" });
    const seg = h("div", { class: "segmento", role: "group", "aria-label": "Cada cuánto pagas" },
      ["mensual", "anual"].map((c) => h("button", { type: "button", "data-c": c, onclick: () => { ver = c; pintar(); } }, c === "mensual" ? "Mes a mes" : "Un año")));
    function pintar() {
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === ver)));
      rejilla.replaceChildren(...EU.planes.lista(pl).map((x) => {
        const precio = EU.planes.precio(pl, x.id, ver);
        const ahorro = EU.planes.ahorro(pl, x.id);
        const esActual = actual === x.id && cicloActual === ver;
        const bloqueado = x.id === "basico" && premiumEnUso().length > 0;
        return h("article", { class: "plan" + (x.id === "premium" ? " plan-premium" : "") + (actual === x.id ? " plan-actual" : "") },
          h("div", { class: "plan-cab" }, h("h3", {}, x.nombre), actual === x.id ? h("span", { class: "sello azul" }, "Tu plan") : null),
          h("p", { class: "plan-precio" }, EU.planes.dinero(precio), h("small", {}, ver === "anual" ? " al año" : " al mes")),
          h("p", { class: "plan-nota" }, ver === "anual"
            ? (ahorro > 0 ? "Ahorras " + EU.planes.dinero(ahorro) + " frente a pagar mes a mes." : "Un solo pago por los 12 meses.")
            : (ahorro > 0 ? "O " + EU.planes.dinero(EU.planes.precio(pl, x.id, "anual")) + " si pagas el año." : "Pagas cada mes.")),
          h("ul", { class: "plan-puntos" }, x.puntos.map((t) => h("li", {}, t))),
          bloqueado ? h("p", { class: "banda ambar" }, "Tu página usa la plantilla " + nombresPremium() + ", que es del plan Premium. Si prefieres el Básico, escríbenos y te la cambiamos por otra plantilla sin perder tus datos.") : null,
          h("button", { class: "btn " + (x.id === "premium" ? "" : "btn-sec"), type: "button", disabled: bloqueado, onclick: () => elegirPlan(x.id, ver) },
            esActual ? "Renovar este plan" : actual === "prueba" ? "Quiero el " + x.nombre : "Pagar el " + x.nombre));
      }));
    }
    pintar();
    return h("section", { class: "hoja" },
      h("div", { class: "hoja-fila" },
        h("div", { class: "hoja-cab" }, h("h2", {}, actual === "prueba" ? "Elige tu plan" : "Planes"),
          h("p", {}, actual === "prueba" ? "Tu página sigue igual, con todo lo que ya cargaste." : "Puedes cambiar de plan cuando pagues tu próximo periodo.")),
        seg),
      rejilla);
  }
  function elegirPlan(planId, cicloId) {
    S.pago = { plan: planId, ciclo: cicloId };
    pintarSeccion();
    const f = document.getElementById("reportar-pago");
    if (f) f.scrollIntoView({ block: "start", behavior: EU.reducido ? "auto" : "smooth" });
  }

  function pintarSuscripcion() {
    const est = estadoCuenta();
    const pl = S.planes, actual = plan(), cicloActual = ciclo();
    const pendientes = S.pagos.filter((p) => p.estado === "pendiente");
    const out = [];
    const vence = S.cuenta && S.cuenta.vence;

    out.push(h("section", { class: "hoja talon" },
      h("div", { class: "talon-fila" },
        h("div", {}, h("p", { class: "suave" }, "Tu plan"),
          h("p", { class: "talon-monto" }, EU.planes.nombres[actual] || "Básico"),
          actual === "prueba" ? null : h("p", { class: "talon-precio" }, EU.planes.dinero(EU.planes.precio(pl, actual, cicloActual)) + (cicloActual === "anual" ? " al año" : " al mes"))),
        h("span", { class: "sello grande " + est.tono }, est.sello)),
      h("p", {}, est.texto),
      vence ? h("p", { class: "suave" }, (actual === "prueba" ? "La prueba termina el " : "Fecha de corte: ") + EU.fecha(vence, true) + ".") : null,
      actual === "prueba" && premiumEnUso().length ? h("p", { class: "banda azul" }, "Estás probando la plantilla " + nombresPremium() + ", del plan Premium. Al terminar la prueba, elige el Premium para seguir con ella.") : null,
      pendientes.length ? h("p", { class: "banda ambar" }, pendientes.length === 1 ? "Tienes un pago en revisión. Cuando lo aprobemos, tu plan se actualiza solo." : "Tienes " + pendientes.length + " pagos en revisión.") : null,
      h("p", { class: "suave chico" }, S.sitios.length > 1 ? "Tu cuenta tiene " + S.sitios.length + " páginas. " : "Tu página: ",
        S.sitios.length > 1 ? h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => irA("paginas") }, "Ver mis páginas")
          : h("a", { href: enlacePagina(S.principal), target: "_blank", rel: "noopener" }, enlacePagina(S.principal).replace(/^https?:\/\//, "")))));

    out.push(hojaPlanes());

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
      WA_EU ? h("a", { class: "btn btn-sec", href: waEU("Hola, quiero pagar la suscripción de mi página " + S.principal.slug + "."), target: "_blank", rel: "noopener" }, "Escribir a " + marca() + " por WhatsApp") : null));

    out.push(formularioPago(pendientes.length));

    out.push(h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Pagos que has reportado")),
      S.pagos.length ? h("div", {}, S.pagos.map((p) => {
        const sello = { pendiente: ["En revisión", "ambar"], aprobado: ["Pagado", "verde"], rechazado: ["Rechazado", "rojo"] }[p.estado] || [p.estado, "gris"];
        return h("div", { class: "recibo" },
          h("div", {}, h("b", {}, montoPago(p) + " por " + textoPago(p)),
            h("p", { class: "suave" }, [p.metodo, p.referencia ? "Ref. " + p.referencia : "", EU.fechaHora(p.creado)].filter(Boolean).join(", "))),
          h("span", { class: "sello " + sello[1] }, sello[0]),
          p.estado === "rechazado" && p.respuesta ? h("p", { class: "respuesta" }, "Motivo: " + p.respuesta) : null);
      })) : h("p", { class: "suave" }, "Todavía no has reportado pagos.")));

    out.push(hojaIdioma());
    out.push(formularioClave());
    out.push(hojaApp());
    return out;
  }

  /* ---------- Idioma del panel ----------
     Se guarda en la cuenta (eu_cuentas.idioma) para abrir el panel en ese idioma desde cualquier
     teléfono, y para que Tiendo vea en su panel qué idioma habla cada cliente. */
  async function guardarIdioma(nuevo) {
    try { await api.rpc("eu_poner_idioma", { p_sitio: S.principal.id, p_idioma: nuevo }); if (S.cuenta) S.cuenta.idioma = nuevo; return true; }
    catch (_) { return false; }
  }
  function hojaIdioma() {
    if (!EU.selectorIdiomas) return null;
    return h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Idioma del panel"),
        h("p", {}, "Tu panel sale en este idioma en cualquier teléfono donde entres. Tu página se ve en el idioma de cada cliente.")),
      EU.selectorIdiomas({ alCambiar: async (nuevo) => {
        if (sucio() && !confirm(EU.t ? EU.t("Tienes cambios sin guardar. ¿Salir de todas formas?") : "Tienes cambios sin guardar. ¿Salir de todas formas?")) return pintarPanel();
        await guardarIdioma(nuevo);
        EU.idiomaCambiar(nuevo);
      } }));
  }

  function formularioPago(pendientes) {
    const pl = S.planes, actual = plan();
    const metodos = (S.ajustes.pagos || []).filter((m) => m && m.metodo).map((m) => m.metodo);
    const pre = S.pago || {};
    const d = {
      plan: premiumEnUso().length ? "premium" : pre.plan || (actual === "premium" ? "premium" : "basico"), ciclo: pre.ciclo || (actual === "prueba" ? "mensual" : ciclo()),
      meses: "1", monto: 0, moneda: "USD", metodo: metodos[0] || "", referencia: "", nota: "",
    };
    const total = () => Math.round((d.ciclo === "anual" ? EU.planes.precio(pl, d.plan, "anual") : EU.planes.precio(pl, d.plan, "mensual") * (Number(d.meses) || 1)) * 100) / 100;
    d.monto = total();
    const resumen = h("p", { class: "banda azul", "aria-live": "polite" });
    const baja = h("p", { class: "banda ambar", hidden: true }, "Con el plan Básico queda en línea solo tu página principal. Las demás se pausan, sin borrarse, hasta que vuelvas a Premium.");
    const defMonto = { tipo: "dinero", ruta: "monto", etiqueta: "Monto que pagaste", ayuda: "Si pagaste en bolívares, escribe el monto en bolívares y elige Bolívares abajo." };
    const pintarResumen = () => {
      const tiempo = d.ciclo === "anual" ? "1 año" : d.meses + (String(d.meses) === "1" ? " mes" : " meses");
      resumen.textContent = "Plan " + EU.planes.nombres[d.plan] + " por " + tiempo + ": " + EU.planes.dinero(total()) + ".";
      baja.hidden = !(d.plan === "basico" && S.sitios.length > 1);
    };
    const ed = EU.crearEditor({ raiz: () => d, alCambiar: (def) => {
      if (["plan", "ciclo", "meses"].includes(def.ruta)) {
        d.monto = total(); d.moneda = "USD";
        montoCampo.replaceWith(montoCampo = ed.campo(defMonto));
        monedaCampo.replaceWith(monedaCampo = ed.campo(defMoneda));
        pintarResumen();
      }
    } });
    const defMoneda = { tipo: "selector", ruta: "moneda", etiqueta: "Moneda", opciones: [{ id: "USD", nombre: "Dólares" }, { id: "VES", nombre: "Bolívares" }] };
    let montoCampo = ed.campo(defMonto);
    let monedaCampo = ed.campo(defMoneda);
    pintarResumen();
    const archivo = h("input", { type: "file", accept: "image/*,application/pdf", id: "comprobante" });
    const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
    const boton = h("button", { class: "btn", type: "submit" }, "Enviar reporte de pago");
    const form = h("form", { class: "hoja", id: "reportar-pago", novalidate: true },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Reportar un pago"), h("p", {}, marca() + " lo revisa y tu fecha de corte se corre sola.")),
      pendientes >= 5 ? h("p", { class: "banda ambar" }, "Tienes 5 pagos esperando revisión. Espera a que los revisemos para reportar otro.") : null,
      h("div", { class: "campos" },
        ed.campo({ tipo: "selector", ruta: "plan", etiqueta: "Plan que pagas", opciones: premiumEnUso().length ? [{ id: "premium", nombre: "Premium" }] : [{ id: "basico", nombre: "Básico" }, { id: "premium", nombre: "Premium" }],
          ayuda: premiumEnUso().length ? "Tu página usa la plantilla " + nombresPremium() + ", que es del plan Premium." : "" }),
        ed.campo({ tipo: "selector", ruta: "ciclo", etiqueta: "Cada cuánto pagas", opciones: [{ id: "mensual", nombre: "Mes a mes" }, { id: "anual", nombre: "Un año" }] }),
        ed.campo({ tipo: "selector", ruta: "meses", etiqueta: "Meses que pagas", lista: true, si: { ruta: "ciclo", igual: "mensual" }, opciones: Array.from({ length: 11 }, (_, i) => ({ id: String(i + 1), nombre: i + 1 + (i ? " meses" : " mes") })) }),
        resumen, baja,
        montoCampo, monedaCampo,
        metodos.length ? ed.campo({ tipo: "selector", ruta: "metodo", etiqueta: "Cómo pagaste", lista: true, opciones: [...metodos, "Otro"] }) : ed.campo({ tipo: "texto", ruta: "metodo", etiqueta: "Cómo pagaste", max: 40, requerido: true }),
        ed.campo({ tipo: "texto", ruta: "referencia", etiqueta: "Número de referencia", max: 80, placeholder: "Ej: 004512" }),
        h("div", { class: "campo" }, h("label", { for: "comprobante" }, "Captura o comprobante"), archivo, h("p", { class: "ayuda" }, "Foto o PDF. Opcional si pusiste la referencia.")),
        ed.campo({ tipo: "area", ruta: "nota", etiqueta: "Nota (opcional)", max: 300, filas: 2 })),
      error, boton);
    if (pendientes >= 5) boton.disabled = true;
    form.addEventListener("change", () => { error.hidden = true; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      const f = archivo.files && archivo.files[0];
      const falta = !(d.monto > 0) ? "Escribe el monto que pagaste." : !String(d.metodo).trim() ? "Elige cómo pagaste." : !d.referencia.trim() && !f ? "Escribe la referencia o sube la captura del pago." : "";
      if (falta) { error.textContent = falta; error.hidden = false; return; }
      boton.disabled = true; boton.textContent = "Enviando";
      try {
        const cuenta = S.principal.id; // los pagos son de la cuenta, no de cada página
        let comprobante = null;
        if (f) {
          if (f.size > 12 * 1024 * 1024) throw new Error("El comprobante pesa demasiado.");
          const blob = /^image\//.test(f.type) ? await EU.comprimirImagen(f, { max: 1600, calidad: 0.8 }) : f;
          if (blob.size > 4 * 1024 * 1024) throw new Error("El comprobante pesa más de 4 MB. Prueba con una captura.");
          comprobante = cuenta + "/" + EU.idNuevo() + "." + EU.extension(blob);
          await api.subir("eu-pagos", comprobante, blob);
        }
        const fila = { sitio_id: cuenta, monto: d.monto, moneda: d.moneda, metodo: String(d.metodo).slice(0, 40), referencia: d.referencia.trim() || null,
          meses: d.ciclo === "anual" ? 12 : Number(d.meses) || 1, plan: d.plan, ciclo: d.ciclo, nota: d.nota.trim() || null, comprobante, creado_por: api.sesion.uid };
        const r = await api.insertar("eu_pagos", fila);
        const nuevo = (r && r[0]) || Object.assign({ estado: "pendiente", creado: new Date().toISOString() }, fila);
        S.pagos.unshift(nuevo);
        S.pago = null;
        // Aviso al teléfono de Tiendo. Si no sale, el pago igual queda en su lista de pendientes.
        if (C.avisos && nuevo.id) api.funcion("eu-avisos", { accion: "pago", pago: nuevo.id }).catch(() => { /* sin aviso */ });
        pintarSeccion();
        pagoEnviado(nuevo);
      } catch (err) {
        error.textContent = err.message || "No se pudo enviar el pago."; error.hidden = false;
        boton.disabled = false; boton.textContent = "Enviar reporte de pago";
      }
    });
    return form;
  }

  // Confirmación del reporte, con la opción de avisar también por WhatsApp
  function pagoEnviado(p) {
    const texto = "Hola, soy de " + S.principal.nombre + " (" + S.principal.slug + "). Acabo de reportar en mi panel un pago de " + montoPago(p) + " por " + p.metodo +
      (p.referencia ? ", referencia " + p.referencia : "") + ": " + textoPago(p) + ".";
    EU.modal({
      titulo: "Recibimos tu reporte de pago",
      construir(m) {
        m.cuerpo.append(
          h("p", {}, "Tu pago ya está en la lista de " + marca() + ". Cuando lo revisen, tu plan y tu fecha de corte se actualizan solos."),
          h("p", { class: "suave" }, "Si tienes apuro, escríbeles también por WhatsApp con los datos del pago ya escritos."));
        m.pie.append(
          h("button", { class: "btn btn-sec", type: "button", onclick: m.cerrar }, "Cerrar"),
          h("a", { class: "btn", href: waEU(texto), target: "_blank", rel: "noopener", onclick: m.cerrar }, "Avisar por WhatsApp"));
      },
    });
  }

  /* ---------- Mis páginas ----------
     Con Premium la cuenta puede tener varias páginas, cada una con su enlace y su plantilla,
     y cambiarle la plantilla a cualquiera. El menú de la plantilla anterior queda guardado. */
  function tarjetasPlantilla(elegida, alElegir) {
    const caja = h("div", { class: "plantillas-op", role: "group", "aria-label": "Plantilla" });
    PLANTILLAS().forEach((P) => {
      const b = h("button", { class: "plantilla-op", type: "button", "aria-pressed": String(P.id === elegida) },
        h("img", { src: P.vistaPrevia, alt: "", loading: "lazy" }),
        h("span", {}, h("b", {}, P.nombre, pildoraPremium(P)), h("small", {}, P.ideal || P.rubro)));
      b.addEventListener("click", () => {
        caja.querySelectorAll(".plantilla-op").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        alElegir(P);
      });
      caja.append(b);
    });
    return caja;
  }
  function detallePlantilla(P) {
    if (!P) return h("p", { class: "suave" }, "Elige una plantilla para ver lo que trae.");
    return h("div", { class: "plantilla-detalle" },
      h("p", {}, P.descripcion),
      h("ul", { class: "plan-puntos" }, (P.puntos || []).map((t) => h("li", {}, t))),
      h("div", {}, h("a", { class: "btn btn-sec btn-chico", href: "/t/" + P.id + "/", target: "_blank", rel: "noopener" }, "Abrir la demo")));
  }

  function pintarPaginas() {
    const premium = plan() === "premium";
    const max = S.planes.maxPaginas;
    const activa = S.principal.estado === "activo";
    const out = [];
    const filas = S.sitios.map((s) => {
      const P = (window.EU_PLANTILLAS || {})[s.plantilla] || { nombre: s.plantilla, vistaPrevia: "" };
      const esta = s.id === S.sitio.id;
      const enlace = enlacePagina(s);
      return h("article", { class: "pagina" + (esta ? " pagina-actual" : "") },
        h("img", { src: P.vistaPrevia, alt: "", loading: "lazy" }),
        h("div", { class: "pagina-txt" },
          h("h3", {}, esta ? S.nombre : s.nombre),
          h("p", { class: "suave" }, "Plantilla " + P.nombre + (s.principal ? "" : ". Página principal"), pildoraPremium(P)),
          h("a", { class: "pagina-enlace", href: enlace, target: "_blank", rel: "noopener" }, enlace.replace(/^https?:\/\//, "")),
          s.estado !== "activo" ? h("p", {}, h("span", { class: "sello ambar" }, "En pausa")) : null),
        h("div", { class: "acciones" },
          esta ? h("span", { class: "chip", "aria-current": "true" }, "La estás editando") : h("button", { class: "btn btn-chico", type: "button", onclick: () => cambiarPagina(s.slug) }, "Editar esta página"),
          premium && activa ? h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => cambiarPlantilla(s) }, "Cambiar plantilla") : null,
          s.principal ? h("button", { class: "btn btn-peligro btn-chico", type: "button", onclick: () => borrarPagina(s) }, "Borrar") : null));
    });
    out.push(h("section", { class: "hoja" },
      h("div", { class: "hoja-fila" },
        h("div", { class: "hoja-cab" }, h("h2", {}, S.sitios.length === 1 ? "Tu página" : "Tus páginas"),
          premium ? h("p", {}, "Usas " + S.sitios.length + " de " + max + ".") : null),
        premium && activa && S.sitios.length < max ? h("button", { class: "btn", type: "button", onclick: nuevaPagina }, "Crear otra página") : null),
      h("div", { class: "paginas" }, filas)));

    if (!premium) {
      out.push(h("section", { class: "hoja" },
        h("div", { class: "hoja-cab" }, h("h2", {}, "Con Premium tienes más de una"),
          h("p", {}, "Para una segunda sucursal, otro negocio o una línea de productos aparte.")),
        h("ul", { class: "plan-puntos" },
          h("li", {}, "Hasta " + max + " páginas en la misma cuenta, cada una con su enlace y su código QR"),
          h("li", {}, "Cada página con la plantilla que quieras, también las Premium como Delicias"),
          h("li", {}, "Cambias de plantilla cuando quieras y tu menú anterior queda guardado")),
        h("div", { class: "acciones" },
          h("button", { class: "btn", type: "button", onclick: () => elegirPlanDesdePaginas() }, "Ver el plan Premium"),
          h("span", { class: "suave" }, EU.planes.dinero(EU.planes.precio(S.planes, "premium", "mensual")) + " al mes o " + EU.planes.dinero(EU.planes.precio(S.planes, "premium", "anual")) + " al año"))));
      if (plan() === "basico") {
        out.push(h("p", { class: "suave chico" }, "¿Quieres otra plantilla para tu página sin cambiar de plan? ",
          WA_EU ? h("a", { href: waEU("Hola, quiero cambiar la plantilla de mi página " + S.principal.slug + "."), target: "_blank", rel: "noopener" }, "Escríbenos y te la cambiamos") : "Escríbenos y te la cambiamos", "."));
      }
    }
    return out;
  }
  function elegirPlanDesdePaginas() { S.pago = { plan: "premium", ciclo: "mensual" }; irA("suscripcion"); }

  function nuevaPagina() {
    const d = { nombre: "", slug: "", plantilla: "" };
    let tocado = false;
    EU.modal({
      titulo: "Crear otra página", ancho: true,
      construir(m) {
        const nombre = h("input", { class: "entrada", type: "text", id: "np-nombre", maxlength: 80, placeholder: "Ej: " + S.principal.nombre + " Centro" });
        const slug = h("input", { class: "entrada", type: "text", id: "np-slug", maxlength: 40, autocapitalize: "none", spellcheck: false });
        const enlace = h("p", { class: "ayuda" });
        const detalle = h("div", {}, detallePlantilla(null));
        const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
        const pintarEnlace = () => { enlace.textContent = "Su enlace será " + location.host + "/?n=" + (d.slug || "nombre-de-la-pagina"); };
        nombre.addEventListener("input", () => { d.nombre = nombre.value; if (!tocado) { d.slug = EU.slug(nombre.value); slug.value = d.slug; pintarEnlace(); } error.hidden = true; });
        slug.addEventListener("input", () => { tocado = true; d.slug = EU.slug(slug.value); pintarEnlace(); error.hidden = true; });
        slug.addEventListener("blur", () => { slug.value = d.slug; });
        pintarEnlace();
        m.cuerpo.append(
          h("div", { class: "campos" },
            h("div", { class: "campo" }, h("label", { for: "np-nombre" }, "Nombre de la página"), nombre),
            h("div", { class: "campo" }, h("label", { for: "np-slug" }, "Enlace"), slug, enlace)),
          h("div", { class: "campo" }, h("p", { class: "etq" }, "Plantilla"), tarjetasPlantilla("", (P) => { d.plantilla = P.id; detalle.replaceChildren(detallePlantilla(P)); error.hidden = true; }), detalle),
          h("p", { class: "suave chico" }, "La página nueva arranca con el contacto, la tasa y las formas de pago de tu página principal, y con el menú de muestra de la plantilla."),
          error);
        const ok = h("button", { class: "btn", type: "button" }, "Crear página");
        ok.addEventListener("click", async () => {
          const falta = d.nombre.trim().length < 2 ? "Escribe el nombre de la página." : !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(d.slug) ? "El enlace lleva de 3 a 40 letras minúsculas, números o guiones." : !d.plantilla ? "Elige una plantilla." : "";
          if (falta) { error.textContent = falta; error.hidden = false; return; }
          ok.disabled = true; ok.textContent = "Creando";
          try {
            await api.rpc("eu_crear_pagina", { p_usuario: d.slug, p_nombre: d.nombre.trim(), p_plantilla: d.plantilla });
            m.cerrar();
            if (sucio() || S.subiendo) {
              // hay cambios sin guardar en la página abierta: se queda ahí y la nueva aparece en la lista
              const lista = await api.select("eu_sitios", "select=id,slug,nombre,plantilla,estado,actualizado,dominio,principal,creado&dueno=eq." + api.sesion.uid + "&order=creado.asc").catch(() => null);
              if (lista && lista.length) S.sitios = lista;
              pintarPanelLigero();
              EU.aviso("Página creada. Guarda tus cambios y ábrela desde Mis páginas.");
            } else {
              EU.aviso("Página creada. Ya la puedes editar.");
              S.borrador = null; S.seccion = "hoy";
              cargar(d.slug);
            }
          } catch (err) { error.textContent = err.message || "No se pudo crear la página."; error.hidden = false; ok.disabled = false; ok.textContent = "Crear página"; }
        });
        m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: m.cerrar }, "Cancelar"), ok);
      },
    });
  }

  function cambiarPlantilla(s) {
    const esta = s.id === S.sitio.id;
    if (esta && (sucio() || S.subiendo)) { EU.aviso("Guarda o descarta tus cambios antes de cambiar la plantilla.", true); return; }
    let elegida = s.plantilla;
    EU.modal({
      titulo: "Cambiar la plantilla de " + (esta ? S.nombre : s.nombre), ancho: true,
      construir(m) {
        const detalle = h("div", {}, detallePlantilla((window.EU_PLANTILLAS || {})[elegida]));
        const ok = h("button", { class: "btn", type: "button", disabled: true }, "Cambiar plantilla");
        m.cuerpo.append(
          h("p", { class: "banda azul" }, "Se conservan el nombre, el contacto, la dirección, el horario, las formas de pago y la tasa. El menú y los colores pasan a ser los de la plantilla nueva; los de ahora quedan guardados por si vuelves a esta plantilla."),
          tarjetasPlantilla(elegida, (P) => { elegida = P.id; detalle.replaceChildren(detallePlantilla(P)); ok.disabled = elegida === s.plantilla; }),
          detalle);
        ok.addEventListener("click", async () => {
          ok.disabled = true; ok.textContent = "Cambiando";
          try {
            await api.rpc("eu_cambiar_plantilla", { p_sitio: s.id, p_plantilla: elegida });
            try { localStorage.removeItem("eu:borrador:" + s.id); } catch (_) { /* nada */ }
            m.cerrar();
            EU.aviso("Plantilla cambiada a " + ((window.EU_PLANTILLAS || {})[elegida] || { nombre: elegida }).nombre + ".");
            if (!esta && (sucio() || S.subiendo)) {
              const x = S.sitios.find((y) => y.id === s.id);
              if (x) x.plantilla = elegida;
              pintarPanelLigero();
            } else {
              S.borrador = null; S.seccion = esta ? "hoy" : "paginas";
              cargar(S.sitio.slug);
            }
          } catch (err) { EU.aviso(err.message || "No se pudo cambiar la plantilla.", true); ok.disabled = false; ok.textContent = "Cambiar plantilla"; }
        });
        m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: m.cerrar }, "Cancelar"), ok);
      },
    });
  }

  function borrarPagina(s) {
    EU.modal({
      titulo: "Borrar " + s.nombre,
      construir(m) {
        const ok = h("button", { class: "btn btn-peligro lleno", type: "button" }, "Borrar " + s.nombre);
        m.cuerpo.append(
          h("p", { class: "banda rojo" }, "Se borran esta página, su menú, sus fotos y sus pedidos. Su enlace deja de funcionar. No se puede deshacer."),
          h("p", { class: "suave" }, "Tus otras páginas y tu suscripción quedan igual."));
        ok.addEventListener("click", async () => {
          ok.disabled = true; ok.textContent = "Borrando";
          try {
            try {
              const archivos = await api.listar("eu-media", s.id);
              const rutas = (archivos || []).filter((a) => a && a.name && a.id !== null).map((a) => s.id + "/" + a.name);
              if (rutas.length) await api.borrarArchivos("eu-media", rutas);
            } catch (_) { /* si fallan las fotos, igual se borra la página */ }
            await api.rpc("eu_borrar_pagina", { p_sitio: s.id });
            try { localStorage.removeItem("eu:borrador:" + s.id); } catch (_) { /* nada */ }
            m.cerrar();
            EU.aviso("Página borrada.");
            const sigue = s.id === S.sitio.id ? S.principal.slug : S.sitio.slug;
            if (s.id === S.sitio.id) S.borrador = null;
            S.seccion = "paginas";
            if (s.id !== S.sitio.id && sucio()) { S.sitios = S.sitios.filter((x) => x.id !== s.id); pintarPanelLigero(); }
            else cargar(sigue);
          } catch (err) { EU.aviso(err.message || "No se pudo borrar la página.", true); ok.disabled = false; ok.textContent = "Borrar " + s.nombre; }
        });
        m.pie.append(h("button", { class: "btn btn-sec", type: "button", onclick: m.cerrar }, "Cancelar"), ok);
      },
    });
  }
  // Repinta la navegación y la sección sin recargar la página que se está editando (para no perder cambios sin guardar)
  function pintarPanelLigero() { pintarNav(); pintarSeccion(); }

  /* ---------- Bienvenida e instalación ---------- */
  function bienvenida() {
    const enlace = enlacePagina(S.principal);
    EU.modal({
      titulo: "Tu página ya está en línea",
      construir(m) {
        m.cuerpo.append(
          h("p", {}, "Ya tiene su enlace y un menú de muestra para que veas cómo queda. Ahora ponle lo tuyo:"),
          h("ol", { class: "pasos-app" },
            h("li", {}, "Cambia el menú de muestra por tus productos, con tus precios y tus fotos."),
            h("li", {}, "Pon la tasa del día para que tus clientes vean los precios en bolívares."),
            h("li", {}, "Comparte tu enlace y tu código QR desde la sección Compartir.")),
          h("p", { class: "enlace-caja" }, enlace.replace(/^https?:\/\//, "")),
          h("p", { class: "suave" }, estadoCuenta().texto + " No te pedimos tarjeta: al final eliges un plan o tu página se pausa."));
        m.pie.append(
          h("a", { class: "btn btn-sec", href: enlace, target: "_blank", rel: "noopener" }, "Ver mi página"),
          h("button", { class: "btn", type: "button", onclick: m.cerrar }, "Empezar a editar"));
      },
    });
  }
  // Invitación a instalar el panel como app, hasta que se instale o se descarte
  function invitarApp() {
    if (!EU.app || EU.app.instalada) return null;
    try { if (localStorage.getItem("eu:app:luego")) return null; } catch (_) { return null; }
    const caja = h("section", { class: "hoja app-invita" },
      h("img", { src: "/img/icono-192.png", alt: "", width: 52, height: 52 }),
      h("div", { class: "hoja-cab" }, h("h2", {}, "Ten tu panel a un toque"), h("p", {}, "Instálalo como app en tu teléfono: abre directo en tu página, sin buscar el enlace.")),
      h("div", { class: "acciones" },
        h("button", { class: "btn btn-chico", type: "button", onclick: () => EU.app.abrir() }, "Instalar la app"),
        h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => { try { localStorage.setItem("eu:app:luego", "1"); } catch (_) { /* nada */ } caja.remove(); } }, "Ahora no")));
    return caja;
  }
  function hojaApp() {
    if (!EU.app) return null;
    return h("section", { class: "hoja" },
      h("div", { class: "hoja-cab" }, h("h2", {}, "La app de tu panel"),
        h("p", {}, EU.app.instalada ? "Ya la estás usando." : "Instala tu panel en el teléfono o en la computadora para entrar con un toque.")),
      EU.app.instalada ? null : h("div", {}, h("button", { class: "btn btn-sec", type: "button", onclick: () => EU.app.abrir() }, "Instalar la app")));
  }

  function formularioClave() {
    const a = h("input", { class: "entrada", type: "password", id: "clave-nueva", autocomplete: "new-password", minlength: 8 });
    const b = h("input", { class: "entrada", type: "password", id: "clave-repite", autocomplete: "new-password", minlength: 8 });
    const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
    const boton = h("button", { class: "btn btn-sec", type: "submit" }, "Cambiar contraseña");
    const form = h("form", { class: "hoja", novalidate: true },
      h("div", { class: "hoja-cab" }, h("h2", {}, "Tu contraseña"), h("p", {}, "Tu usuario es " + S.principal.slug + ". La contraseña debe tener al menos 8 letras o números.")),
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
  // Los accesos directos de la app instalada abren una sección: /panel/#suscripcion
  const inicio = location.hash.slice(1);
  if (["pedidos-recibidos", "suscripcion", "paginas", "compartir"].includes(inicio)) S.seccion = inicio;
  if (api.conectado) cargar(); else pantallaEntrada();
  // Desde la portada: /panel/?instalar=1 abre de una vez la ventana para instalar la app
  if (params.get("instalar") && EU.app) { quitarParametro("instalar"); setTimeout(() => EU.app.abrir(), 600); }
})();
