/* Plantilla Licorería (plan Premium): catálogo nocturno y elegante con precio por presentación
   (lata, botella, caja…), combos, sugerencias de hielo y refrescos, y aviso de mayoría de edad.
   Aquí están los datos de fábrica, los temas y lo que el cliente puede editar desde su panel. */
(function () {
  const K = window.EU_CATALOGOS;
  const IMG = "/t/licoreria/img/";
  const foto = (n) => IMG + "productos/" + n + ".webp";
  // pres: lista de [presentación, precio]. El precio de la tarjeta es el más bajo ("desde").
  const prod = (id, cat, nombre, desc, pres, extra) => Object.assign({
    id, cat, nombre, desc: desc || "", precio: Math.min.apply(null, pres.map((x) => Number(x[1]) || 0)),
    presentaciones: pres.map((x) => [x[0], String(x[1])]), foto: "", opciones: [], destacado: false, sugerido: false, agotado: false,
  }, extra || {});
  const FOTOS = ["lata", "cerveza", "ron", "whisky", "vino", "vodka", "licor", "refresco", "hielo", "snacks"]
    .reduce((a, t) => a.concat([0, 1, 2].map((i) => t + "-" + i)), ["combo-0"]);
  const FRANJAS = ["cervezas", "rones", "whisky", "vinos", "vodka", "licores", "sinalcohol", "hielo", "combos"];
  const trio = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return ""; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].join(", "); };
  const CLARO = { "--fondo": "#FBF6EF", "--tarjeta": "#FFFFFF", "--tinta": "#22140F", "--gris": "#6E5B52", "--gris-claro": "#A3918A", "--linea-suave": "#EEE3D8",
    "--crema": "#F6EBDD", "--suave-fondo": "#F3EAE1", "--campo": "#FFFFFF" };

  const P = {
    id: "licoreria",
    nombre: "Licorería",
    rubro: "Licorería y bebidas",
    premium: true,
    descripcion: "Un catálogo nocturno y elegante para licorerías: cada producto con sus presentaciones y precios (lata, botella, caja), combos para la fiesta, hielo y refrescos sugeridos en el pedido, y aviso de mayoría de edad al entrar.",
    ideal: "Licorerías, bodegones de bebidas y ventas de cerveza y hielo",
    puntos: ["Precio por presentación: lata, botella, caja…", "Combos destacados para fiestas", "Hielo, refrescos y snacks sugeridos en el pedido", "Aviso de mayoría de edad al entrar"],
    mascota: "",
    mascotaDemo: "refresco",
    nombreDemo: "La Bodega Nocturna",
    vistaPrevia: "/t/licoreria/vista.webp",
    varFuente: "--f-titulos",
    galeria: FOTOS.map((id) => ({ src: foto(id), nombre: id })).concat(FRANJAS.map((id) => ({ src: IMG + "fotos/" + id + ".webp", nombre: id }))),
    temas: [
      { id: "reserva", nombre: "Reserva", muestra: ["#0F0B09", "#D9A441", "#F6EBDD"], modo: "dark" },
      { id: "clasico", nombre: "Clásico", muestra: ["#FBF6EF", "#8E1B33", "#D9A441"], modo: "light",
        vars: Object.assign({}, CLARO, { "--rojo": "#8E1B33", "--rojo-hondo": "#6E1427", "--sobre-rojo": "#FFFFFF", "--vino": "#4A0F1C", "--vino-hondo": "#2A0810", "--cabecera": "#2A0810", "--velo": "42, 8, 16" }) },
      { id: "neon", nombre: "Neón", muestra: ["#0B0B14", "#FF3D8B", "#3DE0FF"], modo: "dark",
        vars: { "--fondo": "#0B0B14", "--tarjeta": "#16162A", "--linea-suave": "#2A2A48", "--crema": "#1F1F38", "--suave-fondo": "#1C1C33", "--campo": "#0F0F1D",
          "--tinta": "#F1F0FF", "--gris": "#A9A8C9", "--gris-claro": "#6F6E92", "--rojo": "#FF3D8B", "--rojo-hondo": "#FF8DBB", "--sobre-rojo": "#FFFFFF",
          "--mostaza": "#3DE0FF", "--sobre-mostaza": "#06121A", "--vino": "#3A1E5C", "--vino-hondo": "#07070F", "--cabecera": "#07070F", "--velo": "7, 7, 15" } },
      { id: "esmeralda", nombre: "Esmeralda", muestra: ["#0C1A15", "#D9A441", "#1F7A5C"], modo: "dark",
        vars: { "--fondo": "#0C1A15", "--tarjeta": "#132620", "--linea-suave": "#22392F", "--crema": "#1A3029", "--suave-fondo": "#172C25", "--campo": "#0A1511",
          "--tinta": "#EEF5EF", "--gris": "#A8BDB2", "--gris-claro": "#6D8479", "--vino": "#1F5A45", "--vino-hondo": "#06100C", "--cabecera": "#06100C", "--velo": "6, 16, 12" } },
    ],
    colorear(c, col) {
      const v = {};
      if (c.principal) {
        v["--rojo"] = c.principal;
        v["--sobre-rojo"] = col.sobre(c.principal);
        v["--rojo-hondo"] = col.mezclar(c.principal, "#ffffff", 0.25);
        v["--vino"] = col.mezclar(c.principal, "#000000", 0.62);
      }
      if (c.acento) { v["--mostaza"] = c.acento; v["--mostaza-suave"] = col.mezclar(c.acento, "#ffffff", 0.55); v["--sobre-mostaza"] = col.sobre(c.acento); }
      if (c.fondo) {
        const oscuro = col.luz(c.fondo) < 0.35;
        v["--fondo"] = c.fondo;
        v["--tarjeta"] = oscuro ? col.mezclar(c.fondo, "#ffffff", 0.07) : "#ffffff";
        v["--tinta"] = oscuro ? "#F6EBDD" : "#22140F";
        v["--gris"] = oscuro ? "#B9A898" : "#6E5B52";
        v["--gris-claro"] = oscuro ? "#7E6F62" : "#A3918A";
        v["--linea-suave"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.14 : 0.07);
        v["--suave-fondo"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.09 : 0.04);
        v["--crema"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#F6D9A8", oscuro ? 0.12 : 0.3);
        v["--campo"] = oscuro ? col.mezclar(c.fondo, "#000000", 0.25) : "#ffffff";
        v["--cabecera"] = oscuro ? col.mezclar(c.fondo, "#000000", 0.35) : col.mezclar(c.principal || "#2A0810", "#000000", 0.75);
        v["--vino-hondo"] = col.mezclar(c.fondo, "#000000", 0.5);
        v["--velo"] = trio(col.mezclar(c.fondo, "#000000", 0.5));
      }
      return v;
    },
    agotados: [{ ruta: "catalogo.productos", titulo: "Productos" }],
    secciones: [
      {
        id: "menu", titulo: "Catálogo",
        campos: [
          { tipo: "lista", ruta: "catalogo.categorias", etiqueta: "Categorías", item: "categoría", titulo: "nombre", fotoDe: "foto", prefijoId: "cat", maximo: 14,
            ayuda: "Son los botones de arriba del catálogo. Cada una sale con su foto de fondo y su título.",
            nuevo: { nombre: "Nueva categoría", corto: "", emoji: "🍾", foto: "", nota: "", adicionales: false },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 34, requerido: true },
              { tipo: "texto", clave: "corto", etiqueta: "Nombre corto para el botón", max: 16, ayuda: "Opcional. Ej: «Sin alcohol» en vez de «Refrescos y bebidas sin alcohol»." },
              { tipo: "texto", clave: "emoji", etiqueta: "Emoji", max: 4, ayuda: "Sale en el botón y cuando un producto no tiene foto." },
              { tipo: "foto", clave: "foto", etiqueta: "Foto de la franja", max: 1200, cubre: true, galeria: true, ayuda: "Horizontal, como un letrero. Si no subes ninguna, sale un fondo de color con el emoji." },
              { tipo: "area", clave: "nota", etiqueta: "Nota debajo del título", max: 200, ayuda: "Opcional. Ej: «Las cervezas se entregan bien frías»." },
              { tipo: "interruptor", clave: "adicionales", etiqueta: "Son adicionales", ayuda: "Sus productos se ofrecen al elegir cualquier otro producto («¿Le agregas algo?»). Ideal para hielo o vasos." },
            ] },
          { tipo: "lista", ruta: "catalogo.productos", etiqueta: "Productos", item: "producto", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "p",
            agrupar: { clave: "cat", desde: "catalogo.categorias" },
            nuevo: { nombre: "Producto nuevo", desc: "", precio: 5, presentaciones: [], foto: "", opciones: [], destacado: false, sugerido: false, agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", max: 800, galeria: true, ayuda: "Mejor cuadrada. Se recorta al centro." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 60, requerido: true },
              { tipo: "selector", clave: "cat", etiqueta: "Categoría", opciones: { desde: "catalogo.categorias" } },
              { tipo: "pares", clave: "presentaciones", etiqueta: "Presentaciones y precios", max: 8, boton: "Agregar presentación", placeholderA: "Ej: Botella 1 L", placeholderB: "Precio en $, ej: 12.5",
                ayuda: "Cada presentación con su precio (lata, botella, caja de 24…). El cliente elige una. Si no pones ninguna, se usa el precio de abajo." },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio (si no tiene presentaciones)", ayuda: "Si tiene presentaciones, la página muestra «desde» el precio más bajo." },
              { tipo: "area", clave: "desc", etiqueta: "Descripción", max: 240 },
              { tipo: "interruptor", clave: "destacado", etiqueta: "Sale en «Lo más vendido»", ayuda: "El carrusel de arriba del catálogo." },
              { tipo: "interruptor", clave: "sugerido", etiqueta: "Sugerirlo dentro del pedido", ayuda: "Sale en «No te olvides» cuando el cliente revisa su pedido. Ideal para hielo, refrescos y vasos." },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotado hoy" },
            ] },
        ],
      },
    ],
    apariencia: [
      { tipo: "interruptor", ruta: "edad.aviso", etiqueta: "Preguntar si es mayor de edad al entrar", ayuda: "Sale una sola vez en cada teléfono: «¿Eres mayor de 18 años?»." },
      { tipo: "numero", ruta: "edad.minima", etiqueta: "Edad mínima", min: 16, max: 21, sufijo: "años", si: { ruta: "edad.aviso" } },
      { tipo: "foto", ruta: "portada.foto", etiqueta: "Foto de la portada", max: 1600, cubre: true, ayuda: "La foto grande de arriba, detrás de tu logo. Mejor horizontal. Si no subes ninguna, sale la de tu primera categoría." },
      { tipo: "texto", ruta: "portada.nota", etiqueta: "Aviso en la portada", max: 40, placeholder: "Ej: Delivery hasta la 1 am", ayuda: "Una frase corta que sale en una pastilla dorada. Déjala vacía para quitarla." },
      { tipo: "interruptor", ruta: "menu.buscador", etiqueta: "Buscador arriba del catálogo" },
      { tipo: "texto", ruta: "menu.tituloDestacados", etiqueta: "Título del carrusel", max: 30, placeholder: "⭐ Lo más vendido" },
      { tipo: "texto", ruta: "menu.tituloSugerencias", etiqueta: "Título de las sugerencias del pedido", max: 30, placeholder: "No te olvides" },
    ],
  };

  P.defaults = K.combinar(K.contenidoBase, {
    negocio: {
      eslogan: "Bien fría, a tu puerta",
      descripcion: "Cervezas, rones, whisky, vinos y combos. Arma tu pedido y envíalo por WhatsApp.",
      direccion: "Av. Principal, local 7",
      horario: { 0: ["10:00", "23:59"], 1: ["10:00", "23:59"], 2: ["10:00", "23:59"], 3: ["10:00", "23:59"], 4: ["10:00", "23:59"], 5: ["10:00", "23:59"], 6: ["10:00", "23:59"] },
    },
    pedidos: { tipos: ["delivery", "llevar"] },
    animaciones: { productos: "subir", boton: "ninguna", mascota: false, personaje: "ninguna" },
    portada: { foto: "", nota: "Delivery hasta medianoche", frases: [] },
    edad: { aviso: true, minima: 18 },
    menu: { buscador: true, tituloDestacados: "⭐ Lo más vendido", tituloSugerencias: "No te olvides" },
    catalogo: {
      categorias: [
        { id: "combos", nombre: "Combos para la fiesta", corto: "Combos", emoji: "🎉", foto: IMG + "fotos/combos.webp", nota: "Todo listo para compartir. Pregúntanos por combos a tu medida.", adicionales: false },
        { id: "cervezas", nombre: "Cervezas", corto: "", emoji: "🍺", foto: IMG + "fotos/cervezas.webp", nota: "Se entregan bien frías.", adicionales: false },
        { id: "rones", nombre: "Rones", corto: "", emoji: "🥃", foto: IMG + "fotos/rones.webp", nota: "", adicionales: false },
        { id: "whisky", nombre: "Whisky", corto: "", emoji: "🥃", foto: IMG + "fotos/whisky.webp", nota: "", adicionales: false },
        { id: "vinos", nombre: "Vinos y espumantes", corto: "Vinos", emoji: "🍷", foto: IMG + "fotos/vinos.webp", nota: "", adicionales: false },
        { id: "vodka", nombre: "Vodka y ginebra", corto: "Vodka", emoji: "🍸", foto: IMG + "fotos/vodka.webp", nota: "", adicionales: false },
        { id: "licores", nombre: "Licores y cremas", corto: "Licores", emoji: "🍹", foto: IMG + "fotos/licores.webp", nota: "", adicionales: false },
        { id: "sinalcohol", nombre: "Refrescos y bebidas sin alcohol", corto: "Sin alcohol", emoji: "🥤", foto: IMG + "fotos/sinalcohol.webp", nota: "", adicionales: false },
        { id: "hielo", nombre: "Hielo, vasos y snacks", corto: "Hielo", emoji: "🧊", foto: IMG + "fotos/hielo.webp", nota: "", adicionales: false },
      ],
      productos: [
        prod("c1", "combos", "Combo Playa", "1 ron añejo 0,75 L + 2 refrescos de cola 2 L + 1 bolsa de hielo 5 kg", [["Combo", 24]], { foto: foto("combo-0"), destacado: true }),
        prod("c2", "combos", "Combo Cervecero", "24 cervezas en lata + 2 bolsas de hielo + 1 maní salado", [["Combo", 30]], { foto: foto("lata-1"), destacado: true }),
        prod("c3", "combos", "Combo Whisky", "1 whisky 12 años 0,75 L + 4 aguas con gas + 1 bolsa de hielo", [["Combo", 48]], { foto: foto("whisky-1") }),

        prod("b1", "cervezas", "Cerveza rubia", "Clásica, suave y refrescante", [["Lata 355 ml", 1.2], ["Six pack (6 latas)", 6.5], ["Caja de 24 latas", 24]], { foto: foto("lata-0"), destacado: true }),
        prod("b2", "cervezas", "Cerveza ligera", "Menos calorías, el mismo sabor", [["Lata 355 ml", 1.3], ["Caja de 24 latas", 26]], { foto: foto("lata-2") }),
        prod("b3", "cervezas", "Cerveza en botella", "Botella de vidrio retornable", [["Botella 222 ml", 0.9], ["Caja de 36 botellas", 28]], { foto: foto("cerveza-0") }),
        prod("b4", "cervezas", "Cerveza importada", "Lager premium", [["Botella 330 ml", 2.5], ["Six pack", 14]], { foto: foto("cerveza-1") }),

        prod("r1", "rones", "Ron añejo", "Suave, con notas de madera y vainilla", [["0,75 L", 14], ["1 L", 18]], { foto: foto("ron-0"), destacado: true }),
        prod("r2", "rones", "Ron extra añejo", "Reserva de 12 años", [["0,75 L", 32]], { foto: foto("ron-1") }),
        prod("r3", "rones", "Ron blanco", "Ideal para cócteles y mojitos", [["0,75 L", 9], ["1,75 L", 18]], { foto: foto("ron-2") }),

        prod("w1", "whisky", "Whisky 12 años", "Escocés, suave y equilibrado", [["0,75 L", 35], ["1 L", 42]], { foto: foto("whisky-0"), destacado: true }),
        prod("w2", "whisky", "Whisky 18 años", "Edición especial", [["0,75 L", 75]], { foto: foto("whisky-2") }),
        prod("w3", "whisky", "Whisky blend", "Para compartir", [["0,75 L", 18], ["1 L", 22]], { foto: foto("whisky-1") }),

        prod("v1", "vinos", "Vino tinto", "Cabernet sauvignon", [["0,75 L", 12]], { foto: foto("vino-0") }),
        prod("v2", "vinos", "Vino blanco", "Fresco y afrutado", [["0,75 L", 11]], { foto: foto("vino-1") }),
        prod("v3", "vinos", "Espumante", "Para celebrar", [["0,75 L", 16]], { foto: foto("vino-2") }),

        prod("k1", "vodka", "Vodka", "Triple destilado", [["0,75 L", 12], ["1 L", 15]], { foto: foto("vodka-0") }),
        prod("k2", "vodka", "Ginebra", "London dry, para gin tonic", [["0,75 L", 20]], { foto: foto("vodka-1") }),

        prod("l1", "licores", "Crema de whisky", "Dulce y cremosa", [["0,75 L", 16]], { foto: foto("licor-0") }),
        prod("l2", "licores", "Licor de café", "Para postres y cócteles", [["0,75 L", 15]], { foto: foto("licor-1") }),
        prod("l3", "licores", "Tequila", "Reposado", [["0,75 L", 24]], { foto: foto("licor-2") }),

        prod("s1", "sinalcohol", "Refresco de cola", "", [["Lata 355 ml", 0.8], ["Botella 2 L", 2.2]], { foto: foto("refresco-0"), sugerido: true }),
        prod("s2", "sinalcohol", "Agua con gas", "Para tus tragos", [["Botella 600 ml", 0.8], ["Six pack", 4.5]], { foto: foto("refresco-1"), sugerido: true }),
        prod("s3", "sinalcohol", "Bebida energética", "", [["Lata 250 ml", 2]], { foto: foto("lata-1") }),

        prod("h1", "hielo", "Hielo", "Cubitos", [["Bolsa 2 kg", 1.5], ["Bolsa 5 kg", 3]], { foto: foto("hielo-0"), sugerido: true }),
        prod("h2", "hielo", "Vasos desechables", "Paquete de 25", [["Paquete", 1.5]], { foto: foto("snacks-1") }),
        prod("h3", "hielo", "Maní salado", "Bolsa 200 g", [["Bolsa", 2]], { foto: foto("snacks-0"), sugerido: true }),
        prod("h4", "hielo", "Papitas", "Bolsa grande", [["Bolsa", 2.5]], { foto: foto("snacks-2") }),
      ],
    },
  });

  (window.EU_PLANTILLAS = window.EU_PLANTILLAS || {}).licoreria = P;
})();
