// EU Digital: avisos al teléfono del administrador (Web Push).
// Cuando un cliente reporta un pago, su panel llama a esta función y ella le manda una
// notificación a cada dispositivo donde el administrador activó los avisos.
//
// Acciones (POST, con la sesión de quien llama):
//   { accion: "clave" }            solo admin: la clave pública para suscribir un dispositivo
//   { accion: "prueba" }           solo admin: manda un aviso de prueba a sus dispositivos
//   { accion: "pago", pago: id }   dueño de la página o admin: avisa de ese pago (una sola vez)
//   { accion: "registro" }         quien se acaba de registrar: avisa de su cuenta nueva (una sola vez)
//
// No usa librerías: el cifrado (RFC 8291, aes128gcm) y la firma VAPID (RFC 8292) van con WebCrypto.

const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
// Contacto que piden los servicios de avisos (Google, Apple, Mozilla) por si necesitan ubicar al remitente
const CONTACTO = Deno.env.get("EU_AVISOS_CONTACTO") || "https://eu-digital-solutions.vercel.app";

const txt = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLANTILLAS = { pizzeria: "Pizzería", arepera: "Arepera", burgers: "Burgers y perros", sushi: "Sushi bar", boutique: "Boutique" };
const PLANES = { basico: "Básico", premium: "Premium" };
const SERVICIOS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com|push\.samsungosp\.com)$/;

export const b64 = {
  cod(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(texto) {
    const t = String(texto || "").replace(/-/g, "+").replace(/_/g, "/");
    const s = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
};

function unir(...partes) {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
}

async function hkdf(sal, material, info, largo) {
  const k = await crypto.subtle.importKey("raw", material, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sal, info }, k, largo * 8));
}

// Cifra el mensaje para un dispositivo (RFC 8291). "fijo" solo se usa en las pruebas, para repetir el ejemplo del RFC.
export async function cifrar(datos, p256dh, auth, fijo) {
  const delNavegador = b64.dec(p256dh), secreto = b64.dec(auth);
  if (delNavegador.length !== 65 || delNavegador[0] !== 4 || secreto.length !== 16) throw new Error("suscripcion");
  const par = (fijo && fijo.par) || (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  const mia = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const suya = await crypto.subtle.importKey("raw", delNavegador, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: suya }, par.privateKey, 256));
  const material = await hkdf(secreto, compartido, unir(txt.encode("WebPush: info\0"), delNavegador, mia), 32);
  const sal = (fijo && fijo.sal) || crypto.getRandomValues(new Uint8Array(16));
  const llave = await hkdf(sal, material, txt.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, material, txt.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", llave, "AES-GCM", false, ["encrypt"]);
  // 0x02 marca el último (y único) bloque
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, unir(datos, new Uint8Array([2]))));
  const cab = new Uint8Array(21);
  cab.set(sal, 0);
  new DataView(cab.buffer).setUint32(16, 4096);
  cab[20] = mia.length;
  return unir(cab, mia, cifrado);
}

// Encabezado Authorization que identifica al remitente ante el servicio de avisos (RFC 8292)
export async function vapid(endpoint, clave, ahora) {
  const cab = b64.cod(txt.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cuerpo = b64.cod(txt.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor((ahora || Date.now()) / 1000) + 12 * 3600,
    sub: CONTACTO,
  })));
  const firma = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, clave.privada, txt.encode(cab + "." + cuerpo)));
  return "vapid t=" + cab + "." + cuerpo + "." + b64.cod(firma) + ", k=" + clave.publica;
}

