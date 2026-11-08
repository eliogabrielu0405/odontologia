/* Cuenta: sesión, registro, invitaciones, perfil, equipo de la clínica y suscripción (Pago Móvil + comprobante). */
(function () {
  const { icon, esc, money, fmtDate, fmtDateTime, toast, openModal, confirmDialog, copyText, waLink, daysBetween, isoDate } = U;

  const cfg = window.SONRISAS_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase && typeof window.supabase.createClient === 'function');
  const client = configured
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sonrisas-auth' } })
    : null;

  let ctx = null;
  let publicSettings = null;
  let reportsCache = [];

  /* ---------- Errores en palabras simples ---------- */
  const friendly = (error) => {
    const m = (error && (error.message || error.error_description)) || '';
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Tu correo aún no está confirmado.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un minuto y vuelve a intentar.';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet.';
    if (/same.*password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta a la actual.';
    if (/Password should be/i.test(m)) return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
    return m || 'Ocurrió un error. Intenta de nuevo.';
  };

  /** Llama a la función del servidor (registro, invitaciones y acciones del administrador). */
  const api = async (action, payload = {}) => {
    const { data, error } = await client.functions.invoke('sonrisas-api', { body: { action, ...payload } });
    if (error) {
      let message = 'No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.';
      try { const body = await error.context.json(); if (body && body.error) message = body.error; } catch { /* sin detalle */ }
      throw new Error(message);
    }
    return data;
  };

  const rpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(friendly(error));
    return data;
  };

  /* ---------- Sesión ---------- */
  const signIn = async (email, password) => {
    const { error } = await client.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
    if (error) throw new Error(friendly(error));
  };
  const signOut = async () => { try { await client.auth.signOut(); } catch { /* sin conexión */ } ctx = null; };
  const hasSession = async () => { const { data } = await client.auth.getSession(); return !!(data && data.session); };

  const register = async (data) => { await api('registrar', data); await signIn(data.email, data.password); };
  const verifyCode = (code) => api('verificar_codigo', { code });
  const join = async (data) => { await api('unirse', data); await signIn(data.email, data.password); };
  const createAdmin = async (data) => { await api('crear_admin', data); await signIn(data.email, data.password); };

  const loadContext = async () => { ctx = await rpc('my_context'); return ctx; };
  const loadPublicSettings = async () => {
    if (!client) return null;
    try { const { data } = await client.from('platform_settings').select('*').eq('id', 1).maybeSingle(); publicSettings = data || publicSettings; } catch { /* sin conexión */ }
    return publicSettings;
  };
  const platform = () => (ctx && ctx.settings) || publicSettings || {};

  /* ---------- Estado de la suscripción ---------- */
  const STATES = {
    prueba: { label: 'Período de prueba', badge: 'b-info' },
    al_dia: { label: 'Al día', badge: 'b-ok' },
    por_vencer: { label: 'Por vencer', badge: 'b-warn' },
    vencida: { label: 'Vencida · en período de gracia', badge: 'b-danger' },
    sin_acceso: { label: 'Vencida', badge: 'b-danger' },
    suspendida: { label: 'Suspendida', badge: 'b-danger' },
    bloqueada: { label: 'Bloqueada', badge: 'b-dark' },
  };

  /** Calcula el estado de la suscripción de una clínica (sirve también para el panel del administrador). */
  const subscriptionOf = (clinicRow, settings, today = (ctx && ctx.today) || isoDate()) => {
    if (!clinicRow) return null;
    const s = settings || {};
    const daysLeft = daysBetween(today, clinicRow.paid_until);
    const grace = Number(s.grace_days || 0);
    const reminder = Number(s.reminder_days || 0);
    let state;
    if (clinicRow.status === 'bloqueada') state = 'bloqueada';
    else if (clinicRow.status === 'suspendida') state = 'suspendida';
    else if (daysLeft < -grace) state = 'sin_acceso';
    else if (daysLeft < 0) state = 'vencida';
    else if (clinicRow.trial) state = 'prueba';
    else if (daysLeft <= reminder) state = 'por_vencer';
    else state = 'al_dia';
    return { state, ...STATES[state], daysLeft, graceLeft: grace + daysLeft, paidUntil: clinicRow.paid_until, price: Number(s.monthly_price || 0), currency: s.currency || 'USD' };
  };
  const subscription = () => (ctx && ctx.clinic ? subscriptionOf(ctx.clinic, ctx.settings) : null);
  const canPay = () => !!(ctx && ctx.profile && ['titular', 'recepcion'].includes(ctx.profile.role));
  const hasAccess = () => !!(ctx && ctx.has_access);

  /* ---------- Pagos de la suscripción ---------- */
  const loadMyReports = async () => {
    if (!ctx || !ctx.clinic) return [];
    const { data, error } = await client.from('payment_reports').select('*').eq('clinic_id', ctx.clinic.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(friendly(error));
    reportsCache = data || [];
    return reportsCache;
  };
  const pendingReport = () => reportsCache.find((r) => r.status === 'pendiente') || null;

  const uploadReceipt = async (clinicId, file) => {
    const blob = await U.compressImage(file);
    const type = blob.type || file.type || 'image/jpeg';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('hei') ? 'heic' : 'jpg';
    const path = `${clinicId}/${Date.now()}-${U.randomCode(6).toLowerCase()}.${ext}`;
    const { error } = await client.storage.from('comprobantes').upload(path, blob, { contentType: type, upsert: false });
    if (error) throw new Error(`No se pudo subir la foto: ${friendly(error)}`);
    return path;
  };

  const reportPayment = async ({ file, amount, currency, months, reference, bank, payerPhone, paidOn }) => {
    if (!ctx || !ctx.clinic) throw new Error('No hay una clínica asociada a tu cuenta.');
    const path = await uploadReceipt(ctx.clinic.id, file);
    const { error } = await client.from('payment_reports').insert({
      clinic_id: ctx.clinic.id, user_id: ctx.user_id, amount: U.cents(amount), currency, months: Number(months) || 1,
      reference: String(reference || '').trim().slice(0, 60), bank: String(bank || '').trim().slice(0, 80),
      payer_phone: String(payerPhone || '').trim().slice(0, 30), paid_on: paidOn, receipt_path: path,
    });
    if (error) throw new Error(friendly(error));
  };

  const receiptUrl = async (path) => {
    if (!path) return null;
    const { data, error } = await client.storage.from('comprobantes').createSignedUrl(path, 3600);
    if (error) throw new Error('No se pudo abrir el comprobante.');
    return data.signedUrl;
  };

  const showReceipt = async (report) => {
    let url = null;
    try { url = await receiptUrl(report.receipt_path); } catch (err) { toast(err.message, 'err'); return; }
    openModal({
      title: `Comprobante · ${money(report.amount, report.currency)}`, size: 'lg', hideFooter: true,
      body: `<div class="receipt-view">${url ? `<img src="${esc(url)}" alt="Foto del comprobante de pago">` : '<p class="muted">Este pago no tiene foto.</p>'}</div>
        <dl class="kv compact">
          <dt>Referencia</dt><dd>${esc(report.reference) || '—'}</dd>
          <dt>Banco</dt><dd>${esc(report.bank) || '—'}</dd>
          <dt>Teléfono</dt><dd>${esc(report.payer_phone) || '—'}</dd>
          <dt>Fecha del pago</dt><dd>${fmtDate(report.paid_on)}</dd>
          <dt>Meses</dt><dd>${report.months}</dd>
        </dl>
        ${url ? `<div class="doc-actions"><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${icon('eye')}Abrir en tamaño completo</a></div>` : ''}`,
    });
  };

  /* ---------- Clínica y perfil ---------- */
  const updateClinic = async ({ clinicName, rif, phone, address }) => {
    await rpc('update_my_clinic', { p_name: clinicName, p_rif: rif || '', p_phone: phone || '', p_address: address || '' });
    if (ctx && ctx.clinic) Object.assign(ctx.clinic, { name: clinicName.trim(), rif: (rif || '').trim(), phone: (phone || '').trim(), address: (address || '').trim() });
    DB.setClinic({ name: clinicName.trim(), rif: (rif || '').trim(), phone: (phone || '').trim(), address: (address || '').trim() });
  };

  const changePassword = async (password) => {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error(friendly(error));
  };

  /* =====================================================================
     VISTA: Mi suscripción
     ===================================================================== */
  const PM_FIELDS = [
    ['pm_bank', 'Banco'], ['pm_phone', 'Teléfono'], ['pm_id_doc', 'Cédula / RIF'], ['pm_holder', 'Titular'],
  ];

  const statusCard = (sub) => {
    let detail = '';
    if (sub.state === 'prueba') detail = sub.daysLeft === 0 ? 'Tu prueba gratis termina hoy.' : `Te quedan ${U.plural(sub.daysLeft, 'día', 'días')} de prueba gratis.`;
    else if (sub.state === 'al_dia') detail = `Tu plan está pagado hasta el ${fmtDate(sub.paidUntil)}.`;
    else if (sub.state === 'por_vencer') detail = sub.daysLeft === 0 ? 'Tu suscripción vence hoy.' : `Tu suscripción vence en ${U.plural(sub.daysLeft, 'día', 'días')}.`;
    else if (sub.state === 'vencida') detail = `Venció el ${fmtDate(sub.paidUntil)}. Te ${sub.graceLeft === 1 ? 'queda 1 día' : `quedan ${sub.graceLeft} días`} de gracia antes de que se pause el acceso.`;
    else if (sub.state === 'sin_acceso') detail = `Venció el ${fmtDate(sub.paidUntil)}. Reporta tu pago para volver a usar Sonrisas.`;
    else if (sub.state === 'suspendida') detail = 'Tu cuenta está suspendida. Reporta tu pago y la reactivamos al confirmarlo.';
    else detail = 'Tu cuenta está bloqueada. Escríbenos para resolverlo.';
    return `<div class="card sub-card sub-${sub.state}">
      <div class="sub-main">
        <span class="badge ${sub.badge}">${esc(sub.label)}</span>
        <h2>${sub.price ? money(sub.price, sub.currency) : 'Plan Sonrisas'}<small>${sub.price ? ' / mes' : ''}</small></h2>
        <p>${esc(detail)}</p>
      </div>
      <dl class="sub-meta"><dt>Vence</dt><dd>${fmtDate(sub.paidUntil)}</dd><dt>Clínica</dt><dd>${esc(ctx.clinic.name)}</dd></dl>
    </div>`;
  };

  const payCard = (s, sub) => {
    const configuredPM = PM_FIELDS.some(([k]) => String(s[k] || '').trim());
    const support = s.support_whatsapp ? `<a class="btn btn-sm" href="${esc(waLink(s.support_whatsapp, `Hola, soy de ${ctx.clinic.name} y tengo una consulta sobre mi suscripción de Sonrisas.`))}" target="_blank" rel="noopener">${icon('whatsapp')}Escribir a soporte</a>` : '';
    if (!configuredPM) {
      return `<div class="card card-pad"><h3 class="section-title">Cómo pagar</h3><p class="muted no-margin">EU Digital Solutions todavía no cargó los datos de pago.</p>${support ? `<div class="doc-actions left">${support}</div>` : ''}</div>`;
    }
    const rows = PM_FIELDS.filter(([k]) => String(s[k] || '').trim()).map(([k, label]) => `
      <div class="pm-row"><span>${label}</span><strong>${esc(s[k])}</strong><button type="button" class="icon-btn sm" data-copy="${esc(s[k])}" aria-label="Copiar ${label}">${icon('copy')}</button></div>`).join('');
    return `<div class="card card-pad pm-card">
      <div class="pm-head"><div class="pm-logo">${icon('phone')}</div><div><h3>Pago Móvil</h3><p class="muted no-margin">Paga con estos datos y luego envía el comprobante.</p></div></div>
      <div class="pm-rows">${rows}
        ${sub.price ? `<div class="pm-row total"><span>Monto</span><strong>${money(sub.price, sub.currency)}</strong><button type="button" class="icon-btn sm" data-copy="${esc(U.number2(sub.price))}" aria-label="Copiar monto">${icon('copy')}</button></div>` : ''}
      </div>
      ${s.payment_note ? `<p class="pm-note">${esc(s.payment_note)}</p>` : ''}
      ${support ? `<div class="doc-actions left">${support}</div>` : ''}
    </div>`;
  };

  const reportForm = (s, sub) => `
    <form class="card" data-report novalidate>
      <div class="card-head"><h3>Reportar un pago</h3><span class="muted small">Lo revisamos y activamos tu plan</span></div>
      <div class="card-body form-grid">
        <label class="field full upload-field">
          <span>Foto del comprobante <span class="req">*</span></span>
          <input type="file" name="receipt" accept="image/*" required data-file>
          <span class="upload-box" data-drop>${icon('camera')}<span data-file-label>Toca para tomar o elegir la foto del comprobante</span></span>
          <img class="upload-preview" data-preview alt="Vista previa del comprobante" hidden>
        </label>
        <label class="field">Meses que pagas<select name="months">${[1, 2, 3, 6, 12].map((m) => `<option value="${m}">${m} ${m === 1 ? 'mes' : 'meses'}</option>`).join('')}</select></label>
        <label class="field">Moneda<select name="currency"><option value="USD" ${sub.currency === 'USD' ? 'selected' : ''}>Dólares ($)</option><option value="VES" ${sub.currency === 'VES' ? 'selected' : ''}>Bolívares (Bs.)</option></select></label>
        <label class="field"><span>Monto pagado <span class="req">*</span></span><input type="number" name="amount" min="0.01" step="0.01" inputmode="decimal" required value="${sub.price ? sub.price : ''}"></label>
        <label class="field"><span>Fecha del pago <span class="req">*</span></span><input type="date" name="paidOn" required value="${isoDate()}"></label>
        <label class="field"><span>Referencia <span class="req">*</span></span><input name="reference" required maxlength="60" placeholder="Últimos dígitos" inputmode="numeric"></label>
        <label class="field">Banco de origen<input name="bank" maxlength="80" placeholder="Ej: Banesco"></label>
        <label class="field full">Teléfono desde el que pagaste<input name="payerPhone" maxlength="30" inputmode="tel" placeholder="0414-1234567"></label>
      </div>
      <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit" data-send>${icon('upload')}Enviar comprobante</button></div>
    </form>`;

  const REPORT_BADGE = { pendiente: 'b-warn', aprobado: 'b-ok', rechazado: 'b-danger' };
  const REPORT_LABEL = { pendiente: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' };

  const historyCard = (reports) => `
    <div class="card"><div class="card-head"><h3>Pagos reportados</h3></div>
      <div class="table-wrap"><table><thead><tr><th>Enviado</th><th class="num">Monto</th><th>Meses</th><th>Referencia</th><th>Estado</th><th><span class="sr-only">Comprobante</span></th></tr></thead><tbody>
      ${reports.map((r) => `<tr><td class="nowrap">${fmtDateTime(r.created_at)}</td><td class="num money">${money(r.amount, r.currency)}</td><td>${r.months}</td><td>${esc(r.reference) || '—'}</td>
        <td><span class="badge ${REPORT_BADGE[r.status]}">${REPORT_LABEL[r.status]}</span>${r.admin_note ? `<br><small class="muted">${esc(r.admin_note)}</small>` : ''}</td>
        <td><div class="act"><button data-receipt="${r.id}" title="Ver comprobante" aria-label="Ver comprobante">${icon('eye')}</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Todavía no reportaste pagos.</td></tr>'}
      </tbody></table></div></div>`;

  const subscriptionView = async (el) => {
    const s = platform();
    const sub = subscription();
    el.innerHTML = `${pageHead('Mi suscripción', 'Estado de tu plan Sonrisas y pagos')}<div class="card empty">Cargando pagos…</div>`;
    let reports = [];
    try { reports = await loadMyReports(); } catch (err) { toast(err.message, 'err'); }
    const pending = reports.find((r) => r.status === 'pendiente');
    const allowed = canPay() && sub.state !== 'bloqueada';
    el.innerHTML = `
      ${pageHead('Mi suscripción', 'Estado de tu plan Sonrisas y pagos')}
      ${statusCard(sub)}
      ${pending ? `<div class="banner banner-info">${icon('clock')}<div class="grow"><strong>Recibimos tu comprobante del ${fmtDate(pending.paid_on)}.</strong> Está en revisión; te avisamos al activarlo.</div></div>` : ''}
      <div class="grid grid-2 sub-grid">
        ${payCard(s, sub)}
        ${allowed ? reportForm(s, sub) : `<div class="card card-pad"><h3 class="section-title">Reportar un pago</h3><p class="muted no-margin">${sub.state === 'bloqueada' ? 'Tu cuenta está bloqueada. Escríbenos por WhatsApp para resolverlo.' : 'Solo el titular de la clínica o la recepción pueden reportar pagos.'}</p></div>`}
      </div>
      <div class="mt">${historyCard(reports)}</div>`;

    el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy)));
    el.querySelectorAll('[data-receipt]').forEach((b) => b.addEventListener('click', () => showReceipt(reports.find((r) => r.id === b.dataset.receipt))));
    const form = el.querySelector('[data-report]');
    if (!form) return;
    const fileInput = form.querySelector('[data-file]');
    const preview = form.querySelector('[data-preview]');
    const label = form.querySelector('[data-file-label]');
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) { preview.hidden = true; label.textContent = 'Toca para tomar o elegir la foto del comprobante'; return; }
      if (!file.type.startsWith('image/')) { toast('El comprobante tiene que ser una foto o captura (JPG o PNG).', 'err'); fileInput.value = ''; return; }
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
      label.textContent = `${file.name} · toca para cambiarla`;
    });
    form.months.addEventListener('change', () => { if (sub.price && form.currency.value === sub.currency) form.amount.value = U.cents(sub.price * Number(form.months.value)); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const file = fileInput.files[0];
      if (!file) { toast('Agrega la foto del comprobante.', 'err'); return; }
      if (!(Number(data.amount) > 0)) { toast('Escribe el monto que pagaste.', 'err'); form.amount.focus(); return; }
      if (!String(data.reference).trim()) { toast('Escribe el número de referencia del pago.', 'err'); form.reference.focus(); return; }
      const button = form.querySelector('[data-send]');
      button.disabled = true;
      button.textContent = 'Enviando…';
      try {
        await reportPayment({ ...data, file });
        toast('¡Listo! Recibimos tu comprobante. Te avisamos cuando esté aprobado.');
        subscriptionView(el);
      } catch (err) {
        toast(err.message, 'err');
        button.disabled = false;
        button.innerHTML = `${icon('upload')}Enviar comprobante`;
      }
    });
  };

  /* =====================================================================
     VISTA: Mi equipo (solo titular)
     ===================================================================== */
  const COLORS = [['#0d9488', 'Verde azulado'], ['#0284c7', 'Azul'], ['#7c3aed', 'Violeta'], ['#d97706', 'Ámbar'], ['#db2777', 'Rosa'], ['#16a34a', 'Verde'], ['#475569', 'Gris']];
  const appUrl = () => `${location.origin}${location.pathname}`;
  const inviteMessage = (invite) => `Hola, te invito a usar Sonrisas en ${ctx.clinic.name}. Entra a ${appUrl()}#unirse-${invite.code} y crea tu cuenta con el código ${invite.code}. Vence el ${fmtDate(String(invite.expires_at).slice(0, 10))}.`;

  const showTempPassword = (person, password) => openModal({
    title: 'Contraseña temporal', hideFooter: true,
    body: `<div class="stack"><p class="no-margin">Entrégale esta contraseña a <strong>${esc(person)}</strong>. Al entrar, puede cambiarla en <em>Mi perfil</em>.</p>
      <div class="code-box"><code>${esc(password)}</code><button type="button" class="btn btn-sm" data-copy-pass>${icon('copy')}Copiar</button></div></div>`,
    onMount: (form) => form.querySelector('[data-copy-pass]').addEventListener('click', () => copyText(password)),
  });

  const teamView = async (el) => {
    const render = async () => {
      let invites = [];
      try {
        await DB.reloadMembers();
        const { data, error } = await client.from('clinic_invites').select('*').is('used_by', null).order('created_at', { ascending: false });
        if (error) throw error;
        invites = (data || []).filter((i) => new Date(i.expires_at) > new Date());
      } catch (err) { toast(friendly(err), 'err'); }
      const me = DB.currentUser();
      const members = DB.all('users').slice().sort((a, b) => (a.role === 'titular' ? -1 : b.role === 'titular' ? 1 : `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)));
      el.innerHTML = `
        ${pageHead('Mi equipo', 'Odontólogos y recepción que usan Sonrisas en tu clínica', `<button class="btn btn-primary" data-invite>${icon('plus')}Invitar a alguien</button>`)}
        <div class="card"><div class="table-wrap"><table><thead><tr><th>Persona</th><th>Correo</th><th>Rol</th><th>Especialidad</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
          ${members.map((u) => `<tr>
            <td><div class="cell-user"><div class="avatar sm" style="background:${esc(u.color)}">${esc(U.initials(u.firstName, u.lastName))}</div><div><strong>${esc(u.firstName)} ${esc(u.lastName)}</strong><small>${esc(u.phone)}</small></div></div></td>
            <td>${esc(u.email)}</td>
            <td><span class="badge ${u.role === 'titular' ? 'b-violet' : u.role === 'odontologo' ? 'b-info' : 'b-muted'}">${DB.ROLES[u.role]}</span></td>
            <td>${esc(u.specialty) || '<span class="muted">—</span>'}</td>
            <td>${u.active ? '<span class="badge b-ok">Activo</span>' : '<span class="badge b-muted">Inactivo</span>'}</td>
            <td>${u.id === me.id ? '<span class="muted small">Tú</span>' : `<div class="act">
              <button data-edit="${u.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
              <button data-pass="${u.id}" title="Contraseña temporal" aria-label="Generar contraseña temporal">${icon('key')}</button>
              <button class="del" data-remove="${u.id}" title="Quitar del equipo" aria-label="Quitar del equipo">${icon('trash')}</button></div>`}</td></tr>`).join('')}
        </tbody></table></div></div>
        <div class="card mt"><div class="card-head"><h3>Invitaciones pendientes</h3><span class="muted small">Cada código sirve una vez y vence en 7 días</span></div>
          <div class="table-wrap"><table><thead><tr><th>Código</th><th>Rol</th><th>Vence</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
          ${invites.map((i) => `<tr><td><code class="code-inline">${esc(i.code)}</code></td><td>${DB.ROLES[i.role]}</td><td>${fmtDate(String(i.expires_at).slice(0, 10))}</td>
            <td><div class="act"><a class="icon-btn sm" href="${esc(waLink('', inviteMessage(i)))}" target="_blank" rel="noopener" title="Enviar por WhatsApp" aria-label="Enviar por WhatsApp">${icon('whatsapp')}</a>
            <button data-copy-invite="${esc(i.code)}" title="Copiar mensaje" aria-label="Copiar mensaje">${icon('copy')}</button>
            <button class="del" data-del-invite="${esc(i.code)}" title="Anular" aria-label="Anular invitación">${icon('trash')}</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No hay invitaciones pendientes. Usa “Invitar a alguien” para sumar a tu recepción u otros odontólogos.</td></tr>'}
          </tbody></table></div></div>`;

      el.querySelector('[data-invite]').addEventListener('click', () => openModal({
        title: 'Invitar a tu equipo',
        body: `<div class="stack"><p class="no-margin muted">Generamos un código para que la persona cree su propia cuenta con su correo y contraseña.</p>
          <label class="field">¿Qué rol tendrá?<select name="role"><option value="recepcion">Recepción: agenda, pacientes, presupuestos y pagos</option><option value="odontologo">Odontólogo/a: además, historia clínica y odontograma</option></select></label></div>`,
        submitLabel: 'Generar código',
        onSubmit: async (data) => {
          const invite = { code: U.randomCode(8), clinic_id: ctx.clinic.id, role: data.role, created_by: ctx.user_id };
          const { data: created, error } = await client.from('clinic_invites').insert(invite).select('*').single();
          if (error) throw new Error(friendly(error));
          setTimeout(() => openModal({
            title: 'Código de invitación', hideFooter: true,
            body: `<div class="stack"><p class="no-margin">Comparte este código con la persona que vas a sumar como <strong>${DB.ROLES[created.role]}</strong>:</p>
              <div class="code-box big"><code>${esc(created.code)}</code></div>
              <div class="doc-actions"><button type="button" class="btn" data-copy-msg>${icon('copy')}Copiar mensaje</button>
              <a class="btn btn-primary" href="${esc(waLink('', inviteMessage(created)))}" target="_blank" rel="noopener">${icon('whatsapp')}Enviar por WhatsApp</a></div></div>`,
            onMount: (form) => form.querySelector('[data-copy-msg]').addEventListener('click', () => copyText(inviteMessage(created))),
          }), 0);
          render();
          return undefined;
        },
      }));

      el.querySelectorAll('[data-copy-invite]').forEach((b) => b.addEventListener('click', () => copyText(inviteMessage(invites.find((i) => i.code === b.dataset.copyInvite)))));
      el.querySelectorAll('[data-del-invite]').forEach((b) => b.addEventListener('click', () => confirmDialog('¿Anular esta invitación? El código dejará de funcionar.', async () => {
        const { error } = await client.from('clinic_invites').delete().eq('code', b.dataset.delInvite);
        if (error) throw new Error(friendly(error));
        toast('Invitación anulada');
        render();
      }, 'Anular')));

      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
        const u = DB.get('users', b.dataset.edit);
        openModal({
          title: `Editar a ${u.firstName}`,
          body: `<div class="form-grid">
            <label class="field">Rol<select name="role"><option value="recepcion" ${u.role === 'recepcion' ? 'selected' : ''}>Recepción</option><option value="odontologo" ${u.role === 'odontologo' ? 'selected' : ''}>Odontólogo/a</option></select></label>
            <label class="field">Especialidad<select name="specialty"><option value="">—</option>${DB.SPECIALTIES.map((s) => `<option ${u.specialty === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
            <label class="field">Color en la agenda<select name="color">${COLORS.map(([c, n]) => `<option value="${c}" ${u.color === c ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="field">Estado<select name="active"><option value="1" ${u.active ? 'selected' : ''}>Activo</option><option value="0" ${!u.active ? 'selected' : ''}>Inactivo (no puede entrar)</option></select></label></div>`,
          onSubmit: async (data) => {
            await rpc('update_member', { p_member: u.id, p_role: data.role, p_specialty: data.specialty, p_color: data.color, p_active: data.active === '1' });
            toast('Cambios guardados');
            render();
            return undefined;
          },
        });
      }));

      el.querySelectorAll('[data-pass]').forEach((b) => b.addEventListener('click', () => {
        const u = DB.get('users', b.dataset.pass);
        confirmDialog(`¿Generar una contraseña temporal para ${u.firstName} ${u.lastName}? La actual dejará de funcionar.`, async () => {
          const res = await api('clave_miembro', { userId: u.id });
          setTimeout(() => showTempPassword(`${u.firstName} ${u.lastName}`, res.password), 0);
          return undefined;
        }, 'Generar contraseña');
      }));

      el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
        const u = DB.get('users', b.dataset.remove);
        confirmDialog(`¿Quitar a ${u.firstName} ${u.lastName} de tu clínica? Se borra su cuenta; sus citas e historial quedan guardados.`, async () => {
          await api('quitar_miembro', { userId: u.id });
          toast('Persona quitada del equipo');
          render();
          return undefined;
        }, 'Quitar');
      }));
    };
    el.innerHTML = `${pageHead('Mi equipo', 'Odontólogos y recepción que usan Sonrisas en tu clínica')}<div class="card empty">Cargando equipo…</div>`;
    await render();
  };

  /* =====================================================================
     VISTA: Mi perfil
     ===================================================================== */
  const profileView = (el) => {
    const me = DB.currentUser() || {};
    el.innerHTML = `
      ${pageHead('Mi perfil', 'Tus datos y tu contraseña')}
      <div class="grid grid-2">
        <form class="card" data-profile novalidate>
          <div class="card-head"><h3>Mis datos</h3></div>
          <div class="card-body form-grid">
            <label class="field">Nombre<input name="firstName" required value="${esc(me.firstName)}"></label>
            <label class="field">Apellido<input name="lastName" required value="${esc(me.lastName)}"></label>
            <label class="field full">Correo<input value="${esc(me.email)}" disabled></label>
            <label class="field">Teléfono<input name="phone" inputmode="tel" value="${esc(me.phone)}" placeholder="0414-1234567"></label>
            <label class="field">Especialidad<select name="specialty"><option value="">—</option>${DB.SPECIALTIES.map((s) => `<option ${me.specialty === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
            <label class="field full">Color en la agenda<select name="color">${COLORS.map(([c, n]) => `<option value="${c}" ${me.color === c ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check')}Guardar mis datos</button></div>
        </form>
        <form class="card" data-password novalidate>
          <div class="card-head"><h3>Cambiar contraseña</h3></div>
          <div class="card-body stack">
            <label class="field">Nueva contraseña<input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label>
            <label class="field">Repite la nueva contraseña<input type="password" name="confirm" required minlength="8" autocomplete="new-password"></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">${icon('key')}Cambiar contraseña</button></div>
        </form>
      </div>`;
    el.querySelector('[data-profile]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.firstName.trim() || !data.lastName.trim()) { toast('Escribe tu nombre y apellido.', 'err'); return; }
      try {
        await rpc('update_my_profile', { p_first: data.firstName, p_last: data.lastName, p_phone: data.phone, p_specialty: data.specialty, p_color: data.color });
        await DB.reloadMembers();
        toast('Datos guardados');
        App.render({ keepScroll: true });
      } catch (err) { toast(err.message, 'err'); }
    });
    el.querySelector('[data-password]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (data.password.length < 8) { toast('La contraseña debe tener al menos 8 caracteres.', 'err'); return; }
      if (data.password !== data.confirm) { toast('Las contraseñas no coinciden.', 'err'); return; }
      try { await changePassword(data.password); toast('Contraseña cambiada'); e.target.reset(); } catch (err) { toast(err.message, 'err'); }
    });
  };

  const pageHead = (title, subtitle, actions = '') =>
    `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;

  window.Session = {
    client, configured, api, rpc, friendly,
    signIn, signOut, hasSession, register, verifyCode, join, createAdmin,
    loadContext, context: () => ctx, loadPublicSettings, platform,
    subscription, subscriptionOf, STATES, canPay, hasAccess, loadMyReports, pendingReport, receiptUrl, showReceipt,
    updateClinic, changePassword, showTempPassword,
    views: { subscription: subscriptionView, team: teamView, profile: profileView },
  };
})();
