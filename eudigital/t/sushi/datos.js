/* Plantilla Sushi: datos de fábrica, temas y lo que el cliente puede editar. */
(function () {
  const K = window.EU_CATALOGOS;
  const P = {
    id: "sushi",
    nombre: "Sushi bar",
    rubro: "Comida japonesa",
    descripcion: "Menú por categorías con fotos, carrito y pedido por WhatsApp. Estilo japonés con pétalos de sakura.",
    nombreDemo: "Sakura Sushi",
    vistaPrevia: "/t/sushi/vista.webp",
    varFuente: "--f-display",
    temas: [
      { id: "sakura", nombre: "Sakura", muestra: ["#16100F", "#E0213A", "#F9C6D3"] },
      { id: "matcha", nombre: "Matcha", muestra: ["#13201A", "#3C7A3B", "#CFE3B0"], modo: "light",
        vars: { "--rojo": "#3C7A3B", "--salmon": "#9BBF5A", "--sakura": "#CFE3B0", "--sakura-suave": "#EEF5E2", "--papel": "#FAFCF6", "--negro": "#13201A", "--linea": "#DDE8CF", "--tinta-2": "#56634F" } },
      { id: "tinta", nombre: "Tinta azul", muestra: ["#0E1A2E", "#1F4E99", "#BFD3F2"], modo: "light",
        vars: { "--rojo": "#1F4E99", "--salmon": "#E8A33D", "--sakura": "#BFD3F2", "--sakura-suave": "#E6EEFA", "--papel": "#F7F9FD", "--negro": "#0E1A2E", "--linea": "#D6E0F0", "--tinta-2": "#4D5B70" } },
      { id: "noche", nombre: "Noche", muestra: ["#120C0D", "#FF3B52", "#F6B3C4"], modo: "dark" },
    ],
    colorear(c, col) {
      const v = {};
      if (c.principal) { v["--rojo"] = c.principal; v["--sobre-rojo"] = col.sobre(c.principal); }
      if (c.acento) { v["--sakura"] = c.acento; v["--salmon"] = col.mezclar(c.acento, c.principal || "#FF8466", 0.45); v["--sakura-suave"] = col.mezclar(c.acento, "#ffffff", 0.7); }
      if (c.fondo) {
        const oscuro = col.luz(c.fondo) < 0.35;
        v["--papel"] = c.fondo;
        v["--tarjeta"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#ffffff", oscuro ? 0.06 : 0.6);
        v["--linea"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", 0.12);
        v["--tinta"] = oscuro ? "#FFF3F5" : "#16100F";
        v["--tinta-2"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", 0.55);
      }
      return v;
    },
    agotados: [{ ruta: "catalogo.productos", titulo: "Platos" }],
    secciones: [
      {
        id: "menu", titulo: "Menú",
        campos: [
          { tipo: "lista", ruta: "catalogo.categorias", etiqueta: "Categorías", item: "categoría", titulo: "nombre", prefijoId: "cat",
            ayuda: "Las pestañas de arriba del menú. El kanji es el símbolo japonés que acompaña el nombre.",
            nuevo: { nombre: "Nueva categoría", kanji: "品", nota: "", color: "rojo" },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 30, requerido: true },
              { tipo: "texto", clave: "kanji", etiqueta: "Kanji", max: 2, ayuda: "Un símbolo. Si no tiene foto, el plato muestra este kanji." },
              { tipo: "texto", clave: "nota", etiqueta: "Nota corta", max: 30, placeholder: "Ej: 8 piezas" },
              { tipo: "selector", clave: "color", etiqueta: "Color del círculo", opciones: [{ id: "rojo", nombre: "Rojo" }, { id: "salmon", nombre: "Salmón" }, { id: "negro", nombre: "Negro" }, { id: "sakura", nombre: "Rosado" }] },
            ] },
          { tipo: "lista", ruta: "catalogo.productos", etiqueta: "Platos", item: "plato", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "p",
            agrupar: { clave: "cat", desde: "catalogo.categorias" },
            nuevo: { nombre: "Plato nuevo", precio: 0, desc: "", foto: "", etiqueta: "", agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", forma: "redonda", max: 700, ayuda: "Mejor cuadrada y con el plato centrado." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 60, requerido: true },
              { tipo: "selector", clave: "cat", etiqueta: "Categoría", opciones: { desde: "catalogo.categorias" } },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio" },
              { tipo: "area", clave: "desc", etiqueta: "Descripción", max: 180 },
              { tipo: "texto", clave: "etiqueta", etiqueta: "Etiqueta", max: 20, placeholder: "Ej: De la casa" },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotado hoy" },
            ] },
        ],
      },
    ],
    apariencia: [
      { tipo: "texto", ruta: "portada.kanji", etiqueta: "Letras japonesas de la portada", max: 6, ayuda: "Van en vertical al lado del nombre." },
      { tipo: "texto", ruta: "portada.sello", etiqueta: "Texto del sello", max: 4, ayuda: "Si subes un logo, el logo reemplaza el sello." },
      { tipo: "texto", ruta: "portada.pie", etiqueta: "Nota al final del menú", max: 90 },
    ],
  };

  P.defaults = K.combinar(K.contenidoBase, {
    negocio: {
      eslogan: "Sushi bar · Pedidos",
      descripcion: "Arma tu pedido, revísalo en el carrito y envíalo directo a nuestro WhatsApp.",
    },
    pedidos: { tipos: ["aqui", "llevar", "delivery"] },
    animaciones: { portada: "petalos", productos: "subir" },
    portada: { kanji: "桜寿司", sello: "注文", pie: "Precios en dólares. Las bandejas se arman con la pieza del día." },
    catalogo: {
      categorias: [
        { id: "rolls", nombre: "Rolls", kanji: "巻", nota: "8 piezas", color: "rojo" },
        { id: "nigiri", nombre: "Nigiri", kanji: "握", nota: "2 piezas", color: "salmon" },
        { id: "sashimi", nombre: "Sashimi", kanji: "刺", nota: "", color: "negro" },
        { id: "bandejas", nombre: "Bandejas", kanji: "盛", nota: "Para compartir", color: "rojo" },
        { id: "entradas", nombre: "Entradas", kanji: "前", nota: "", color: "salmon" },
        { id: "bebidas", nombre: "Bebidas", kanji: "飲", nota: "", color: "negro" },
        { id: "extras", nombre: "Extras", kanji: "添", nota: "", color: "sakura" },
      ],
      productos: [
        { id: "r1", cat: "rolls", nombre: "California Roll", precio: 8, desc: "Kanikama, aguacate, pepino y ajonjolí por fuera." },
        { id: "r2", cat: "rolls", nombre: "Philadelphia Roll", precio: 9, desc: "Salmón fresco, queso crema y pepino." },
        { id: "r3", cat: "rolls", nombre: "Tempura Roll", precio: 10, desc: "Langostino tempura, queso crema y salsa de anguila." },
        { id: "r4", cat: "rolls", nombre: "Sakura Roll", precio: 12, etiqueta: "De la casa", desc: "Salmón y queso crema, cubierto de salmón flameado y salsa acevichada." },
        { id: "r5", cat: "rolls", nombre: "Spicy Tuna Roll", precio: 11, desc: "Atún picante, pepino y cebollín." },
        { id: "r6", cat: "rolls", nombre: "Dragon Roll", precio: 13, desc: "Langostino tempura por dentro, aguacate y salsa de anguila por fuera." },
        { id: "n1", cat: "nigiri", nombre: "Nigiri de salmón", precio: 5, desc: "Arroz de sushi con láminas de salmón." },
        { id: "n2", cat: "nigiri", nombre: "Nigiri de atún", precio: 5.5, desc: "Arroz de sushi con láminas de atún." },
        { id: "n3", cat: "nigiri", nombre: "Nigiri de langostino", precio: 5, desc: "Langostino cocido sobre arroz." },
        { id: "n4", cat: "nigiri", nombre: "Nigiri de kani", precio: 4, desc: "Kanikama sobre arroz con alga." },
        { id: "s1", cat: "sashimi", nombre: "Sashimi de salmón", precio: 9, desc: "6 cortes de salmón fresco." },
        { id: "s2", cat: "sashimi", nombre: "Sashimi mixto", precio: 13, desc: "9 cortes: salmón, atún y pescado blanco." },
        { id: "b1", cat: "bandejas", nombre: "Bandeja 20 piezas", precio: 22, desc: "Surtido de rolls y nigiris." },
        { id: "b2", cat: "bandejas", nombre: "Combo Pareja", precio: 28, etiqueta: "Favorito", desc: "2 rolls a elección, 4 nigiris y 2 sopas miso." },
        { id: "b3", cat: "bandejas", nombre: "Bandeja 40 piezas", precio: 40, desc: "Surtido grande de rolls, nigiris y sashimi." },
        { id: "e1", cat: "entradas", nombre: "Gyozas (5 unidades)", precio: 6, desc: "Empanaditas japonesas de cerdo, a la plancha." },
        { id: "e2", cat: "entradas", nombre: "Edamame", precio: 4, desc: "Vainas de soya con sal marina." },
        { id: "e3", cat: "entradas", nombre: "Sopa miso", precio: 4, desc: "Caldo de miso con tofu, alga wakame y cebollín." },
        { id: "e4", cat: "entradas", nombre: "Ensalada kani", precio: 6, desc: "Kanikama, pepino, mango y mayonesa japonesa." },
        { id: "d1", cat: "bebidas", nombre: "Té verde frío", precio: 2, desc: "" },
        { id: "d2", cat: "bebidas", nombre: "Ramune", precio: 3, desc: "Refresco japonés de botella con canica." },
        { id: "d3", cat: "bebidas", nombre: "Refresco 1 L", precio: 1.5, desc: "" },
        { id: "d4", cat: "bebidas", nombre: "Agua", precio: 1, desc: "" },
        { id: "x1", cat: "extras", nombre: "Salsa de soya extra", precio: 0.5, desc: "" },
        { id: "x2", cat: "extras", nombre: "Wasabi extra", precio: 0.5, desc: "" },
        { id: "x3", cat: "extras", nombre: "Jengibre encurtido", precio: 0.5, desc: "" },
      ].map((p) => Object.assign({ foto: "", etiqueta: "", agotado: false }, p)),
    },
  });

  (window.EU_PLANTILLAS = window.EU_PLANTILLAS || {}).sushi = P;
})();
