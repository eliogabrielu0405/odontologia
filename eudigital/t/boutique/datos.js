/* Plantilla Boutique: datos de fábrica, temas y lo que el cliente puede editar. */
(function () {
  const K = window.EU_CATALOGOS;
  const TALLAS = ["XS", "S", "M", "L", "XL"];
  const liso = (id, nombre, hex, acento) => ({ id, nombre, tipo: "liso", hex, tinta: "#FFFFFF", acento: acento || "", fotos: [] });
  const NEGRO = () => liso("negro", "Negro", "#1E1B1D");
  const BLANCO = () => liso("blanco", "Blanco", "#ECE8EA");
  const ROSA = () => liso("rosa", "Rosa palo", "#EBB2C3");
  const prenda = (o) => Object.assign({ nuevo: false, agotado: false, tallas: TALLAS.slice(), agotadas: [], etiquetas: [], detalles: [], telaAcento: "" }, o);
  const MODELOS = [
    { id: "vestidoTiras", nombre: "Vestido midi de tiras" },
    { id: "vestidoCoqueta", nombre: "Vestido corto con mangas abullonadas" },
    { id: "vestidoNoche", nombre: "Vestido ajustado de un hombro" },
    { id: "blusaGlobo", nombre: "Blusa de manga globo" },
    { id: "topLazo", nombre: "Top corto de tiras con lazo" },
    { id: "faldaPlisada", nombre: "Falda plisada midi" },
    { id: "faldaVichy", nombre: "Falda mini con volante" },
    { id: "pantalonPalazzo", nombre: "Pantalón palazzo" },
    { id: "pantalonSastre", nombre: "Pantalón sastre" },
    { id: "conjuntoRose", nombre: "Conjunto de top y falda" },
    { id: "conjuntoLino", nombre: "Conjunto de blusa y pantalón" },
  ];
  const TELAS = [
    { id: "satin", nombre: "Satín (brilla)" }, { id: "algodon", nombre: "Algodón" }, { id: "lino", nombre: "Lino" },
    { id: "crepe", nombre: "Crepé" }, { id: "punto", nombre: "Tejido de punto" },
  ];

  const P = {
    id: "boutique",
    nombre: "Boutique",
    rubro: "Tienda de ropa",
    descripcion: "Catálogo de ropa con probador 360: cada prenda gira en 3D o con tus fotos. Tallas, colores, carrito y pedido por WhatsApp.",
    nombreDemo: "Lazo",
    vistaPrevia: "/t/boutique/vista.webp",
    varFuente: "--display",
    sinTipos: true,
    modelos: MODELOS,
    temas: [
      { id: "rosa", nombre: "Rosa chicle", muestra: ["#FFFFFF", "#CC3570", "#F2C3D3"] },
      { id: "noche", nombre: "Noche", muestra: ["#000000", "#FF7AAB", "#F2C3D3"], modo: "dark" },
      { id: "lavanda", nombre: "Lavanda", muestra: ["#FFFFFF", "#6B4BB8", "#D9CCF2"], modo: "light",
        vars: { "--chicle": "#6B4BB8", "--palo": "#D9CCF2", "--estudio": "#F3EFFB", "--linea": "#E3DCF0", "--tinta-2": "#5E5670" } },
      { id: "arena", nombre: "Arena", muestra: ["#FBF8F3", "#9A6B3F", "#E8D9C4"], modo: "light",
        vars: { "--papel": "#FBF8F3", "--chicle": "#9A6B3F", "--palo": "#E8D9C4", "--estudio": "#F4ECE1", "--linea": "#E9DFD2", "--tinta-2": "#6E6155" } },
    ],
    colorear(c, col) {
      const v = {};
      if (c.principal) { v["--chicle"] = c.principal; v["--sobre-chicle"] = col.sobre(c.principal); }
      if (c.acento) { v["--palo"] = c.acento; v["--estudio"] = col.mezclar(c.acento, "#ffffff", 0.7); }
      if (c.fondo) {
        const oscuro = col.luz(c.fondo) < 0.35;
        v["--papel"] = c.fondo;
        v["--tinta"] = oscuro ? "#FFFFFF" : "#000000";
        v["--sobre-tinta"] = oscuro ? "#000000" : "#FFFFFF";
        v["--tinta-2"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", 0.6);
        v["--linea"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.2 : 0.1);
      }
      return v;
    },
    agotados: [{ ruta: "catalogo.productos", titulo: "Prendas", ayuda: "Agotada = sin ninguna talla. Las tallas sueltas se marcan dentro de cada prenda." }],
    secciones: [
      {
        id: "prendas", titulo: "Prendas",
        campos: [
          { tipo: "lista", ruta: "catalogo.categorias", etiqueta: "Categorías", item: "categoría", titulo: "nombre", prefijoId: "cat", maximo: 10,
            nuevo: { nombre: "Nueva categoría" },
            campos: [{ tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 24, requerido: true }] },
          { tipo: "lista", ruta: "catalogo.productos", etiqueta: "Prendas", item: "prenda", titulo: "nombre", precio: "precio", prefijoId: "p",
            fotoDe: "colores.0.fotos.0",
            agrupar: { clave: "categoria", desde: "catalogo.categorias" },
            ayuda: "Cada prenda se ve en 3D con el modelo y los colores que elijas. Si subes fotos en un color, se muestran tus fotos en vez del 3D.",
            nuevo: { nombre: "Prenda nueva", precio: 25, descripcion: "", modelo: "vestidoTiras", tela: "algodon", nuevo: true, agotado: false, tallas: TALLAS.slice(), agotadas: [], etiquetas: [], detalles: [],
              colores: [{ id: "c1", nombre: "Negro", tipo: "liso", hex: "#1E1B1D", tinta: "#FFFFFF", acento: "", fotos: [] }] },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 40, requerido: true },
              { tipo: "selector", clave: "categoria", etiqueta: "Categoría", opciones: { desde: "catalogo.categorias" } },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio" },
              { tipo: "area", clave: "descripcion", etiqueta: "Descripción", max: 240 },
              { tipo: "interruptor", clave: "nuevo", etiqueta: "Marcar como nueva" },
              { tipo: "selector", clave: "modelo", etiqueta: "Forma en el probador 3D", opciones: MODELOS },
              { tipo: "selector", clave: "tela", etiqueta: "Tela", opciones: TELAS },
              { tipo: "lista", clave: "colores", etiqueta: "Colores", item: "color", titulo: "nombre", prefijoId: "c", minimo: 1, maximo: 8, muestra: "hex",
                nuevo: { nombre: "Color nuevo", tipo: "liso", hex: "#CC3570", tinta: "#FFFFFF", acento: "", fotos: [] },
                campos: [
                  { tipo: "texto", clave: "nombre", etiqueta: "Nombre del color", max: 30, requerido: true },
                  { tipo: "selector", clave: "tipo", etiqueta: "Tela", opciones: [{ id: "liso", nombre: "Lisa" }, { id: "lunares", nombre: "Con lunares" }, { id: "vichy", nombre: "De cuadros vichy" }] },
                  { tipo: "color", clave: "hex", etiqueta: "Color de la tela" },
                  { tipo: "color", clave: "tinta", etiqueta: "Color de los lunares o cuadros", ayuda: "Solo si la tela tiene lunares o cuadros." },
                  { tipo: "fotos", clave: "fotos", etiqueta: "Fotos de la prenda en este color", max: 1000, maximo: 36,
                    ayuda: "Opcional. Con una foto se ve esa foto. Con varias tomadas alrededor del maniquí (cada 10° o 15°), el cliente la gira." },
                ] },
              { tipo: "multi", clave: "tallas", etiqueta: "Tallas que vendes", opciones: { desde: "tallas" } },
              { tipo: "multi", clave: "agotadas", etiqueta: "Tallas agotadas", opciones: { desde: "tallas" } },
              { tipo: "pares", clave: "detalles", etiqueta: "Detalles", max: 6, placeholderA: "Ej: Tela", placeholderB: "Ej: Algodón con elastano" },
              { tipo: "etiquetas", clave: "etiquetas", etiqueta: "Palabras para el buscador", max: 10, largo: 20, ayuda: "Ej: fiesta, midi, lunares." },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotada en todas las tallas" },
            ] },
        ],
      },
      {
        id: "tallas", titulo: "Tallas y entregas",
        campos: [
          { tipo: "etiquetas", ruta: "tallas", etiqueta: "Tallas de la tienda", max: 10, largo: 6, ayuda: "En orden, de la más pequeña a la más grande." },
          { tipo: "lista", ruta: "guia", etiqueta: "Guía de tallas (cm)", item: "fila", titulo: "talla", prefijoId: "g", maximo: 10,
            nuevo: { talla: "", busto: "", cintura: "", cadera: "" },
            campos: [
              { tipo: "texto", clave: "talla", etiqueta: "Talla", max: 6, requerido: true },
              { tipo: "texto", clave: "busto", etiqueta: "Busto", max: 10, placeholder: "Ej: 84–88" },
              { tipo: "texto", clave: "cintura", etiqueta: "Cintura", max: 10 },
              { tipo: "texto", clave: "cadera", etiqueta: "Cadera", max: 10 },
            ] },
          { tipo: "lista", ruta: "entregas", etiqueta: "Formas de entrega", item: "entrega", titulo: "nombre", prefijoId: "e", minimo: 1, maximo: 5,
            nuevo: { nombre: "Nueva entrega", campo: "", etiqueta: "", nota: "" },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 30, requerido: true },
              { tipo: "texto", clave: "campo", etiqueta: "Qué le pedimos al cliente", max: 50, ayuda: "Ej: Dirección de entrega. Déjalo vacío si no hace falta (retiro en tienda)." },
              { tipo: "texto", clave: "etiqueta", etiqueta: "Cómo sale en el mensaje", max: 20, placeholder: "Ej: Dirección" },
              { tipo: "texto", clave: "nota", etiqueta: "Nota para el cliente", max: 140, ayuda: "Escribe {direccion} y se reemplaza por la dirección de la tienda." },
            ] },
        ],
      },
    ],
    apariencia: [
      { tipo: "selector", ruta: "portada.destacado", etiqueta: "Prenda de la portada", opciones: { desde: "catalogo.productos" }, ayuda: "La que gira grande al abrir la página." },
    ],
  };

  P.defaults = K.combinar(K.contenidoBase, {
    negocio: {
      eslogan: "Boutique",
      descripcion: "Ropa para damas, con pedidos por WhatsApp.",
      direccion: "Calle Principal, C.C. Ejemplo, local 12",
      ciudad: "Caracas",
      horario: { 0: null, 1: ["09:00", "18:00"], 2: ["09:00", "18:00"], 3: ["09:00", "18:00"], 4: ["09:00", "18:00"], 5: ["09:00", "18:00"], 6: ["09:00", "18:00"] },
    },
    pedidos: { tipos: ["delivery", "llevar"] },
    pagos: K.contenidoBase.pagos.map((m) => Object.assign({}, m, { local: m.id === "pagomovil" || m.id === "zelle" || m.id === "efectivo" ? m.local : false, delivery: m.id === "pagomovil" || m.id === "zelle" || m.id === "efectivo" })),
    animaciones: { productos: "subir" },
    portada: { destacado: "vestido-coqueta" },
    tallas: TALLAS,
    guia: [
      { id: "xs", talla: "XS", busto: "80–84", cintura: "62–66", cadera: "86–90" },
      { id: "s", talla: "S", busto: "84–88", cintura: "66–70", cadera: "90–94" },
      { id: "m", talla: "M", busto: "88–92", cintura: "70–74", cadera: "94–98" },
      { id: "l", talla: "L", busto: "92–98", cintura: "74–80", cadera: "98–104" },
      { id: "xl", talla: "XL", busto: "98–104", cintura: "80–86", cadera: "104–110" },
    ],
    entregas: [
      { id: "tienda", nombre: "Retiro en tienda", campo: "", etiqueta: "", nota: "Retiras en {direccion}. Te avisamos por WhatsApp cuando esté lista." },
      { id: "delivery", nombre: "Delivery", campo: "Dirección de entrega", etiqueta: "Dirección", nota: "El delivery tiene un costo adicional según la zona." },
      { id: "nacional", nombre: "Envío nacional", campo: "Ciudad y agencia (MRW, Zoom o Tealca)", etiqueta: "Envío a", nota: "El costo del envío se coordina por WhatsApp." },
    ],
    catalogo: {
      categorias: [
        { id: "vestidos", nombre: "Vestidos" }, { id: "blusas", nombre: "Blusas" }, { id: "faldas", nombre: "Faldas" },
        { id: "pantalones", nombre: "Pantalones" }, { id: "conjuntos", nombre: "Conjuntos" },
      ],
      productos: [
        prenda({ id: "vestido-coqueta", nombre: "Vestido Coqueta", categoria: "vestidos", precio: 42, nuevo: true, modelo: "vestidoCoqueta", tela: "algodon", telaAcento: "satin",
          descripcion: "Corto, con escote cuadrado y mangas abullonadas. Lleva un lazo de satín en la espalda: gira la prenda para verlo.",
          detalles: [["Tela", "Algodón con elastano"], ["Largo", "Arriba de la rodilla"], ["Cuidado", "Lavar en frío y del revés"]],
          agotadas: ["XL"], etiquetas: ["lunares", "lazo", "corto", "mangas"],
          colores: [
            { id: "c1", nombre: "Negro con lunares", tipo: "lunares", hex: "#1E1B1D", tinta: "#F6F2F0", acento: "#E9A3B8", fotos: [] },
            { id: "c2", nombre: "Rosa con lunares", tipo: "lunares", hex: "#EDB0C2", tinta: "#FFFFFF", acento: "#1E1B1D", fotos: [] },
            { id: "c3", nombre: "Blanco con lunares", tipo: "lunares", hex: "#F1EFEF", tinta: "#1E1B1D", acento: "#1E1B1D", fotos: [] },
          ] }),
        prenda({ id: "vestido-aurora", nombre: "Vestido Aurora", categoria: "vestidos", precio: 38, nuevo: true, modelo: "vestidoTiras", tela: "satin",
          descripcion: "Midi de tiras finas en satín, con escote en V y espalda baja. La falda cae suelta y se mueve al caminar.",
          detalles: [["Tela", "Satín con forro"], ["Largo", "Midi, a media pierna"], ["Cuidado", "Lavar a mano en agua fría"]],
          etiquetas: ["satin", "midi", "tiras", "fiesta"], colores: [ROSA(), NEGRO(), liso("perla", "Blanco perla", "#ECE8EA")] }),
        prenda({ id: "vestido-noche", nombre: "Vestido Noche", categoria: "vestidos", precio: 45, modelo: "vestidoNoche", tela: "punto",
          descripcion: "Ajustado y de un solo hombro, en tejido de punto que se adapta al cuerpo. Tiene una abertura atrás para caminar cómoda.",
          detalles: [["Tela", "Punto grueso con elastano"], ["Largo", "Midi"], ["Cuidado", "Lavar en frío y secar a la sombra"]],
          agotadas: ["XS"], etiquetas: ["un hombro", "ajustado", "fiesta", "midi"], colores: [NEGRO(), liso("fucsia", "Fucsia", "#C42F6B"), BLANCO()] }),
        prenda({ id: "blusa-valentina", nombre: "Blusa Valentina", categoria: "blusas", precio: 26, modelo: "blusaGlobo", tela: "crepe",
          descripcion: "Escote en V y mangas largas tipo globo, recogidas con puño. Fresca y fácil de combinar.",
          detalles: [["Tela", "Crepé liviano"], ["Largo", "A la cadera"], ["Cuidado", "Lavar en frío y planchar a temperatura baja"]],
          etiquetas: ["manga larga", "globo", "escote en v", "oficina"], colores: [BLANCO(), ROSA(), NEGRO()] }),
        prenda({ id: "top-lazo", nombre: "Top Lazo", categoria: "blusas", precio: 18, modelo: "topLazo", tela: "satin", tallas: ["XS", "S", "M", "L"],
          descripcion: "Top corto de tiras finas con un lazo al centro. Combina con faldas y pantalones de tiro alto.",
          detalles: [["Tela", "Satín con forro"], ["Largo", "Corto, debajo del busto"], ["Cuidado", "Lavar a mano"]],
          etiquetas: ["crop", "corto", "tiras", "lazo"], colores: [ROSA(), BLANCO(), NEGRO()] }),
        prenda({ id: "falda-plisada", nombre: "Falda Plisada", categoria: "faldas", precio: 28, modelo: "faldaPlisada", tela: "satin",
          descripcion: "Midi de pretina elástica, con pliegues finos que se abren al caminar.",
          detalles: [["Tela", "Satín plisado"], ["Largo", "Midi, debajo de la rodilla"], ["Cuidado", "Lavar a mano y colgar sin torcer"]],
          agotadas: ["L"], etiquetas: ["plisada", "midi", "satin"], colores: [NEGRO(), ROSA(), BLANCO()] }),
        prenda({ id: "falda-vichy", nombre: "Falda Vichy", categoria: "faldas", precio: 22, modelo: "faldaVichy", tela: "algodon",
          descripcion: "Mini evasé de cuadros vichy, con volante en el ruedo y elástico atrás en la pretina.",
          detalles: [["Tela", "Algodón"], ["Largo", "Mini"], ["Cuidado", "Lavar en frío"]],
          etiquetas: ["cuadros", "mini", "volante"],
          colores: [
            { id: "c1", nombre: "Vichy rosa", tipo: "vichy", hex: "#FFFFFF", tinta: "#E58FAA", acento: "", fotos: [] },
            { id: "c2", nombre: "Vichy negro", tipo: "vichy", hex: "#FFFFFF", tinta: "#1E1B1D", acento: "", fotos: [] },
          ] }),
        prenda({ id: "pantalon-palazzo", nombre: "Pantalón Palazzo", categoria: "pantalones", precio: 32, modelo: "pantalonPalazzo", tela: "crepe",
          descripcion: "Tiro alto y pierna ancha, con cinturón para anudar. Cae con fluidez y no marca.",
          detalles: [["Tela", "Crepé"], ["Largo", "Al tobillo"], ["Cuidado", "Lavar en frío"]],
          etiquetas: ["ancho", "tiro alto", "cinturon"], colores: [NEGRO(), BLANCO(), ROSA()] }),
        prenda({ id: "pantalon-sastre", nombre: "Pantalón Sastre", categoria: "pantalones", precio: 34, modelo: "pantalonSastre", tela: "crepe", telaAcento: "metal",
          descripcion: "Pierna recta con raya marcada adelante y atrás, y botón dorado. Para la oficina o una cena.",
          detalles: [["Tela", "Crepé grueso"], ["Largo", "Al tobillo"], ["Cuidado", "Lavar en frío y planchar por el revés"]],
          agotadas: ["XL"], etiquetas: ["recto", "oficina", "formal"], colores: [NEGRO(), liso("empolvado", "Rosa empolvado", "#D8A1B1"), liso("hueso", "Blanco hueso", "#E5DFDC")] }),
        prenda({ id: "conjunto-rose", nombre: "Conjunto Rosé", categoria: "conjuntos", precio: 40, modelo: "conjuntoRose", tela: "satin", tallas: ["XS", "S", "M", "L"],
          descripcion: "Top de tiras con lazo y minifalda plisada a juego. Se venden juntos.",
          detalles: [["Tela", "Satín"], ["Incluye", "Top y falda"], ["Cuidado", "Lavar a mano"]],
          etiquetas: ["top", "falda", "plisada", "set"], colores: [ROSA(), NEGRO()] }),
        prenda({ id: "conjunto-lino", nombre: "Conjunto Lino", categoria: "conjuntos", precio: 55, nuevo: true, modelo: "conjuntoLino", tela: "lino",
          descripcion: "Blusa holgada de manga corta y pantalón palazzo en lino. Fresco para los días de calor.",
          detalles: [["Tela", "Lino con viscosa"], ["Incluye", "Blusa y pantalón"], ["Cuidado", "Lavar en frío y planchar húmedo"]],
          etiquetas: ["lino", "palazzo", "set", "blusa"], colores: [BLANCO(), ROSA(), NEGRO()] }),
      ],
    },
  });

  (window.EU_PLANTILLAS = window.EU_PLANTILLAS || {}).boutique = P;
})();