/* ---------- Base de datos (con la llave de servicio: solo esta función la tiene) ---------- */
async function db(ruta, op) {
  op = op || {};
  const r = await fetch(SB + "/rest/v1/" + ruta, Object.assign({}, op, {
    headers: Object.assign({ apikey: SERVICIO, Authorization: "Bearer " + SERVICIO, "Content-Type": "application/json" }, op.headers || {}),
  }));
  const t = await r.text();
  if (!r.ok) throw new Error("db " + r.status + " " + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}

async function quienLlama(req) {
  const aut = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/.test(aut)) return null;
  const r = await fetch(SB + "/auth/v1/user", { headers: { Authorization: aut, apikey: ANON } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && UUID.test(u.id || "") ? u.id : null;
}

// La clave del remitente se crea sola la primera vez y queda guardada donde solo esta función la lee
async function claveAvisos() {
  let filas = await db("eu_avisos_clave?select=jwk,publica&id=eq.1");
  if (!filas.length) {
    const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
    const publica = b64.cod(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey)));
    await db("eu_avisos_clave?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ id: 1, jwk, publica }) });
    filas = await db("eu_avisos_clave?select=jwk,publica&id=eq.1");
  }
  const j = filas[0].jwk;
  const privada = await crypto.subtle.importKey("jwk", { kty: j.kty, crv: j.crv, x: j.x, y: j.y, d: j.d }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { privada, publica: filas[0].publica };
}

function destinoValido(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && SERVICIOS.test(u.hostname);
  } catch (_) { return false; }
}

async function enviar(s, datos, clave) {
  if (!destinoValido(s.endpoint)) return "quitar";
  let cuerpo;
  try { cuerpo = await cifrar(datos, s.p256dh, s.auth); } catch (_) { return "quitar"; }
  const r = await fetch(s.endpoint, {
    method: "POST",
    headers: { TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: await vapid(s.endpoint, clave) },
    body: cuerpo,
    signal: AbortSignal.timeout(8000),
  });
  if (r.status === 404 || r.status === 410) return "quitar"; // el dispositivo ya no existe o quitó el permiso
  return r.ok ? "ok" : "fallo " + r.status;
}

async function repartir(subs, aviso) {
  if (!subs.length) return { dispositivos: 0, enviados: 0, fallidos: 0 };
  const clave = await claveAvisos();
  const datos = txt.encode(JSON.stringify(aviso));
  const res = await Promise.all(subs.map((s) => enviar(s, datos, clave).catch((e) => "fallo " + ((e && e.name) || "red"))));
  const quitar = subs.filter((_, i) => res[i] === "quitar").map((s) => s.id).filter((id) => UUID.test(id));
  if (quitar.length) await db("eu_avisos?id=in.(" + quitar.join(",") + ")", { method: "DELETE" }).catch(() => null);
  const fallos = res.filter((r) => r.startsWith("fallo"));
  if (fallos.length) console.error("avisos con falla:", fallos.join(", "));
  return { dispositivos: subs.length, enviados: res.filter((r) => r === "ok").length, fallidos: fallos.length, quitados: quitar.length };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (obj, estado) => new Response(JSON.stringify(obj), { status: estado || 200, headers: Object.assign({ "Content-Type": "application/json" }, CORS) });

export async function atender(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return responder({ error: "Solo POST" }, 405);
  try {
    const uid = await quienLlama(req);
    if (!uid) return responder({ error: "Sesión no válida" }, 401);
    const b = (await req.json().catch(() => null)) || {};
    const esAdmin = (await db("eu_admins?select=user_id&user_id=eq." + uid)).length > 0;

    if (b.accion === "clave") {
      if (!esAdmin) return responder({ error: "No autorizado" }, 403);
      return responder({ clave: (await claveAvisos()).publica });
    }

    if (b.accion === "prueba") {
      if (!esAdmin) return responder({ error: "No autorizado" }, 403);
      const subs = await db("eu_avisos?select=id,endpoint,p256dh,auth&user_id=eq." + uid);
      return responder(await repartir(subs, { titulo: "Avisos activados", texto: "Así te va a llegar cada pago que te reporten.", url: "/admin/", tag: "eu-prueba" }));
    }

    if (b.accion === "pago") {
      const id = String(b.pago || "");
      if (!UUID.test(id)) return responder({ error: "Falta el pago" }, 400);
      const p = (await db("eu_pagos?select=id,sitio_id,monto,moneda,metodo,referencia,meses,plan,ciclo,estado,avisado&id=eq." + id))[0];
      if (!p) return responder({ error: "Ese pago no existe" }, 404);
      const s = (await db("eu_sitios?select=nombre,dueno&id=eq." + p.sitio_id))[0];
      if (!s || (!esAdmin && s.dueno !== uid)) return responder({ error: "No autorizado" }, 403);
      if (p.estado !== "pendiente" || p.avisado) return responder({ enviados: 0, repetido: true });
      // Se marca primero: si dos llamadas llegan a la vez, solo una avisa
      const marcado = await db("eu_pagos?id=eq." + id + "&avisado=is.null&select=id", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ avisado: new Date().toISOString() }) });
      if (!marcado.length) return responder({ enviados: 0, repetido: true });
      const monto = p.moneda === "VES"
        ? "Bs " + Number(p.monto).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "$" + Number(p.monto).toFixed(2);
      const tiempo = p.ciclo === "anual" ? "1 año" : p.meses + (Number(p.meses) === 1 ? " mes" : " meses");
      const texto = [monto + " por " + p.metodo, p.referencia ? "Ref. " + p.referencia : "", (PLANES[p.plan] ? "Plan " + PLANES[p.plan] + ", " : "") + tiempo].filter(Boolean).join(" · ");
      const subs = await db("eu_avisos?select=id,endpoint,p256dh,auth");
      return responder(await repartir(subs, { titulo: "Pago reportado: " + s.nombre, texto, url: "/admin/#pagos", tag: "pago-" + id }));
    }

    if (b.accion === "registro") {
      // Solo la cuenta de quien llama, y solo si se registró sola desde la portada
      const s = (await db("eu_sitios?select=id,nombre,slug,plantilla&principal=is.null&dueno=eq." + uid + "&limit=1"))[0];
      if (!s) return responder({ error: "No encontramos tu cuenta" }, 404);
      const c = (await db("eu_cuentas?select=origen,aviso_alta,vence&sitio_id=eq." + s.id))[0];
      if (!c || c.origen !== "registro" || c.aviso_alta) return responder({ enviados: 0, repetido: true });
      const marcado = await db("eu_cuentas?sitio_id=eq." + s.id + "&aviso_alta=is.null&select=sitio_id", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ aviso_alta: new Date().toISOString() }) });
      if (!marcado.length) return responder({ enviados: 0, repetido: true });
      const hasta = c.vence ? new Date(c.vence + "T12:00:00Z").toLocaleDateString("es-VE", { day: "numeric", month: "long", timeZone: "UTC" }) : "";
      const texto = [PLANTILLAS[s.plantilla] || s.plantilla, "Usuario " + s.slug, hasta ? "Prueba gratis hasta el " + hasta : "Prueba gratis"].join(" · ");
      const subs = await db("eu_avisos?select=id,endpoint,p256dh,auth");
      return responder(await repartir(subs, { titulo: "Nuevo registro: " + s.nombre, texto, url: "/admin/#clientes", tag: "registro-" + s.id }));
    }

    return responder({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return responder({ error: "No se pudo mandar el aviso" }, 500);
  }
}

Deno.serve(atender);
