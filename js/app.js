/* Aplicación: arranque, inicio de sesión, menú, permisos por rol y navegación por hash (#pacientes, #paciente-p8-odontograma…). */
(function () {
  const { icon, esc, initials, fullName, toast } = U;

  /** Permisos por rol. */
  const PERMS = {
    admin: ['delete', 'clinical', 'catalog', 'reports', 'users', 'activity', 'settings'],
    odontologo: ['clinical', 'catalog', 'reports'],
    recepcion: [],
  };

  const NAV = [
    { section: 'Principal' },
    { route: 'inicio', label: 'Dashboard', icon: 'dashboard' },
    { route: 'pacientes', label: 'Pacientes', icon: 'users' },
    { route: 'agenda', label: 'Agenda', icon: 'calendar' },
    { section: 'Clínica' },
    { route: 'tratamientos', label: 'Tratamientos', icon: 'tooth' },
    { route: 'presupuestos', label: 'Presupuestos', icon: 'file' },
    { route: 'pagos', label: 'Pagos', icon: 'cash' },
    { route: 'reportes', label: 'Reportes', icon: 'chart', perm: 'reports' },
    { section: 'Administración', perm: 'users' },
    { route: 'usuarios', label: 'Usuarios', icon: 'shield', perm: 'users' },
    { route: 'actividad', label: 'Actividad', icon: 'activity', perm: 'activity' },
    { route: 'configuracion', label: 'Configuración', icon: 'settings', perm: 'settings' },
  ];

  const ROUTES = [
    { re: /^(?:inicio)?$/, view: 'dashboard', nav: 'inicio' },
    { re: /^pacientes$/, view: 'patients', nav: 'pacientes' },
    { re: /^paciente-([A-Za-z0-9_]+?)(?:-([a-z]+))?$/, view: 'patientDetail', nav: 'pacientes', params: (m) => ({ id: m[1], tab: m[2] || 'info' }) },
    { re: /^agenda$/, view: 'agenda', nav: 'agenda' },
    { re: /^tratamientos$/, view: 'treatments', nav: 'tratamientos' },
    { re: /^presupuestos$/, view: 'budgets', nav: 'presupuestos' },
    { re: /^pagos$/, view: 'payments', nav: 'pagos' },
    { re: /^reportes$/, view: 'reports', nav: 'reportes', perm: 'reports' },
    { re: /^usuarios$/, view: 'users', nav: 'usuarios', perm: 'users' },
    { re: /^actividad$/, view: 'activity', nav: 'actividad', perm: 'activity' },
    { re: /^configuracion$/, view: 'settings', nav: 'configuracion', perm: 'settings' },
  ];

  const app = document.getElementById('app');
  let user = null;
  let booted = false;
  let dirty = false;

  const can = (perm) => !!user && (PERMS[user.role] || []).includes(perm);
  const currentRoute = () => {
    try { return decodeURIComponent(location.hash.replace(/^#/, '')); } catch { return ''; }
  };
  const go = (name) => { if (currentRoute() === name) render(); else location.hash = name; };

  const brand = (subtitle) => `<div class="login-logo"><div class="logo-mark lg">${icon('tooth')}</div><h1>DentaGest</h1><p>${subtitle}</p></div>`;

  /* ---------- Pantallas sin sesión ---------- */
  const renderLoading = (slow) => {
    app.innerHTML = `
      <div class="splash"><div class="splash-card" role="status">
        <div class="logo-mark lg">${icon('tooth')}</div>
        <h1>DentaGest</h1>
        <p>Cargando pacientes, agenda y pagos de la clínica…</p>
        <div class="loader" aria-hidden="true"></div>
        ${slow ? '<p class="muted small">La base de datos está tardando en responder. Seguimos intentando; no hace falta recargar.</p>' : ''}
      </div></div>`;
  };

  const renderMessage = (kind) => {
    const text = kind === 'noaccess'
      ? { title: 'Sin acceso a los datos', body: 'Tu acceso a este artefacto no incluye los datos de la clínica. Pedile a quien lo comparte que te dé acceso de Colaborador o Editor.' }
      : { title: 'Datos no disponibles', body: 'No se pueden mostrar los datos de la clínica en esta vista. Abrí el artefacto desde claude.ai con tu cuenta para ver y cargar pacientes.' };
    app.innerHTML = `<div class="splash"><div class="splash-card"><div class="logo-mark lg">${icon('lock')}</div><h1>${text.title}</h1><p>${text.body}</p></div></div>`;
  };

  const renderSetup = () => {
    app.innerHTML = `
      <div class="login-wrap">
        <form class="login-card" novalidate>
          ${brand('Configurá tu clínica para empezar')}
          <p class="muted small center">La base de datos está vacía. Creá la cuenta de administrador; después vas a poder cargar pacientes, profesionales y tratamientos.</p>
          <div class="stack">
            <label class="field">Nombre de la clínica<input name="clinicName" required placeholder="Clínica Dental…" autocomplete="organization"></label>
            <div class="form-grid">
              <label class="field">Tu nombre<input name="firstName" required autocomplete="given-name"></label>
              <label class="field">Tu apellido<input name="lastName" required autocomplete="family-name"></label>
            </div>
            <label class="field">Email<input type="email" name="email" required autocomplete="username"></label>
            <label class="field">Contraseña<input type="password" name="password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label>
            <button class="btn btn-primary btn-block btn-lg" type="submit">Crear clínica</button>
          </div>
        </form>
      </div>`;
    const form = app.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const missing = [...form.querySelectorAll('[required]')].find((el) => !String(el.value).trim());
      if (missing) { missing.focus(); toast('Completá todos los campos.', 'err'); return; }
      if (data.password.length < 6) { toast('La contraseña debe tener al menos 6 caracteres.', 'err'); return; }
      if (DB.setupClinic(data)) { toast('Clínica creada. ¡Bienvenido/a!'); render(); }
    });
  };

  const renderLogin = () => {
    const s = DB.settings();
    const demo = Array.isArray(s.demoAccounts) ? s.demoAccounts : [];
    app.innerHTML = `
      <div class="login-wrap">
        <form class="login-card" novalidate>
          ${brand(esc(s.clinicName || 'Gestión para clínicas odontológicas'))}
          <div class="stack">
            <label class="field">Email<input type="email" id="login-email" name="email" autocomplete="username" placeholder="tu@clinica.com" required></label>
            <label class="field">Contraseña<input type="password" id="login-password" name="password" autocomplete="current-password" required></label>
            <label class="field inline"><input type="checkbox" name="remember" checked> Mantener la sesión iniciada en este dispositivo</label>
            <button class="btn btn-primary btn-block btn-lg" type="submit">Iniciar sesión</button>
          </div>
          ${demo.length ? `<div class="demo-accounts"><h4>Cuentas de demostración</h4>${demo.map((d, i) => `
            <div class="demo-account"><div><strong>${esc(d.label)}</strong><span>${esc(d.email)} · ${esc(d.password)}</span></div><button type="button" class="btn btn-sm" data-demo="${i}">Usar</button></div>`).join('')}</div>` : ''}
        </form>
      </div>`;
    const form = app.querySelector('form');
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-demo]');
      if (!b) return;
      const d = demo[Number(b.dataset.demo)];
      form.email.value = d.email;
      form.password.value = d.password;
      form.querySelector('[type=submit]').focus();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.email.value.trim() || !form.password.value) { toast('Escribí tu email y contraseña.', 'err'); return; }
      const res = DB.login(form.email.value, form.password.value, form.remember.checked);
      if (res.error) { toast(res.error, 'err'); form.password.select(); return; }
      user = res.user;
      toast(`Hola, ${user.firstName}`);
      render();
    });
  };

  /* ---------- Layout con sesión ---------- */
  const syncLabel = (pending) => {
    if (DB.isReadOnly()) return { cls: 'ro', text: 'Solo lectura' };
    if (DB.mode() === 'local') return { cls: '', text: 'Guardado en este navegador' };
    return pending ? { cls: 'busy', text: 'Guardando…' } : { cls: '', text: 'Guardado' };
  };
  const updateSync = (pending) => {
    const el = app.querySelector('[data-sync]');
    if (!el) return;
    const { cls, text } = syncLabel(pending);
    el.className = `sync ${cls}`;
    el.textContent = text;
  };

  const renderLayout = (activeNav) => {
    const s = DB.settings();
    const today = U.isoDate();
    const todayCount = DB.all('appointments').filter((a) => a.date === today && ['programada', 'confirmada'].includes(a.status)).length;
    const banners = [];
    if (DB.isReadOnly()) banners.push(`<div class="banner banner-warn">${icon('lock')}<div class="grow"><strong>Solo lectura.</strong> Podés ver los datos, pero tu acceso a este artefacto no permite modificarlos.</div></div>`);
    if (s.exampleData) banners.push(`<div class="banner banner-info">${icon('info')}<div class="grow"><strong>Estás viendo datos de ejemplo.</strong> Los pacientes, citas y pagos son ficticios. ${can('settings') ? 'Cuando quieras empezar con tu clínica, borralos desde <a href="#configuracion">Configuración</a>.' : ''}</div></div>`);

    app.innerHTML = `
      <div class="layout">
        <aside class="sidebar" data-sidebar aria-label="Menú principal">
          <div class="sidebar-brand"><div class="logo-mark">${icon('tooth')}</div><div><strong>DentaGest</strong><small>${esc(s.clinicName)}</small></div></div>
          <nav class="nav">
            ${NAV.filter((n) => !n.perm || can(n.perm)).map((n) => (n.section
              ? `<div class="nav-section">${n.section}</div>`
              : `<a href="#${n.route}" class="${activeNav === n.route ? 'active' : ''}" ${activeNav === n.route ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></a>`)).join('')}
          </nav>
          <div class="sidebar-foot">
            <div class="sidebar-user">
              <div class="avatar sm" style="background:${esc(user.color)}">${esc(initials(user.firstName, user.lastName))}</div>
              <div><strong>${esc(user.firstName)} ${esc(user.lastName)}</strong><small>${DB.ROLES[user.role] || ''}</small></div>
            </div>
            <button class="side-btn" data-logout>${icon('logout')}Cerrar sesión</button>
          </div>
        </aside>
        <div class="backdrop" data-backdrop></div>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" data-menu aria-label="Abrir menú">${icon('menu')}</button>
            <div class="who"><strong>${esc(user.firstName)} ${esc(user.lastName)}</strong><small>${DB.ROLES[user.role] || ''}</small></div>
            <div class="spacer"></div>
            <span class="sync" data-sync></span>
            <div class="search-box">${icon('search')}<input data-search type="search" placeholder="Buscar paciente…" autocomplete="off" aria-label="Buscar paciente"><div class="search-results" data-results hidden></div></div>
            <a class="icon-btn" href="#agenda" title="${todayCount} citas pendientes hoy" aria-label="${todayCount} citas pendientes hoy">${icon('bell')}${todayCount ? '<span class="dot"></span>' : ''}</a>
            <div class="avatar" style="background:${esc(user.color)}" title="${esc(user.email)}">${esc(initials(user.firstName, user.lastName))}</div>
          </header>
          <main class="content">${banners.join('')}<div data-content></div></main>
        </div>
      </div>`;

    updateSync(DB.pendingWrites());
    const sidebar = app.querySelector('[data-sidebar]');
    const backdrop = app.querySelector('[data-backdrop]');
    const toggle = (open) => { sidebar.classList.toggle('open', open); backdrop.classList.toggle('open', open); };
    app.querySelector('[data-menu]').addEventListener('click', () => toggle(true));
    backdrop.addEventListener('click', () => toggle(false));
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) toggle(false); });
    app.querySelector('[data-logout]').addEventListener('click', logout);

    const input = app.querySelector('[data-search]');
    const results = app.querySelector('[data-results]');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.hidden = true; return; }
      const found = DB.all('patients').filter((p) => `${p.firstName} ${p.lastName} ${p.dni}`.toLowerCase().includes(q)).slice(0, 6);
      results.innerHTML = found.length
        ? found.map((p) => `<a href="#paciente-${p.id}"><div class="avatar sm">${esc(initials(p.firstName, p.lastName))}</div><div><strong>${esc(fullName(p))}</strong><br><small class="muted">DNI ${esc(p.dni)}</small></div></a>`).join('')
        : '<div class="empty compact">Sin resultados</div>';
      results.hidden = false;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const a = results.querySelector('a'); if (a) { e.preventDefault(); location.hash = a.getAttribute('href').slice(1); input.value = ''; results.hidden = true; } }
      if (e.key === 'Escape') { input.value = ''; results.hidden = true; }
    });
    results.addEventListener('click', () => { input.value = ''; results.hidden = true; });
  };

  /* ---------- Render ---------- */
  const render = ({ keepScroll = false } = {}) => {
    if (!booted) return;
    dirty = false;
    const scrollY = window.scrollY;
    U.closeModal({ silent: true });
    const mode = DB.mode();
    if (mode === 'unavailable') { renderMessage('unavailable'); return; }
    if (mode === 'cloud' && !DB.all('users').length) {
      if (!DB.isConfirmed('users')) renderLoading(false);
      else if (DB.isReadOnly()) renderMessage('noaccess');
      else renderSetup();
      return;
    }
    user = DB.currentUser();
    if (!user) { renderLogin(); return; }
    const route = currentRoute();
    const found = ROUTES.map((r) => ({ r, m: route.match(r.re) })).find((x) => x.m);
    renderLayout(found ? found.r.nav : null);
    const content = app.querySelector('[data-content]');
    if (!found) content.innerHTML = '<div class="card empty">No encontramos esta página. <a href="#inicio">Ir al inicio</a></div>';
    else if (found.r.perm && !can(found.r.perm)) content.innerHTML = `<div class="card empty">Tu rol no tiene acceso a esta sección. <a href="#inicio">Ir al inicio</a></div>`;
    else Views[found.r.view](content, found.r.params ? found.r.params(found.m) : {});
    window.scrollTo(0, keepScroll ? scrollY : 0);
  };

  const isBusy = () => {
    if (document.querySelector('#modal-root .modal-overlay')) return true;
    const active = document.activeElement;
    return !!(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && active.type !== 'checkbox' && active.type !== 'file');
  };
  /** Cambios que llegan de otra persona: se redibuja sin interrumpir a quien está escribiendo. */
  const softRender = () => {
    if (!booted) return;
    if (isBusy()) { dirty = true; return; }
    render({ keepScroll: true });
  };
  const flushIfDirty = () => setTimeout(() => { if (dirty && !isBusy()) render({ keepScroll: true }); }, 350);

  const logout = () => {
    DB.logout();
    user = null;
    if (currentRoute()) location.hash = ''; else render();
  };

  window.App = { render, go, can, user: () => user, logout };
  window.addEventListener('hashchange', () => render());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') U.closeModal(); });
  document.addEventListener('modal:closed', flushIfDirty);
  document.addEventListener('focusout', () => { if (dirty) flushIfDirty(); });

  const boot = async () => {
    renderLoading(false);
    const slowTimer = setTimeout(() => { if (!booted) renderLoading(true); }, 10000);
    try { await DB.init(); } catch (err) { console.error('DentaGest: error al iniciar', err); }
    clearTimeout(slowTimer);
    booted = true;
    DB.onChange(softRender);
    DB.onSync(updateSync);
    render();
  };
  boot();
})();
