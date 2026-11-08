/* Utilidades generales: íconos, formato, entorno, almacenamiento, contraseñas, modales, avisos y descargas. */
(function () {
  const ICON_PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    tooth: '<path d="M7 3c-3 0-4.5 2.5-4 6 .5 3 1.5 4.5 2 7.5.4 2.5 1.4 4.5 2.5 4.5 1.6 0 1.6-2.5 2-4.5.4-1.5 1-2.5 2.5-2.5s2.1 1 2.5 2.5c.4 2 .4 4.5 2 4.5 1.1 0 2.1-2 2.5-4.5.5-3 1.5-4.5 2-7.5.5-3.5-1-6-4-6-2.5 0-3.5 1.5-5 1.5S9.5 3 7 3z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chevronL: '<path d="m15 18-6-6 6-6"/>',
    chevronR: '<path d="m9 18 6-6-6-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };

  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');

  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const fmtDate = (s) => (s ? parseDate(String(s).slice(0, 10)).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  const fmtDateLong = (d) => capitalize(d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const fmtDateTime = (s) => new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const ageFrom = (birth) => {
    if (!birth) return '';
    const b = parseDate(birth); const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  };
  const initials = (first, last) => `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase();
  const fullName = (p) => (p ? `${p.lastName}, ${p.firstName}` : '—');

  /* ---------- Entorno: claude.ai (artefacto) o navegador común ---------- */
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');
  const capabilityCache = {};
  /** Devuelve el espacio de una capacidad del artefacto, o null si esta vista no la tiene. */
  const capability = (name) => {
    if (!inClaude) return Promise.resolve(null);
    if (!capabilityCache[name]) {
      capabilityCache[name] = Promise.resolve().then(() => window.claude.use(name)).catch(() => null);
    }
    return capabilityCache[name];
  };
  let framed = true;
  try { framed = window.self !== window.top; } catch { framed = true; }
  /** Solo se ofrece imprimir cuando la app corre sola en el navegador (en claude.ai no hay diálogo de impresión). */
  const canPrint = !inClaude && !framed;

  /* ---------- Almacenamiento del navegador, con respaldo en memoria ---------- */
  const memory = { local: {}, session: {} };
  const area = (kind) => {
    try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; }
  };
  const storage = {
    get(key, kind = 'local') {
      try {
        const value = area(kind)?.getItem(key);
        if (value !== null && value !== undefined) return value;
      } catch { /* almacenamiento bloqueado */ }
      return memory[kind][key] ?? null;
    },
    set(key, value, kind = 'local') {
      memory[kind][key] = value;
      try { area(kind)?.setItem(key, value); } catch { /* bloqueado o lleno: queda en memoria */ }
    },
    remove(key, kind = 'local') {
      delete memory[kind][key];
      try { area(kind)?.removeItem(key); } catch { /* bloqueado */ }
    },
  };

  /* ---------- Contraseñas: SHA-256 con sal (nunca se guardan en texto plano) ---------- */
  const SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const SHA_H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const sha256 = (message) => {
    const bytes = Array.from(new TextEncoder().encode(String(message)));
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    bytes.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255, (low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const hash = SHA_H.slice();
    const w = new Array(64);
    for (let offset = 0; offset < bytes.length; offset += 64) {
      for (let i = 0; i < 16; i++) {
        const j = offset + i * 4;
        w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
    }
    return hash.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
  const newSalt = () => {
    try { return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join(''); }
    catch { return Math.random().toString(16).slice(2, 18).padEnd(16, '0'); }
  };
  const hashPassword = (password, salt) => sha256(`${salt}:${password}`);

  /* ---------- Avisos ---------- */
  let toastTimer;
  let lastErrorAt = 0;
  const toast = (msg, kind = 'ok') => {
    // Un aviso de error no se tapa con uno de éxito inmediato (por ejemplo, en modo solo lectura).
    if (kind !== 'err' && Date.now() - lastErrorAt < 1500) return;
    if (kind === 'err') lastErrorAt = Date.now();
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.innerHTML = `<div class="toast ${kind}" role="status">${kind === 'err' ? icon('alert') : icon('check')}<span>${esc(msg)}</span></div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, kind === 'err' ? 4500 : 2800);
  };

  /* ---------- Modales ---------- */
  const closeModal = ({ silent = false } = {}) => {
    const root = document.getElementById('modal-root');
    if (!root || !root.firstChild) return;
    root.innerHTML = '';
    if (!silent) document.dispatchEvent(new CustomEvent('modal:closed'));
  };

  /**
   * Abre un modal. `onSubmit(data, form)` recibe los campos del formulario;
   * si devuelve false el modal permanece abierto.
   */
  const openModal = ({ title, body, submitLabel = 'Guardar', size = '', onSubmit, onMount, danger = false, hideFooter = false }) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <form class="modal ${size}" novalidate role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
          <div class="modal-body">${body}</div>
          ${hideFooter ? '' : `<div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>
          </div>`}
        </form>
      </div>`;
    const form = root.querySelector('form');
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal()));
    root.querySelector('.modal-overlay').addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-overlay')) closeModal(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const missing = [...form.querySelectorAll('[required]')].find((el) => !String(el.value).trim());
      if (missing) { missing.focus(); toast('Completá los campos obligatorios', 'err'); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const result = onSubmit ? onSubmit(data, form) : undefined;
      if (result !== false) closeModal();
    });
    if (onMount) onMount(form);
    const first = form.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return form;
  };

  const confirmDialog = (message, onYes, label = 'Eliminar') =>
    openModal({ title: 'Confirmar acción', body: `<p style="margin:0">${esc(message)}</p>`, submitLabel: label, danger: true, onSubmit: onYes });

  /* ---------- Archivos: descarga e impresión ---------- */
  /** Ofrece un archivo al usuario. En claude.ai usa la capacidad de descargas (pide confirmación). */
  const downloadFile = async (name, content, type = 'text/plain') => {
    if (inClaude) {
      const downloads = await capability('downloads');
      if (!downloads) { toast('Las descargas no están disponibles en esta vista.', 'err'); return false; }
      try {
        const result = await downloads.save({ filename: name, data: content });
        if (result && result.status === 'saved') toast(`Archivo descargado: ${name}`);
        return true;
      } catch (err) {
        const code = err && err.code;
        if (code === 'declined') return false;
        if (code === 'rate_limited') toast('Ya hay una descarga esperando tu confirmación.', 'err');
        else toast('No se pudo descargar el archivo en esta vista.', 'err');
        return false;
      }
    }
    try {
      const blob = new Blob([content], { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return true;
    } catch {
      toast('No se pudo descargar el archivo.', 'err');
      return false;
    }
  };

  const printHTML = (html) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { toast('No se pudo abrir la impresión.', 'err'); }
      setTimeout(() => frame.remove(), 1500);
    }, 250);
  };

  const toCSV = (rows, columns) => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return '﻿' + [columns.map((c) => cell(c.label)).join(';'), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(';'))].join('\n');
  };

  window.U = {
    icon, esc, money, isoDate, parseDate, addDays, capitalize, fmtDate, fmtDateLong, fmtDateTime, ageFrom, initials, fullName, pad,
    inClaude, capability, canPrint, storage, sha256, newSalt, hashPassword,
    toast, openModal, closeModal, confirmDialog, downloadFile, printHTML, toCSV,
  };
})();
