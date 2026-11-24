/* Puente de la Boutique: convierte los datos del negocio al formato del probador 360
   y arranca la tienda (app.js es un módulo que usa three.js). */
EU.alListo(function (sitio) {
  "use strict";
  const c = sitio.c;
  const P = EU.plantilla;
  const n = c.negocio;
  const MODELOS = (P.modelos || []).map((m) => m.id);
  const MODELO_POR_CATEGORIA = { vestidos: "vestidoTiras", blusas: "blusaGlobo", faldas: "faldaPlisada", pantalones: "pantalonPalazzo", conjuntos: "conjuntoLino" };
  const TELAS = ["satin", "algodon", "lino", "crepe", "punto"];
  const hex = (h, def) => EU.color(h) || def;
  const texto = (v) => String(v == null ? "" : v);

  const tallasTienda = [...new Set((Array.isArray(c.tallas) ? c.tallas : []).map((t) => texto(t).trim()).filter(Boolean))].slice(0, 10);
  const TALLAS = tallasTienda.length ? tallasTienda : ["Única"];
  const categorias = (c.catalogo.categorias || []).filter((k) => k && k.id && k.nombre).map((k) => ({ id: texto(k.id), nombre: texto(k.nombre) }));
  const productos = (c.catalogo.productos || []).filter((p) => p && p.id && p.nombre && categorias.some((k) => k.id === p.categoria)).map((p) => {
    const propias = (Array.isArray(p.tallas) ? p.tallas : TALLAS).map(texto).filter((t) => TALLAS.includes(t));
    const tallas = propias.length ? propias : TALLAS.slice();
    const agotadas = p.agotado ? tallas.slice() : (Array.isArray(p.agotadas) ? p.agotadas : []).map(texto).filter((t) => tallas.includes(t));
    const colores = (p.colores || []).filter((x) => x && x.nombre).slice(0, 8).map((x) => {
      const col = { nombre: texto(x.nombre) };
      if (x.tipo === "lunares" || x.tipo === "vichy") Object.assign(col, { estampado: x.tipo, fondo: hex(x.hex, "#FFFFFF"), tinta: hex(x.tinta, "#1E1B1D") });
      else col.hex = hex(x.hex, "#CCCCCC");
      if (EU.color(x.acento)) col.acento = EU.color(x.acento);
      const fotos = (Array.isArray(x.fotos) ? x.fotos : []).map(EU.url).filter(Boolean);
      if (fotos.length) col.fotos360 = fotos;
      return col;
    });
    if (!colores.length) colores.push({ nombre: "Único", hex: "#1E1B1D" });
    return {
      id: texto(p.id), nombre: texto(p.nombre), categoria: p.categoria, precio: Math.max(0, Number(p.precio) || 0), nuevo: !!p.nuevo,
      modelo: MODELOS.includes(p.modelo) ? p.modelo : MODELO_POR_CATEGORIA[p.categoria] || "vestidoTiras",
      tela: TELAS.includes(p.tela) ? p.tela : "algodon",
      telaAcento: p.telaAcento === "satin" || p.telaAcento === "metal" ? p.telaAcento : undefined,
      descripcion: texto(p.descripcion),
      detalles: (Array.isArray(p.detalles) ? p.detalles : []).filter((d) => Array.isArray(d) && d[0] && d[1]).map((d) => [texto(d[0]), texto(d[1])]),
      tallas, agotadas,
      etiquetas: (Array.isArray(p.etiquetas) ? p.etiquetas : []).map(texto),
      colores,
    };
  });

  /* Pie: descripción, logo y nota de muestra */
  document.getElementById("pie-desc").textContent = n.descripcion || "";
  document.getElementById("pie-nota").hidden = !sitio.demo;
  const logo = EU.url(n.logo);
  if (logo) { const im = document.getElementById("marca-logo"); im.src = logo; im.alt = ""; im.hidden = false; }

  if (!productos.length) {
    document.getElementById("destacado").hidden = true;
    document.querySelector(".catalogo").innerHTML = '<div class="envoltura"><div class="vacio"><p class="vacio-tit">Pronto publicaremos la colección.</p><p>Escríbenos por WhatsApp si buscas algo en especial.</p></div></div>';
    document.querySelectorAll(".marca").forEach((m) => { m.textContent = sitio.nombre; });
    document.querySelector(".filtros").hidden = true;
    return;
  }

  function resumenHorario(H) {
    const dias = EU_CATALOGOS.dias;
    const rango = (d) => { const v = H && (H[d] || H[String(d)]); return Array.isArray(v) && v[0] && v[1] ? EU.hora(v[0]) + " a " + EU.hora(v[1]) : ""; };
    const grupos = [];
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => { const r = rango(d), g = grupos[grupos.length - 1]; if (g && g.r === r) g.fin = d; else grupos.push({ ini: d, fin: d, r }); });
    const con = grupos.filter((g) => g.r);
    return con.map((g) => (g.ini === g.fin ? dias[g.ini] : dias[g.ini] + " a " + dias[g.fin].toLowerCase()) + ", de " + g.r).join(". ") + (con.length ? "." : "");
  }
  const entregas = (c.entregas || []).filter((e) => e && e.id && e.nombre).map((e) => ({
    id: texto(e.id), nombre: texto(e.nombre), campo: texto(e.campo), etiqueta: texto(e.etiqueta || e.campo || "Dirección"), nota: texto(e.nota),
  }));
  const pagos = (c.pagos || []).filter((m) => m && m.nombre && (m.delivery !== false || m.local !== false));
  if (!pagos.length) document.getElementById("f-pagos").closest("fieldset").hidden = true;

  window.CONFIG = {
    tienda: sitio.nombre,
    whatsapp: EU.whatsapp(),
    whatsappVisible: EU.telefonoVisible(),
    moneda: "$",
    destacado: productos.some((p) => p.id === (c.portada && c.portada.destacado)) ? c.portada.destacado : productos[0].id,
    clave: "eu:boutique:" + (sitio.slug || "demo"),
    tasaInicial: { valor: EU.tasa(), fecha: (c.tasa && c.tasa.fecha) || "" },
    direccion: texto(n.direccion),
    ciudad: texto(n.ciudad),
    mapa: EU.url(n.mapa),
    horario: resumenHorario(n.horario),
    entregas: entregas.length ? entregas : [{ id: "tienda", nombre: "Retiro en tienda", campo: "", etiqueta: "", nota: "Te avisamos por WhatsApp cuando esté listo." }],
    pagos: pagos.map((m) => texto(m.nombre)),
  };
  window.CATEGORIAS = categorias;
  window.TALLAS = TALLAS;
  window.GUIA_TALLAS = (c.guia || []).filter((g) => g && g.talla).map((g) => [texto(g.talla), texto(g.busto), texto(g.cintura), texto(g.cadera)]);
  window.PRODUCTOS = productos;
  window.EU_BOUTIQUE = {
    detallePago(nombre, total) { const m = pagos.find((x) => x.nombre === nombre); return m ? EU.pagos.detalle(m.id, total) : ""; },
    lineasPago() { return []; },
  };
  if (!window.GUIA_TALLAS.length) { const b = document.getElementById("abrir-guia"); if (b) b.hidden = true; }

  import("/t/boutique/app.js").catch((e) => {
    console.error(e);
    document.querySelectorAll(".escena").forEach((x) => { x.dataset.estado = "error"; });
  });
});
