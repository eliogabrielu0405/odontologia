/* Utilidades generales: íconos, formato, modales, notificaciones y CSV. */
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
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmtDate = (s) => (s ? parseDate(s.slice(0, 10)).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  const fmtDateLong = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDateTime = (s) => new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const ageFrom = (birth) => {
    if (!birth) return '';
    const b = parseDate(birth); const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  };
  const initials = (first, last) => ((first || '?')[0] + (last || '')[0] || '').toUpperCase();
  const fullName = (p) => (p ? `${p.lastName}, ${p.firstName}` : '—');

  /* ---------- Toast ---------- */
  let toastTimer;
  const toast = (msg, kind = 'ok') => {
    const root = document.getElementById('toast-root');
    root.innerHTML = `<div class="toast ${kind}">${kind === 'err' ? icon('alert') : icon('check')}<span>${esc(msg)}</span></div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (root.innerHTML = ''), 2800);
  };

  /* ---------- Modal ---------- */
  const closeModal = () => { document.getElementById('modal-root').innerHTML = ''; };

  /**
   * Abre un modal. `onSubmit(data, form)` recibe los campos del formulario;
   * si devuelve false el modal permanece abierto.
   */
  const openModal = ({ title, body, submitLabel = 'Guardar', size = '', onSubmit, onMount, danger = false, hideFooter = false }) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <form class="modal ${size}" novalidate>
          <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close>${icon('x')}</button></div>
          <div class="modal-body">${body}</div>
          ${hideFooter ? '' : `<div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>
          </div>`}
        </form>
      </div>`;
    const form = root.querySelector('form');
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
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
    const first = form.querySelector('input:not([type=hidden]), select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return form;
  };

  const confirmDialog = (message, onYes, label = 'Eliminar') =>
    openModal({ title: 'Confirmar acción', body: `<p style="margin:0">${esc(message)}</p>`, submitLabel: label, danger: true, onSubmit: onYes });

  /* ---------- CSV / archivos ---------- */
  const downloadFile = (name, content, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };
  const toCSV = (rows, columns) => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return '﻿' + [columns.map((c) => cell(c.label)).join(';'), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(';'))].join('\n');
  };

  window.U = { icon, esc, money, isoDate, parseDate, addDays, fmtDate, fmtDateLong, fmtDateTime, ageFrom, initials, fullName, pad, toast, openModal, closeModal, confirmDialog, downloadFile, toCSV };
})();
