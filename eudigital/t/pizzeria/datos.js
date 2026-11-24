/* Plantilla Pizzería: datos de fábrica, temas y lo que el cliente puede editar. */
(function () {
  const K = window.EU_CATALOGOS;
  const IMG = "/t/pizzeria/img/";
  const top = (id, nombre, grupo, precio, tam, n) => ({ id, nombre, grupo, precio, foto: IMG + "ingredientes/" + id + ".webp", tam, n, agotado: false });
  const pizza = (id, nombre, desc, precio, salsa, queso, masa, ingredientes, etiqueta) =>
    ({ id, nombre, desc, precio, foto: IMG + "pizzas/" + id + ".webp", etiqueta: etiqueta || "", salsa, queso, masa, ingredientes, agotado: false });
  const bebida = (id, nombre, chica, grande) => ({ id, nombre, foto: IMG + "bebidas/" + id + ".webp", precioChica: chica, precio: grande, agotado: false });
  const GALERIA = [
    ...["pepperoni", "jamon", "tocineta", "pollo", "champi", "pimenton", "cebolla", "aceitunas", "maiz", "tomate", "jalapeno", "pina", "albahaca", "feta", "rucula", "mozz"]
      .map((id) => ({ src: IMG + "ingredientes/" + id + ".webp", nombre: id })),
    ...["margarita", "mediterranea", "pepperoni", "cuatro", "hawaiana", "vegetariana", "bbq", "diavola"].map((id) => ({ src: IMG + "pizzas/" + id + ".webp", nombre: "Pizza " + id })),
    ...["glup-cola", "glup-fresh", "glup-uva", "glup-pina", "maltin"].map((id) => ({ src: IMG + "bebidas/" + id + ".webp", nombre: id })),
  ];

  const P = {
    id: "pizzeria",
    nombre: "Pizzería",
    rubro: "Pizzería",
    descripcion: "Menú de pizzas con tamaños, mitad y mitad, y un armador donde el cliente ve caer cada ingrediente real sobre la pizza. Trae una pizza bailarina.",
    nombreDemo: "Pizzería La Bailarina",
    vistaPrevia: "/t/pizzeria/vista.webp",
    varFuente: "--display",
    tieneMascota: true,
    galeria: GALERIA,
    temas: [
      { id: "napoles", nombre: "Nápoles", muestra: ["#d7262b", "#f5c451", "#f3f5f1"] },
      { id: "noche", nombre: "Noche", muestra: ["#141814", "#ec3a3f", "#f5c451"], modo: "dark" },
      { id: "albahaca", nombre: "Albahaca", muestra: ["#1f7a3d", "#f5c451", "#f2f6ef"], modo: "light",
        vars: { "--tomato": "#1f7a3d", "--tomato-soft": "#dcefe1", "--basil": "#c0392b", "--basil-soft": "#f8e1de", "--bg": "#f2f6ef" } },
      { id: "horno", nombre: "Horno de leña", muestra: ["#8a3b12", "#f2a541", "#f7efe6"], modo: "light",
        vars: { "--tomato": "#8a3b12", "--tomato-soft": "#f6e2d4", "--cheese": "#f2a541", "--bg": "#f7efe6", "--surface-2": "#efe3d6", "--line": "#e3d3c2" } },
    ],
    colorear(c, col) {
      const v = {};
      if (c.principal) { v["--tomato"] = c.principal; v["--tomato-ink"] = col.sobre(c.principal); v["--tomato-soft"] = col.mezclar(c.principal, "#ffffff", 0.85); }
      if (c.acento) v["--cheese"] = c.acento;
      if (c.fondo) {
        const oscuro = col.luz(c.fondo) < 0.35;
        v["--bg"] = c.fondo;
        v["--surface"] = oscuro ? col.mezclar(c.fondo, "#ffffff", 0.06) : "#ffffff";
        v["--surface-2"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.12 : 0.05);
        v["--line"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.18 : 0.11);
        v["--fg"] = oscuro ? "#eef1ec" : "#1d221d";
        v["--muted"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", 0.55);
        if (c.principal) v["--tomato-soft"] = col.mezclar(c.principal, c.fondo, oscuro ? 0.75 : 0.85);
      }
      return v;
    },
    agotados: [
      { ruta: "catalogo.pizzas", titulo: "Pizzas" },
      { ruta: "catalogo.ingredientes", titulo: "Ingredientes" },
      { ruta: "catalogo.bebidas", titulo: "Bebidas" },
    ],
    secciones: [
      {
        id: "pizzas", titulo: "Pizzas",
        campos: [
          { tipo: "lista", ruta: "catalogo.pizzas", etiqueta: "Pizzas de la casa", item: "pizza", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "pz",
            ayuda: "El precio es el del tamaño más pequeño. Los otros tamaños suben según el recargo que pongas en Arma tu pizza.",
            nuevo: { nombre: "Pizza nueva", desc: "", precio: 7, foto: "", etiqueta: "", salsa: "tomate", queso: "mozz", masa: "trad", ingredientes: [], agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", forma: "redonda", max: 600, galeria: true, ayuda: "Si no subes foto, la página dibuja la pizza con sus ingredientes." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 40, requerido: true },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio" },
              { tipo: "area", clave: "desc", etiqueta: "Descripción", max: 140 },
              { tipo: "texto", clave: "etiqueta", etiqueta: "Etiqueta", max: 18, placeholder: "Ej: La más pedida" },
              { tipo: "selector", clave: "salsa", etiqueta: "Salsa", opciones: { desde: "pizza.salsas" } },
              { tipo: "selector", clave: "queso", etiqueta: "Queso", opciones: { desde: "pizza.quesos" } },
              { tipo: "selector", clave: "masa", etiqueta: "Masa", opciones: { desde: "pizza.masas" } },
              { tipo: "multi", clave: "ingredientes", etiqueta: "Ingredientes", opciones: { desde: "catalogo.ingredientes" }, ayuda: "Se usan para dibujar la pizza y para el armador." },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotada hoy" },
            ] },
        ],
      },
      {
        id: "arma", titulo: "Arma tu pizza",
        campos: [
          { tipo: "dinero", ruta: "pizza.base", etiqueta: "Precio de la pizza armada sin ingredientes", ayuda: "En el tamaño más pequeño." },
          { tipo: "interruptor", ruta: "pizza.mitad", etiqueta: "Ofrecer mitad y mitad" },
          { tipo: "selector", ruta: "pizza.mitadCobro", etiqueta: "Cómo se cobra la mitad y mitad", opciones: [{ id: "promedio", nombre: "El promedio de las dos mitades" }, { id: "cara", nombre: "Lo de la mitad más cara" }] },
          { tipo: "lista", ruta: "pizza.tamanos", etiqueta: "Tamaños", item: "tamaño", titulo: "nombre", prefijoId: "t", maximo: 4,
            ayuda: "Ordénalos del más pequeño al más grande. El recargo es cuánto más cuesta que el más pequeño.",
            nuevo: { nombre: "Nuevo tamaño", detalle: "", recargo: 50 },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 14, requerido: true },
              { tipo: "texto", clave: "detalle", etiqueta: "Medida", max: 10, placeholder: "Ej: 30 cm" },
              { tipo: "numero", clave: "recargo", etiqueta: "Recargo", sufijo: "%", min: 0, max: 400 },
            ] },
          { tipo: "lista", ruta: "pizza.masas", etiqueta: "Masas", item: "masa", titulo: "nombre", precio: "precio", prefijoId: "m", maximo: 6,
            nuevo: { nombre: "Nueva masa", precio: 0 },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 20, requerido: true },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio extra", ayuda: "0 si viene incluida." },
            ] },
          { tipo: "lista", ruta: "pizza.salsas", etiqueta: "Salsas", item: "salsa", titulo: "nombre", prefijoId: "s", maximo: 6,
            nuevo: { nombre: "Nueva salsa", base: "tomate" },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 20, requerido: true },
              { tipo: "selector", clave: "base", etiqueta: "Cómo se ve", opciones: [{ id: "tomate", nombre: "Roja" }, { id: "bbq", nombre: "Oscura" }, { id: "blanca", nombre: "Blanca" }] },
            ] },
          { tipo: "lista", ruta: "pizza.quesos", etiqueta: "Quesos", item: "queso", titulo: "nombre", precio: "precio", prefijoId: "q", maximo: 6,
            nuevo: { nombre: "Nuevo queso", precio: 0, estilo: "normal" },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 20, requerido: true },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio extra" },
              { tipo: "selector", clave: "estilo", etiqueta: "Cómo se ve", opciones: [{ id: "normal", nombre: "Normal" }, { id: "extra", nombre: "Con más queso" }, { id: "cuatro", nombre: "Varios quesos" }] },
            ] },
        ],
      },
      {
        id: "ingredientes", titulo: "Ingredientes",
        campos: [
          { tipo: "lista", ruta: "catalogo.ingredientes", etiqueta: "Ingredientes", item: "ingrediente", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "i",
            agrupar: { clave: "grupo" },
            ayuda: "El precio es para el tamaño más pequeño; en los otros sube con el mismo recargo.",
            nuevo: { nombre: "Ingrediente nuevo", grupo: "Extras", precio: 1, foto: "", tam: 2.4, n: 10, agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", max: 300, galeria: true, ayuda: "Una foto del ingrediente sin fondo (PNG). Es la que cae sobre la pizza." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 24, requerido: true },
              { tipo: "texto", clave: "grupo", etiqueta: "Grupo", max: 20, ayuda: "Ej: Carnes, Vegetales, Extras." },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio" },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotado hoy" },
            ] },
        ],
      },
      {
        id: "bebidas", titulo: "Bebidas",
        campos: [
          { tipo: "texto", ruta: "bebidasTam.grande", etiqueta: "Nombre del tamaño grande", max: 10 },
          { tipo: "texto", ruta: "bebidasTam.chica", etiqueta: "Nombre del tamaño pequeño", max: 10 },
          { tipo: "lista", ruta: "catalogo.bebidas", etiqueta: "Bebidas", item: "bebida", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "b",
            nuevo: { nombre: "Bebida nueva", foto: "", precio: 1.5, precioChica: 0, agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", max: 500, galeria: true },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 30, requerido: true },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio del tamaño grande" },
              { tipo: "dinero", clave: "precioChica", etiqueta: "Precio del tamaño pequeño", ayuda: "Déjalo en 0 si no lo vendes." },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotada hoy" },
            ] },
        ],
      },
    ],
    apariencia: [
      { tipo: "texto", ruta: "portada.titulo", etiqueta: "Título grande de la portada", max: 50 },
    ],
  };

  P.defaults = K.combinar(K.contenidoBase, {
    negocio: {
      eslogan: "Pizza al horno",
      descripcion: "Elige una de la casa o arma la tuya ingrediente por ingrediente. Te la confirmamos por WhatsApp.",
      horario: { 0: ["12:00", "23:00"], 1: null, 2: ["17:00", "23:00"], 3: ["17:00", "23:00"], 4: ["17:00", "23:00"], 5: ["17:00", "00:00"], 6: ["12:00", "00:00"] },
    },
    pedidos: { delivery: 2, tipos: ["delivery", "llevar", "aqui"] },
    animaciones: { productos: "subir" },
    portada: { titulo: "Pizza al horno, hecha a tu gusto" },
    pizza: {
      base: 5, mitad: true, mitadCobro: "promedio",
      tamanos: [{ id: "p", nombre: "Personal", detalle: "25 cm", recargo: 0 }, { id: "m", nombre: "Mediana", detalle: "30 cm", recargo: 40 }, { id: "f", nombre: "Familiar", detalle: "40 cm", recargo: 90 }],
      masas: [{ id: "trad", nombre: "Tradicional", precio: 0 }, { id: "delg", nombre: "Delgada", precio: 0 }, { id: "borde", nombre: "Borde de queso", precio: 1.5 }],
      salsas: [{ id: "tomate", nombre: "Tomate", base: "tomate" }, { id: "bbq", nombre: "BBQ", base: "bbq" }, { id: "blanca", nombre: "Blanca", base: "blanca" }],
      quesos: [{ id: "mozz", nombre: "Mozzarella", precio: 0, estilo: "normal" }, { id: "extra", nombre: "Extra queso", precio: 1, estilo: "extra" }, { id: "cuatro", nombre: "4 quesos", precio: 1.5, estilo: "cuatro" }],
    },
    bebidasTam: { grande: "2 L", chica: "1 L" },
    catalogo: {
      pizzas: [
        pizza("margarita", "Margarita", "Tomate, mozzarella fresca y albahaca.", 6, "tomate", "mozz", "trad", ["tomate", "albahaca"], "Clásica"),
        pizza("mediterranea", "Mediterránea", "Aceitunas, feta, tomate, cebolla morada y rúcula.", 8, "tomate", "mozz", "delg", ["aceitunas", "feta", "tomate", "cebolla", "rucula"]),
        pizza("pepperoni", "Pepperoni", "Doble pepperoni crujiente sobre mozzarella.", 7, "tomate", "mozz", "trad", ["pepperoni"], "La más pedida"),
        pizza("cuatro", "Cuatro Quesos", "Mozzarella, gorgonzola, parmesano y provolone.", 8.5, "blanca", "cuatro", "trad", []),
        pizza("hawaiana", "Hawaiana", "Jamón y piña dulce. Sin discusiones.", 7.5, "tomate", "mozz", "trad", ["jamon", "pina"]),
        pizza("vegetariana", "Vegetariana", "Pimentón, champiñones, cebolla, maíz y aceitunas.", 7.5, "tomate", "mozz", "trad", ["pimenton", "champi", "cebolla", "maiz", "aceitunas"]),
        pizza("bbq", "BBQ Pollo", "Salsa BBQ, pollo, tocineta y cebolla morada.", 8.5, "bbq", "mozz", "trad", ["pollo", "tocineta", "cebolla"]),
        pizza("diavola", "Diavola", "Pepperoni y jalapeño para los valientes.", 8, "tomate", "mozz", "delg", ["pepperoni", "jalapeno"], "Picante"),
      ],
      ingredientes: [
        top("pepperoni", "Pepperoni", "Carnes", 1.2, 2.7, 13), top("jamon", "Jamón", "Carnes", 1, 2.4, 12), top("tocineta", "Tocineta", "Carnes", 1.3, 3.2, 10), top("pollo", "Pollo", "Carnes", 1.3, 2.9, 12),
        top("champi", "Champiñones", "Vegetales", 1, 2.6, 11), top("pimenton", "Pimentón", "Vegetales", 0.8, 2.9, 11), top("cebolla", "Cebolla morada", "Vegetales", 0.8, 2.7, 10),
        top("aceitunas", "Aceitunas", "Vegetales", 1, 1.45, 13), top("maiz", "Maíz", "Vegetales", 0.8, 1.6, 12), top("tomate", "Tomate", "Vegetales", 0.8, 2.8, 7), top("jalapeno", "Jalapeño", "Vegetales", 0.8, 1.85, 10),
        top("pina", "Piña", "Extras", 1, 2, 11), top("albahaca", "Albahaca", "Extras", 0.6, 2.3, 9), top("feta", "Queso feta", "Extras", 1.2, 1.3, 12), top("rucula", "Rúcula", "Extras", 0.8, 3.3, 7),
      ],
      bebidas: [
        bebida("glup-cola", "Glup! Cola", 1, 1.5), bebida("glup-fresh", "Glup! Fresh", 1, 1.5), bebida("glup-uva", "Glup! Uva", 1, 1.5),
        bebida("glup-pina", "Glup! Piña", 1, 1.5), bebida("maltin", "Maltín Polar", 1.2, 1.8),
      ],
    },
  });

  (window.EU_PLANTILLAS = window.EU_PLANTILLAS || {}).pizzeria = P;
})();
