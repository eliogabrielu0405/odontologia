/* Sonrisas: arranque, pantallas de acceso, menú, permisos por rol, avisos de suscripción y navegación (#pacientes, #paciente-p8-odontograma…). */
(function () {
  const { icon, esc, initials, fullName, toast, waLink, fmtDate } = U;
  const COMPANY = (window.SONRISAS_CONFIG && window.SONRISAS_CONFIG.company) || 'EU Digital Solutions';

  /** Permisos por rol dentro de una clínica. */
  const PERMS = {
    titular: ['delete', 'clinical', 'catalog', 'reports', 'team', 'activity', 'settings', 'billing'],
    odontologo: ['clinical', 'catalog', 'reports'],
    recepcion: ['billing'],
  };

  const CLINIC_NAV = [
    { section: 'Consultorio' },
    { route: 'inicio', label: 'Inicio', icon: 'dashboard' },
    { route: 'agenda', label: 'Agenda', icon: 'calendar' },
    { route: 'pacientes', label: 'Pacientes', icon: 'users' },
    { route: 'presupuestos', label: 'Presupuestos', icon: 'file' },
    { route: 'pagos', label: 'Cobros', icon: 'cash' },
    { route: 'tratamientos', label: 'Tratamientos', icon: 'tooth' },
    { route: 'reportes', label: 'Reportes', icon: 'chart', perm: 'reports' },
    { section: 'Mi clínica' },
    { route: 'suscripcion', label: 'Mi suscripción', icon: 'wallet', perm: 'billing', alert: true },
    { route: 'equipo', label: 'Mi equipo', icon: 'shield', perm: 'team' },
    { route: 'configuracion', label: 'Configuración', icon: 'settings', perm: 'settings' },
    { route: 'actividad', label: 'Actividad', icon: 'activity', perm: 'activity' },
    { route: 'sugerencias', label: 'Sugerencias', icon: 'bulb', count: true },
    { route: 'perfil', label: 'Mi perfil', icon: 'user' },
  ];
  const LOCKED_NAV = [
    { section: 'Mi clínica' },
    { route: 'suscripcion', label: 'Mi suscripción', icon: 'wallet', perm: 'billing' },
    { route: 'sugerencias', label: 'Sugerencias', icon: 'bulb', count: true },
    { route: 'perfil', label: 'Mi perfil', icon: 'user' },
  ];
  const LOCKED_ROUTES = ['suscripcion', 'sugerencias', 'perfil'];
  const ADMIN_NAV = [
    { section: COMPANY },
    { route: 'admin', label: 'Resumen', icon: 'dashboard' },
    { route: 'admin-clinicas', label: 'Clínicas', icon: 'building' },
    { route: 'admin-pagos', label: 'Pagos recibidos', icon: 'upload' },
    { route: 'admin-sugerencias', label: 'Sugerencias', icon: 'bulb', count: true },
    { route: 'admin-ajustes', label: 'Ajustes de cobro', icon: 'settings' },
  ];

  const CLINIC_ROUTES = [
    { re: /^(?:inicio)?$/, view: () => Views.dashboard, nav: 'inicio' },
    { re: /^pacientes$/, view: () => Views.patients, nav: 'pacientes' },
    { re: /^paciente-([A-Za-z0-9_]+?)(?:-([a-z]+))?$/, view: () => Views.patientDetail, nav: 'pacientes', params: (m) => ({ id: m[1], tab: m[2] || 'info' }) },
    { re: /^agenda$/, view: () => Views.agenda, nav: 'agenda' },
    { re: /^tratamientos$/, view: () => Views.treatments, nav: 'tratamientos' },
    { re: /^presupuestos$/, view: () => Views.budgets, nav: 'presupuestos' },
    { re: /^pagos$/, view: () => Views.payments, nav: 'pagos' },
    { re: /^reportes$/, view: () => Views.reports, nav: 'reportes', perm: 'reports' },
    { re: /^suscripcion$/, view: () => Session.views.subscription, nav: 'suscripcion', perm: 'billing' },
    { re: /^equipo$/, view: () => Session.views.team, nav: 'equipo', perm: 'team' },
    { re: /^configuracion$/, view: () => Views.settings, nav: 'configuracion', perm: 'settings' },
    { re: /^actividad$/, view: () => Views.activity, nav: 'actividad', perm: 'activity' },
    { re: /^sugerencias$/, view: () => Suggestions.clinicView, nav: 'sugerencias' },
    { re: /^perfil$/, view: () => Session.views.profile, nav: 'perfil' },
  ];
  const ADMIN_ROUTES = [
    { re: /^(?:admin)?$/, view: () => Admin.home, nav: 'admin' },
    { re: /^admin-clinicas$/, view: () => Admin.clinics, nav: 'admin-clinicas' },
    { re: /^admin-pagos$/, view: () => Admin.payments, nav: 'admin-pagos' },
    { re: /^admin-sugerencias$/, view: () => Suggestions.adminView, nav: 'admin-sugerencias' },
    { re: /^admin-ajustes$/, view: () => Admin.settings, nav: 'admin-ajustes' },
  ];

  const app = document.getElementById('app');
  let user = null;
  let mode = 'loading'; // 'public' | 'clinic' | 'locked' | 'admin' | 'blocked' | 'inactive' | 'orphan' | 'error'
  let booted = false;
  let dirty = false;
  let errorMessage = '';

  const can = (perm) => !!user && (PERMS[user.role] || []).includes(perm);
  const currentRoute = () => { try { return decodeURIComponent(location.hash.replace(/^#/, '')); } catch { return ''; } };
  const go = (name) => { if (currentRoute() === name) render(); else location.hash = name; };

  const brandTile = (size = '') => `<div class="brand-tile ${size}">${Logo.mark()}</div>`;
  const brandBlock = (subtitle) => `<div class="login-logo"><h1 class="login-brand">${Logo.full()}</h1><p>${subtitle}</p></div>`;
  const footer = () => `<div class="login-install" data-install-slot="login"></div><p class="login-foot">Sonrisas es un producto de <strong>${esc(COMPANY)}</strong></p>`;
  const supportLink = (text) => {
    const phone = (Session.platform() || {}).support_whatsapp;
    return phone ? `<a href="${esc(waLink(phone, text))}" target="_blank" rel="noopener">${icon('whatsapp')}Escríbenos por WhatsApp</a>` : '';
  };

  /* =====================================================================
     Pantallas sin acceso al sistema
     ===================================================================== */
  // Sin ícono propio va el logo: completo en la pantalla de carga, el diente en las demás.
  const splash = (title, body, extra = '', ic = 'tooth') => {
    const head = ic !== 'tooth' ? `<div class="logo-mark lg">${icon(ic)}</div><h1>${title}</h1>`
      : title === 'Sonrisas' ? `<h1 class="splash-logo">${Logo.full()}</h1>`
        : `${brandTile('lg')}<h1>${title}</h1>`;
    app.innerHTML = `<div class="splash"><div class="splash-card" role="status">${head}${body ? `<p>${body}</p>` : ''}${extra}</div></div>`;
  };
  const renderLoading = (slow) => splash('Sonrisas', 'Cargando tu consultorio…', `<div class="loader" aria-hidden="true"></div>${slow ? '<p class="muted small">Está tardando más de lo normal. Revisa tu conexión a internet.</p>' : ''}`);
  const logoutButton = '<button class="btn" data-logout>Cerrar sesión</button>';
  const bindLogout = () => { const b = app.querySelector('[data-logout]'); if (b) b.addEventListener('click', logout); };

  const renderNotConfigured = () => splash('Falta conectar el servidor',
    'Esta copia de Sonrisas todavía no tiene los datos de Supabase. Completa <code>js/config.js</code> con la URL y la clave pública del proyecto.', '', 'settings');

  const renderBlocked = () => {
    const name = Session.context().clinic.name;
    const phone = (Session.platform() || {}).support_whatsapp;
    const support = phone ? `<a class="btn btn-primary" href="${esc(waLink(phone, `Hola, la cuenta de Sonrisas de ${name} aparece bloqueada.`))}" target="_blank" rel="noopener">${icon('whatsapp')}Escríbenos por WhatsApp</a>` : '';
    splash('Cuenta bloqueada', `El acceso de ${esc(name)} a Sonrisas está bloqueado. Escríbenos para resolverlo.`, `<div class="splash-actions">${support}${logoutButton}</div>`, 'lock');
    bindLogout();
  };
  const renderInactive = () => {
    splash('Usuario desactivado', 'El titular de tu clínica desactivó tu usuario. Habla con él para volver a entrar.', `<div class="splash-actions">${logoutButton}</div>`, 'lock');
    bindLogout();
  };
  const renderOrphan = () => {
    splash('Tu cuenta no tiene clínica', 'No encontramos una clínica asociada a esta cuenta. Si te invitaron, pide un código nuevo al titular.', `<div class="splash-actions">${logoutButton}</div>`, 'info');
    bindLogout();
  };
  const renderError = () => {
    splash('No pudimos conectar', esc(errorMessage || 'Revisa tu conexión a internet e intenta de nuevo.'), `<div class="splash-actions"><button class="btn btn-primary" data-retry>Reintentar</button>${logoutButton}</div>`, 'alert');
    app.querySelector('[data-retry]').addEventListener('click', enter);
    bindLogout();
  };

  /* ---------- Acceso: iniciar sesión, crear cuenta, unirse con código ---------- */
  const authShell = (active, inner) => `
    <div class="login-wrap">
      <div class="auth-card">
        ${brandBlock('El sistema para tu consultorio odontológico')}
        ${active === 'admin' ? '' : `<div class="auth-tabs" role="tablist">
          <a href="#" role="tab" class="${active === 'login' ? 'active' : ''}" aria-selected="${active === 'login'}">Iniciar sesión</a>
          <a href="#registro" role="tab" class="${active === 'registro' ? 'active' : ''}" aria-selected="${active === 'registro'}">Soy odontólogo</a>
          <a href="#unirse" role="tab" class="${active === 'unirse' ? 'active' : ''}" aria-selected="${active === 'unirse'}">Tengo un código</a>
        </div>`}
        ${inner}
      </div>
      ${footer()}
    </div>`;

  const submitWith = (form, label, fn) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const missing = [...form.querySelectorAll('[required]')].find((el) => !String(el.value).trim());
    if (missing) { missing.focus(); toast('Completa los campos obligatorios.', 'err'); return; }
    const button = form.querySelector('[type=submit]');
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = label;
    try { await fn(Object.fromEntries(new FormData(form).entries())); } catch (err) { toast(err.message || 'Ocurrió un error.', 'err'); button.disabled = false; button.innerHTML = original; }
  });
  const checkPasswords = (d) => {
    if (d.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if (d.password !== d.confirm) throw new Error('Las contraseñas no coinciden.');
  };

  const renderLogin = () => {
    app.innerHTML = authShell('login', `
      <form class="stack" data-login novalidate>
        <label class="field">Correo<input type="email" name="email" id="login-email" autocomplete="username" placeholder="tu@correo.com" required></label>
        <label class="field">Contraseña<input type="password" name="password" id="login-password" autocomplete="current-password" required></label>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Iniciar sesión</button>
        <button type="button" class="link-btn center" data-forgot>¿Olvidaste tu contraseña?</button>
      </form>`);
    const form = app.querySelector('[data-login]');
    submitWith(form, 'Entrando…', async (d) => { await Session.signIn(d.email, d.password); await enter(); });
    app.querySelector('[data-forgot]').addEventListener('click', () => U.openModal({
      title: '¿Olvidaste tu contraseña?', hideFooter: true,
      body: `<div class="stack"><p class="no-margin"><strong>Si eres recepción u odontólogo de una clínica:</strong> pídele al titular que te genere una contraseña temporal en <em>Mi equipo</em>.</p>
        <p class="no-margin"><strong>Si eres el titular:</strong> escríbenos y te ayudamos a recuperar el acceso.</p>
        ${supportLink('Hola, olvidé mi contraseña de Sonrisas.') ? `<p class="no-margin">${supportLink('Hola, olvidé mi contraseña de Sonrisas.')}</p>` : ''}</div>`,
    }));
    form.email.focus();
  };

  const renderRegister = () => {
    const trial = Number((Session.platform() || {}).trial_days || 0);
    app.innerHTML = authShell('registro', `
      <form class="stack" data-register novalidate>
        ${trial ? `<div class="trial-pill">${icon('check')}Pruébalo gratis por ${U.plural(trial, 'día', 'días')}</div>` : ''}
        <div class="form-grid">
          <label class="field">Nombre<input name="firstName" required autocomplete="given-name"></label>
          <label class="field">Apellido<input name="lastName" required autocomplete="family-name"></label>
        </div>
        <label class="field">Nombre de tu consultorio o clínica<input name="clinicName" required autocomplete="organization" placeholder="Ej: Consultorio Dental Sonríe"></label>
        <label class="field">Teléfono (WhatsApp)<input name="phone" required inputmode="tel" autocomplete="tel" placeholder="0414-1234567"></label>
        <label class="field">Correo<input type="email" name="email" required autocomplete="username"></label>
        <div class="form-grid">
          <label class="field">Contraseña<input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label>
          <label class="field">Repite la contraseña<input type="password" name="confirm" required minlength="8" autocomplete="new-password"></label>
        </div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Crear mi cuenta</button>
        <p class="muted small center no-margin">Con esta cuenta entras tú. Después puedes invitar a tu recepción desde “Mi equipo”.</p>
      </form>`);
    submitWith(app.querySelector('[data-register]'), 'Creando tu cuenta…', async (d) => {
      checkPasswords(d);
      await Session.register(d);
      toast(`¡Bienvenido/a a Sonrisas, ${d.firstName}!`);
      location.hash = 'inicio';
      await enter();
    });
  };

  const renderJoin = (prefill = '') => {
    app.innerHTML = authShell('unirse', `
      <form class="stack" data-code novalidate>
        <p class="muted no-margin">El titular de tu clínica te comparte un código desde “Mi equipo”.</p>
        <label class="field">Código de invitación<input name="code" required autocomplete="off" class="code-input" maxlength="12" value="${esc(prefill)}" placeholder="ABCD2345"></label>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Continuar</button>
      </form>
      <form class="stack" data-join novalidate hidden></form>`);
    const codeForm = app.querySelector('[data-code]');
    const joinForm = app.querySelector('[data-join]');
    submitWith(codeForm, 'Verificando…', async (d) => {
      const code = d.code.trim().toUpperCase();
      const info = await Session.verifyCode(code);
      codeForm.hidden = true;
      joinForm.hidden = false;
      joinForm.innerHTML = `
        <div class="banner banner-info no-margin">${icon('building')}<div class="grow">Te unirás a <strong>${esc(info.clinicName)}</strong> como <strong>${esc(DB.ROLES[info.role] || info.role)}</strong>.</div></div>
        <input type="hidden" name="code" value="${esc(code)}">
        <div class="form-grid">
          <label class="field">Nombre<input name="firstName" required autocomplete="given-name"></label>
          <label class="field">Apellido<input name="lastName" required autocomplete="family-name"></label>
        </div>
        <label class="field">Teléfono<input name="phone" inputmode="tel" autocomplete="tel" placeholder="0414-1234567"></label>
        <label class="field">Correo<input type="email" name="email" required autocomplete="username"></label>
        <div class="form-grid">
          <label class="field">Contraseña<input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label>
          <label class="field">Repite la contraseña<input type="password" name="confirm" required minlength="8" autocomplete="new-password"></label>
        </div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Crear mi cuenta</button>`;
      submitWith(joinForm, 'Creando tu cuenta…', async (j) => {
        checkPasswords(j);
        await Session.join(j);
        toast(`¡Bienvenido/a, ${j.firstName}!`);
        location.hash = 'inicio';
        await enter();
      });
      joinForm.firstName.focus();
    });
    if (prefill) codeForm.requestSubmit();
  };

  const renderCreateAdmin = () => {
    app.innerHTML = authShell('admin', `
      <form class="stack" data-admin novalidate>
        <div class="banner banner-info no-margin">${icon('shield')}<div class="grow">Cuenta de administrador de ${esc(COMPANY)}. Necesitas el código de un solo uso que recibiste al instalar Sonrisas.</div></div>
        <label class="field">Código de administrador<input name="code" required autocomplete="off"></label>
        <div class="form-grid">
          <label class="field">Nombre<input name="firstName" required></label>
          <label class="field">Apellido<input name="lastName" required></label>
        </div>
        <label class="field">Correo<input type="email" name="email" required autocomplete="username"></label>
        <div class="form-grid">
          <label class="field">Contraseña<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
          <label class="field">Repite la contraseña<input type="password" name="confirm" required minlength="8" autocomplete="new-password"></label>
        </div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Crear administrador</button>
      </form>`);
    submitWith(app.querySelector('[data-admin]'), 'Creando…', async (d) => {
      checkPasswords(d);
      await Session.createAdmin(d);
      toast('Cuenta de administrador creada');
      location.hash = 'admin';
      await enter();
    });
  };

  const renderPublic = () => {
    const route = currentRoute();
    if (route === 'registro') renderRegister();
    else if (route === 'crear-admin') renderCreateAdmin();
    else if (route === 'unirse' || route.startsWith('unirse-')) renderJoin(route.startsWith('unirse-') ? route.slice(7).toUpperCase() : '');
    else renderLogin();
  };

  /* =====================================================================
     Layout con sesión
     ===================================================================== */
  const subscriptionBanner = () => {
    const sub = Session.subscription();
    if (!sub || currentRoute() === 'suscripcion') return '';
    const pending = Session.pendingReport();
    const payBtn = Session.canPay() ? '<a class="btn btn-sm" href="#suscripcion">Pagar ahora</a>' : '';
    if (pending && ['por_vencer', 'vencida', 'prueba'].includes(sub.state)) {
      return `<div class="banner banner-info">${icon('clock')}<div class="grow"><strong>Comprobante en revisión.</strong> Recibimos tu pago del ${fmtDate(pending.paid_on)}; te avisamos al aprobarlo.</div></div>`;
    }
    if (sub.state === 'prueba') {
      const days = sub.daysLeft === 0 ? 'Tu prueba gratis termina hoy.' : `Te ${sub.daysLeft === 1 ? 'queda 1 día' : `quedan ${sub.daysLeft} días`} de prueba gratis.`;
      return `<div class="banner banner-info">${icon('info')}<div class="grow"><strong>${days}</strong> ${Session.canPay() ? 'Para seguir después, paga tu plan por Pago Móvil y sube el comprobante.' : 'Avísale al titular para que active el plan.'}</div>${Session.canPay() ? '<a class="btn btn-sm" href="#suscripcion">Ver cómo pagar</a>' : ''}</div>`;
    }
    if (sub.state === 'por_vencer') {
      return `<div class="banner banner-warn">${icon('bell')}<div class="grow"><strong>Tu suscripción vence ${sub.daysLeft === 0 ? 'hoy' : `el ${fmtDate(sub.paidUntil)}`}.</strong> ${Session.canPay() ? 'Paga por Pago Móvil y sube el comprobante para no perder el acceso.' : 'Avísale al titular de la clínica.'}</div>${payBtn}</div>`;
    }
    if (sub.state === 'vencida') {
      return `<div class="banner banner-danger">${icon('alert')}<div class="grow"><strong>Tu suscripción venció el ${fmtDate(sub.paidUntil)}.</strong> Te ${sub.graceLeft === 1 ? 'queda 1 día' : `quedan ${sub.graceLeft} días`} antes de que se pause el acceso.</div>${payBtn}</div>`;
    }
    return '';
  };

  const lockedNotice = () => {
    const sub = Session.subscription();
    const text = sub.state === 'suspendida' ? 'La cuenta de tu clínica está suspendida.' : `La suscripción de tu clínica venció el ${fmtDate(sub.paidUntil)}.`;
    return `<div class="banner banner-danger">${icon('lock')}<div class="grow"><strong>${text}</strong> ${Session.canPay() ? 'Reporta tu pago aquí y reactivamos el acceso en cuanto lo confirmemos. Tus datos están guardados.' : 'Pídele al titular o a la recepción que reporten el pago. Tus datos están guardados.'}</div></div>`;
  };

  const syncText = (state) => {
    if (state.offline) return { cls: 'busy', text: `Sin conexión · ${U.plural(state.pending, 'cambio pendiente', 'cambios pendientes')}` };
    return state.pending ? { cls: 'busy', text: 'Guardando…' } : { cls: '', text: 'Guardado' };
  };
  const updateSync = (state) => {
    const el = app.querySelector('[data-sync]');
    if (!el) return;
    const { cls, text } = syncText(state);
    el.className = `sync ${cls}`;
    el.textContent = text;
  };

  /** Número junto a una opción del menú (por ejemplo, sugerencias nuevas). Se actualiza solo cuando cambia. */
  const navCount = (route) => {
    const n = window.Suggestions ? Suggestions.navCount(route) : 0;
    return `<span class="nav-count" data-nav-count="${route}" ${n ? '' : 'hidden'}>${n || ''}</span>`;
  };

  const renderLayout = (navItems, activeNav, { brandSub, who, search, banners = '' }) => {
    const sub = Session.subscription();
    const alertDot = sub && ['por_vencer', 'vencida', 'sin_acceso', 'suspendida'].includes(sub.state);
    app.innerHTML = `
      <div class="layout">
        <aside class="sidebar" data-sidebar aria-label="Menú principal">
          <div class="sidebar-brand">${brandTile()}<div><strong>Sonrisas</strong><small>${esc(brandSub)}</small></div></div>
          <nav class="nav">
            ${navItems.filter((n) => !n.perm || can(n.perm) || mode === 'admin').map((n) => (n.section
              ? `<div class="nav-section">${esc(n.section)}</div>`
              : `<a href="#${n.route}" class="${activeNav === n.route ? 'active' : ''}" ${activeNav === n.route ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span>${n.alert && alertDot ? '<i class="nav-dot" aria-label="Requiere atención"></i>' : ''}${n.count ? navCount(n.route) : ''}</a>`)).join('')}
          </nav>
          <div class="sidebar-foot">
            <div class="sidebar-user">
              <div class="avatar sm" style="background:${esc(who.color || '#0d9488')}">${esc(initials(who.firstName, who.lastName))}</div>
              <div><strong>${esc(who.firstName)} ${esc(who.lastName)}</strong><small>${esc(who.roleLabel)}</small></div>
            </div>
            <div data-install-slot="side"></div>
            <button class="side-btn" data-logout>${icon('logout')}Cerrar sesión</button>
            <p class="side-company">${esc(COMPANY)}</p>
          </div>
        </aside>
        <div class="backdrop" data-backdrop></div>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" data-menu aria-label="Abrir menú">${icon('menu')}<i class="menu-dot" data-menu-dot ${window.Suggestions && navItems.some((n) => n.count && Suggestions.navCount(n.route)) ? '' : 'hidden'}></i></button>
            <div class="who"><strong>${esc(brandSub)}</strong><small>${esc(who.firstName)} ${esc(who.lastName)} · ${esc(who.roleLabel)}</small></div>
            <div class="spacer"></div>
            ${search ? '<span class="sync" data-sync></span>' : ''}
            ${search ? `<div class="search-box">${icon('search')}<input data-search type="search" placeholder="Buscar paciente…" autocomplete="off" aria-label="Buscar paciente"><div class="search-results" data-results hidden></div></div>` : '<div class="spacer-mobile"></div>'}
            <a class="avatar" href="${mode === 'admin' ? '#admin' : '#perfil'}" style="background:${esc(who.color || '#0d9488')}" title="Mi perfil" aria-label="Mi perfil">${esc(initials(who.firstName, who.lastName))}</a>
          </header>
          <main class="content">${banners}<div data-content></div></main>
        </div>
      </div>`;

    const sidebar = app.querySelector('[data-sidebar]');
    const backdrop = app.querySelector('[data-backdrop]');
    const toggle = (open) => { sidebar.classList.toggle('open', open); backdrop.classList.toggle('open', open); };
    app.querySelector('[data-menu]').addEventListener('click', () => toggle(true));
    backdrop.addEventListener('click', () => toggle(false));
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) toggle(false); });
    app.querySelector('[data-logout]').addEventListener('click', logout);

    if (!search) return;
    updateSync({ pending: DB.pendingWrites(), offline: !navigator.onLine });
    const input = app.querySelector('[data-search]');
    const results = app.querySelector('[data-results]');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.hidden = true; return; }
      const found = DB.all('patients').filter((p) => `${p.firstName} ${p.lastName} ${p.dni} ${p.phone}`.toLowerCase().includes(q)).slice(0, 6);
      results.innerHTML = found.length
        ? found.map((p) => `<a href="#paciente-${p.id}"><div class="avatar sm">${esc(initials(p.firstName, p.lastName))}</div><div><strong>${esc(fullName(p))}</strong><br><small class="muted">C.I. ${esc(p.dni)}</small></div></a>`).join('')
        : '<div class="empty compact">Sin resultados</div>';
      results.hidden = false;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const a = results.querySelector('a'); if (a) { e.preventDefault(); location.hash = a.getAttribute('href').slice(1); input.value = ''; results.hidden = true; } }
      if (e.key === 'Escape') { input.value = ''; results.hidden = true; }
    });
    results.addEventListener('click', () => { input.value = ''; results.hidden = true; });
  };

  /* =====================================================================
     Render principal
     ===================================================================== */
  const runRoute = (routes, fallbackNav, navItems, layoutOptions) => {
    const route = currentRoute();
    const found = routes.map((r) => ({ r, m: route.match(r.re) })).find((x) => x.m);
    renderLayout(navItems, found ? found.r.nav : fallbackNav, layoutOptions);
    const content = app.querySelector('[data-content]');
    if (!found) { content.innerHTML = `<div class="card empty">No encontramos esta página. <a href="#${fallbackNav}">Volver al inicio</a></div>`; return; }
    if (found.r.perm && mode !== 'admin' && !can(found.r.perm)) { content.innerHTML = `<div class="card empty">Tu rol no tiene acceso a esta sección. <a href="#${fallbackNav}">Volver al inicio</a></div>`; return; }
    const result = found.r.view()(content, found.r.params ? found.r.params(found.m) : {});
    if (result && typeof result.catch === 'function') result.catch((err) => { content.innerHTML = `<div class="card empty">${esc(err.message || 'No se pudo cargar esta sección.')}</div>`; });
  };

  const render = ({ keepScroll = false } = {}) => {
    if (!booted) return;
    dirty = false;
    const scrollY = window.scrollY;
    U.closeModal({ silent: true });
    const ctx = Session.context();
    if (mode === 'loading') renderLoading(false);
    else if (mode === 'public') renderPublic();
    else if (mode === 'error') renderError();
    else if (mode === 'blocked') renderBlocked();
    else if (mode === 'inactive') renderInactive();
    else if (mode === 'orphan') renderOrphan();
    else if (mode === 'admin') {
      const info = (ctx && ctx.admin) || {};
      const [firstName, ...rest] = String(info.full_name || 'Administrador').split(' ');
      const admin = { firstName, lastName: rest.join(' '), roleLabel: 'Administrador', color: '#7c3aed' };
      runRoute(ADMIN_ROUTES, 'admin', ADMIN_NAV, { brandSub: 'Administración', who: admin, search: false });
    } else {
      const profile = ctx.profile;
      user = DB.currentUser() || { id: profile.id, firstName: profile.first_name, lastName: profile.last_name, role: profile.role, color: profile.color };
      const who = { ...user, roleLabel: DB.ROLES[user.role] };
      if (mode === 'locked') {
        const route = currentRoute();
        if (!LOCKED_ROUTES.includes(route)) { location.replace(`#${Session.canPay() ? 'suscripcion' : 'perfil'}`); return; }
        runRoute(CLINIC_ROUTES.filter((r) => LOCKED_ROUTES.includes(r.nav)), 'suscripcion', LOCKED_NAV, { brandSub: ctx.clinic.name, who, search: false, banners: lockedNotice() });
      } else {
        runRoute(CLINIC_ROUTES, 'inicio', CLINIC_NAV, { brandSub: ctx.clinic.name, who, search: true, banners: subscriptionBanner() });
      }
    }
    if (window.PWA) PWA.paint(app);
    window.scrollTo(0, keepScroll ? scrollY : 0);
  };

  /* ---------- Entrar con la sesión actual ---------- */
  const enter = async () => {
    mode = 'loading';
    renderLoading(false);
    const slow = setTimeout(() => renderLoading(true), 10000);
    try {
      const ctx = await Session.loadContext();
      DB.teardown();
      if (!ctx) mode = 'public';
      else if (ctx.is_admin) mode = 'admin';
      else if (!ctx.profile || !ctx.clinic) mode = 'orphan';
      else if (!ctx.profile.active) mode = 'inactive';
      else if (ctx.clinic.status === 'bloqueada') mode = 'blocked';
      else if (!ctx.has_access) mode = 'locked';
      else mode = 'clinic';
      if (mode === 'clinic') await DB.init({ client: Session.client, context: ctx });
      if (mode === 'clinic' || mode === 'locked') {
        if (mode === 'locked') await DB.initLocked({ client: Session.client, context: ctx });
        try { await Session.loadMyReports(); } catch { /* el aviso de pago es opcional */ }
      }
      if (mode === 'admin' && !currentRoute().startsWith('admin')) location.replace('#admin');
      refreshCounts();
    } catch (err) {
      errorMessage = Session.friendly(err);
      mode = 'error';
    }
    clearTimeout(slow);
    booted = true;
    render();
  };

  /** Avisos del menú (sugerencias): no frenan la carga; se pintan cuando llegan. */
  const refreshCounts = () => {
    if (!window.Suggestions) return;
    const job = mode === 'admin' ? Suggestions.refreshFresh() : ['clinic', 'locked'].includes(mode) ? Suggestions.refreshUnseen() : null;
    if (job) job.catch(() => {});
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshCounts(); });

  /** La suscripción cambió (pago aprobado, suspensión…): recarga el contexto y redibuja. */
  let refreshing = false;
  const refreshAccount = async () => {
    if (refreshing || !['clinic', 'locked'].includes(mode)) return;
    refreshing = true;
    const before = `${mode}|${(Session.context() || {}).has_access}`;
    try {
      const ctx = await Session.loadContext();
      try { await Session.loadMyReports(); } catch { /* opcional */ }
      const nextMode = !ctx || !ctx.profile ? 'orphan' : !ctx.profile.active ? 'inactive' : ctx.clinic.status === 'bloqueada' ? 'blocked' : !ctx.has_access ? 'locked' : 'clinic';
      if (`${nextMode}|${ctx && ctx.has_access}` !== before) { refreshing = false; await enter(); return; }
      softRender();
    } catch { /* se reintenta en el próximo cambio */ }
    refreshing = false;
  };

  const isBusy = () => {
    if (document.querySelector('#modal-root .modal-overlay')) return true;
    const active = document.activeElement;
    return !!(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && !['checkbox', 'file', 'button', 'submit'].includes(active.type));
  };
  const softRender = () => {
    if (!booted || mode !== 'clinic') return;
    if (isBusy()) { dirty = true; return; }
    render({ keepScroll: true });
  };
  const flushIfDirty = () => setTimeout(() => { if (dirty && !isBusy()) render({ keepScroll: true }); }, 350);

  const logout = async () => {
    DB.teardown();
    if (window.Suggestions) Suggestions.reset();
    await Session.signOut();
    user = null;
    mode = 'public';
    if (currentRoute()) location.hash = ''; else render();
  };

  window.App = { render, go, can, user: () => user, logout, refreshAccount, mode: () => mode };
  window.addEventListener('hashchange', () => render());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') U.closeModal(); });
  document.addEventListener('modal:closed', flushIfDirty);
  document.addEventListener('focusout', () => { if (dirty) flushIfDirty(); });

  // Netlify, en su plan gratuito, pone una insignia fija abajo a la derecha que no se puede ocultar.
  // Mientras esté en la página se deja libre esa franja para que no tape botones (--host-badge en styles.css).
  const watchHostBadge = () => {
    const mark = () => document.documentElement.classList.toggle('has-host-badge', !!document.getElementById('nl-badge-frame'));
    new MutationObserver(mark).observe(document.body, { childList: true });
    mark();
  };

  const boot = async () => {
    if (!Session.configured) { booted = true; renderNotConfigured(); return; }
    renderLoading(false);
    DB.onChange(softRender);
    DB.onSync(updateSync);
    DB.onAccountChange(refreshAccount);
    Session.client.auth.onAuthStateChange((event) => {
      // Se difiere para no llamar a Supabase dentro del aviso de autenticación.
      if (event === 'SIGNED_OUT') setTimeout(() => { if (mode !== 'public') { DB.teardown(); mode = 'public'; user = null; render(); } }, 0);
    });
    await Session.loadPublicSettings();
    let session = false;
    try { session = await Session.hasSession(); } catch { session = false; }
    if (session) { await enter(); return; }
    mode = 'public';
    booted = true;
    render();
  };
  watchHostBadge();
  boot();
})();
