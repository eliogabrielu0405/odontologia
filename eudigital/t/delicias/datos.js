/* Plantilla Delicias (plan Premium): menú moderno de comida rápida con buscador, «Lo más pedido»,
   opciones obligatorias (carne, pollo…), adicionales con doble porción y sugerencias en el pedido.
   Aquí están los datos de fábrica, los temas y lo que el cliente puede editar desde su panel. */
(function () {
  const K = window.EU_CATALOGOS;
  const IMG = "/t/delicias/img/";
  const CARNE_POLLO = ["Carne", "Pollo"];
  const CARNE_POLLO_MIXTO = ["Carne", "Pollo", "Mixto"];
  const CARNE_POLLO_MIXTA = ["Carne", "Pollo", "Mixta"];
  const SALCHICHA = ["Salchicha de pollo", "Polaca"];
  const prod = (id, cat, nombre, desc, precio, extra) => Object.assign({ id, cat, nombre, desc: desc || "", precio, foto: "", opciones: [], destacado: false, sugerido: false, agotado: false }, extra || {});
  const foto = (n) => IMG + "productos/" + n + ".webp";
  const FOTOS = ["h10", "h5", "h6", "p1", "p2", "p4", "p5", "p7", "pe1", "pepito", "metropepito", "s2", "sp1", "sp3", "sp4", "papas", "tequenos",
    "a-tocineta", "a-jamon", "a-maiz", "a-pepinillo", "a-carne"];
  const FRANJAS = ["hamburguesas", "perros", "pepitos", "sandwiches", "salchipapas", "raciones", "adicionales"];

  // "#C8141C" → "200, 20, 28" (para los velos con transparencia sobre las fotos)
  const trio = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return ""; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].join(", "); };

  const P = {
    id: "delicias",
    nombre: "Delicias",
    rubro: "Comida rápida",
    premium: true,
    descripcion: "Un menú moderno hecho para pedir rápido desde el teléfono: buscador, «Lo más pedido» arriba, categorías con foto, opciones como carne o pollo y adicionales con doble porción. En la computadora el pedido queda siempre a la vista.",
    ideal: "Hamburguesas, perros, pepitos, salchipapas y comida rápida con muchas opciones",
    puntos: ["Buscador y «Lo más pedido» arriba del menú", "Opciones para elegir: carne, pollo, mixto…", "Adicionales con doble porción en cada producto", "Sugerencias dentro del pedido para vender más"],
    mascota: "hamburguesa",
    mascotaDemo: "hamburguesa",
    nombreDemo: "Delicias Burger",
    vistaPrevia: "/t/delicias/vista.webp",
    varFuente: "--f-titulos",
    galeria: FOTOS.map((id) => ({ src: foto(id), nombre: id })).concat(FRANJAS.map((id) => ({ src: IMG + "fotos/" + id + ".webp", nombre: id }))),
    temas: [
      { id: "brasa", nombre: "Brasa", muestra: ["#C8141C", "#FFC20F", "#3A0709"] },
      { id: "noche", nombre: "Noche", muestra: ["#16100F", "#E8262E", "#FFC20F"], modo: "dark",
        vars: { "--fondo": "#16100F", "--tarjeta": "#241A18", "--tinta": "#FBEFEA", "--gris": "#BFAEA9", "--gris-claro": "#8E7C77", "--linea-suave": "#3A2C29",
          "--crema": "#33241F", "--suave-fondo": "#2E2220", "--campo": "#1C1412", "--rojo": "#E8262E", "--rojo-hondo": "#FF6B70", "--vino": "#4A0C10", "--vino-hondo": "#2A0607", "--velo": "20, 6, 6" } },
      { id: "huerta", nombre: "Huerta", muestra: ["#1E8E4E", "#FFC20F", "#0E3B22"], modo: "light",
        vars: { "--rojo": "#1E8E4E", "--rojo-hondo": "#166B3A", "--vino": "#0E3B22", "--vino-hondo": "#082515", "--velo": "8, 37, 21", "--fondo": "#F5F8F1", "--crema": "#EEF6E4", "--linea-suave": "#E1EAD8", "--suave-fondo": "#EDF2E6" } },
      { id: "cielo", nombre: "Cielo", muestra: ["#2457D6", "#FFB21E", "#0D1F4D"], modo: "light",
        vars: { "--rojo": "#2457D6", "--rojo-hondo": "#1A40A3", "--vino": "#0D1F4D", "--vino-hondo": "#081433", "--velo": "8, 20, 51", "--mostaza": "#FFB21E", "--fondo": "#F3F6FC", "--crema": "#E9F0FF", "--linea-suave": "#DFE6F3", "--suave-fondo": "#E9EEF7" } },
    ],
    colorear(c, col) {
      const v = {};
      if (c.principal) {
        v["--rojo"] = c.principal;
        v["--sobre-rojo"] = col.sobre(c.principal);
        v["--rojo-hondo"] = col.mezclar(c.principal, "#000000", 0.22);
        v["--vino"] = col.mezclar(c.principal, "#000000", 0.7);
        v["--vino-hondo"] = col.mezclar(c.principal, "#000000", 0.82);
        v["--velo"] = trio(col.mezclar(c.principal, "#000000", 0.82));
      }
      if (c.acento) { v["--mostaza"] = c.acento; v["--mostaza-suave"] = col.mezclar(c.acento, "#ffffff", 0.55); v["--sobre-mostaza"] = col.sobre(c.acento); }
      if (c.fondo) {
        const oscuro = col.luz(c.fondo) < 0.35;
        v["--fondo"] = c.fondo;
        v["--tarjeta"] = oscuro ? col.mezclar(c.fondo, "#ffffff", 0.08) : "#ffffff";
        v["--tinta"] = oscuro ? "#FBEFEA" : "#1D0A0B";
        v["--gris"] = oscuro ? "#BFAEA9" : "#6F5F5E";
        v["--gris-claro"] = oscuro ? "#8E7C77" : "#A39391";
        v["--linea-suave"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.14 : 0.07);
        v["--suave-fondo"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.1 : 0.04);
        v["--crema"] = oscuro ? col.mezclar(c.fondo, "#ffffff", 0.12) : col.mezclar(c.fondo, "#FFE7A3", 0.35);
        v["--campo"] = oscuro ? col.mezclar(c.fondo, "#000000", 0.2) : "#ffffff";
      }
      return v;
    },
    agotados: [{ ruta: "catalogo.productos", titulo: "Productos" }],
    secciones: [
      {
        id: "menu", titulo: "Menú",
        campos: [
          { tipo: "lista", ruta: "catalogo.categorias", etiqueta: "Categorías", item: "categoría", titulo: "nombre", fotoDe: "foto", prefijoId: "cat", maximo: 14,
            ayuda: "Son los botones de arriba del menú. Cada una sale con su foto de fondo y su título.",
            nuevo: { nombre: "Nueva categoría", corto: "", emoji: "🍽️", foto: "", nota: "", adicionales: false },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 34, requerido: true },
              { tipo: "texto", clave: "corto", etiqueta: "Nombre corto para el botón", max: 16, ayuda: "Opcional. Ej: «Perros» en vez de «Perros calientes»." },
              { tipo: "texto", clave: "emoji", etiqueta: "Emoji", max: 4, ayuda: "Sale en el botón y cuando un producto no tiene foto." },
              { tipo: "foto", clave: "foto", etiqueta: "Foto de la franja", max: 1200, cubre: true, galeria: true, ayuda: "Horizontal, como un letrero. Si no subes ninguna, sale un fondo de color con el emoji." },
              { tipo: "area", clave: "nota", etiqueta: "Nota debajo del título", max: 200, ayuda: "Opcional. Ej: «Todas traen papas»." },
              { tipo: "interruptor", clave: "adicionales", etiqueta: "Son adicionales", ayuda: "Sus productos se ofrecen al elegir cualquier otro producto («¿Le agregas algo?»), con doble o triple porción." },
            ] },
          { tipo: "lista", ruta: "catalogo.productos", etiqueta: "Productos", item: "producto", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "p",
            agrupar: { clave: "cat", desde: "catalogo.categorias" },
            nuevo: { nombre: "Producto nuevo", desc: "", precio: 5, foto: "", opciones: [], destacado: false, sugerido: false, agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", max: 800, galeria: true, ayuda: "Mejor cuadrada. Se recorta al centro." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 60, requerido: true },
              { tipo: "selector", clave: "cat", etiqueta: "Categoría", opciones: { desde: "catalogo.categorias" } },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio", ayuda: "Si lo dejas en 0 sale «Precio por confirmar» y no se puede pedir." },
              { tipo: "area", clave: "desc", etiqueta: "Lo que trae", max: 240 },
              { tipo: "etiquetas", clave: "opciones", etiqueta: "Opciones para elegir", largo: 30, max: 8, placeholder: "Ej: Carne", ayuda: "Opcional. Si pones opciones (Carne, Pollo, Mixto…), el cliente tiene que elegir una. No cambian el precio." },
              { tipo: "interruptor", clave: "destacado", etiqueta: "Sale en «Lo más pedido»", ayuda: "El carrusel de arriba del menú." },
              { tipo: "interruptor", clave: "sugerido", etiqueta: "Sugerirlo dentro del pedido", ayuda: "Sale en «Te puede gustar» cuando el cliente revisa su pedido. Ideal para papas, tequeños o bebidas." },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotado hoy" },
            ] },
        ],
      },
    ],
    apariencia: [
      { tipo: "foto", ruta: "portada.foto", etiqueta: "Foto de la portada", max: 1600, cubre: true, ayuda: "La foto grande de arriba, detrás de tu logo. Mejor horizontal. Si no subes ninguna, sale la foto de tu primera categoría." },
      { tipo: "interruptor", ruta: "menu.buscador", etiqueta: "Buscador arriba del menú" },
      { tipo: "texto", ruta: "menu.tituloDestacados", etiqueta: "Título del carrusel", max: 30, placeholder: "🔥 Lo más pedido", ayuda: "Los productos que marcaste con «Sale en «Lo más pedido»»." },
      { tipo: "texto", ruta: "menu.tituloSugerencias", etiqueta: "Título de las sugerencias del pedido", max: 30, placeholder: "Te puede gustar" },
      { tipo: "etiquetas", ruta: "portada.frases", etiqueta: "Lo que dice la mascota al tocarla", largo: 30, max: 8, placeholder: "Ej: ¡Provecho! 😋", ayuda: "Sale en un globito cuando tocan la mascota de la portada." },
    ],
  };

  P.defaults = K.combinar(K.contenidoBase, {
    negocio: {
      eslogan: "Sabores que enamoran",
      descripcion: "Hamburguesas, perros, pepitos y salchipapas. Arma tu pedido y envíalo por WhatsApp.",
      direccion: "Av. Principal, local 3",
      horario: { 0: ["11:00", "23:00"], 1: ["11:00", "23:00"], 2: ["11:00", "23:00"], 3: ["11:00", "23:00"], 4: ["11:00", "23:00"], 5: ["11:00", "23:00"], 6: ["11:00", "23:00"] },
    },
    pedidos: { tipos: ["delivery", "llevar", "aqui"] },
    animaciones: { productos: "subir", boton: "ninguna" },
    portada: { foto: "", frases: ["¡Provecho! 😋", "¡Pide la tuya! 🔥", "¡Qué rico! 🍔", "¡Chévere! 🎉"] },
    menu: { buscador: true, tituloDestacados: "🔥 Lo más pedido", tituloSugerencias: "Te puede gustar" },
    catalogo: {
      categorias: [
        { id: "hamburguesas", nombre: "Hamburguesas", corto: "", emoji: "🍔", foto: IMG + "fotos/hamburguesas.webp", nota: "", adicionales: false },
        { id: "perros", nombre: "Perros calientes", corto: "Perros", emoji: "🌭", foto: IMG + "fotos/perros.webp", nota: "", adicionales: false },
        { id: "pepitos", nombre: "Pepitos", corto: "", emoji: "🥖", foto: IMG + "fotos/pepitos.webp", nota: "", adicionales: false },
        { id: "sandwiches", nombre: "Sándwich y Club House", corto: "Sándwiches", emoji: "🥪", foto: IMG + "fotos/sandwiches.webp", nota: "", adicionales: false },
        { id: "salchipapas", nombre: "Salchipapas", corto: "", emoji: "🍟", foto: IMG + "fotos/salchipapas.webp", nota: "", adicionales: false },
        { id: "raciones", nombre: "Papas y tequeños", corto: "Raciones", emoji: "🥔", foto: IMG + "fotos/raciones.webp", nota: "", adicionales: false },
        { id: "adicionales", nombre: "Adicionales", corto: "", emoji: "🥓", foto: IMG + "fotos/adicionales.webp", nota: "Al agregar cualquier producto puedes sumarle adicionales. Si los pides sueltos aquí, dinos en las notas a qué producto van.", adicionales: true },
      ],
      productos: [
        prod("h1", "hamburguesas", "Mini Burger", "Pan pequeño, huevo, carne, lechuga, tomate, papas perreras y salsas", 4),
        prod("h2", "hamburguesas", "Mini Burger Especial", "Mini Burger + jamón, queso amarillo y tocineta", 5),
        prod("h3", "hamburguesas", "Hamburguesa Normal", "Pan, huevo, carne o pollo, lechuga, tomate, papas perreras y salsas", 5.5, { opciones: CARNE_POLLO }),
        prod("h4", "hamburguesas", "Hamburguesa Especial", "La Normal + jamón, queso amarillo y tocineta", 6.5, { opciones: CARNE_POLLO }),
        prod("h5", "hamburguesas", "Hamburguesa Doble", "Doble carne, doble pollo o mixta + jamón, queso amarillo y tocineta", 7.5, { foto: foto("h5"), opciones: CARNE_POLLO_MIXTA, destacado: true }),
        prod("h6", "hamburguesas", "Hamburguesa Doble Especial Mixta", "Carne y pollo + jamón, queso amarillo y tocineta", 8.5, { foto: foto("h6") }),
        prod("h7", "hamburguesas", "Hamburguesa de Chuleta Ahumada", "Chuleta ahumada + jamón y queso amarillo", 6.5),
        prod("h10", "hamburguesas", "Crispy Burger", "Pan, huevo, milanesas de pollo crispy, cebolla caramelizada, lechuga, tomate, salsa especial, queso cheddar fundido y ración de papas pequeña", 9, { foto: foto("h10"), destacado: true }),
        prod("h11", "hamburguesas", "Burger de la Casa", "Pan, huevo, lechuga, tomate, papas perreras, salsas, chuleta ahumada, carne, pollo, chorizo ahumado, jamón, queso cheddar fundido, tocineta y ración de papas pequeña", 13.5),
        prod("h12", "hamburguesas", "Hamburguesa Keto", "Baja en carbohidratos: cubierta de lechuga, tomate, doble carne, doble pollo o mixta, jamón, queso mozzarella y tocineta. Salsas opcionales", 7, { opciones: CARNE_POLLO_MIXTA }),

        prod("p1", "perros", "Perro Normal", "Pan, salchicha de pollo, repollo, papas perreras, salsas variadas y queso de año", 2.5, { foto: foto("p1") }),
        prod("p2", "perros", "Perro Especial", "Pan, salchicha de pollo o polaca, repollo, papas perreras, salsas, jamón y queso amarillo", 3.5, { foto: foto("p2"), opciones: SALCHICHA }),
        prod("p3", "perros", "Perro Súper Especial", "El Especial + tocineta", 4, { opciones: SALCHICHA }),
        prod("p4", "perros", "Mechi Perro", "Pan, salchicha polaca, carne mechada, repollo, papas perreras, salsas y queso de año", 6.5, { foto: foto("p4") }),
        prod("p5", "perros", "Mechi Perro Especial", "Mechi Perro + jamón, queso amarillo y tocineta", 7.5, { foto: foto("p5"), destacado: true }),
        prod("p7", "perros", "Perro Gemelo Especial", "Pan, 2 salchichas de pollo, repollo, papas perreras, salsas, jamón y queso amarillo", 4.5, { foto: foto("p7") }),

        prod("pe1", "pepitos", "Mini Pepito", "Pan de perro, carne o pollo (o mixto), tomate, lechuga, papas, salsas y queso de año", 6.5, { foto: foto("pe1"), opciones: CARNE_POLLO_MIXTO }),
        prod("pe2", "pepitos", "Mini Pepito Especial", "Carne o pollo (o mixto), tomate, lechuga, papas, salsas, jamón, queso amarillo rallado y tocineta", 7.5, { opciones: CARNE_POLLO_MIXTO }),
        prod("pe4", "pepitos", "Pepito Especial", "Pan canilla de 40 cm, carne, tomate, lechuga, papas perreras, salsas, jamón, queso amarillo y tocineta", 16.9, { foto: foto("pepito") }),
        prod("pe6", "pepitos", "Pepito Mixto Especial", "Pan canilla de 40 cm, carne, pollo, chorizo, tomate, lechuga, papas, salsas, jamón, queso amarillo y tocineta", 16.9, { foto: foto("pepito") }),
        prod("pe7", "pepitos", "Metro Pepito Especial", "Un metro de pepito para compartir. Carne, jamón, queso amarillo, tocineta, papas y salsas", 38, { foto: foto("metropepito"), destacado: true }),
        prod("pe9", "pepitos", "Enrollado tipo Shawarma", "Pan árabe, carne o pollo (o mixto), tomate, lechuga, queso amarillo rallado, jamón y tocineta. Salsas opcionales", 7.5, { opciones: CARNE_POLLO_MIXTO }),

        prod("s1", "sandwiches", "Sándwich", "Pan, lechuga, tomate, jamón, queso amarillo y salsas", 3.5),
        prod("s2", "sandwiches", "Club House", "Sándwich de jamón, queso, huevo, lechuga, tomate, salsas y papas fritas", 7.8, { foto: foto("s2"), destacado: true }),
        prod("s3", "sandwiches", "Club House de Carne o Pollo", "Sándwich de jamón, queso, huevo, lechuga, tomate, salsas, full papas fritas y milanesa de pollo o carne a la plancha", 11, { opciones: CARNE_POLLO }),
        prod("s4", "sandwiches", "Club House Mixto", "Sándwich, milanesa de pollo, carne de hamburguesa, papas crujientes, salsas, queso amarillo rallado, tocineta y maíz", 13),

        prod("sp1", "salchipapas", "Salchipapa", "Full papas fritas, salchichas, ensalada coleslaw, salsas y maíz", 7, { foto: foto("sp1") }),
        prod("sp2", "salchipapas", "Salchipapa Especial", "Salchipapa + jamón, queso amarillo y tocineta", 8.5),
        prod("sp3", "salchipapas", "Salchi Club House", "La combinación perfecta entre Club House y Salchipapa", 9.5, { foto: foto("sp3") }),
        prod("sp4", "salchipapas", "Salchi Ternera Mix", "Papas crujientes, ensalada coleslaw, salchichas, carne de lomo, salsas, maíz, queso amarillo y tocineta", 13, { foto: foto("sp4"), destacado: true }),

        prod("r1", "raciones", "Ración de papas pequeña", "Papas fritas", 2, { foto: foto("papas"), sugerido: true }),
        prod("r2", "raciones", "Ración de papas grande", "Papas fritas", 2.5, { foto: foto("papas"), sugerido: true }),
        prod("r3", "raciones", "Ración de tequeños", "6 tequeños con salsa", 4, { foto: foto("tequenos"), sugerido: true }),

        prod("a1", "adicionales", "Tocineta", "", 0.9, { foto: foto("a-tocineta") }),
        prod("a8", "adicionales", "Jamón", "", 0.8, { foto: foto("a-jamon") }),
        prod("a2", "adicionales", "Maíz", "", 0.5, { foto: foto("a-maiz") }),
        prod("a3", "adicionales", "Pepinillo", "", 0.8, { foto: foto("a-pepinillo") }),
        prod("a4", "adicionales", "Carne de hamburguesa", "", 3, { foto: foto("a-carne") }),
        prod("a5", "adicionales", "Milanesa de pollo", "", 2.5),
        prod("a7", "adicionales", "Cebolla caramelizada", "", 1.2),
      ],
    },
  });

  (window.EU_PLANTILLAS = window.EU_PLANTILLAS || {}).delicias = P;
})();
