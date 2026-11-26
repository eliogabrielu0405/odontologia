/* Registro con prueba gratis: el dueño del negocio elige una plantilla, pone sus datos y su página
   queda en línea. Al terminar entra directo a su panel. */
(function () {
  "use strict";
  const C = window.EU_CONFIG;
  const EU = window.EU;
  const h = EU.h;
  const api = EU.crearApi({ llave: "eu:panel", almacen: "local" });
  const app = document.getElementById("app");
  const ORDEN = ["pizzeria", "arepera", "burgers", "sushi", "boutique"];
  const PL = window.EU_PLANTILLAS || {};
  const params = new URLSearchParams(location.search);
  const WA = EU.soloNumeros(C.whatsappMarca);
  const waEU = (texto) => "https://wa.me/" + WA + "?text=" + encodeURIComponent(texto);
  let planes = EU.planes.leer();
  // Si viene de "Mira tu negocio aquí" en la portada, el nombre llega ya escrito
  const nombreTraido = String(params.get("nombre") || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  const d = { plantilla: ORDEN.includes(params.get("plantilla")) ? params.get("plantilla") : "", nombre: nombreTraido, usuario: EU.slug(nombreTraido), whatsapp: "", contacto: "", clave: "" };
  let usuarioTocado = false;
  // Al cambiar de idioma la página se vuelve a abrir: lo que ya escribió se guarda un momento
  // en esta pestaña (sin la contraseña) y se recupera.
  const BORRADOR = "eu:registro-borrador";
  try {
    const b = JSON.parse(sessionStorage.getItem(BORRADOR) || "null");
    sessionStorage.removeItem(BORRADOR);
    if (b) {
      ["plantilla", "nombre", "usuario", "whatsapp", "contacto"].forEach((k) => { if (typeof b[k] === "string" && b[k]) d[k] = b[k]; });
      if (b.usuarioTocado) usuarioTocado = true;
    }
  } catch (_) { /* sin almacenamiento */ }
  const cambiarIdioma = (nuevo) => {
    try { sessionStorage.setItem(BORRADOR, JSON.stringify({ plantilla: d.plantilla, nombre: d.nombre, usuario: d.usuario, whatsapp: d.whatsapp, contacto: d.contacto, usuarioTocado })); } catch (_) { /* sin almacenamiento */ }
    EU.idiomaCambiar(nuevo);
  };

  const telefono = (t) => { let n = EU.soloNumeros(t); if (/^0[24]\d{9}$/.test(n)) n = "58" + n.slice(1); return n; };
  const usuarioValido = (u) => /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(u);
  const dias = () => planes.diasPrueba + (planes.diasPrueba === 1 ? " día" : " días");

  function cabecera() {
    return h("header", { class: "rg-cab" },
      h("a", { class: "marca-eu", href: "/" }, h("img", { src: "/img/favicon.svg", alt: "" }), C.marca || "EU Digital"),
      h("div", { class: "acciones" },
        EU.selectorIdiomas ? EU.selectorIdiomas({ alCambiar: cambiarIdioma }) : null,
        h("a", { class: "btn btn-sec btn-chico", href: "/panel/" }, "Ya tengo cuenta")));
  }

  function cerrado() {
    document.title = "Registro cerrado";
    app.replaceChildren(h("div", { class: "rg" }, cabecera(),
      h("main", { class: "hoja rg-fin" },
        h("h1", {}, "El registro está cerrado por ahora"),
        h("p", { class: "suave" }, "Escríbenos por WhatsApp y te creamos tu página nosotros."),
        h("div", { class: "acciones" },
          WA ? h("a", { class: "btn btn-verde", href: waEU("Hola, quiero una página de pedidos para mi negocio."), target: "_blank", rel: "noopener" }, "Escribir por WhatsApp") : null,
          h("a", { class: "btn btn-sec", href: "/" }, "Volver al inicio")))));
  }

  function pintar() {
    const refs = {};
    const vista = h("aside", { class: "hoja rg-vista", "aria-live": "polite", hidden: true });

    /* Paso 1: la plantilla */
    const lista = h("fieldset", { class: "rg-lista" }, h("legend", { class: "sr" }, "Plantilla"),
      ORDEN.filter((id) => PL[id]).map((id) => {
        const p = PL[id];
        const radio = h("input", { type: "radio", name: "plantilla", value: id, checked: d.plantilla === id });
        const fila = h("label", { class: "rg-pl" + (d.plantilla === id ? " elegida" : "") },
          radio, h("img", { src: p.vistaPrevia, alt: "", loading: "lazy" }),
          h("div", {}, h("b", {}, p.nombre), h("span", {}, p.ideal || p.rubro)));
        radio.addEventListener("change", () => {
          d.plantilla = id;
          lista.querySelectorAll(".rg-pl").forEach((x) => x.classList.toggle("elegida", x === fila));
          pintarVista(); quitarError();
        });
        return fila;
      }));

    function pintarVista() {
      const p = PL[d.plantilla];
      vista.hidden = !p;
      if (!p) return;
      vista.replaceChildren(
        h("img", { class: "tel", src: p.vistaPrevia, alt: "Así se ve la plantilla " + p.nombre }),
        h("h3", {}, p.nombre),
        h("p", {}, p.descripcion),
        h("ul", {}, (p.puntos || []).map((x) => h("li", {}, x))),
        h("div", {}, h("a", { class: "btn btn-sec btn-chico", href: "/t/" + p.id + "/" + (d.nombre.trim() ? "?prueba=" + encodeURIComponent(d.nombre.trim()) : ""), target: "_blank", rel: "noopener" }, d.nombre.trim() ? "Verla con tu nombre" : "Abrir la demo")));
    }

    /* Paso 2: el negocio */
    // "caja" es lo que se pone en la hoja cuando el campo lleva algo más al lado (la contraseña y su botón)
    const campo = (id, etiqueta, entrada, ayuda, caja) => {
      const err = h("p", { class: "error-campo", id: "e-" + id, hidden: true });
      entrada.id = id;
      entrada.setAttribute("aria-describedby", "e-" + id + (ayuda ? " a-" + id : ""));
      refs[id] = { entrada, err };
      entrada.addEventListener("input", () => { entrada.removeAttribute("aria-invalid"); err.hidden = true; quitarError(); });
      return h("div", { class: "campo" }, h("label", { for: id }, etiqueta), caja || entrada, typeof ayuda === "string" ? h("p", { class: "ayuda", id: "a-" + id }, ayuda) : ayuda || null, err);
    };
    const nombre = h("input", { class: "entrada", type: "text", maxlength: 80, autocomplete: "organization", placeholder: "Ej: Arepera Doña Rosa" });
    const usuario = h("input", { class: "entrada", type: "text", maxlength: 40, autocomplete: "username", autocapitalize: "none", spellcheck: false, placeholder: "Ej: arepera-rosa" });
    nombre.value = d.nombre; usuario.value = d.usuario;
    const whatsapp = h("input", { class: "entrada", type: "tel", inputmode: "tel", autocomplete: "tel", maxlength: 22, placeholder: "Ej: 0414 123 4567" });
    const contacto = h("input", { class: "entrada", type: "text", maxlength: 80, autocomplete: "name" });
    whatsapp.value = d.whatsapp; contacto.value = d.contacto;
    const clave = h("input", { class: "entrada", type: "password", autocomplete: "new-password", minlength: 8, maxlength: 60 });
    const ver = h("button", { class: "btn btn-sec", type: "button", "aria-pressed": "false" }, "Mostrar");
    ver.addEventListener("click", () => { const oculta = clave.type === "password"; clave.type = oculta ? "text" : "password"; ver.textContent = oculta ? "Ocultar" : "Mostrar"; ver.setAttribute("aria-pressed", String(oculta)); });

    const enlace = h("p", { class: "rg-enlace" });
    const estado = h("p", { class: "rg-estado", "aria-live": "polite" });
    function pintarEnlace() {
      enlace.replaceChildren(h("small", {}, "El enlace de tu página"), location.host + "/?n=" + (d.usuario || "tu-negocio"));
    }
    let revisarT, revisarN = 0;
    function revisarUsuario() {
      clearTimeout(revisarT);
      estado.textContent = ""; estado.className = "rg-estado";
      const u = d.usuario;
      if (!u) return;
      if (!usuarioValido(u)) { estado.textContent = "De 3 a 40 letras minúsculas, números o guiones."; estado.classList.add("mal"); return; }
      const turno = ++revisarN;
      revisarT = setTimeout(async () => {
        try {
          const libre = await api.rpc("eu_usuario_libre", { p_usuario: u });
          if (turno !== revisarN) return;
          estado.textContent = libre ? "Disponible" : "Ese usuario no está disponible. Prueba con otro.";
          estado.classList.add(libre ? "ok" : "mal");
        } catch (_) { /* sin conexión: se revisa al crear la página */ }
      }, 450);
    }
    nombre.addEventListener("input", () => {
      d.nombre = nombre.value;
      if (!usuarioTocado) {
        d.usuario = EU.slug(nombre.value); usuario.value = d.usuario;
        usuario.removeAttribute("aria-invalid"); refs.usuario.err.hidden = true;
        pintarEnlace(); revisarUsuario();
      }
    });
    usuario.addEventListener("input", () => {
      usuarioTocado = true;
      const limpio = usuario.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").slice(0, 40);
      if (limpio !== usuario.value) usuario.value = limpio;
      d.usuario = limpio.replace(/-+$/, "");
      pintarEnlace(); revisarUsuario();
    });
    whatsapp.addEventListener("input", () => { d.whatsapp = whatsapp.value; });
    contacto.addEventListener("input", () => { d.contacto = contacto.value; });
    clave.addEventListener("input", () => { d.clave = clave.value; });

    const error = h("p", { class: "banda rojo", role: "alert", hidden: true });
    function quitarError() { error.hidden = true; }
    const boton = h("button", { class: "btn btn-ancho", type: "submit" }, "Crear mi página gratis");
    const letra = h("p", { class: "rg-letra" });
    const pintarLetra = () => { letra.textContent = "Tu prueba dura " + dias() + " y no pide tarjeta. Al terminar eliges un plan, desde " + EU.planes.dinero(EU.planes.precio(planes, "basico", "mensual")) + " al mes, o tu página se pausa: no se borra nada."; };

    const form = h("form", { class: "rg-cuerpo", novalidate: true },
      h("section", { class: "hoja rg-pl-hoja" },
        h("div", { class: "rg-paso" }, h("i", { "aria-hidden": "true" }, "1"), h("h2", {}, "Elige tu plantilla")),
        h("p", { class: "suave", style: "margin-top:-8px" }, "Es el diseño de tu página. En la prueba usas una."),
        lista),
      vista,
      h("section", { class: "hoja rg-datos" },
        h("div", { class: "rg-paso" }, h("i", { "aria-hidden": "true" }, "2"), h("h2", {}, "Los datos de tu negocio")),
        h("div", { class: "campos" },
          EU.selectorIdiomas ? h("div", { class: "campo" }, h("span", { class: "etq", style: "font-weight:700" }, "El idioma de tu panel"),
            EU.selectorIdiomas({ alCambiar: cambiarIdioma }),
            h("p", { class: "ayuda" }, "Tu panel y los avisos te salen en este idioma. Lo puedes cambiar después.")) : null,
          campo("nombre", "Nombre del negocio", nombre),
          campo("usuario", "Usuario", usuario, h("div", { style: "display:flex;flex-direction:column;gap:6px" }, estado, enlace, h("p", { class: "ayuda", id: "a-usuario" }, "Con este usuario entras a tu panel y es el final del enlace de tu página."))),
          campo("whatsapp", "WhatsApp donde recibes los pedidos", whatsapp, "Ahí te llega cada pedido. Lo puedes cambiar después."),
          campo("clave", "Contraseña", clave, "Al menos 8 letras o números.", h("div", { class: "rg-clave" }, clave, ver)),
          campo("contacto", "Tu nombre (opcional)", contacto)),
        error, boton, letra));
    function marcar(id, texto) {
      const r = refs[id];
      if (!r) return;
      r.entrada.setAttribute("aria-invalid", "true");
      r.err.textContent = texto; r.err.hidden = false;
    }
    function validar() {
      const faltas = [];
      if (!d.plantilla) faltas.push(["plantilla", "Elige una plantilla."]);
      if (d.nombre.trim().length < 2) faltas.push(["nombre", "Escribe el nombre de tu negocio."]);
      if (!usuarioValido(d.usuario)) faltas.push(["usuario", "El usuario lleva de 3 a 40 letras minúsculas, números o guiones."]);
      const tel = telefono(d.whatsapp);
      if (tel.length < 10 || tel.length > 15) faltas.push(["whatsapp", "Escribe tu WhatsApp completo. Ej: 0414 123 4567."]);
      if (d.clave.length < 8) faltas.push(["clave", "La contraseña debe tener al menos 8 letras o números."]);
      return faltas;
    }
    function campoDeMensaje(m) {
      m = String(m || "").toLowerCase();
      return m.includes("whatsapp") ? "whatsapp" : m.includes("contraseña") ? "clave" : m.includes("usuario") ? "usuario" : m.includes("nombre") ? "nombre" : m.includes("plantilla") ? "plantilla" : "";
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      quitarError();
      const faltas = validar();
      if (faltas.length) {
        faltas.forEach(([id, t]) => marcar(id, t));
        const [id, texto] = faltas[0];
        error.textContent = faltas.length === 1 ? texto : "Revisa los datos marcados en rojo.";
        if (id === "plantilla") { error.textContent = texto; lista.scrollIntoView({ block: "center", behavior: "smooth" }); const r = lista.querySelector("input"); if (r) r.focus({ preventScroll: true }); }
        else refs[id].entrada.focus();
        error.hidden = false;
        return;
      }
      boton.disabled = true; boton.textContent = "Creando tu página";
      const usuarioFinal = d.usuario;
      try {
        await api.rpc("eu_registrarse", {
          p_usuario: usuarioFinal, p_clave: d.clave, p_nombre: d.nombre.trim(), p_plantilla: d.plantilla,
          p_whatsapp: telefono(d.whatsapp), p_contacto: d.contacto.trim() || null,
        });
      } catch (err) {
        const texto = err.status === 404 ? "El registro todavía no está disponible. Escríbenos por WhatsApp y te creamos tu página." : err.message || "No se pudo crear tu página. Intenta de nuevo.";
        const id = campoDeMensaje(texto);
        if (id && refs[id]) { marcar(id, texto); refs[id].entrada.focus(); }
        error.textContent = texto; error.hidden = false;
        boton.disabled = false; boton.textContent = "Crear mi página gratis";
        return;
      }
      boton.textContent = "Abriendo tu panel";
      try { await api.entrar(usuarioFinal, d.clave); location.href = "/panel/?bienvenida=1"; }
      catch (_) { location.href = "/panel/?u=" + encodeURIComponent(usuarioFinal); }
    });

    const titulo = h("h1", {});
    const sub = h("p", {});
    const pintarTitulo = () => {
      titulo.textContent = "Crea tu página y pruébala " + dias() + " gratis";
      sub.textContent = "Eliges una plantilla, pones los datos de tu negocio y tu página queda en línea de una vez, con su menú de muestra listo para que lo cambies. Sin tarjeta.";
    };
    pintarTitulo(); pintarLetra(); pintarEnlace(); pintarVista();
    if (d.usuario) revisarUsuario();
    app.replaceChildren(h("div", { class: "rg" }, cabecera(),
      h("main", {},
        h("div", { class: "rg-titulo" }, titulo, sub),
        api.conectado ? h("p", { class: "banda azul", style: "margin-top:16px" }, "Ya hay una sesión abierta en este dispositivo. ", h("a", { href: "/panel/" }, "Ir a mi panel")) : null,
        form)));
    return () => { pintarTitulo(); pintarLetra(); };
  }

  document.title = "Crea tu página gratis · " + (C.marca || "EU Digital");
  const repintar = pintar();
  api.rpc("eu_planes_publicos", {}).then((r) => {
    planes = EU.planes.leer(r);
    if (!planes.registroAbierto) cerrado(); else repintar();
  }).catch(() => { /* sin conexión o base sin actualizar: quedan los valores de siempre */ });
})();
