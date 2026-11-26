/* Vista previa al compartir un enlace (WhatsApp, Facebook, Instagram, Telegram, X…).
   Esos servicios leen la página sin ejecutar JavaScript, así que cuando el que pide es uno de
   sus robots se le responde una página corta con el nombre, la descripción y la imagen del
   negocio. Las personas siguen de largo hacia la página normal. */

export const config = { matcher: ["/", "/t/:plantilla", "/t/:plantilla/", "/registro", "/registro/"] };

// Robots que arman vistas previas de enlaces. No incluye buscadores (esos sí ejecutan la página)
// ni navegadores dentro de apps como Instagram o Facebook, que son personas.
const ROBOTS = /WhatsApp|facebookexternalhit|Facebot|meta-externalagent|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|Pinterestbot|SkypeUriPreview|redditbot|Embedly|Iframely|Cardyb|vkShare/i;

const PLANTILLAS = {
  pizzeria: { nombre: "Pizzería", texto: "Página de pedidos para pizzerías: el cliente arma su pizza y te llega el pedido por WhatsApp." },
  arepera: { nombre: "Arepera", texto: "Página de pedidos para areperas: el cliente arma su arepa y te llega el pedido por WhatsApp." },
  burgers: { nombre: "Burgers y perros", texto: "Página de pedidos para hamburguesas y perros calientes, con pedidos directo a tu WhatsApp." },
  delicias: { nombre: "Delicias", texto: "Menú moderno de comida rápida con buscador, opciones y adicionales, y pedidos directo a tu WhatsApp." },
  sushi: { nombre: "Sushi", texto: "Página de pedidos para sushi, con carrito y pedidos directo a tu WhatsApp." },
  boutique: { nombre: "Boutique", texto: "Catálogo de ropa con tallas y colores, y pedidos directo a tu WhatsApp." },
};
// Respaldo por si no se puede leer core/config.js (son los mismos datos públicos de ese archivo)
const RESPALDO = {
  supabaseUrl: "https://rbssbogagijomskbzezv.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJic3Nib2dhZ2lqb21za2J6ZXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNzEwMDQsImV4cCI6MjEwOTk0NzAwNH0.RXKETjReiRIfCdTiwPDEBgWCfXW-X7S8vXIA4Thq6w4",
  dominioBase: "", marca: "EU Digital Solutions",
};

const seguir = () => new Response(null, { headers: { "x-middleware-next": "1" } });

export default async function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!ROBOTS.test(ua)) return seguir();
  try { return await vistaPrevia(request); }
  catch (_) { return seguir(); }
}

async function leerConfig(origen) {
  try {
    const r = await fetch(origen + "/core/config.js", { headers: { "user-agent": "eu-vista-previa" } });
    if (!r.ok) return RESPALDO;
    const t = await r.text();
    const dato = (k) => { const m = t.match(new RegExp(k + '\\s*:\\s*"([^"]*)"')); return m ? m[1] : null; };
    const c = { supabaseUrl: dato("supabaseUrl"), supabaseKey: dato("supabaseKey"), dominioBase: dato("dominioBase") || "", marca: dato("marca") || RESPALDO.marca };
    return c.supabaseUrl && c.supabaseKey ? c : RESPALDO;
  } catch (_) { return RESPALDO; }
}

function esPlataforma(host, C) {
  if (!host || host === "localhost" || host === "127.0.0.1") return true;
  if (/\.((workers|pages)\.dev|vercel\.app|netlify\.app)$/.test(host)) return true;
  return !!C.dominioBase && (host === C.dominioBase || host === "www." + C.dominioBase);
}

