/* Plantilla Arma tu Arepa: datos de fábrica, temas y lo que el cliente puede editar. */
(function () {
  const K = window.EU_CATALOGOS;
  const IMG = "/t/arepera/img/";
  const ing = (id, cat, nombre, extra) => Object.assign({ id, cat, nombre, foto: IMG + id + ".webp", capa: "relleno", agotado: false }, extra || {});
  const bebida = (id, grupo, nombre, precio, foto, extra) => Object.assign({ id, grupo, nombre, precio, foto: IMG + foto + ".webp", chico: false, frase: "", agotado: false }, extra || {});
  const GALERIA = [
    ["mechada", "Carne mechada"], ["pollo", "Pollo desmechado"], ["pernil", "Pernil"], ["chicharron", "Chicharrón"], ["chorizo", "Chorizo"],
    ["jamon", "Jamón"], ["carne-asada", "Carne asada"], ["blanco", "Queso blanco"], ["guayanes", "Queso guayanés"], ["demano", "Queso de mano"],
    ["amarillo", "Queso amarillo"], ["reina", "Reina pepiada"], ["perico", "Perico"], ["caraotas", "Caraotas"], ["aguacate", "Aguacate"],
    ["tajadas", "Tajadas"], ["huevo", "Huevo frito"], ["tomate", "Tomate"], ["ajo", "Salsa de ajo"], ["picante", "Picante"],
    ["glup-verde", "Refresco verde"], ["glup-uva", "Refresco uva"], ["glup-amarilla", "Refresco amarillo"], ["glup-cola", "Refresco cola"],
    ["jugo-parchita", "Jugo de parchita"], ["jugo-guayaba", "Jugo de guayaba"], ["jugo-tamarindo", "Jugo de tamarindo"], ["malta", "Malta"],
  ].map(([id, nombre]) => ({ src: IMG + id + ".webp", nombre }));

  const P = {
    id: "arepera",
    nombre: "Arma tu arepa",
    rubro: "Arepera",
    descripcion: "El cliente arma su arepa con fotos reales que caen una encima de otra, suma bebidas y manda el pedido por WhatsApp. Trae una arepa bailarina.",
    nombreDemo: "Arma tu Arepa",
    vistaPrevia: "/t/arepera/vista.webp",
    varFuente: "--display",
    tieneMascota: true,
    galeria: GALERIA,
    temas: [
      { id: "sol", nombre: "Sol", muestra: ["#FFF7DD", "#2F8F4E", "#FFC63F"] },
      { id: "noche", nombre: "Noche", muestra: ["#1C130B", "#55C27A", "#6A4416"], modo: "dark" },
      { id: "caribe", nombre: "Caribe", muestra: ["#EAF7F6", "#0F7C8C", "#7FD3C8"], modo: "light",
        vars: { "--bg": "#EAF7F6", "--line": "#C5E6E1", "--chip": "#D3EFEA", "--ray-a": "#9EE0D6", "--ray-b": "#7FD3C8", "--glow": "#E2FBF7", "--toast": "#0F7C8C",
          "--leaf": "#0F7C8C", "--leaf-deep": "#0A5864", "--ink": "#12343A", "--muted": "#4F6F73", "--plate-rim": "#C5E6E1" } },
      { id: "guayaba", nombre: "Guayaba", muestra: ["#FFF1F1", "#C2334D", "#FFB3B8"], modo: "light",
        vars: { "--bg": "#FFF1F1", "--line": "#F5D0D3", "--chip": "#FFE0E2", "--ray-a": "#FFC9CD", "--ray-b": "#FFB3B8", "--glow": "#FFF0F1", "--toast": "#C2334D",
          "--leaf": "#C2334D", "--leaf-deep": "#8E2034", "--ink": "#3B1219", "--muted": "#7D4B53", "--plate-rim": "#F0CDD1" } },
    ],
    colorear(c, col) {
      const v = {};
      if (c.principal) { v["--leaf"] = c.principal; v["--leaf-deep"] = col.mezclar(c.principal, "#000000", 0.3); v["--leaf-ink"] = col.sobre(c.principal); v["--toast"] = c.principal; }
      if (c.acento) { v["--ray-b"] = c.acento; v["--ray-a"] = col.mezclar(c.acento, "#ffffff", 0.3); v["--glow"] = col.mezclar(c.acento, "#ffffff", 0.75); }
      if (c.fondo) {
        const oscuro = col.luz(c.fondo) < 0.35;
        v["--bg"] = c.fondo;
        v["--panel"] = oscuro ? col.mezclar(c.fondo, "#ffffff", 0.07) : "#ffffff";
        v["--line"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.16 : 0.1);
        v["--chip"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", oscuro ? 0.1 : 0.05);
        v["--ink"] = oscuro ? "#FCEBC8" : "#3A2414";
        v["--muted"] = col.mezclar(c.fondo, oscuro ? "#ffffff" : "#000000", 0.55);
      }
      return v;
    },
    agotados: [
      { ruta: "catalogo.ingredientes", titulo: "Rellenos" },
      { ruta: "catalogo.bebidas", titulo: "Bebidas" },
    ],
    secciones: [
      {
        id: "arepa", titulo: "Precios",
        campos: [
          { tipo: "texto", ruta: "arepa.nombre", etiqueta: "Qué arma el cliente", max: 20, ayuda: "Sale en el botón y en el pedido. Ej: Arepa, Cachapa, Empanada." },
          { tipo: "dinero", ruta: "arepa.precio", etiqueta: "Precio base" },
          { tipo: "lista", ruta: "catalogo.categorias", etiqueta: "Tipos de relleno", item: "tipo", titulo: "nombre", prefijoId: "cat", maximo: 5,
            ayuda: "Son las pestañas. Puedes decir cuántos van incluidos en el precio base y cuánto cuesta cada uno de más.",
            nuevo: { nombre: "Nuevo tipo", incluidos: 0, adicional: 0.5, nota: "" },
            campos: [
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 12, requerido: true },
              { tipo: "numero", clave: "incluidos", etiqueta: "Incluidos en el precio", min: 0, max: 10 },
              { tipo: "dinero", clave: "adicional", etiqueta: "Precio de cada uno de más" },
              { tipo: "texto", clave: "nota", etiqueta: "Nota (opcional)", max: 90, ayuda: "Si la dejas vacía, la página explica sola lo que va incluido." },
            ] },
        ],
      },
      {
        id: "rellenos", titulo: "Rellenos",
        campos: [
          { tipo: "lista", ruta: "catalogo.ingredientes", etiqueta: "Rellenos", item: "relleno", titulo: "nombre", foto: "foto", prefijoId: "i",
            agrupar: { clave: "cat", desde: "catalogo.categorias" },
            nuevo: { nombre: "Relleno nuevo", foto: "", capa: "relleno", agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", max: 700, galeria: true, ayuda: "Para que caiga sobre la arepa, usa una foto del relleno sin fondo (PNG) o elige una de la plantilla." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 40, requerido: true },
              { tipo: "selector", clave: "cat", etiqueta: "Tipo", opciones: { desde: "catalogo.categorias" } },
              { tipo: "selector", clave: "capa", etiqueta: "Cómo se pone", opciones: [{ id: "relleno", nombre: "Relleno (va apilado)" }, { id: "salsa", nombre: "Salsa (va por encima)" }] },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotado hoy" },
            ] },
        ],
      },
      {
        id: "bebidas", titulo: "Bebidas",
        campos: [
          { tipo: "lista", ruta: "catalogo.bebidas", etiqueta: "Bebidas", item: "bebida", titulo: "nombre", foto: "foto", precio: "precio", prefijoId: "b",
            agrupar: { clave: "grupo" },
            nuevo: { nombre: "Bebida nueva", grupo: "Refrescos", precio: 1, foto: "", chico: false, frase: "", agotado: false },
            campos: [
              { tipo: "foto", clave: "foto", etiqueta: "Foto", max: 500, galeria: true, ayuda: "Mejor una foto de la botella o el vaso sin fondo." },
              { tipo: "texto", clave: "nombre", etiqueta: "Nombre", max: 40, requerido: true },
              { tipo: "texto", clave: "grupo", etiqueta: "Grupo", max: 30, ayuda: "Las bebidas del mismo grupo salen juntas. Ej: Refrescos, Jugos naturales." },
              { tipo: "dinero", clave: "precio", etiqueta: "Precio" },
              { tipo: "interruptor", clave: "chico", etiqueta: "Se ve más pequeña", ayuda: "Para las de 1 litro o las latas." },
              { tipo: "texto", clave: "frase", etiqueta: "Lo que dice la mascota al agregarla", max: 40 },
              { tipo: "interruptor", clave: "agotado", etiqueta: "Agotada hoy" },
            ] },
        ],
      },
    ],
    apariencia: [
      { tipo: "etiquetas", ruta: "mascota.frases", etiqueta: "Frases de la arepa bailarina", max: 10, largo: 30, ayuda: "Lo que dice cuando el cliente agrega un relleno. Toca una frase para quitarla." },
    ],
  };

  P.defaults = K.combinar(K.contenidoBase, {
    negocio: {
      eslogan: "Arma tu arepa",
      descripcion: "Elige carnes, quesos y extras, y pide por WhatsApp.",
    },
    pedidos: { tipos: ["llevar", "delivery", "aqui"] },
    animaciones: { portada: "ninguna", productos: "zoom" },
    arepa: { nombre: "Arepa", precio: 3.5 },
    mascota: { frases: ["¡Qué rico!", "¡Eso, eso!", "¡Rellenita!", "¡Mmm, sabrosa!", "¡Va quedando bella!", "¡Otra más!"] },
    catalogo: {
      categorias: [
        { id: "carnes", nombre: "Carnes", incluidos: 2, adicional: 0.5, nota: "" },
        { id: "quesos", nombre: "Quesos", incluidos: 0, adicional: 0.5, nota: "" },
        { id: "otros", nombre: "Otros", incluidos: 0, adicional: 0.5, nota: "" },
        { id: "extras", nombre: "Extras", incluidos: 1, adicional: 0.5, nota: "" },
      ],
      ingredientes: [
        ing("mechada", "carnes", "Carne mechada"), ing("pollo", "carnes", "Pollo desmechado"), ing("pernil", "carnes", "Pernil"),
        ing("chicharron", "carnes", "Chicharrón"), ing("chorizo", "carnes", "Chorizo"), ing("jamon", "carnes", "Jamón"), ing("carne-asada", "carnes", "Carne asada"),
        ing("blanco", "quesos", "Queso blanco rallado"), ing("guayanes", "quesos", "Queso guayanés"), ing("demano", "quesos", "Queso de mano"), ing("amarillo", "quesos", "Queso amarillo"),
        ing("reina", "otros", "Reina pepiada"), ing("perico", "otros", "Perico"), ing("caraotas", "otros", "Caraotas negras"),
        ing("aguacate", "extras", "Aguacate"), ing("tajadas", "extras", "Tajadas"), ing("huevo", "extras", "Huevo frito"), ing("tomate", "extras", "Tomate"),
        ing("ajo", "extras", "Salsa de ajo", { capa: "salsa" }), ing("picante", "extras", "Picante", { capa: "salsa" }),
      ],
      bebidas: [
        ...[["limon", "Limón", "glup-verde"], ["uva", "Uva", "glup-uva"], ["pina", "Piña", "glup-amarilla"], ["cola", "Cola", "glup-cola"]].flatMap(([id, sabor, foto]) => [
          bebida(`glup-${id}-1`, "Refrescos Glup", `Glup ${sabor} 1 L`, 1.5, foto, { chico: true, frase: "¡Glup, glup, glup!" }),
          bebida(`glup-${id}-2`, "Refrescos Glup", `Glup ${sabor} 2 L`, 2.5, foto, { frase: "¡Glup, glup, glup!" }),
        ]),
        bebida("parchita", "Jugos naturales", "Jugo de parchita", 2, "jugo-parchita", { frase: "¡Juguito de parchita!" }),
        bebida("guayaba", "Jugos naturales", "Jugo de guayaba", 2, "jugo-guayaba", { frase: "¡Rico jugo de guayaba!" }),
        bebida("tamarindo", "Jugos naturales", "Jugo de tamarindo", 2, "jugo-tamarindo", { frase: "¡Tamarindo, qué sabroso!" }),
        bebida("malta", "Malta", "Malta", 1.5, "malta", { frase: "¡Una malta bien fría!" }),
      ],
    },
  });

  (window.EU_PLANTILLAS = window.EU_PLANTILLAS || {}).arepera = P;
})();
