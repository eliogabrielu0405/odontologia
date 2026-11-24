/* Imágenes para compartir: la tarjeta que sale al mandar el enlace por WhatsApp y el cartel con el
   código QR para imprimir. Se dibujan en el navegador del dueño, con sus colores, logo y fotos. */
(function () {
  "use strict";
  const EU = window.EU;
  const K = window.EU_CATALOGOS;
  const EMOJI = { pizzeria: "🍕", arepera: "🫓", burgers: "🍔", sushi: "🍣", boutique: "👗" };
  const TITULOS = '"Bricolage Grotesque", "Trebuchet MS", system-ui, sans-serif';
  const CUERPO = '"Atkinson Hyperlegible", system-ui, sans-serif';

  /* ---------- Datos de la tarjeta a partir del contenido de la página ---------- */
  function colores(plantilla, contenido) {
    const tema = (contenido && contenido.tema) || {};
    const temas = (plantilla && plantilla.temas) || [];
    const preset = temas.find((t) => t.id === tema.preset) || temas[0] || {};
    const m = preset.muestra || [];
    const col = tema.colores || {};
    const principal = EU.color(col.principal) || m[0] || "#1d232b";
    const acento = EU.color(col.acento) || m[1] || "#f5c451";
    return { principal, acento };
  }
  // La primera foto de la página que no sea el logo (sirve una de la plantilla si el dueño no subió ninguna)
  function primeraFoto(contenido) {
    const n = (contenido && contenido.negocio) || {};
    const fuera = new Set([n.logo, contenido && contenido.compartir && contenido.compartir.imagen].filter(Boolean));
    const texto = JSON.stringify(contenido || {});
    const re = /"((?:https:\/\/[^"]+|\/t\/[^"]+)\.(?:webp|jpe?g|png))"/gi;
    let m;
    while ((m = re.exec(texto))) { if (!fuera.has(m[1])) return m[1]; }
    return "";
  }
  EU.datosTarjeta = function ({ nombre, plantilla, contenido }) {
    const n = (contenido && contenido.negocio) || {};
    const c = colores(plantilla, contenido);
    return {
      v: 1,
      nombre: String(nombre || "").trim(),
      frase: String(n.eslogan || n.descripcion || "").trim().slice(0, 140),
      logo: EU.url(n.logo) || "",
      foto: EU.url(primeraFoto(contenido)) || "",
      principal: c.principal, acento: c.acento,
      emoji: EMOJI[plantilla && plantilla.id] || "🛍️",
      boton: plantilla && plantilla.sinTipos ? "Pide por WhatsApp" : "Haz tu pedido por WhatsApp",
    };
  };

  /* ---------- Utilidades de dibujo ---------- */
  function cargarImagen(src) {
    return new Promise((ok) => {
      if (!src) return ok(null);
      const img = new Image();
      if (!src.startsWith("/") && !src.startsWith(location.origin)) img.crossOrigin = "anonymous";
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = src;
      setTimeout(() => ok(null), 7000);
    });
  }
  async function fuentes() {
    if (!document.fonts || !document.fonts.load) return;
    try { await Promise.race([Promise.all([document.fonts.load('800 60px "Bricolage Grotesque"'), document.fonts.load('400 30px "Atkinson Hyperlegible"'), document.fonts.load('700 30px "Atkinson Hyperlegible"')]), new Promise((ok) => setTimeout(ok, 2500))]); }
    catch (_) { /* se usa la letra del sistema */ }
  }
  function cubrir(ctx, img, x, y, w, h) {
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / k, sh = h / k;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }
  function lineas(ctx, texto, ancho, max) {
    const palabras = String(texto).split(/\s+/).filter(Boolean);
    const out = [];
    let linea = "";
    for (const p of palabras) {
      const prueba = linea ? linea + " " + p : p;
      if (ctx.measureText(prueba).width <= ancho || !linea) linea = prueba;
      else { out.push(linea); linea = p; }
    }
    if (linea) out.push(linea);
    if (out.length > max) {
      const corto = out.slice(0, max);
      let ult = corto[max - 1];
      while (ult.length > 1 && ctx.measureText(ult + "…").width > ancho) ult = ult.slice(0, -1);
      corto[max - 1] = ult.replace(/[\s,.;:]+$/, "") + "…";
      return corto;
    }
    return out;
  }
  function redondo(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function circuloLogo(ctx, img, inicial, cx, cy, r, fondo, tinta) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (img) { ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); cubrir(ctx, img, cx - r, cy - r, r * 2, r * 2); }
    else {
      ctx.fillStyle = fondo; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = tinta; ctx.font = `800 ${Math.round(r * 1.05)}px ${TITULOS}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(inicial, cx, cy + r * 0.06);
    }
    ctx.restore();
  }
  const sobre = (hex) => (K && K.color ? K.color.sobre(hex) : "#ffffff");

  /* ---------- Tarjeta para WhatsApp: 1200 x 630 ---------- */
  EU.dibujarTarjeta = async function (d, { conFotos = true } = {}) {
    await fuentes();
    const [logo, foto] = conFotos ? await Promise.all([cargarImagen(d.logo), cargarImagen(d.foto)]) : [null, null];
    const W = 1200, H = 630, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const tinta = sobre(d.principal);
    ctx.fillStyle = d.principal; ctx.fillRect(0, 0, W, H);

    // Lado derecho: una foto de la página o, si no hay, el ícono de la plantilla
    const X = 680;
    if (foto) {
      cubrir(ctx, foto, X, 0, W - X, H);
      const g = ctx.createLinearGradient(X, 0, X + 140, 0);
      g.addColorStop(0, d.principal); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(X - 1, 0, 141, H);
    } else {
      ctx.save();
      ctx.globalAlpha = 0.16; ctx.fillStyle = tinta;
      ctx.beginPath(); ctx.arc(X + 270, H / 2, 250, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = `230px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.emoji, X + 270, H / 2 + 10);
    }

    // Lado izquierdo: logo, nombre, frase y botón
    const L = 70, ANCHO = X - L - 60;
    circuloLogo(ctx, logo, (d.nombre[0] || "•").toUpperCase(), L + 62, 128, 62, d.acento, sobre(d.acento));
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = tinta;
    // Nombre y frase van entre el logo y el botón. El nombre se achica hasta caber en dos líneas
    // (si aun así no cabe, se corta con puntos suspensivos) y la frase baja a una línea si hace falta.
    const ARRIBA = 232, ABAJO = H - 118 - 30;
    let tam = 78, filas = [], frase = [];
    for (;;) {
      ctx.font = `800 ${tam}px ${TITULOS}`;
      const todas = lineas(ctx, d.nombre, ANCHO, 99);
      const cabe = todas.length <= 2 && todas.every((f) => ctx.measureText(f).width <= ANCHO);
      filas = lineas(ctx, d.nombre, ANCHO, 2);
      ctx.font = `400 30px ${CUERPO}`;
      frase = d.frase ? lineas(ctx, d.frase, ANCHO, 2) : [];
      const alto = () => filas.length * tam * 1.06 + (frase.length ? 14 + frase.length * 40 : 0);
      if (alto() > ABAJO - ARRIBA && frase.length > 1) frase = lineas(ctx, d.frase, ANCHO, 1);
      if ((cabe && alto() <= ABAJO - ARRIBA) || tam <= 44) break;
      tam -= 4;
    }
    const alto = filas.length * tam * 1.06 + (frase.length ? 14 + frase.length * 40 : 0);
    let y = ARRIBA + Math.max(0, (ABAJO - ARRIBA - alto) / 2) + tam * 0.86;
    ctx.font = `800 ${tam}px ${TITULOS}`;
    filas.forEach((f, i) => { ctx.fillText(f, L, y); if (i < filas.length - 1) y += tam * 1.06; });
    if (frase.length) {
      ctx.font = `400 30px ${CUERPO}`;
      ctx.globalAlpha = 0.9;
      y += 14 + 36;
      frase.forEach((f) => { ctx.fillText(f, L, y); y += 40; });
      ctx.globalAlpha = 1;
    }
    ctx.font = `700 28px ${CUERPO}`;
    const tw = ctx.measureText(d.boton).width;
    redondo(ctx, L, H - 118, tw + 64, 64, 32);
    ctx.fillStyle = tinta; ctx.fill();
    ctx.fillStyle = d.principal; ctx.textBaseline = "middle";
    ctx.fillText(d.boton, L + 32, H - 118 + 33);
    return cv;
  };

  // JPEG listo para subir. Si una foto de otro sitio no deja exportar el dibujo, se hace sin fotos.
  EU.tarjetaJPG = async function (d) {
    const exportar = (cv) => new Promise((ok, mal) => { try { cv.toBlob((b) => (b ? ok(b) : mal(new Error("sin imagen"))), "image/jpeg", 0.86); } catch (e) { mal(e); } });
    try { return await exportar(await EU.dibujarTarjeta(d)); }
    catch (_) { return exportar(await EU.dibujarTarjeta(d, { conFotos: false })); }
  };

  /* ---------- Código QR ---------- */
  EU.dibujarQR = function (texto, { tam = 600, margen = 4, color = "#000000", fondo = "#ffffff" } = {}) {
    const q = window.EU_QR(texto, "M");
    const celdas = q.n + margen * 2;
    const paso = Math.max(1, Math.floor(tam / celdas));
    const cv = document.createElement("canvas");
    cv.width = cv.height = paso * celdas;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = color;
    for (let f = 0; f < q.n; f++) for (let c = 0; c < q.n; c++) if (q.oscuro(f, c)) ctx.fillRect((c + margen) * paso, (f + margen) * paso, paso, paso);
    return cv;
  };

  // Cartel para imprimir (1200 x 1600): nombre arriba, el código en el centro y una invitación a escanear
  EU.dibujarCartelQR = async function (d, enlace) {
    await fuentes();
    const logo = await cargarImagen(d.logo);
    const W = 1200, H = 1600, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const tinta = sobre(d.principal);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = d.principal; ctx.fillRect(0, 0, W, 430);
    circuloLogo(ctx, logo, (d.nombre[0] || "•").toUpperCase(), W / 2, 150, 86, d.acento, sobre(d.acento));
    ctx.textAlign = "center"; ctx.fillStyle = tinta;
    let tam = 84, filas;
    for (; tam >= 48; tam -= 4) { ctx.font = `800 ${tam}px ${TITULOS}`; filas = lineas(ctx, d.nombre, W - 160, 2); if (filas.length === 1 || tam <= 60) break; }
    filas = filas.slice(0, 2);
    let y = 300 + (filas.length === 1 ? tam * 0.55 : 0);
    filas.forEach((f) => { ctx.fillText(f, W / 2, y); y += tam * 1.02; });

    // Código: oscuro sobre blanco, que es lo que mejor leen las cámaras
    const qr = EU.dibujarQR(enlace, { tam: 760, margen: 2, color: "#111111" });
    const qx = (W - qr.width) / 2, qy = 520;
    ctx.fillStyle = "#ffffff"; redondo(ctx, qx - 30, qy - 30, qr.width + 60, qr.height + 60, 40); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = d.principal; redondo(ctx, qx - 30, qy - 30, qr.width + 60, qr.height + 60, 40); ctx.stroke();
    ctx.drawImage(qr, qx, qy);

    ctx.fillStyle = "#16181d"; ctx.textBaseline = "alphabetic";
    ctx.font = `800 68px ${TITULOS}`;
    ctx.fillText("Escanea y haz tu pedido", W / 2, qy + qr.height + 150);
    ctx.font = `400 34px ${CUERPO}`; ctx.fillStyle = "#4b5160";
    ctx.fillText("Abre la cámara del teléfono y apunta al código", W / 2, qy + qr.height + 210);
    ctx.font = `700 30px ${CUERPO}`; ctx.fillStyle = "#16181d";
    const corto = enlace.replace(/^https?:\/\//, "");
    ctx.fillText(corto.length > 52 ? corto.slice(0, 51) + "…" : corto, W / 2, H - 70);
    return cv;
  };

  EU.descargarCanvas = function (cv, nombreArchivo) {
    return new Promise((ok) => cv.toBlob((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url; a.download = nombreArchivo;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      ok();
    }, "image/png"));
  };
})();
