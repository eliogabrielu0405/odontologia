/* Fotos de pacientes: perfil y fotos clínicas (caries, fracturas, antes y después…).
   Los archivos van al almacenamiento privado "pacientes" de Supabase, en <clínica>/<paciente>/<archivo>.
   Para mostrarlos se piden enlaces temporales firmados, que se guardan en memoria mientras sirven. */
(function () {
  const BUCKET = 'pacientes';
  const LINK_SECONDS = 3600;
  const REUSE_MS = 50 * 60 * 1000;
  const CATEGORIES = ['Caries', 'Fractura', 'Restauración', 'Antes', 'Después', 'Radiografía', 'Encías', 'Ortodoncia', 'Otra'];

  const links = new Map(); // ruta → { url, at }
  const client = () => Session.client;

  const extFor = (type) => (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('hei') ? 'heic' : 'jpg');

  const put = async (path, blob, type) => {
    const { error } = await client().storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
    if (error) throw new Error(`No se pudo subir la foto: ${Session.friendly(error)}`);
  };

  /**
   * Sube una foto. kind: 'perfil' (cualquiera del equipo) o 'foto' (clínica, solo odontólogos).
   * Las fotos clínicas llevan además una miniatura liviana para la galería. Devuelve { path, thumb }.
   */
  const upload = async (patientId, file, kind = 'foto') => {
    const clinic = DB.clinic();
    if (!clinic) throw new Error('No hay una clínica abierta.');
    if (!file || !file.type || !file.type.startsWith('image/')) throw new Error('Elige una imagen (foto JPG o PNG).');
    const base = `${clinic.id}/${patientId}/${kind}-${Date.now()}-${U.randomCode(6).toLowerCase()}`;
    const blob = kind === 'perfil' ? await U.compressImage(file, 640, 0.85) : await U.compressImage(file, 2000, 0.85);
    const type = blob.type || file.type || 'image/jpeg';
    const path = `${base}.${extFor(type)}`;
    await put(path, blob, type);
    if (kind === 'perfil') return { path, thumb: path };
    let thumb = path;
    try {
      const small = await U.compressImage(file, 420, 0.78);
      const smallType = small.type || type;
      if (small !== file && small.size < blob.size) { thumb = `${base}-mini.${extFor(smallType)}`; await put(thumb, small, smallType); }
    } catch { thumb = path; }
    return { path, thumb };
  };

  const cached = (path) => {
    const hit = links.get(path);
    return hit && Date.now() - hit.at < REUSE_MS ? hit.url : null;
  };

  /** Enlaces temporales para varias fotos a la vez. Devuelve { ruta: url }. */
  const urls = async (paths) => {
    const wanted = [...new Set(paths.filter(Boolean))];
    const missing = wanted.filter((p) => !cached(p));
    if (missing.length) {
      const { data, error } = await client().storage.from(BUCKET).createSignedUrls(missing, LINK_SECONDS);
      if (!error && data) data.forEach((d) => { if (d && d.signedUrl && !d.error) links.set(d.path, { url: d.signedUrl, at: Date.now() }); });
    }
    const out = {};
    wanted.forEach((p) => { const u = cached(p); if (u) out[p] = u; });
    return out;
  };

  const url = async (path) => (await urls([path]))[path] || null;

  /** Borra archivos. No falla si alguno ya no existe. */
  const remove = async (paths) => {
    const list = paths.filter(Boolean);
    if (!list.length) return;
    list.forEach((p) => links.delete(p));
    const { error } = await client().storage.from(BUCKET).remove(list);
    if (error) throw new Error(`No se pudo borrar la foto: ${Session.friendly(error)}`);
  };

  /** Pone las fotos reales en los elementos marcados con data-photo="ruta" dentro de root. */
  const hydrate = async (root) => {
    if (!root) return;
    const els = [...root.querySelectorAll('[data-photo]')].filter((el) => !el.dataset.photoDone);
    if (!els.length) return;
    let map = {};
    try { map = await urls(els.map((el) => el.dataset.photo)); } catch { return; }
    els.forEach((el) => {
      const u = map[el.dataset.photo];
      if (!u) return;
      const img = new Image();
      img.alt = el.dataset.photoAlt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.onload = () => { el.classList.add('has-photo'); };
      img.src = u;
      el.appendChild(img);
      el.dataset.photoDone = '1';
    });
  };

  // Cualquier pantalla que muestre un elemento con data-photo recibe la foto sola, sin código extra en cada vista.
  let pending = 0;
  const watch = () => {
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => { pending = 0; hydrate(document.body); }, 40);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);

  window.Photos = { CATEGORIES, upload, url, urls, remove, hydrate };
})();