async function vistaPrevia(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const origen = url.protocol + "//" + url.host;
  const C = await leerConfig(origen);
  const m = url.pathname.match(/^\/t\/([a-z0-9-]+)\/?$/);
  const plantilla = m ? m[1] : "";
  const n = (url.searchParams.get("n") || url.searchParams.get("negocio") || "").trim().toLowerCase();

  // ¿De qué negocio es esta dirección?
  let filtro = "";
  if (/^[a-z0-9-]{1,40}$/.test(n)) filtro = "slug=eq." + n;
  else if (!plantilla && !esPlataforma(host, C)) {
    const base = C.dominioBase;
    if (base && host.endsWith("." + base)) {
      const sub = host.slice(0, -(base.length + 1));
      if (/^[a-z0-9-]{1,40}$/.test(sub) && !["www", "app", "panel", "admin"].includes(sub)) filtro = "slug=eq." + sub;
    } else filtro = "dominio=eq." + encodeURIComponent(host.replace(/^www\./, ""));
  }

  if (filtro) {
    const api = C.supabaseUrl.replace(/\/+$/, "");
    const r = await fetch(api + "/rest/v1/eu_sitios?select=slug,nombre,plantilla,dominio,negocio:contenido->negocio,compartir:contenido->compartir&estado=eq.activo&limit=1&" + filtro, {
      headers: { apikey: C.supabaseKey, Authorization: "Bearer " + C.supabaseKey },
    });
    const filas = r.ok ? await r.json() : [];
    const s = filas && filas[0];
    if (!s) {
      return responder({
        titulo: "Página no disponible", descripcion: "Esta página de pedidos no está disponible en este momento.",
        url: url.href, sitio: C.marca, abrir: "/index.html" + url.search, noindex: true, cache: 120,
      });
    }
    const neg = s.negocio || {};
    const comp = s.compartir || {};
    const tarjeta = https(comp.imagen);
    const logo = https(neg.logo);
    const catalogo = s.plantilla === "boutique";
    const pagina = s.dominio ? "https://" + s.dominio + "/" : origen + "/?n=" + encodeURIComponent(s.slug);
    return responder({
      titulo: String(s.nombre || "").trim() || "Haz tu pedido",
      descripcion: limpiar(neg.eslogan) || limpiar(neg.descripcion) || (catalogo ? "Mira el catálogo y haz tu pedido por WhatsApp." : "Mira el menú y haz tu pedido por WhatsApp."),
      imagen: tarjeta || logo, ancho: tarjeta ? 1200 : 0, alto: tarjeta ? 630 : 0, tipoImagen: tarjeta ? "image/jpeg" : "",
      url: pagina, sitio: String(s.nombre || C.marca),
      abrir: "/t/" + encodeURIComponent(s.plantilla) + "/index.html?n=" + encodeURIComponent(s.slug), cache: 300,
    });
  }

  if (/^\/registro\/?$/.test(url.pathname)) {
    return responder({
      titulo: "Crea tu página de pedidos y pruébala gratis",
      descripcion: "Eliges la plantilla, pones los datos de tu negocio y tu página queda en línea. Sin tarjeta: al terminar la prueba eliges tu plan.",
      imagen: origen + "/img/compartir.jpg", ancho: 1200, alto: 630, tipoImagen: "image/jpeg",
      url: origen + "/registro/", sitio: C.marca, abrir: "/registro/index.html" + url.search, cache: 3600,
    });
  }

  if (plantilla && PLANTILLAS[plantilla]) {
    const p = PLANTILLAS[plantilla];
    return responder({
      titulo: "Plantilla " + p.nombre + " · " + C.marca, descripcion: p.texto,
      imagen: origen + "/t/" + plantilla + "/compartir.jpg", ancho: 1200, alto: 630, tipoImagen: "image/jpeg",
      url: origen + "/t/" + plantilla + "/", sitio: C.marca, abrir: "/t/" + plantilla + "/index.html", cache: 3600,
    });
  }

  return responder({
    titulo: C.marca + ": tu página de pedidos por WhatsApp",
    descripcion: "Tu menú o tu catálogo en línea, con pedidos directo a tu WhatsApp. Pruébala gratis: cambias precios, fotos y la tasa del día desde tu teléfono.",
    imagen: origen + "/img/compartir.jpg", ancho: 1200, alto: 630, tipoImagen: "image/jpeg",
    url: origen + "/", sitio: C.marca, abrir: "/index.html", cache: 3600,
  });
}

function https(u) {
  try { const x = new URL(String(u || "")); return x.protocol === "https:" ? x.href : ""; } catch (_) { return ""; }
}
function limpiar(t) { return String(t || "").replace(/\s+/g, " ").trim().slice(0, 200); }
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);

function responder({ titulo, descripcion, imagen, ancho, alto, tipoImagen, url, sitio, abrir, noindex, cache }) {
  const img = imagen
    ? `<meta property="og:image" content="${e(imagen)}">
<meta property="og:image:secure_url" content="${e(imagen)}">${tipoImagen ? `
<meta property="og:image:type" content="${tipoImagen}">` : ""}${ancho ? `
<meta property="og:image:width" content="${ancho}">
<meta property="og:image:height" content="${alto}">` : ""}
<meta property="og:image:alt" content="${e(titulo)}">
<meta name="twitter:image" content="${e(imagen)}">` : "";
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titulo)}</title>
<meta name="description" content="${e(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_VE">
<meta property="og:site_name" content="${e(sitio)}">
<meta property="og:title" content="${e(titulo)}">
<meta property="og:description" content="${e(descripcion)}">
<meta property="og:url" content="${e(url)}">
${img}
<meta name="twitter:card" content="${imagen && ancho ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${e(titulo)}">
<meta name="twitter:description" content="${e(descripcion)}">
<link rel="canonical" href="${e(url)}">${noindex ? `
<meta name="robots" content="noindex">` : ""}
</head>
<body>
<h1>${e(titulo)}</h1>
<p>${e(descripcion)}</p>
<p><a href="${e(abrir)}">Abrir la página</a></p>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=" + (cache || 300), "x-eu-vista": "1" },
  });
}
