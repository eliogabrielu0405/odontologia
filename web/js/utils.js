/* Utilidades: íconos, formato (Venezuela), almacenamiento, modales, avisos, archivos, WhatsApp e imágenes. */
(function () {
  const ICON_PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
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
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
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
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9.5c.3 1.6 1.9 3.6 3.6 4.4l1.2-1.2 2 .8v1.2c-3.2.6-7.7-3.4-7.8-6.6H9.5l.7 2"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    refresh: '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>',
  };

  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Formato ---------- */
  const LOCALE = 'es-VE';
  let currentCurrency = 'USD';
  const setCurrency = (c) => { currentCurrency = c === 'VES' ? 'VES' : 'USD'; };
  const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const number2 = (n) => cents(n).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /** Monto con símbolo: $1.234,56 o Bs. 1.234,56 */
  const money = (n, currency = currentCurrency) => (currency === 'VES' ? `Bs. ${number2(n)}` : `$${number2(n)}`);
  const currencyLabel = (c) => (c === 'VES' ? 'Bolívares (Bs.)' : 'Dólares ($)');

  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const daysBetween = (fromIso, toIso) => Math.round((parseDate(toIso) - parseDate(fromIso)) / 86400000);
  const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const fmtDate = (s) => (s ? parseDate(String(s).slice(0, 10)).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  const fmtDateLong = (d) => capitalize(d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const fmtDateTime = (s) => new Date(s).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const ageFrom = (birth) => {
    if (!birth) return '';
    const b = parseDate(birth); const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  };
  const initials = (first, last) => `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase();
  const fullName = (p) => (p ? `${p.lastName}, ${p.firstName}` : '—');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- WhatsApp (números de Venezuela) ---------- */
  const waNumber = (phone) => {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) digits = `58${digits.slice(1)}`;
    else if (digits.length === 10 && digits.startsWith('4')) digits = `58${digits}`;
    return digits;
  };
  const waLink = (phone, text = '') => {
    const number = waNumber(phone);
    const query = text ? `?text=${encodeURIComponent(text)}` : '';
    return number ? `https://wa.me/${number}${query}` : `https://wa.me/${query}`;
  };

  /* ---------- Almacenamiento del navegador ---------- */
  const memory = {};
  const storage = {
    get(key) { try { const v = window.localStorage.getItem(key); if (v !== null) return v; } catch { /* bloqueado */ } return memory[key] ?? null; },
    set(key, value) { memory[key] = value; try { window.localStorage.setItem(key, value); } catch { /* bloqueado */ } },
    remove(key) { delete memory[key]; try { window.localStorage.removeItem(key); } catch { /* bloqueado */ } },
  };

  /* ---------- Avisos ---------- */
  let toastTimer;
  let lastErrorAt = 0;
  const toast = (msg, kind = 'ok') => {
    if (kind !== 'err' && Date.now() - lastErrorAt < 1500) return;
    if (kind === 'err') lastErrorAt = Date.now();
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.innerHTML = `<div class="toast ${kind}" role="status">${kind === 'err' ? icon('alert') : icon('check')}<span>${esc(msg)}</span></div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, kind === 'err' ? 5000 : 3000);
  };

  /* ---------- Modales ---------- */
  const closeModal = ({ silent = false } = {}) => {
    const root = document.getElementById('modal-root');
    if (!root || !root.firstChild) return;
    root.innerHTML = '';
    if (!silent) document.dispatchEvent(new CustomEvent('modal:closed'));
  };

  /**
   * Abre un modal. `onSubmit(data, form)` recibe los campos del formulario; puede ser async.
   * Si devuelve false (o una promesa que resuelve false) el modal sigue abierto.
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
            <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-submit>${esc(submitLabel)}</button>
          </div>`}
        </form>
      </div>`;
    const form = root.querySelector('form');
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal()));
    root.querySelector('.modal-overlay').addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-overlay')) closeModal(); });
    let busy = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const missing = [...form.querySelectorAll('[required]')].find((el) => (el.type === 'file' ? !el.files.length : !String(el.value).trim()));
      if (missing) { missing.focus(); toast('Completa los campos obligatorios.', 'err'); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const submit = form.querySelector('[data-submit]');
      busy = true;
      if (submit) { submit.disabled = true; submit.dataset.label = submit.textContent; submit.textContent = 'Guardando…'; }
      let result;
      try { result = onSubmit ? await onSubmit(data, form) : undefined; } catch (err) { toast(err.message || 'No se pudo guardar.', 'err'); result = false; }
      busy = false;
      if (submit && document.body.contains(submit)) { submit.disabled = false; submit.textContent = submit.dataset.label; }
      if (result !== false && root.contains(form)) closeModal();
    });
    if (onMount) onMount(form);
    const first = form.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]):not([type=file]), .modal-body select, .modal-body textarea');
    if (first) setTimeout(() => { if (!form.contains(document.activeElement)) first.focus(); }, 30);
    return form;
  };

  const confirmDialog = (message, onYes, label = 'Eliminar') =>
    openModal({ title: 'Confirmar', body: `<p class="no-margin">${esc(message)}</p>`, submitLabel: label, danger: true, onSubmit: onYes });

  /* ---------- Archivos ---------- */
  const downloadFile = (name, content, type = 'text/plain') => {
    try {
      const blob = content instanceof Blob ? content : new Blob([content], { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
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

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); toast('Copiado'); return; } catch { /* sigue con el método alternativo */ }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); toast('Copiado'); } catch { toast('No se pudo copiar. Selecciona el texto y cópialo.', 'err'); }
    area.remove();
  };

  /** Reduce una foto (comprobante) a máximo 1600 px en JPEG para que suba rápido desde el celular. */
  const compressImage = (file, maxSide = 1600, quality = 0.82) => new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/')) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob && (blob.size < file.size || !/jpeg|png|webp/.test(file.type)) ? blob : file);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const randomCode = (length = 8) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(length);
    try { crypto.getRandomValues(bytes); } catch { for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256); }
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  };

  window.U = {
    icon, esc, money, number2, cents, currencyLabel, setCurrency, isoDate, parseDate, addDays, daysBetween, capitalize,
    fmtDate, fmtDateLong, fmtDateTime, ageFrom, initials, fullName, pad, plural, waNumber, waLink, storage,
    toast, openModal, closeModal, confirmDialog, downloadFile, printHTML, toCSV, copyText, compressImage, randomCode,
    canPrint: true,
  };
})();
