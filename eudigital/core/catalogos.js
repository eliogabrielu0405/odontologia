/* Opciones que comparten las páginas y el panel: fuentes, animaciones y temporadas. */
window.EU_CATALOGOS = {
  fuentes: [
    { id: "", nombre: "La de la plantilla" },
    { id: "lilita", nombre: "Lilita One: redonda y gruesa", css: "Lilita+One", familia: '"Lilita One","Arial Rounded MT Bold",sans-serif' },
    { id: "baloo", nombre: "Baloo: amistosa", css: "Baloo+2:wght@700;800", familia: '"Baloo 2","Trebuchet MS",sans-serif' },
    { id: "bebas", nombre: "Bebas Neue: alta y angosta", css: "Bebas+Neue", familia: '"Bebas Neue",Impact,sans-serif' },
    { id: "pacifico", nombre: "Pacifico: escrita a mano", css: "Pacifico", familia: "Pacifico,cursive" },
    { id: "brush", nombre: "Caveat Brush: de pincel", css: "Caveat+Brush", familia: '"Caveat Brush",cursive' },
    { id: "playfair", nombre: "Playfair: elegante", css: "Playfair+Display:wght@700;800", familia: '"Playfair Display",Georgia,serif' },
    { id: "bodoni", nombre: "Bodoni: de revista de moda", css: "Bodoni+Moda:wght@600;700", familia: '"Bodoni Moda",Didot,Georgia,serif' },
    { id: "shippori", nombre: "Shippori: japonesa", css: "Shippori+Mincho+B1:wght@800", familia: '"Shippori Mincho B1","Yu Mincho",serif' },
  ],
  portada: [
    { id: "ninguna", nombre: "Sin animación" },
    { id: "petalos", nombre: "Pétalos cayendo" },
    { id: "confeti", nombre: "Confeti" },
    { id: "nieve", nombre: "Nieve" },
    { id: "corazones", nombre: "Corazones" },
    { id: "burbujas", nombre: "Burbujas que suben" },
    { id: "estrellas", nombre: "Estrellas que brillan" },
    { id: "emojis", nombre: "Emojis cayendo (tú los eliges)" },
  ],
  logo: [
    { id: "ninguna", nombre: "Quieto" },
    { id: "latido", nombre: "Late" },
    { id: "rebote", nombre: "Rebota" },
    { id: "giro", nombre: "Gira despacio" },
    { id: "brillo", nombre: "Destello" },
  ],
  productos: [
    { id: "ninguna", nombre: "Aparecen de una vez" },
    { id: "subir", nombre: "Suben suave al bajar" },
    { id: "zoom", nombre: "Crecen al aparecer" },
    { id: "girar", nombre: "Giran un poco al aparecer" },
  ],
  boton: [
    { id: "ninguna", nombre: "Quieto" },
    { id: "latido", nombre: "Late" },
    { id: "brillo", nombre: "Destello" },
    { id: "rebote", nombre: "Rebota" },
  ],
  temporada: [
    { id: "ninguna", nombre: "Ninguna" },
    { id: "navidad", nombre: "Navidad: nieve y saludo", saludo: "¡Feliz Navidad!" },
    { id: "anonuevo", nombre: "Año Nuevo: confeti dorado", saludo: "¡Feliz Año Nuevo!" },
    { id: "carnaval", nombre: "Carnaval: confeti de colores", saludo: "¡Feliz Carnaval!" },
    { id: "sanvalentin", nombre: "San Valentín: corazones", saludo: "¡Feliz día del amor y la amistad!" },
    { id: "madres", nombre: "Día de las Madres: flores", saludo: "¡Feliz día, mamá!" },
    { id: "halloween", nombre: "Halloween: calabazas", saludo: "¡Feliz Halloween!" },
  ],
  banner: [
    { id: "fijo", nombre: "Quieto" },
    { id: "desliza", nombre: "Se desliza" },
    { id: "parpadea", nombre: "Llama la atención" },
  ],
  dias: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
};

