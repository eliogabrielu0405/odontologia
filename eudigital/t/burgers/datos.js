/* Plantilla Burgers: datos de fábrica, temas y lo que el cliente puede editar. */
(function () {
  const K = window.EU_CATALOGOS;
  const IMG = "/t/burgers/img/productos/";
  const prod = (cat, id, nombre, desc, precio) => ({ id, cat, nombre, desc: desc || "", precio, foto: IMG + id + ".webp", agotado: false });
  const FOTOS = ["perro-normal", "perro-especial", "perro-explosivo", "pepiperro", "mechiperro", "ham-normal", "ham-especial", "ham-doble", "ham-pollo-plancha",
    "ham-pollo-crispy", "ham-3-sabores", "ham-papi-burguers", "babypepito", "pepito", "salchipapas", "papas-salvajes", "shawarma", "club-house",
    "refresco-1l", "refresco-2l", "glup-cola", "glup-fresh", "glup-uva", "glup-pina", "maltin"];

  const P = {
    id: "burgers",
    nombre: "Burgers y perros",
    rubro: "Comida rápida",
    descripcion: "Estilo cartel con bordes de sticker, una hamburguesa que se abre capa por capa al bajar, menú por categorías y pedido por WhatsApp.",
    nombreDemo: "Papi Burgers",
    vistaPrevia: "/t/burgers/vista.webp",
    varFuente: "--f-brush",
    galeria: FOTOS.map((id) => ({ src: IMG + id + ".webp", nombre: id })),
    temas: [
      { id: "cartel", nombre: "Cartel", muestra: ["#FDD103", "#E11413", "#049804"] },
      { id: "parrilla", nombre: "Parrilla", muestra: ["#1B1512", "#E77F0A", "#FDD103"], modo: "dark",
        vars: { "--fondo-a": "#1B1512", "--fondo-b": "#2A201A", "--puntos": "#3A2C22", "--tarjeta": "#2A211B", "--tinta-txt": "#FFF4DE", "--suave": "#CDBBA3", "--foto-fondo": "#3A2C22", "--campo": "#1B1512" } },
      { id: "menta", nombre: "Menta", muestra: ["#DDF3E4", "#049804", "#E11413"], modo: "light",
        vars: { "--fondo-a": "#BFE8CC", "--fondo-b": "#E8F7EC", "--puntos": "#7FCB97", "--amarillo": "#BFE8CC", "--rojo": "#0B7A33", "--verde": "#E11413" } },
    ],
    colorear(c, col) {
      const v = {};
      if (c.principal) { v["--rojo"] = c.principal; v["--sobre-rojo"] = col.sobre(c.principal); }
      if (c.acento) { v["--amarillo"] = c.acento; v["--fondo-a"] = c.acento; v["--fondo-b"] = col.mezclar(c.acento, "#ffffff", 0.45); }
      if (c.fondo) {
        const oscuro = col.luz(c.fondo) < 0.35;
        v["--fondo-a"] = c.fondo; v["--fondo-b"] = col.mezclar(c.fondo, oscuro ? "#000000" : "#ffffff", 0.35);
        v["--puntos"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", 0.14);
        v["--tarjeta"] = oscuro ? col.mezclar(c.fondo, "#ffffff", 0.08) : "#ffffff";
        v["--tinta-txt"] = oscuro ? "#FFF4DE" : "#000000";
        v["--suave"] = oscuro ? "#CDBBA3" : "#4A4A4A";
        v["--foto-fondo"] = oscuro ? col.mezclar(c.fondo, "#ffffff", 0.12) : (c.acento || "#FDD103");
        v["--campo"] = oscuro ? col.mezclar(c.fondo, "#000000", 0.2) : "#ffffff";
      }
      return v;
    },
    agotados: [{ ruta: "catalogo.productos", titulo: "Productos" }],
    secciones: [
      {
        id: "menu", titulo: "Menú",
        campos: [
          { tipo: "lista", ruta: "catalogo.categorias", etiqueta: "Categorías", item: "categoría", titulo: "nombre", prefijoId: "cat", maximo: 8,
            ayuda: "Son los botones grandes de arriba del menú.",
            nuevo: { nombre: "Nueva categoría", emoji: "🍽️" },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 18, requerido: true },
              { tipo: "texto", clave: "emoji", etiqueta: "Emoji", max: 4, ayuda: "Sale en el botón y cuando un producto no tiene foto." },
            ] },
          { tipo: "lista", ruta: "catalogo.productos", etiqueta: "Productos", item: "producto", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "p",
            agrupar: { clave: "cat", desde: "catalogo.categorias" },
            nuevo: { nombre: "Producto nuevo", desc: "", precio: 5, foto: "", agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", max: 800, galeria: true, ayuda: "Mejor cuadrada. Se recorta al centro." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 50, requerido: true },
              { tipo: "selector", clave: "cat", etiqueta: "Categoría", opciones: { desde: "catalogo.categorias" } },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio", ayuda: "Si lo dejas en 0 sale «Precio por confirmar» y no se puede pedir." },
              { tipo: "area", clave: "desc", etiqueta: "Lo que trae", max: 200 },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotado hoy" },
            ] },
        ],
      },
    ],
    apariencia: [
      { tipo: "interruptor", ruta: "portada.hamburguesa", etiqueta: "Hamburguesa que se abre al bajar", ayuda: "La animación grande del inicio. Si la apagas, la página empieza con tu logo y el menú." },
      { tipo: "texto", ruta: "portada.aviso", etiqueta: "Texto sobre la hamburguesa", max: 30 },
    ],
  };

  P.defaults = K.combinar(K.contenidoBase, {
    negocio: {
      eslogan: "Deleita tu paladar",
      descripcion: "Perros, hamburguesas y más. Arma tu pedido y envíalo por WhatsApp.",
      direccion: "Av. Principal, local 5",
      horario: { 0: ["17:00", "23:30"], 1: ["17:00", "23:30"], 2: ["17:00", "23:30"], 3: ["17:00", "23:30"], 4: ["17:00", "23:30"], 5: ["17:00", "01:00"], 6: ["17:00", "01:00"] },
    },
    pedidos: { tipos: ["llevar", "aqui", "delivery"] },
    animaciones: { productos: "zoom", boton: "latido" },
    portada: { hamburguesa: true, aviso: "Desliza para abrirla" },
    catalogo: {
      categorias: [
        { id: "perros", nombre: "Perros", emoji: "🌭" },
        { id: "hamburguesas", nombre: "Hamburguesas", emoji: "🍔" },
        { id: "extras", nombre: "Extras", emoji: "🍟" },
      ],
      productos: [
        prod("perros", "perro-normal", "Perro Normal", "Salchicha, ensalada, papitas, salsas, queso de año", 2.5),
        prod("perros", "perro-especial", "Perro Especial", "Salchicha, ensalada, papitas, salsas, queso de año, jamón, queso amarillo", 3.5),
        prod("perros", "perro-explosivo", "Perro Explosivo", "Salchicha, ensalada, papitas, salsas, queso de año, jamón, queso amarillo, huevo, tocineta, pepperoni, maíz", 5),
        prod("perros", "pepiperro", "Pepiperro", "Salchicha, ensalada, papitas, salsas, queso de año, carne de pepito, queso amarillo", 5),
        prod("perros", "mechiperro", "Mechiperro", "Salchicha, ensalada, papitas, salsas, queso de año, carne mechada, queso amarillo", 5),
        prod("hamburguesas", "ham-normal", "Hamburguesa Normal", "Salsas, lechuga, tomate, carne, huevo", 5.5),
        prod("hamburguesas", "ham-especial", "Hamburguesa Especial", "Salsas, lechuga, tomate, carne, huevo, queso guayanés, jamón, tocineta", 6.5),
        prod("hamburguesas", "ham-doble", "Hamburguesa Doble carne", "Salsas, lechuga, tomate, 2 carnes, huevo, queso amarillo, queso guayanés, jamón, tocineta", 10),
        prod("hamburguesas", "ham-pollo-plancha", "Hamburguesa de pollo a la plancha", "Salsas, lechuga, tomate, pollo, huevo, queso guayanés, jamón, tocineta", 7),
        prod("hamburguesas", "ham-pollo-crispy", "Hamburguesa de pollo crispy", "Salsas, lechuga, tomate, pollo, huevo, queso guayanés, jamón, tocineta", 7),
        Object.assign(prod("hamburguesas", "ham-chuleta", "Hamburguesa de chuleta", "Salsas, lechuga, tomate, chuleta, huevo, queso guayanés, jamón, tocineta", 7), { foto: "" }),
        Object.assign(prod("hamburguesas", "ham-mixta", "Hamburguesa Mixta", "Salsas, lechuga, tomate, carne, pollo o chuleta, huevo, queso guayanés, jamón, tocineta", 10), { foto: "" }),
        prod("hamburguesas", "ham-3-sabores", "Hamburguesa 3 sabores", "Salsas, lechuga, tomate, carne, pollo, chuleta, huevo, queso guayanés, jamón, tocineta", 14),
        prod("hamburguesas", "ham-papi-burguers", "Hamburguesa de la casa", "Salsas, lechuga, tomate, carne, pollo, chuleta, chorizo, huevo, queso amarillo, queso guayanés, jamón, tocineta, papitas fritas", 15),
        prod("extras", "babypepito", "Babypepito", "Lechuga, ensalada, carne, chorizo, salsas, queso amarillo, papitas fritas", 10),
        prod("extras", "pepito", "Pepito", "Lechuga, ensalada, carne, chorizo, salsas, queso amarillo, papitas fritas", 23),
        Object.assign(prod("extras", "metropepito", "Metropepito", "Lechuga, ensalada, carne, chorizo, salsas, queso amarillo, papitas fritas", 40), { foto: "" }),
        prod("extras", "salchipapas", "Salchipapas", "Lechuga, tomate, papitas fritas, salchichas, queso amarillo, maíz", 7),
        prod("extras", "papas-salvajes", "Papas salvajes", "Lechuga, tomate, carne, chorizo, salsas, queso amarillo, papitas fritas", 10),
        prod("extras", "shawarma", "Shawarma", "Pan árabe, lechuga, tomate, carne, salsas", 7),
        prod("extras", "club-house", "Club house", "Carne, lechuga, tomate, jamón, queso amarillo, huevo, tocineta, papitas fritas, salsas", 10),
        Object.assign(prod("extras", "papi-club-house", "Club House de la casa", "Carne, pollo, salchicha, nuggets, lechuga, tomate, jamón, queso amarillo, huevo, papitas fritas, salsas", 15), { foto: "" }),
        Object.assign(prod("extras", "racion-papas", "Ración de papas", "Papitas fritas y las salsas de su preferencia", 3.5), { foto: "" }),
        prod("extras", "refresco-1l", "Refresco 1 L", "", 1.5),
        prod("extras", "refresco-2l", "Refresco 2 L", "", 2.5),
      ],
    },
  });

  (window.EU_PLANTILLAS = window.EU_PLANTILLAS || {}).burgers = P;
})();
