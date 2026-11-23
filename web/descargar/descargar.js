/* Sonrisas · página de descarga.
   - El botón principal dice "Descargar para Android / iPhone / Windows / Mac" según el equipo.
   - Un toque instala: si el navegador tiene su diálogo de instalación, se abre directo; si no, una ventana
     guía según el equipo (espera el diálogo de Chrome, lleva de WhatsApp a Chrome o Safari, o señala Compartir en iPhone).
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

  /* ---------- Instalar ----------
     Un solo botón ("Descargar…" o "Instalar en este…") hace siempre lo mejor que permite el equipo:
     - Chrome, Edge o Samsung Internet con el diálogo listo: abre el diálogo de instalación del navegador.
     - Chrome sin el diálogo todavía (lo habilita unos 30 s después de abrir la página): ventana que espera
       el diálogo y lo abre apenas llega; mientras tanto muestra cómo instalar desde el menú.
     - Dentro de WhatsApp, Instagram, Facebook…: un toque para abrir la página en Chrome o en Safari.
     - iPhone y iPad: Safari no deja instalar desde la página, así que una flecha señala su botón Compartir. */
  const host = location.host;
  const isIPad = isIOS && !/iphone|ipod/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Twitter|TikTok|musical_ly|Bytedance|Snapchat|LinkedInApp|Pinterest|GSA\/|; wv\)/i.test(ua);
  const isFirefox = /Firefox\/|FxiOS/i.test(ua);
  const chromium = !isIOS && !isFirefox && (/Chrome\/|Chromium\//.test(ua) || !!window.chrome);
  const iosBrowser = /CriOS/.test(ua) ? 'chrome' : /EdgiOS|FxiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua) ? 'other' : 'safari';
  const safariMajor = Number((ua.match(/Version\/(\d+)/) || [])[1]) || 0;
  const macSafari = platform === 'pc' && !chromium && !isFirefox && /Macintosh/.test(ua) && /Safari\//.test(ua);
  const OPEN_HERE = `${PAGE_URL}?instalar`;
  const CHROME_URL = `intent://${host}/descargar/?instalar#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(OPEN_HERE)};end`;
  const SAFARI_URL = `x-safari-https://${host}/descargar/?instalar`;

  const svg = (paths, filled = false) => `<svg viewBox="0 0 24 24" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${paths}</svg>`;
  const ICON = {
    share: svg('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>'),
    add: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>'),
    dotsV: svg('<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>', true),
    dotsH: svg('<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>', true),
    monitor: svg('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m9 9 3 3 3-3M12 6v6"/>'),
    compass: svg('<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>'),
    external: svg('<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  };
  const key = (icon, text = '') => `<span class="key">${icon}${text ? `<span>${text}</span>` : ''}</span>`;
  const stepList = (items) => `<ol class="mini-steps">${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
  const copyBtn = (label = 'Copiar enlace') => `<button type="button" class="btn btn-outline btn-lg btn-block" data-copy="${PAGE_URL}">${ICON_COPY}${label}</button>`;
  const openAppBtn = (style = 'outline') => `<a class="btn btn-${style} btn-lg btn-block" href="${APP_URL}">Abrir Sonrisas</a>`;
  const deviceName = platform === 'android' ? 'teléfono' : platform === 'ios' ? (isIPad ? 'iPad' : 'iPhone') : 'computadora';

  let deferredPrompt = null;
  let installed = false;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  /* ---- La ventana ---- */
  const sheet = $('[data-sheet]');
  const pointer = $('[data-pointer]');
  let sheetMode = null;
  let waitTimer = null;

  /** Pasos para instalar desde el menú de Chrome o Edge (sirven aunque el navegador no haya dado el diálogo). */
  const menuSteps = () => (platform === 'android'
    ? stepList([
      `Toca ${key(ICON.dotsV)} arriba a la derecha.`,
      `Elige ${key(ICON.add, 'Instalar app')}. En algunos teléfonos dice <em>Agregar a la pantalla principal</em>.`,
    ])
    : stepList([
      `Haz clic en ${key(ICON.monitor)} al final de la barra de direcciones, o abre el menú ${key(ICON.dotsV)}.`,
      'Elige <em>Instalar Sonrisas</em> y confirma.',
    ]));
  const chromeHint = () => (platform === 'android'
    ? `<a class="sheet-link" href="${CHROME_URL}">${ICON.external}¿Estás dentro de WhatsApp u otra app? Ábrela en Chrome</a>`
    : '');

  const iosShareStep = () => {
    if (iosBrowser === 'chrome') return `Toca ${key(ICON.share, 'Compartir')} arriba, al lado de la dirección.`;
    if (iosBrowser === 'other') return `Abre el menú ${key(ICON.dotsH)} de tu navegador y toca ${key(ICON.share, 'Compartir')}.`;
    if (isIPad) return `Toca ${key(ICON.share, 'Compartir')} arriba a la derecha.`;
    if (safariMajor >= 26) return `Toca ${key(ICON.dotsH)} abajo a la derecha y luego ${key(ICON.share, 'Compartir')}.`;
    return `Toca ${key(ICON.share, 'Compartir')} en la barra de abajo.`;
  };
  // Dónde está el botón Compartir: la flecha lo señala desde el borde de la pantalla.
  const iosPointer = () => {
    if (iosBrowser === 'chrome' || isIPad) return 'top-right';
    if (iosBrowser === 'other') return null;
    return safariMajor >= 26 ? 'bottom-right' : 'bottom-center';
  };

  const SHEETS = {
    wait: () => ({
      title: 'Instalar Sonrisas',
      sub: 'Se instala en segundos, sin pasar por la tienda de aplicaciones.',
      pointer: 'top-right',
      body: `<button type="button" class="btn btn-primary btn-lg btn-block" data-sheet-install disabled><span class="spinner" aria-hidden="true"></span><span data-wait-label>Preparando la instalación…</span></button>
        <div class="wait-bar" aria-hidden="true"><i data-wait-bar></i></div>
        <p class="sheet-note">Tu navegador habilita la instalación unos segundos después de abrir la página; cuando esté lista, el botón se activa. Si no quieres esperar, hazlo desde el menú:</p>
        ${menuSteps()}${chromeHint()}`,
    }),
    ready: () => ({
      title: 'Todo listo',
      sub: 'Toca el botón y confirma en la ventana del navegador.',
      body: `<button type="button" class="btn btn-primary btn-lg btn-block" data-sheet-install>${ICON_DOWNLOAD}Instalar Sonrisas</button>`,
    }),
    manual: () => ({
      title: 'Instálala desde el menú',
      sub: 'Tu navegador no abrió su ventana de instalación. Son dos toques:',
      pointer: 'top-right',
      body: `${menuSteps()}
        <p class="sheet-note">Si en el menú dice <em>Abrir Sonrisas</em> o <em>Abrir app</em>, ya la tienes instalada.</p>
        ${openAppBtn()}${chromeHint()}`,
    }),
    installing: () => ({
      title: 'Instalando Sonrisas…',
      sub: 'En unos segundos aparece su ícono. No cierres esta página.',
      body: '<div class="wait-bar wait-bar-busy" aria-hidden="true"><i></i></div>',
    }),
    installed: () => ({
      title: '¡Sonrisas quedó instalada!',
      sub: platform === 'pc' ? 'La encuentras en tu escritorio o en el menú de inicio.' : 'La encuentras en tu pantalla de inicio, junto a tus otras apps.',
      body: openAppBtn('primary'),
    }),
    'android-inapp': () => ({
      title: 'Ábrela en Chrome',
      sub: 'Estás dentro de otra app (WhatsApp, Instagram, Facebook…). Para instalar Sonrisas, ábrela en Chrome.',
      body: `<a class="btn btn-primary btn-lg btn-block" href="${CHROME_URL}">${ICON.external}Abrir en Chrome</a>
        <p class="sheet-note">En Chrome se instala con un toque. Si el botón no funciona, copia el enlace y pégalo en Chrome.</p>
        ${copyBtn()}`,
    }),
    'android-other': () => ({
      title: 'Instálala desde el menú',
      sub: 'En este navegador se instala desde su menú. En Chrome es un solo toque.',
      body: `${stepList([
        `Abre el menú ${key(ICON.dotsV)} de tu navegador.`,
        'Elige <em>Instalar</em> o <em>Agregar a pantalla de inicio</em>.',
      ])}
        <a class="btn btn-outline btn-lg btn-block" href="${CHROME_URL}">${ICON.external}Abrir en Chrome</a>`,
    }),
    'ios-safari': () => ({
      title: `Instálala en tu ${deviceName}`,
      sub: 'Safari no tiene botón de instalar: son tres toques en la barra de Safari.',
      pointer: iosPointer(),
      top: iosPointer()?.startsWith('bottom'),
      body: `${stepList([
        iosShareStep(),
        `Toca ${key(ICON.add, 'Agregar a pantalla de inicio')}. Si no lo ves, desliza la lista hacia arriba.`,
        'Toca <em>Agregar</em>. El ícono de Sonrisas queda junto a tus otras apps.',
      ])}
        <p class="sheet-note">¿No aparece <em>Agregar a pantalla de inicio</em>? Toca ${key(ICON.compass)} para abrir la página en Safari y vuelve a intentarlo.</p>`,
    }),
    'ios-other': () => ({
      title: `Instálala en tu ${deviceName}`,
      sub: 'Son tres toques con el botón Compartir de tu navegador.',
      pointer: iosPointer(),
      body: `${stepList([
        iosShareStep(),
        `Toca ${key(ICON.add, 'Agregar a pantalla de inicio')}.`,
        'Toca <em>Agregar</em>.',
      ])}
        <p class="sheet-note">Si no aparece la opción, copia el enlace y ábrelo en Safari.</p>
        ${copyBtn('Copiar enlace para Safari')}`,
    }),
    'ios-inapp': () => ({
      title: 'Ábrela en Safari',
      sub: 'Estás dentro de otra app. Para instalar Sonrisas, primero ábrela en Safari.',
      body: `<a class="btn btn-primary btn-lg btn-block" href="${SAFARI_URL}">${ICON.external}Abrir en Safari</a>
        <p class="sheet-note">Si el botón no funciona, toca ${key(ICON.dotsH)} y elige <em>Abrir en Safari</em> o <em>Abrir en el navegador</em>. También puedes copiar el enlace.</p>
        ${copyBtn('Copiar enlace para Safari')}`,
    }),
    'mac-safari': () => ({
      title: 'Instálala en tu Mac',
      sub: 'En Safari se agrega al Dock y abre en su propia ventana.',
      body: `${stepList([
        'En la barra de menú de arriba, abre <em>Archivo</em>.',
        'Elige <em>Agregar al Dock</em> y luego <em>Agregar</em>.',
      ])}
        <p class="sheet-note">Necesitas macOS Sonoma o más nuevo. En Chrome o Edge se instala con un clic.</p>
        ${openAppBtn()}`,
    }),
    'desktop-other': () => ({
      title: 'Ábrela en Chrome o Edge',
      sub: 'Este navegador no instala aplicaciones web. En Chrome o Edge se instala con un clic.',
      body: `${copyBtn('Copiar enlace para Chrome o Edge')}
        <a class="btn btn-quiet btn-lg btn-block" href="${APP_URL}">Usarla en este navegador</a>`,
    }),
  };

  /** Qué ventana corresponde a este equipo cuando el navegador no tiene el diálogo listo. */
  const pickSheet = () => {
    if (platform === 'ios') return inApp ? 'ios-inapp' : iosBrowser === 'safari' ? 'ios-safari' : 'ios-other';
    if (platform === 'android') return inApp ? 'android-inapp' : chromium ? 'wait' : 'android-other';
    return chromium ? 'wait' : macSafari ? 'mac-safari' : 'desktop-other';
  };

  const startWait = () => {
    // Chrome da el diálogo cuando la página lleva unos 30 s abierta; si ya pasaron, espera un poco más y pasa a los pasos.
    const deadline = Math.max(performance.now() + 4000, 31000);
    const total = deadline - performance.now();
    const label = $('[data-wait-label]', sheet);
    const bar = $('[data-wait-bar]', sheet);
    const tick = () => {
      const left = deadline - performance.now();
      if (left <= 0) { renderSheet('manual'); return; }
      label.textContent = `Preparando la instalación… ${Math.ceil(left / 1000)} s`;
      bar.style.transform = `scaleX(${(1 - left / total).toFixed(3)})`;
    };
    tick();
    waitTimer = setInterval(tick, 250);
  };

  function renderSheet(mode) {
    clearInterval(waitTimer);
    sheetMode = mode;
    const view = SHEETS[mode]();
    $('[data-sheet-title]', sheet).textContent = view.title;
    $('[data-sheet-sub]', sheet).textContent = view.sub;
    $('[data-sheet-body]', sheet).innerHTML = view.body;
    sheet.dataset.pos = view.top ? 'top' : 'bottom';
    pointer.hidden = !view.pointer;
    if (view.pointer) pointer.dataset.at = view.pointer;
    if (mode === 'wait') startWait();
  }
  const openSheet = (mode) => {
    renderSheet(mode);
    if (!sheet.open) sheet.showModal();
  };
  sheet.addEventListener('close', () => { clearInterval(waitTimer); sheetMode = null; });
  // Clic fuera del panel (en el fondo oscuro) cierra la ventana.
  sheet.addEventListener('click', (event) => { if (event.target === sheet) sheet.close(); });

  /* ---- Instalación ---- */
  const install = async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    try {
      await promptEvent.prompt();
    } catch {
      deferredPrompt = promptEvent; // sin un toque reciente el navegador no deja abrir el diálogo
      openSheet('ready');
      return;
    }
    let outcome = 'dismissed';
    try { ({ outcome } = await promptEvent.userChoice); } catch { /* el diálogo se cerró */ }
    if (outcome === 'accepted') { if (sheet.open && sheetMode !== 'installed') renderSheet('installing'); } else if (sheet.open) sheet.close();
    paintActions();
  };

  const startInstall = () => {
    if (standalone) { location.href = APP_URL; return; }
    if (deferredPrompt) { install(); return; }
    openSheet(pickSheet());
  };

  const paintActions = () => {
    const label = { android: 'Instalar en este teléfono', ios: `Instalar en este ${isIPad ? 'iPad' : 'iPhone'}`, pc: 'Instalar en esta computadora' };
    ['android', 'ios', 'pc'].forEach((tabKey) => {
      let html;
      if (tabKey === platform) {
        html = `<button type="button" class="btn btn-primary btn-lg" data-download>${ICON_DOWNLOAD}${label[tabKey]}</button>`;
        if (tabKey === 'pc') html += `<a class="btn btn-outline btn-lg" href="${APP_URL}">Abrir en el navegador</a>`;
      } else {
        html = `<button type="button" class="btn btn-outline btn-lg" data-copy="${PAGE_URL}">${ICON_COPY}Copiar enlace para ${tabKey === 'pc' ? 'la computadora' : 'el teléfono'}</button>`;
      }
      $(`[data-actions="${tabKey}"]`).innerHTML = html;
    });
    $('[data-install-status]').textContent = installed
      ? 'Sonrisas quedó instalada. Ábrela desde su ícono en tu pantalla de inicio o en tu escritorio.'
      : standalone ? 'Ya estás usando Sonrisas instalada en este equipo.' : '';
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    // Si la ventana estaba esperando el diálogo, lo abre de una vez (si el toque fue hace poco) o deja el botón listo.
    if (sheet.open && (sheetMode === 'wait' || sheetMode === 'manual')) {
      if (navigator.userActivation && navigator.userActivation.isActive) install(); else renderSheet('ready');
    }
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    paintActions();
    openSheet('installed');
  });

  const copyLink = async (url) => {
    const where = platform === 'ios' ? 'Safari' : platform === 'android' ? 'Chrome' : 'tu navegador';
    try {
      await navigator.clipboard.writeText(url);
      toast(`Enlace copiado. Pégalo en ${where}.`);
    } catch {
      window.prompt('Copia este enlace:', url);
    }
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-download]')) {
      event.preventDefault();
      startInstall();
      return;
    }
    if (event.target.closest('[data-sheet-install]')) { install(); return; }
    if (event.target.closest('[data-sheet-close]')) { sheet.close(); return; }
    const copy = event.target.closest('[data-copy]');
    if (copy) copyLink(copy.dataset.copy);
  });
  paintActions();

  // Llegó desde "Abrir en Chrome / Safari": abre la instalación directamente.
  const params = new URLSearchParams(location.search);
  if (params.has('instalar')) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (!standalone) setTimeout(() => { if (!sheet.open) openSheet(deferredPrompt ? 'ready' : pickSheet()); }, 600);
  }

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
