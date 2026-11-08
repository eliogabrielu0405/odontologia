/* Sonrisas como aplicación instalable (PWA): service worker, botón “Instalar la app” e instrucciones para iPhone. */
(function () {
  const { icon, openModal, toast } = U;
  let deferredPrompt = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  /** Hay forma de instalar: Android/Chrome/Edge ofrecen el diálogo; en iPhone se explica cómo hacerlo. */
  const available = () => !standalone() && (!!deferredPrompt || isIOS());

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
    toast('Sonrisas quedó instalada. Ábrela desde el ícono en tu pantalla de inicio.');
  });

  const showIOSHelp = () => openModal({
    title: 'Instalar Sonrisas en tu iPhone', hideFooter: true,
    body: `<ol class="install-steps">
        <li>Abre Sonrisas en <strong>Safari</strong>.</li>
        <li>Toca el botón <strong>Compartir</strong> <span class="inline-icon">${icon('upload')}</span> en la barra de abajo.</li>
        <li>Elige <strong>Agregar a pantalla de inicio</strong> y luego <strong>Agregar</strong>.</li>
      </ol>
      <p class="muted no-margin">Vas a ver el ícono de Sonrisas junto a tus otras apps y se abrirá a pantalla completa.</p>`,
  });

  const install = async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      try { await prompt.userChoice; } catch { /* el usuario cerró el diálogo */ }
      notify();
      return;
    }
    if (isIOS()) showIOSHelp();
  };

  /** Pinta el botón en los espacios marcados con data-install-slot. */
  const paint = (root = document) => {
    root.querySelectorAll('[data-install-slot]').forEach((slot) => {
      const kind = slot.dataset.installSlot;
      slot.innerHTML = available()
        ? `<button type="button" class="${kind === 'side' ? 'side-btn' : 'btn btn-light'}" data-install>${icon('download')}Instalar la app</button>`
        : '';
    });
  };
  listeners.add(() => paint());
  document.addEventListener('click', (e) => { if (e.target.closest('[data-install]')) install(); });

  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona igual sin él */ }); });
  }

  window.PWA = { available, install, paint, standalone, onChange: (fn) => listeners.add(fn) };
})();
