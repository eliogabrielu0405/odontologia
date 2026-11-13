/* Sonrisas · página de descarga.
   - El botón principal dice "Descargar para Android / iPhone / Windows / Mac" según el equipo.
   - Android y computadora: si el navegador lo permite, instala la app (PWA) con su diálogo; si no, lleva a los pasos.
   - iPhone: Safari no tiene diálogo de instalación, así que siempre lleva a los pasos.
   - Odontograma de prueba con precios de ejemplo y precios reales del plan (los que pone el administrador). */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const APP_URL = new URL('/', location.href).href;
  const PAGE_URL = new URL('/descargar/', location.href).href;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>';
  const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  /* ---------- Equipo ---------- */
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'pc';
  const pcName = /windows/i.test(ua) ? 'Windows' : /macintosh|mac os x/i.test(ua) ? 'Mac' : '';
  const ctaLabel = { android: 'Descargar para Android', ios: 'Descargar para iPhone', pc: pcName ? `Descargar para ${pcName}` : 'Descargar para computadora' }[platform];
  $$('[data-download-label]').forEach((el) => { el.textContent = ctaLabel; });

  /* ---------- Avisos cortos ---------- */
  const toastEl = $('[data-toast]');
  let toastTimer = null;
  const toast = (message) => {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  };

  /* ---------- Pestañas de equipos ---------- */
  const tabs = $$('[role="tab"]');
  const panels = $$('[role="tabpanel"]');
  const selectTab = (key, { focusTab = false } = {}) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === key;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focusTab) tab.focus();
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== key; });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      const moves = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
      if (!(event.key in moves)) return;
      event.preventDefault();
      const move = moves[event.key];
      const next = move === 'first' ? 0 : move === 'last' ? tabs.length - 1 : (index + move + tabs.length) % tabs.length;
      selectTab(tabs[next].dataset.tab, { focusTab: true });
    });
  });
  selectTab(platform);

  /* ---------- Instalar ---------- */
  let deferredPrompt = null;
  let installed = false;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const paintActions = () => {
    const canInstall = (key) => !!deferredPrompt && platform === key;
    const actions = {
      android: canInstall('android')
        ? `<button type="button" class="btn btn-primary btn-lg" data-install>${ICON_DOWNLOAD}Instalar en este teléfono</button>`
        : `<button type="button" class="btn btn-outline btn-lg" data-copy="${PAGE_URL}">${ICON_COPY}Copiar enlace para Chrome</button>`,
      ios: `<a class="btn btn-primary btn-lg" href="${APP_URL}">Abrir Sonrisas</a>
        <button type="button" class="btn btn-outline btn-lg" data-copy="${APP_URL}">${ICON_COPY}Copiar enlace para Safari</button>`,
      pc: `${canInstall('pc') ? `<button type="button" class="btn btn-primary btn-lg" data-install>${ICON_DOWNLOAD}Instalar en esta computadora</button>` : ''}
        <a class="btn btn-outline btn-lg" href="${APP_URL}">Abrir en el navegador</a>`,
    };
    Object.entries(actions).forEach(([key, html]) => { $(`[data-actions="${key}"]`).innerHTML = html; });
    $('[data-install-status]').textContent = installed
      ? 'Sonrisas quedó instalada. Ábrela desde su ícono en tu pantalla de inicio o en tu escritorio.'
      : standalone ? 'Ya estás usando Sonrisas instalada en este equipo.' : '';
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    paintActions();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    paintActions();
    toast('Sonrisas quedó instalada.');
  });

  const install = async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();
    try { await promptEvent.userChoice; } catch { /* el diálogo se cerró */ }
    paintActions();
  };

  /** Sin diálogo de instalación: muestra los pasos del equipo y los resalta un momento. */
  const showSteps = () => {
    selectTab(platform);
    $('#descargar').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    const panel = $(`[data-panel="${platform}"]`);
    panel.classList.remove('flash');
    void panel.offsetWidth;
    panel.classList.add('flash');
    panel.focus({ preventScroll: true });
  };

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(`Enlace copiado. Pégalo en ${platform === 'ios' ? 'Safari' : 'Chrome'}.`);
    } catch {
      window.prompt('Copia este enlace:', url);
    }
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-download]')) {
      event.preventDefault();
      if (deferredPrompt && platform !== 'ios') install(); else showSteps();
      return;
    }
    if (event.target.closest('[data-install]')) { install(); return; }
    const copy = event.target.closest('[data-copy]');
    if (copy) copyLink(copy.dataset.copy);
  });
  paintActions();

  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* la página funciona igual */ }); });
  }

  /* ---------- Menú del celular ---------- */
  const menu = $('.nav-menu');
  menu.addEventListener('click', (event) => { if (event.target.closest('a')) menu.open = false; });
  document.addEventListener('click', (event) => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) { menu.open = false; $('summary', menu).focus(); }
  });

  /* ---------- Odontograma de prueba ---------- */
  const TEETH = [18, 17, 16, 15, 14, 13, 12, 11];
  const ROOTS = { 18: 3, 17: 3, 16: 3, 15: 1, 14: 2, 13: 1, 12: 1, 11: 1 };
  const LABEL = { caries: 'Caries', endodoncia: 'Endodoncia', corona: 'Corona' };
  const DOT = { caries: 'dot-caries', endodoncia: 'dot-endo', corona: 'dot-corona' };
  // Precios de ejemplo, como un catálogo cargado en la app.
  const planFor = (num, state) => {
    if (state === 'caries') return ['Resina (1 cara)', 35];
    if (state === 'endodoncia') return num % 10 >= 6 ? ['Endodoncia multirradicular', 180] : ['Endodoncia unirradicular', 120];
    return ['Corona de porcelana', 250];
  };
  const FACES = { t: '2,27 38,27 27,38 13,38', r: '38,27 38,63 27,52 27,38', b: '2,63 38,63 27,52 13,52', l: '2,27 13,38 13,52 2,63', c: '13,38 27,38 27,52 13,52' };
  const ROOT_SPECS = { 1: [[12, 28, 20, 3]], 2: [[7, 19, 12, 6], [21, 33, 28, 6]], 3: [[4, 14, 8, 8], [15, 25, 20, 3], [26, 36, 32, 8]] };
  const toothSVG = (num) => {
    const roots = ROOT_SPECS[ROOTS[num]];
    return `<svg viewBox="0 0 40 66" aria-hidden="true" focusable="false">
      ${roots.map(([x1, x2, tx, ty]) => `<path class="root" d="M${x1} 27 Q${x1} ${ty + 9} ${tx} ${ty} Q${x2} ${ty + 9} ${x2} 27 Z"/>`).join('')}
      ${roots.map(([x1, x2, tx, ty]) => `<path class="canal" d="M${tx} ${ty + 4} L${(x1 + x2) / 2} 26"/>`).join('')}
      ${Object.entries(FACES).map(([face, points]) => `<polygon class="face ${face}" points="${points}"/>`).join('')}
      <rect class="ring" x="1.5" y="26.5" width="37" height="37" rx="3"/>
    </svg>`;
  };

  const marks = { 16: 'caries', 15: 'endodoncia' };
  let pick = 'caries';
  let lastTotal = null;
  const teethEl = $('[data-teeth]');
  const totalEl = $('[data-total]');
  const usd = (n) => `$${n.toLocaleString('es-VE')}`;
  teethEl.innerHTML = TEETH.map((num) => `<button type="button" class="tooth" data-num="${num}">${toothSVG(num)}<span class="num">${num}</span></button>`).join('');

  const paintDemo = (changed = null) => {
    $$('.tooth', teethEl).forEach((button) => {
      const num = Number(button.dataset.num);
      const state = marks[num];
      if (state) button.dataset.state = state; else delete button.dataset.state;
      const action = state === pick ? 'quitar el hallazgo' : `marcar ${LABEL[pick].toLowerCase()}`;
      button.setAttribute('aria-label', `Diente ${num}: ${state ? LABEL[state].toLowerCase() : 'sano'}. Toca para ${action}.`);
    });
    const rows = TEETH.filter((num) => marks[num]).map((num) => {
      const [treatment, price] = planFor(num, marks[num]);
      return { num, state: marks[num], treatment, price };
    });
    $('[data-findings]').innerHTML = rows.length
      ? rows.map((row) => `<li class="${row.num === changed ? 'new' : ''}"><span class="f-num">${row.num}</span><span class="f-what"><i class="dot ${DOT[row.state]}"></i>${LABEL[row.state]}</span><span class="f-tx">${row.treatment}</span><span class="f-price">${usd(row.price)}</span></li>`).join('')
      : '<li class="empty">Sin hallazgos. Toca un diente para marcarlo.</li>';
    const total = rows.reduce((sum, row) => sum + row.price, 0);
    totalEl.textContent = usd(total);
    if (lastTotal !== null && total !== lastTotal && !reduceMotion) {
      totalEl.classList.remove('tick');
      void totalEl.offsetWidth;
      totalEl.classList.add('tick');
    }
    lastTotal = total;
  };
  teethEl.addEventListener('click', (event) => {
    const button = event.target.closest('.tooth');
    if (!button) return;
    const num = Number(button.dataset.num);
    if (marks[num] === pick) delete marks[num]; else marks[num] = pick;
    paintDemo(marks[num] ? num : null);
  });
  $$('[data-pick]').forEach((chip) => chip.addEventListener('click', () => {
    pick = chip.dataset.pick;
    $$('[data-pick]').forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
    paintDemo();
  }));
  paintDemo();

  /* ---------- Precios y soporte (los que configura el administrador) ---------- */
  const money = (value, currency) => {
    const n = Number(value) || 0;
    const text = n.toLocaleString('es-VE', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
    return currency === 'VES' ? `Bs. ${text}` : `$${text}`;
  };
  const whatsappLink = (phone) => {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) digits = `58${digits.slice(1)}`;
    else if (digits.length === 10) digits = `58${digits}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent('Hola, quiero saber más de Sonrisas.')}`;
  };
  const applySettings = (settings) => {
    const trial = Number(settings.trial_days) || 0;
    $$('[data-trial]').forEach((el) => { el.textContent = trial; });
    $$('[data-trial-line]').forEach((el) => { el.hidden = trial <= 0; });
    const monthly = Number(settings.monthly_price) || 0;
    const annual = Number(settings.annual_price) || 0;
    if (monthly) $('[data-monthly]').textContent = money(monthly, settings.currency);
    $('[data-annual-plan]').hidden = !annual;
    if (annual) {
      $('[data-annual]').textContent = money(annual, settings.currency);
      const saving = monthly * 12 - annual;
      $('[data-saving]').textContent = saving > 0 ? `Ahorras ${money(saving, settings.currency)} frente a pagar mes a mes.` : 'Pagas una vez y tienes Sonrisas por un año.';
    }
    const link = whatsappLink(settings.support_whatsapp);
    if (link) {
      $$('[data-whatsapp]').forEach((el) => {
        el.href = link;
        el.target = '_blank';
        el.rel = 'noopener';
        el.hidden = false;
      });
    }
  };
  const config = window.SONRISAS_CONFIG || {};
  if (config.supabaseUrl && config.supabaseKey) {
    fetch(`${config.supabaseUrl}/rest/v1/rpc/public_settings`, {
      method: 'POST',
      headers: { apikey: config.supabaseKey, 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => { if (settings) applySettings(settings); })
      .catch(() => { /* se quedan los precios escritos en la página */ });
  }
})();
