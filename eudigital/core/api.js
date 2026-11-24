/* Cliente mínimo de Supabase, sin librerías: sesión, tablas, funciones y archivos.
   Lo usan el panel del cliente y el panel de EU Digital. */
(function () {
  "use strict";
  const C = window.EU_CONFIG;
  const EU = (window.EU = window.EU || {});
  const BASE = C.supabaseUrl.replace(/\/+$/, "");

  const MENSAJES = {
    invalid_credentials: "La contraseña no es correcta.",
    "Invalid login credentials": "La contraseña no es correcta.",
    same_password: "La contraseña nueva es igual a la anterior.",
    weak_password: "Esa contraseña es muy débil. Usa al menos 8 caracteres.",
    over_request_rate_limit: "Demasiados intentos. Espera un minuto y vuelve a intentar.",
    "JWT expired": "Tu sesión venció. Vuelve a entrar.",
    "23505": "Ese usuario ya existe. Elige otro.",
    "42501": "No tienes permiso para hacer eso.",
  };

  class ErrorApi extends Error {
    constructor(mensaje, status, codigo) { super(mensaje); this.status = status; this.codigo = codigo; }
  }
  EU.ErrorApi = ErrorApi;

  async function leerError(res) {
    let j = null;
    try { j = await res.json(); } catch (_) { /* sin cuerpo */ }
    const codigo = String((j && (j.error_code || j.code || j.error)) || "");
    let msg = (j && (j.msg || j.message || j.error_description || j.error)) || "Error " + res.status;
    if (MENSAJES[codigo]) msg = MENSAJES[codigo];
    else if (MENSAJES[msg]) msg = MENSAJES[msg];
    if (res.status === 413) msg = "El archivo es muy pesado.";
    if (/mime type .* is not supported/i.test(msg)) msg = "Ese tipo de archivo no se puede subir. Usa una foto JPG, PNG o WebP.";
    return new ErrorApi(msg, res.status, codigo);
  }

  EU.correoDe = function (usuario) {
    const u = String(usuario || "").trim().toLowerCase();
    return u.includes("@") ? u : u + "@" + C.dominioCorreo;
  };

  /* Crea un cliente con su propia sesión guardada.
     almacen: "local" (queda abierta en el teléfono) o "sesion" (se cierra al cerrar la pestaña). */
  EU.crearApi = function ({ llave, almacen = "local" }) {
    const store = (() => {
      try { return almacen === "sesion" ? window.sessionStorage : window.localStorage; } catch (_) { return null; }
    })();
    let sesion = null;
    try { sesion = JSON.parse(store.getItem(llave)) || null; } catch (_) { sesion = null; }
    let refrescando = null;

    function guardar(s) {
      sesion = s;
      try { if (s) store.setItem(llave, JSON.stringify(s)); else store.removeItem(llave); } catch (_) { /* sin almacenamiento */ }
    }
    function aSesion(r) {
      return {
        token: r.access_token, refresco: r.refresh_token,
        vence: Date.now() + (r.expires_in || 3600) * 1000,
        uid: r.user && r.user.id, correo: r.user && r.user.email,
      };
    }

    async function refrescar() {
      if (!sesion || !sesion.refresco) return false;
      if (refrescando) return refrescando;
      refrescando = (async () => {
        try {
          const res = await fetch(BASE + "/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            headers: { apikey: C.supabaseKey, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: sesion.refresco }),
          });
          if (!res.ok) { if (res.status >= 400 && res.status < 500) guardar(null); return false; }
          guardar(aSesion(await res.json()));
          return true;
        } catch (_) { return false; }
      })();
      const ok = await refrescando;
      refrescando = null;
      return ok;
    }

    async function token() {
      if (!sesion) return null;
      if (Date.now() < sesion.vence - 60000) return sesion.token;
      return (await refrescar()) ? sesion.token : null;
    }

    async function pedir(url, op = {}, reintento = false) {
      const headers = Object.assign({ apikey: C.supabaseKey }, op.headers || {});
      const t = await token();
      headers.Authorization = "Bearer " + (t || C.supabaseKey);
      let res;
      try { res = await fetch(url, Object.assign({}, op, { headers })); }
      catch (_) { throw new ErrorApi("No hay conexión. Revisa tu internet e intenta de nuevo.", 0, "red"); }
      if (res.status === 401 && sesion && !reintento && (await refrescar())) return pedir(url, op, true);
      if (!res.ok) throw await leerError(res);
      return res;
    }
    const json = async (res) => { const t = await res.text(); return t ? JSON.parse(t) : null; };
    const rest = (ruta) => BASE + "/rest/v1/" + ruta;
    const JSONH = { "Content-Type": "application/json" };

    return {
      get sesion() { return sesion; },
      get conectado() { return !!sesion; },

      async entrar(usuario, clave) {
        let res;
        try {
          res = await fetch(BASE + "/auth/v1/token?grant_type=password", {
            method: "POST",
            headers: { apikey: C.supabaseKey, "Content-Type": "application/json" },
            body: JSON.stringify({ email: EU.correoDe(usuario), password: clave }),
          });
        } catch (_) { throw new ErrorApi("No hay conexión. Revisa tu internet e intenta de nuevo.", 0, "red"); }
        if (!res.ok) throw await leerError(res);
        guardar(aSesion(await res.json()));
        return sesion;
      },
      async salir() {
        const s = sesion;
        guardar(null);
        if (s) {
          try { await fetch(BASE + "/auth/v1/logout", { method: "POST", headers: { apikey: C.supabaseKey, Authorization: "Bearer " + s.token } }); }
          catch (_) { /* da igual: la sesión local ya se borró */ }
        }
      },
      async cambiarMiClave(nueva) {
        await pedir(BASE + "/auth/v1/user", { method: "PUT", headers: JSONH, body: JSON.stringify({ password: nueva }) });
      },

      async select(tabla, consulta) { return json(await pedir(rest(tabla + "?" + consulta))); },
      async insertar(tabla, filas) {
        return json(await pedir(rest(tabla), { method: "POST", headers: Object.assign({ Prefer: "return=representation" }, JSONH), body: JSON.stringify(filas) }));
      },
      async actualizar(tabla, filtro, cambios) {
        return json(await pedir(rest(tabla + "?" + filtro), { method: "PATCH", headers: Object.assign({ Prefer: "return=representation" }, JSONH), body: JSON.stringify(cambios) }));
      },
      async guardarFila(tabla, fila, conflicto) {
        return json(await pedir(rest(tabla + "?on_conflict=" + conflicto), {
          method: "POST", headers: Object.assign({ Prefer: "resolution=merge-duplicates,return=representation" }, JSONH), body: JSON.stringify(fila),
        }));
      },
      async borrar(tabla, filtro) { await pedir(rest(tabla + "?" + filtro), { method: "DELETE" }); },
      async rpc(funcion, args) {
        return json(await pedir(rest("rpc/" + funcion), { method: "POST", headers: JSONH, body: JSON.stringify(args || {}) }));
      },

      async subir(bucket, ruta, blob) {
        await pedir(BASE + "/storage/v1/object/" + bucket + "/" + ruta, {
          method: "POST",
          headers: { "Content-Type": blob.type || "application/octet-stream", "x-upsert": "false", "cache-control": "max-age=31536000" },
          body: blob,
        });
        return ruta;
      },
      urlPublica(bucket, ruta) { return BASE + "/storage/v1/object/public/" + bucket + "/" + ruta; },
      async listar(bucket, carpeta) {
        return json(await pedir(BASE + "/storage/v1/object/list/" + bucket, {
          method: "POST", headers: JSONH, body: JSON.stringify({ prefix: carpeta, limit: 1000, offset: 0 }),
        }));
      },
      async borrarArchivos(bucket, rutas) {
        if (!rutas.length) return;
        await pedir(BASE + "/storage/v1/object/" + bucket, { method: "DELETE", headers: JSONH, body: JSON.stringify({ prefixes: rutas }) });
      },
      async descargar(bucket, ruta) {
        return (await pedir(BASE + "/storage/v1/object/authenticated/" + bucket + "/" + ruta)).blob();
      },
    };
  };

  /* Achica la foto en el teléfono antes de subirla (WebP, máximo `max` px de lado). */
  EU.comprimirImagen = async function (archivo, { max = 1200, calidad = 0.82 } = {}) {
    if (!/^image\//.test(archivo.type)) return archivo;
    let img;
    try {
      img = await createImageBitmap(archivo);
    } catch (_) {
      img = await new Promise((ok, mal) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => mal(new ErrorApi("No se pudo leer esa imagen. Prueba con otra foto.", 0, "imagen"));
        i.src = URL.createObjectURL(archivo);
      });
    }
    const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
    const k = Math.min(1, max / Math.max(w0, h0));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w0 * k));
    cv.height = Math.max(1, Math.round(h0 * k));
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const aBlob = (tipo) => new Promise((ok) => cv.toBlob(ok, tipo, calidad));
    let blob = await aBlob("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await aBlob(archivo.type === "image/png" ? "image/png" : "image/jpeg");
    return blob;
  };

  EU.extension = (blob) => ({ "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "application/pdf": "pdf" }[blob.type] || "bin");
  EU.idNuevo = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
})();