/* Utilidades compartidas: mezcla de datos y de colores. */
(function (K) {
  const esObjeto = (v) => v && typeof v === "object" && !Array.isArray(v);
  // Mezcla profunda: lo guardado gana; las listas guardadas reemplazan a las de fábrica.
  K.combinar = function combinar(base, encima) {
    if (encima === undefined) return JSON.parse(JSON.stringify(base));
    if (!esObjeto(base) || !esObjeto(encima)) return JSON.parse(JSON.stringify(encima));
    const out = JSON.parse(JSON.stringify(base));
    for (const k of Object.keys(encima)) out[k] = k in base ? combinar(base[k], encima[k]) : JSON.parse(JSON.stringify(encima[k]));
    return out;
  };
  const hex = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
    return m ? "#" + m[1].toLowerCase() : null;
  };
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const aHex = (a) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  K.color = {
    valido: hex,
    mezclar(a, b, t) { a = hex(a); b = hex(b); if (!a || !b) return a || b; const x = rgb(a), y = rgb(b); return aHex(x.map((v, i) => v + (y[i] - v) * t)); },
    luz(h) { h = hex(h); if (!h) return 1; const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; },
    sobre(h) { return K.color.luz(h) > 0.4 ? "#1a1a1a" : "#ffffff"; },
  };

  /* Redes sociales que el negocio puede poner. "base" arma el enlace cuando escriben solo el usuario. */
  K.redes = [
    { id: "instagram", nombre: "Instagram", base: "https://www.instagram.com/" },
    { id: "tiktok", nombre: "TikTok", base: "https://www.tiktok.com/@" },
    { id: "facebook", nombre: "Facebook", base: "https://www.facebook.com/" },
    { id: "youtube", nombre: "YouTube", base: "https://www.youtube.com/@" },
    { id: "x", nombre: "X (Twitter)", corto: "X", base: "https://x.com/" },
    { id: "threads", nombre: "Threads", base: "https://www.threads.net/@" },
    { id: "telegram", nombre: "Telegram", base: "https://t.me/" },
  ];

  K.contenidoBase = {
    negocio: {
      eslogan: "", descripcion: "", logo: "",
      whatsapp: "", telefono: "",
      direccion: "", referencia: "", ciudad: "", mapa: "",
      instagram: "", tiktok: "", facebook: "", youtube: "", x: "", threads: "", telegram: "",
      horario: { 0: ["12:00", "22:00"], 1: ["11:00", "22:00"], 2: ["11:00", "22:00"], 3: ["11:00", "22:00"], 4: ["11:00", "22:00"], 5: ["11:00", "23:00"], 6: ["11:00", "23:00"] },
    },
    pedidos: { delivery: 0, notaDelivery: "El delivery tiene un costo adicional según la zona.", tipos: ["delivery", "llevar", "aqui"] },
    pagos: [
      { id: "pagomovil", nombre: "Pago Móvil", datos: [["Banco", ""], ["Teléfono", ""], ["Cédula", ""]], nota: "Envía la captura del pago por WhatsApp.", delivery: true, local: true, bs: true },
      { id: "efectivo", nombre: "Efectivo", datos: [], nota: "Dólares o bolívares. Si necesitas cambio, dinos con cuánto pagas.", delivery: true, local: true, bs: false },
      { id: "zelle", nombre: "Zelle", datos: [["Correo", ""], ["Titular", ""]], nota: "Envía la captura del pago por WhatsApp.", delivery: true, local: true, bs: false },
      { id: "binance", nombre: "Binance Pay", datos: [["Pay ID", ""]], nota: "Envía la captura del pago por WhatsApp.", delivery: true, local: true, bs: false },
      { id: "punto", nombre: "Punto de venta", datos: [], nota: "Tarjeta de débito o crédito en el local.", delivery: false, local: true, bs: true },
      { id: "biopago", nombre: "Biopago", datos: [], nota: "Pagas con tu huella en el local.", delivery: false, local: true, bs: true },
    ],
    tasa: { valor: 0, fecha: "" },
    hoy: { cerrado: false, aviso: "" },
    tema: { preset: "", colores: { principal: "", acento: "", fondo: "" }, fuente: "", modo: "" },
    animaciones: { portada: "ninguna", emoji: "", logo: "ninguna", productos: "subir", boton: "ninguna", temporada: "ninguna", mascota: true, personaje: "", baile: "meneo" },
    banner: { texto: "", estilo: "fijo" },
  };
})(window.EU_CATALOGOS);
