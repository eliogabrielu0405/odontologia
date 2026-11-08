/* Aplicación: login, layout, permisos por rol y enrutamiento por hash. */
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
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/pacientes', label: 'Pacientes', icon: 'users' },
    { path: '/agenda', label: 'Agenda', icon: 'calendar' },
    { section: 'Clínica' },
    { path: '/tratamientos', label: 'Tratamientos', icon: 'tooth' },
    { path: '/presupuestos', label: 'Presupuestos', icon: 'file' },
    { path: '/pagos', label: 'Pagos', icon: 'cash' },
    { path: '/reportes', label: 'Reportes', icon: 'chart', perm: 'reports' },
    { section: 'Administración', perm: 'users' },
    { path: '/usuarios', label: 'Usuarios', icon: 'shield', perm: 'users' },
    { path: '/actividad', label: 'Actividad', icon: 'activity', perm: 'activity' },
    { path: '/configuracion', label: 'Configuración', icon: 'settings', perm: 'settings' },
  ];

  const ROUTES = [
    { re: /^\/$/, view: 'dashboard' },
    { re: /^\/pacientes$/, view: 'patients' },
    { re: /^\/pacientes\/([^/]+)(?:\/([a-z]+))?$/, view: 'patientDetail', params: (m) => ({ id: m[1], tab: m[2] || 'info' }) },
    { re: /^\/agenda$/, view: 'agenda' },
    { re: /^\/tratamientos$/, view: 'treatments' },
    { re: /^\/presupuestos$/, view: 'budgets' },
    { re: /^\/pagos$/, view: 'payments' },
    { re: /^\/reportes$/, view: 'reports', perm: 'reports' },
    { re: /^\/usuarios$/, view: 'users', perm: 'users' },
    { re: /^\/actividad$/, view: 'activity', perm: 'activity' },
    { re: /^\/configuracion$/, view: 'settings', perm: 'settings' },
  ];

  const app = document.getElementById('app');
  let user = null;

  const can = (perm) => !!user && PERMS[user.role].includes(perm);
  const currentPath = () => (location.hash.replace(/^#/, '') || '/');
  const go = (path) => { if (currentPath() === path) render(); else location.hash = path; };

  /* ---------- Login ---------- */
  const renderLogin = () => {
    app.innerHTML = `
      <div class="login-wrap">
        <form class="login-card" novalidate>
          <div class="login-logo"><div class="logo-mark">${icon('tooth')}</div><h1>DentaGest</h1><p>Sistema de gestión para clínicas odontológicas</p></div>
          <div class="stack">
            <label class="field">Email<input type="email" name="email" autocomplete="username" placeholder="tu@clinica.com" required></label>
            <label class="field">Contraseña<input type="password" name="password" autocomplete="current-password" placeholder="••••••••" required></label>
            <label class="field" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="remember" style="width:auto" checked> Mantener sesión iniciada</label>
            <button class="btn btn-primary btn-block" type="submit" style="padding:12px">Iniciar sesión</button>
          </div>
          <div class="login-hint"><strong>Acceso de demostración</strong><br>Admin: admin@dentagest.com / admin123<br>Odontólogo: crodriguez@dentagest.com / demo123<br>Recepción: recepcion@dentagest.com / demo123</div>
        </form>
      </div>`;
    const form = app.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = DB.login(form.email.value, form.password.value, form.remember.checked);
      if (res.error) { toast(res.error, 'err'); form.password.select(); return; }
      user = res.user;
      toast(`Bienvenido/a, ${user.firstName}`);
      if (currentPath() === '/') render(); else location.hash = '/';
    });
    form.email.focus();
  };

  /* ---------- Layout ---------- */
  const navActive = (path) => {
    const cur = currentPath();
    return path === '/' ? cur === '/' : cur === path || cur.startsWith(path + '/');
  };

  const renderLayout = () => {
    const s = DB.settings();
    const today = U.isoDate();
    const todayCount = DB.all('appointments').filter((a) => a.date === today && ['programada', 'confirmada'].includes(a.status)).length;
    app.innerHTML = `
      <div class="layout">
        <aside class="sidebar" data-sidebar>
          <div class="sidebar-brand"><div class="logo-mark">${icon('tooth')}</div><div><strong>DentaGest</strong><small>${esc(s.clinicName)}</small></div></div>
          <nav class="nav">
            ${NAV.filter((n) => !n.perm || can(n.perm)).map((n) => n.section
              ? `<div class="nav-section">${n.section}</div>`
              : `<a href="#${n.path}" class="${navActive(n.path) ? 'active' : ''}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}
          </nav>
          <div class="sidebar-foot">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;color:#fff">
              <div class="avatar sm" style="background:${user.color}">${esc(initials(user.firstName, user.lastName))}</div>
              <div style="min-width:0"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(user.firstName)} ${esc(user.lastName)}</strong><small style="color:#94a3b8">${DB.ROLES[user.role]}</small></div>
            </div>
            <button class="btn btn-sm" data-logout style="background:rgba(255,255,255,.06);color:#e2e8f0;border-color:rgba(255,255,255,.1)">${icon('logout')}Cerrar sesión</button>
          </div>
        </aside>
        <div class="backdrop" data-backdrop></div>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" data-menu aria-label="Menú">${icon('menu')}</button>
            <div class="who"><strong>${esc(user.firstName)} ${esc(user.lastName)}</strong><small>${DB.ROLES[user.role]}</small></div>
            <div class="spacer"></div>
            <div class="search-box">${icon('search')}<input data-search placeholder="Buscar paciente…" autocomplete="off"><div class="search-results" data-results hidden></div></div>
            <button class="icon-btn" data-bell title="${todayCount} citas pendientes hoy">${icon('bell')}${todayCount ? '<span class="dot"></span>' : ''}</button>
            <div class="avatar" style="background:${user.color}" title="${esc(user.email)}">${esc(initials(user.firstName, user.lastName))}</div>
          </header>
          <main class="content" data-content></main>
        </div>
      </div>`;

    const sidebar = app.querySelector('[data-sidebar]');
    const backdrop = app.querySelector('[data-backdrop]');
    const toggle = (open) => { sidebar.classList.toggle('open', open); backdrop.classList.toggle('open', open); };
    app.querySelector('[data-menu]').addEventListener('click', () => toggle(true));
    backdrop.addEventListener('click', () => toggle(false));
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) toggle(false); });
    app.querySelector('[data-logout]').addEventListener('click', logout);
    app.querySelector('[data-bell]').addEventListener('click', () => { go('/agenda'); toast(todayCount ? `Tenés ${todayCount} citas pendientes hoy` : 'No hay citas pendientes hoy'); });

    const input = app.querySelector('[data-search]');
    const results = app.querySelector('[data-results]');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.hidden = true; return; }
      const found = DB.all('patients').filter((p) => `${p.firstName} ${p.lastName} ${p.dni}`.toLowerCase().includes(q)).slice(0, 6);
      results.innerHTML = found.length
        ? found.map((p) => `<a href="#/pacientes/${p.id}"><div class="avatar sm">${esc(initials(p.firstName, p.lastName))}</div><div><strong>${esc(fullName(p))}</strong><br><small class="muted">DNI ${esc(p.dni)}</small></div></a>`).join('')
        : '<div class="empty" style="padding:14px">Sin resultados</div>';
      results.hidden = false;
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = results.querySelector('a'); if (a) location.hash = a.getAttribute('href'); } if (e.key === 'Escape') { input.value = ''; results.hidden = true; } });
    results.addEventListener('click', () => { input.value = ''; results.hidden = true; });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-box')) results.hidden = true; });
  };

  /* ---------- Render ---------- */
  const render = () => {
    user = DB.currentUser();
    U.closeModal();
    if (!user) { renderLogin(); return; }
    const path = currentPath();
    const route = ROUTES.find((r) => r.re.test(path));
    renderLayout();
    const content = app.querySelector('[data-content]');
    if (!route) { content.innerHTML = `<div class="card empty">Página no encontrada. <a href="#/">Ir al inicio</a></div>`; return; }
    if (route.perm && !can(route.perm)) { content.innerHTML = `<div class="card empty">${icon('shield')}<p>No tenés permisos para acceder a esta sección.</p></div>`; return; }
    const m = path.match(route.re);
    Views[route.view](content, route.params ? route.params(m) : {});
    window.scrollTo(0, 0);
  };

  const logout = () => {
    DB.logout();
    user = null;
    history.replaceState(null, '', location.pathname + location.search);
    render();
  };

  window.App = { render, go, can, user: () => user, logout };
  window.addEventListener('hashchange', render);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') U.closeModal(); });
  render();
})();
