/* Panel de administración de EU Digital Solutions: clínicas, cobros, comprobantes y ajustes de Sonrisas. */
(function () {
  const { icon, esc, money, fmtDate, fmtDateTime, toast, openModal, confirmDialog, waLink, isoDate, parseDate } = U;

  let data = { clinics: [], profiles: [], reports: [], settings: {} };

  const load = async () => {
    const sb = Session.client;
    const [clinics, profiles, reports, settings] = await Promise.all([
      sb.from('clinics').select('*').order('created_at', { ascending: false }),
      sb.from('profiles').select('id, clinic_id, role, first_name, last_name, email, phone, active, created_at').order('created_at'),
      sb.from('payment_reports').select('*').order('created_at', { ascending: false }).limit(1000),
      sb.from('platform_settings').select('*').eq('id', 1).single(),
    ]);
    [clinics, profiles, reports, settings].forEach((r) => { if (r.error) throw new Error(Session.friendly(r.error)); });
    data = { clinics: clinics.data || [], profiles: profiles.data || [], reports: reports.data || [], settings: settings.data || {} };
    return data;
  };

  const today = () => (Session.context() && Session.context().today) || isoDate();
  const clinicById = (id) => data.clinics.find((c) => c.id === id) || null;
  const membersOf = (clinicId) => data.profiles.filter((p) => p.clinic_id === clinicId);
  const ownerOf = (clinic) => data.profiles.find((p) => p.id === clinic.owner_id) || membersOf(clinic.id).find((p) => p.role === 'titular') || null;
  const subOf = (clinic) => Session.subscriptionOf(clinic, data.settings, today());
  const lastApproved = (clinicId) => data.reports.find((r) => r.clinic_id === clinicId && r.status === 'aprobado') || null;
  const pendingReports = () => data.reports.filter((r) => r.status === 'pendiente');
  const personName = (p) => (p ? `${p.first_name} ${p.last_name}`.trim() : '—');
  const ROLE_LABEL = { titular: 'Titular', odontologo: 'Odontólogo/a', recepcion: 'Recepción' };
  const appUrl = () => `${location.origin}${location.pathname}`;

  const pageHead = (title, subtitle, actions = '') =>
    `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
  const statTile = (tone, ic, value, label, href) =>
    `<${href ? `a href="${href}"` : 'div'} class="card stat ${href ? 'stat-link' : ''}"><div class="ico ico-${tone}">${icon(ic)}</div><div><div class="val">${value}</div><div class="lbl">${label}</div></div></${href ? 'a' : 'div'}>`;
  const subBadge = (s) => `<span class="badge ${s.badge}">${esc(s.label)}</span>`;
  const dueText = (s) => {
    if (s.state === 'bloqueada' || s.state === 'suspendida') return fmtDate(s.paidUntil);
    if (s.daysLeft > 0) return `${fmtDate(s.paidUntil)}<br><small class="muted">en ${U.plural(s.daysLeft, 'día', 'días')}</small>`;
    if (s.daysLeft === 0) return `${fmtDate(s.paidUntil)}<br><small class="muted">vence hoy</small>`;
    return `${fmtDate(s.paidUntil)}<br><small class="danger-text">hace ${U.plural(-s.daysLeft, 'día', 'días')}</small>`;
  };

  /** Mensaje de recordatorio de pago para WhatsApp, con los datos de Pago Móvil. */
  const reminderText = (clinic, person) => {
    const s = data.settings;
    const sub = subOf(clinic);
    const name = person ? person.first_name : '';
    const when = {
      prueba: `tu período de prueba de Sonrisas para ${clinic.name} termina el ${fmtDate(sub.paidUntil)}`,
      por_vencer: `tu suscripción de Sonrisas para ${clinic.name} vence el ${fmtDate(sub.paidUntil)}`,
      al_dia: `tu suscripción de Sonrisas para ${clinic.name} vence el ${fmtDate(sub.paidUntil)}`,
      vencida: `tu suscripción de Sonrisas para ${clinic.name} venció el ${fmtDate(sub.paidUntil)}`,
      sin_acceso: `tu suscripción de Sonrisas para ${clinic.name} venció el ${fmtDate(sub.paidUntil)} y el acceso está pausado`,
      suspendida: `tu cuenta de Sonrisas para ${clinic.name} está suspendida por falta de pago`,
      bloqueada: `tu cuenta de Sonrisas para ${clinic.name} está bloqueada`,
    }[sub.state];
    const pm = [s.pm_bank, s.pm_phone, s.pm_id_doc, s.pm_holder].filter((v) => String(v || '').trim()).join(' · ');
    return [
      `Hola${name ? ` ${name}` : ''}, te escribimos de EU Digital Solutions: ${when}.`,
      s.monthly_price ? `Monto mensual: ${money(s.monthly_price, s.currency)}.` : '',
      pm ? `Pago Móvil: ${pm}.` : '',
      `Cuando pagues, sube la foto del comprobante en Sonrisas, sección Mi suscripción: ${appUrl()}`,
      '¡Gracias!',
    ].filter(Boolean).join('\n');
  };
  const reminderButtons = (clinic) => membersOf(clinic.id).filter((p) => p.phone && ['titular', 'recepcion'].includes(p.role)).map((p) =>
    `<a class="btn btn-sm" href="${esc(waLink(p.phone, reminderText(clinic, p)))}" target="_blank" rel="noopener" title="Enviar recordatorio a ${esc(personName(p))}">${icon('whatsapp')}${esc(p.role === 'titular' ? 'Doctor' : 'Recepción')}</a>`).join('');

  const loadingCard = (el, title) => { el.innerHTML = `${pageHead(title)}<div class="card empty">Cargando…</div>`; };
  const failCard = (el, title, err) => { el.innerHTML = `${pageHead(title)}<div class="card empty">${esc(err.message)} <button class="link-btn" data-retry>Reintentar</button></div>`; el.querySelector('[data-retry]').addEventListener('click', () => App.render()); };

  /* ---------- Acciones ---------- */
  const setStatus = async (clinic, status, label) => {
    const { error } = await Session.client.from('clinics').update({ status }).eq('id', clinic.id);
    if (error) throw new Error(Session.friendly(error));
    toast(label);
  };
  const extend = async (clinic, { months, until }) => {
    let paidUntil = until;
    if (!paidUntil) {
      const base = clinic.paid_until > today() ? clinic.paid_until : today();
      const d = parseDate(base);
      d.setMonth(d.getMonth() + Number(months || 1));
      paidUntil = isoDate(d);
    }
    const { error } = await Session.client.from('clinics').update({ paid_until: paidUntil, trial: false }).eq('id', clinic.id);
    if (error) throw new Error(Session.friendly(error));
    toast(`Suscripción extendida hasta el ${fmtDate(paidUntil)}`);
  };

  const reviewPayment = (report, after) => {
    const clinic = clinicById(report.clinic_id);
    openModal({
      title: `Pago de ${clinic ? clinic.name : 'clínica eliminada'}`, size: 'lg', hideFooter: true,
      body: `<div class="review-grid">
          <div class="receipt-view" data-img><p class="muted">Cargando comprobante…</p></div>
          <div class="stack">
            <dl class="kv compact">
              <dt>Monto</dt><dd><strong>${money(report.amount, report.currency)}</strong></dd>
              <dt>Meses</dt><dd>${report.months}</dd>
              <dt>Referencia</dt><dd>${esc(report.reference) || '—'}</dd>
              <dt>Banco</dt><dd>${esc(report.bank) || '—'}</dd>
              <dt>Teléfono</dt><dd>${esc(report.payer_phone) || '—'}</dd>
              <dt>Fecha del pago</dt><dd>${fmtDate(report.paid_on)}</dd>
              <dt>Enviado</dt><dd>${fmtDateTime(report.created_at)}</dd>
              <dt>Estado</dt><dd>${{ pendiente: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' }[report.status]}${report.admin_note ? ` · ${esc(report.admin_note)}` : ''}</dd>
            </dl>
            ${report.status === 'pendiente' ? `
            <label class="field">Meses a activar<select data-months>${[1, 2, 3, 6, 12].map((m) => `<option value="${m}" ${m === report.months ? 'selected' : ''}>${m} ${m === 1 ? 'mes' : 'meses'}</option>`).join('')}</select></label>
            <div class="doc-actions left"><button type="button" class="btn btn-primary" data-approve>${icon('check')}Aprobar pago</button><button type="button" class="btn btn-danger" data-reject>${icon('x')}Rechazar</button></div>` : ''}
          </div></div>`,
      onMount: async (form) => {
        const box = form.querySelector('[data-img]');
        try {
          const url = await Session.receiptUrl(report.receipt_path);
          box.innerHTML = url ? `<a href="${esc(url)}" target="_blank" rel="noopener" title="Abrir en tamaño completo"><img src="${esc(url)}" alt="Comprobante de pago"></a>` : '<p class="muted">Sin foto.</p>';
        } catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
        const approveBtn = form.querySelector('[data-approve]');
        if (approveBtn) approveBtn.addEventListener('click', async () => {
          approveBtn.disabled = true;
          try {
            const res = await Session.rpc('approve_payment', { p_report: report.id, p_months: Number(form.querySelector('[data-months]').value) });
            toast(`Pago aprobado. Activo hasta el ${fmtDate(res.paid_until)}`);
            U.closeModal();
            after();
          } catch (err) { toast(err.message, 'err'); approveBtn.disabled = false; }
        });
        const rejectBtn = form.querySelector('[data-reject]');
        if (rejectBtn) rejectBtn.addEventListener('click', () => openModal({
          title: 'Rechazar pago', danger: true, submitLabel: 'Rechazar pago',
          body: `<label class="field">Motivo (lo verá la clínica)<input name="note" required maxlength="300" placeholder="Ej: la referencia no coincide con ningún pago recibido"></label>`,
          onSubmit: async (d) => { await Session.rpc('reject_payment', { p_report: report.id, p_note: d.note }); toast('Pago rechazado'); after(); return undefined; },
        }));
      },
    });
  };

  const openClinic = (clinicId, after) => {
    const clinic = clinicById(clinicId);
    if (!clinic) { toast('No encontramos esa clínica.', 'err'); return; }
    const sub = subOf(clinic);
    const owner = ownerOf(clinic);
    const members = membersOf(clinic.id);
    const reports = data.reports.filter((r) => r.clinic_id === clinic.id);
    openModal({
      title: clinic.name, size: 'lg', hideFooter: true,
      body: `<div class="stack">
        <div class="clinic-summary">
          <div>${subBadge(sub)}<p class="no-margin"><strong>${esc(personName(owner))}</strong> · ${esc(owner ? owner.email : '')}</p>
            <p class="muted no-margin">${esc(clinic.phone || (owner && owner.phone) || 'Sin teléfono')} · Registrada el ${fmtDate(String(clinic.created_at).slice(0, 10))}</p></div>
          <div class="align-end"><small class="muted">Pagado hasta</small><div class="big-date">${fmtDate(clinic.paid_until)}</div></div>
        </div>
        <div class="action-row">
          ${reminderButtons(clinic)}
          <button type="button" class="btn btn-sm" data-extend>${icon('calendar')}Extender</button>
          ${clinic.status === 'activa' ? `<button type="button" class="btn btn-sm" data-status="suspendida">${icon('pause')}Suspender</button>` : `<button type="button" class="btn btn-sm" data-status="activa">${icon('check')}Reactivar</button>`}
          ${clinic.status !== 'bloqueada' ? `<button type="button" class="btn btn-sm" data-status="bloqueada">${icon('ban')}Bloquear</button>` : ''}
          <button type="button" class="btn btn-sm btn-danger" data-delete>${icon('trash')}Eliminar</button>
        </div>
        <div><h4 class="section-title">Equipo (${members.length})</h4>
          <div class="table-wrap card flat"><table><thead><tr><th>Persona</th><th>Correo</th><th>Rol</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
          ${members.map((p) => `<tr><td>${esc(personName(p))}${p.active ? '' : ' <span class="badge b-muted">Inactivo</span>'}<br><small class="muted">${esc(p.phone)}</small></td><td>${esc(p.email)}</td><td>${ROLE_LABEL[p.role]}</td>
            <td><div class="act"><button type="button" data-pass="${p.id}" title="Contraseña temporal" aria-label="Generar contraseña temporal">${icon('key')}</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sin usuarios.</td></tr>'}
          </tbody></table></div></div>
        <div><h4 class="section-title">Pagos (${reports.length})</h4>
          <div class="table-wrap card flat"><table><thead><tr><th>Enviado</th><th class="num">Monto</th><th>Meses</th><th>Estado</th><th><span class="sr-only">Ver</span></th></tr></thead><tbody>
          ${reports.map((r) => `<tr><td>${fmtDateTime(r.created_at)}</td><td class="num money">${money(r.amount, r.currency)}</td><td>${r.months}</td><td><span class="badge ${{ pendiente: 'b-warn', aprobado: 'b-ok', rechazado: 'b-danger' }[r.status]}">${{ pendiente: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' }[r.status]}</span></td>
            <td><div class="act"><button type="button" data-report="${r.id}" aria-label="Ver comprobante">${icon('eye')}</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Todavía no reportó pagos.</td></tr>'}
          </tbody></table></div></div>
        <label class="field">Nota interna (solo la ves tú)<textarea data-note rows="2" maxlength="500">${esc(clinic.admin_note)}</textarea></label>
        <div class="doc-actions left"><button type="button" class="btn btn-sm" data-save-note>${icon('check')}Guardar nota</button></div>
      </div>`,
      onMount: (form) => {
        const done = (msg) => { if (msg) toast(msg); U.closeModal(); after(); };
        form.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
          const status = b.dataset.status;
          const text = { suspendida: `¿Suspender a ${clinic.name}? No podrá usar Sonrisas hasta que reporte su pago y lo apruebes.`, bloqueada: `¿Bloquear a ${clinic.name}? Nadie de esa clínica podrá entrar ni reportar pagos.`, activa: `¿Reactivar a ${clinic.name}?` }[status];
          confirmDialog(text, async () => { await setStatus(clinic, status, { suspendida: 'Clínica suspendida', bloqueada: 'Clínica bloqueada', activa: 'Clínica reactivada' }[status]); after(); return undefined; }, { suspendida: 'Suspender', bloqueada: 'Bloquear', activa: 'Reactivar' }[status]);
        }));
        form.querySelector('[data-extend]').addEventListener('click', () => openModal({
          title: `Extender a ${clinic.name}`,
          body: `<div class="stack"><p class="no-margin muted">Úsalo si cobraste por fuera de Sonrisas. Hoy está pagado hasta el ${fmtDate(clinic.paid_until)}.</p>
            <label class="field">Sumar meses<select name="months"><option value="1">1 mes</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label>
            <label class="field">O elige la fecha exacta<input type="date" name="until"></label></div>`,
          submitLabel: 'Extender',
          onSubmit: async (d) => { await extend(clinic, { months: d.months, until: d.until }); after(); return undefined; },
        }));
        form.querySelector('[data-delete]').addEventListener('click', () => openModal({
          title: 'Eliminar clínica', danger: true, submitLabel: 'Eliminar definitivamente',
          body: `<div class="stack"><p class="no-margin">Se borran <strong>todas las cuentas, pacientes, citas, pagos y comprobantes</strong> de ${esc(clinic.name)}. No se puede deshacer.</p>
            <label class="field">Escribe <strong>ELIMINAR</strong> para confirmar<input name="confirm" required autocomplete="off"></label></div>`,
          onSubmit: async (d) => {
            if (d.confirm.trim().toUpperCase() !== 'ELIMINAR') { toast('Escribe ELIMINAR para confirmar.', 'err'); return false; }
            const res = await Session.api('admin_eliminar_clinica', { clinicId: clinic.id });
            toast(`Clínica eliminada (${U.plural(res.removedUsers, 'cuenta borrada', 'cuentas borradas')})`);
            after();
            return undefined;
          },
        }));
        form.querySelectorAll('[data-pass]').forEach((b) => b.addEventListener('click', () => {
          const p = members.find((m) => m.id === b.dataset.pass);
          confirmDialog(`¿Generar una contraseña temporal para ${personName(p)}? La actual dejará de funcionar.`, async () => {
            const res = await Session.api('admin_clave', { userId: p.id });
            setTimeout(() => Session.showTempPassword(personName(p), res.password), 0);
            return undefined;
          }, 'Generar contraseña');
        }));
        form.querySelectorAll('[data-report]').forEach((b) => b.addEventListener('click', () => reviewPayment(reports.find((r) => r.id === b.dataset.report), after)));
        form.querySelector('[data-save-note]').addEventListener('click', async () => {
          const { error } = await Session.client.from('clinics').update({ admin_note: form.querySelector('[data-note]').value.slice(0, 500) }).eq('id', clinic.id);
          if (error) toast(Session.friendly(error), 'err'); else done('Nota guardada');
        });
      },
    });
  };

  /* =====================================================================
     VISTA: Resumen
     ===================================================================== */
  const home = async (el) => {
    loadingCard(el, 'Resumen');
    try { await load(); } catch (err) { failCard(el, 'Resumen', err); return; }
    try { await Suggestions.refreshFresh(); } catch { /* el aviso de sugerencias es opcional */ }
    const newIdeas = Suggestions.freshCount();
    const s = data.settings;
    const subs = data.clinics.map((c) => ({ clinic: c, sub: subOf(c) }));
    const count = (states) => subs.filter((x) => states.includes(x.sub.state)).length;
    const pending = pendingReports();
    const month = today().slice(0, 7);
    const income = {};
    data.reports.filter((r) => r.status === 'aprobado' && String(r.reviewed_at || '').slice(0, 7) === month).forEach((r) => { income[r.currency] = (income[r.currency] || 0) + Number(r.amount); });
    const incomeText = Object.keys(income).length ? Object.entries(income).map(([c, v]) => money(v, c)).join(' + ') : money(0, s.currency);
    const toRemind = subs.filter((x) => ['por_vencer', 'vencida', 'sin_acceso', 'suspendida'].includes(x.sub.state) || (x.sub.state === 'prueba' && x.sub.daysLeft <= Number(s.reminder_days || 0)))
      .sort((a, b) => a.sub.daysLeft - b.sub.daysLeft);
    const missingSetup = !Number(s.monthly_price) || !String(s.pm_phone || '').trim();

    el.innerHTML = `
      ${pageHead('Resumen', `Sonrisas · EU Digital Solutions · ${esc(U.fmtDateLong(new Date()))}`)}
      ${newIdeas ? `<div class="banner banner-info">${icon('bulb')}<div class="grow"><strong>${newIdeas === 1 ? 'Tienes 1 sugerencia nueva' : `Tienes ${newIdeas} sugerencias nuevas`}</strong> de las clínicas para mejorar Sonrisas.</div><a class="btn btn-sm" href="#admin-sugerencias">Ver sugerencias</a></div>` : ''}
      ${missingSetup ? `<div class="banner banner-warn">${icon('alert')}<div class="grow"><strong>Falta configurar el cobro.</strong> Carga el precio mensual y tus datos de Pago Móvil para que los odontólogos sepan cuánto y a dónde pagar.</div><a class="btn btn-sm" href="#admin-ajustes">Configurar</a></div>` : ''}
      <div class="grid grid-4">
        ${statTile('teal', 'building', data.clinics.length, 'Clínicas registradas', '#admin-clinicas')}
        ${statTile('green', 'check', count(['al_dia']), 'Al día')}
        ${statTile('sky', 'clock', count(['prueba']), 'En prueba')}
        ${statTile('amber', 'alert', count(['por_vencer', 'vencida']), 'Por vencer o vencidas')}
        ${statTile('rose', 'pause', count(['sin_acceso', 'suspendida', 'bloqueada']), 'Sin acceso')}
        ${statTile('violet', 'upload', pending.length, 'Pagos por revisar', '#admin-pagos')}
        <div class="card stat span-2"><div class="ico ico-green">${icon('cash')}</div><div><div class="val">${incomeText}</div><div class="lbl">Cobrado este mes (pagos aprobados)</div></div></div>
      </div>
      <div class="grid grid-2 mt">
        <div class="card"><div class="card-head"><h3>Pagos por revisar</h3><a href="#admin-pagos">Ver todos ›</a></div>
          <div class="card-body">${pending.slice(0, 6).map((r) => { const c = clinicById(r.clinic_id); return `
            <div class="list-item"><div class="grow"><strong>${esc(c ? c.name : 'Clínica eliminada')}</strong><br><small>${money(r.amount, r.currency)} · ${r.months} ${r.months === 1 ? 'mes' : 'meses'} · ref. ${esc(r.reference) || '—'}</small></div>
            <button class="btn btn-sm btn-primary" data-review="${r.id}">Revisar</button></div>`; }).join('') || '<div class="empty">No hay pagos esperando revisión.</div>'}</div></div>
        <div class="card"><div class="card-head"><h3>Para recordar el pago</h3><a href="#admin-clinicas">Ver clínicas ›</a></div>
          <div class="card-body">${toRemind.slice(0, 8).map(({ clinic, sub }) => `
            <div class="list-item"><div class="grow"><strong>${esc(clinic.name)}</strong><br><small>${subBadge(sub)} vence ${fmtDate(sub.paidUntil)}</small></div>
            <div class="action-row tight">${reminderButtons(clinic) || '<span class="muted small">Sin teléfono</span>'}</div></div>`).join('') || '<div class="empty">Nadie por vencer en los próximos días.</div>'}</div></div>
      </div>`;
    el.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => reviewPayment(data.reports.find((r) => r.id === b.dataset.review), () => App.render({ keepScroll: true }))));
  };

  /* =====================================================================
     VISTA: Clínicas
     ===================================================================== */
  const clinicsView = async (el) => {
    loadingCard(el, 'Clínicas');
    try { await load(); } catch (err) { failCard(el, 'Clínicas', err); return; }
    let q = '';
    let filter = '';
    const reload = async () => { try { await load(); } catch (err) { toast(err.message, 'err'); } paint(); };
    const paint = () => {
      const rows = data.clinics.map((c) => ({ c, sub: subOf(c), owner: ownerOf(c) })).filter(({ c, sub, owner }) => {
        const hay = `${c.name} ${personName(owner)} ${owner ? owner.email : ''} ${c.phone}`.toLowerCase();
        const matchState = !filter || (filter === 'vencidas' ? ['vencida', 'sin_acceso'].includes(sub.state) : sub.state === filter);
        return (!q || hay.includes(q.toLowerCase())) && matchState;
      });
      el.querySelector('[data-count]').textContent = U.plural(rows.length, 'clínica', 'clínicas');
      el.querySelector('[data-body]').innerHTML = rows.map(({ c, sub, owner }) => {
        const paid = lastApproved(c.id);
        return `<tr>
          <td><button class="link-row" data-open="${c.id}"><strong>${esc(c.name)}</strong><small>${U.plural(membersOf(c.id).length, 'usuario', 'usuarios')} · desde ${fmtDate(String(c.created_at).slice(0, 10))}</small></button></td>
          <td>${esc(personName(owner))}<br><small class="muted">${esc(owner ? owner.email : '')}</small></td>
          <td>${owner && owner.phone ? `<a href="${esc(waLink(owner.phone))}" target="_blank" rel="noopener">${esc(owner.phone)}</a>` : '<span class="muted">—</span>'}</td>
          <td>${subBadge(sub)}</td>
          <td>${dueText(sub)}</td>
          <td>${paid ? `${money(paid.amount, paid.currency)}<br><small class="muted">${fmtDate(String(paid.reviewed_at || paid.created_at).slice(0, 10))}</small>` : '<span class="muted">Sin pagos</span>'}</td>
          <td><div class="act">
            ${owner && owner.phone ? `<a class="icon-btn sm" href="${esc(waLink(owner.phone, reminderText(c, owner)))}" target="_blank" rel="noopener" title="Recordar pago por WhatsApp" aria-label="Recordar pago por WhatsApp">${icon('whatsapp')}</a>` : ''}
            <button data-open="${c.id}" title="Ver y administrar" aria-label="Ver y administrar">${icon('eye')}</button>
            ${c.status === 'activa' ? `<button data-quick="suspendida" data-id="${c.id}" title="Suspender" aria-label="Suspender">${icon('pause')}</button>` : `<button data-quick="activa" data-id="${c.id}" title="Reactivar" aria-label="Reactivar">${icon('check')}</button>`}
          </div></td></tr>`;
      }).join('') || `<tr><td colspan="7" class="empty">${data.clinics.length ? 'Ninguna clínica coincide con la búsqueda.' : 'Todavía no se registró ninguna clínica. Comparte el enlace de Sonrisas con tus clientes.'}</td></tr>`;
    };
    el.innerHTML = `
      ${pageHead('Clínicas', 'Odontólogos que contrataron Sonrisas')}
      <div class="card">
        <div class="toolbar">
          <input class="grow" data-q type="search" placeholder="Buscar por clínica, doctor o correo…" aria-label="Buscar clínicas">
          <select data-filter aria-label="Estado"><option value="">Todos los estados</option><option value="al_dia">Al día</option><option value="prueba">En prueba</option><option value="por_vencer">Por vencer</option><option value="vencidas">Vencidas</option><option value="suspendida">Suspendidas</option><option value="bloqueada">Bloqueadas</option></select>
          <span class="muted" data-count></span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Clínica</th><th>Doctor titular</th><th>Teléfono</th><th>Estado</th><th>Vence</th><th>Último pago</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-body></tbody></table></div>
      </div>`;
    paint();
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; paint(); });
    el.querySelector('[data-filter]').addEventListener('change', (e) => { filter = e.target.value; paint(); });
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (open) { openClinic(open.dataset.open, reload); return; }
      const quick = e.target.closest('[data-quick]');
      if (quick) {
        const c = clinicById(quick.dataset.id);
        const status = quick.dataset.quick;
        confirmDialog(status === 'suspendida' ? `¿Suspender a ${c.name}? No podrá usar Sonrisas hasta que pague.` : `¿Reactivar a ${c.name}?`, async () => {
          await setStatus(c, status, status === 'suspendida' ? 'Clínica suspendida' : 'Clínica reactivada');
          reload();
          return undefined;
        }, status === 'suspendida' ? 'Suspender' : 'Reactivar');
      }
    });
  };

  /* =====================================================================
     VISTA: Pagos
     ===================================================================== */
  let paymentsTab = 'pendiente';
  const paymentsView = async (el) => {
    loadingCard(el, 'Pagos recibidos');
    try { await load(); } catch (err) { failCard(el, 'Pagos recibidos', err); return; }
    const reload = async () => { try { await load(); } catch (err) { toast(err.message, 'err'); } paint(); };
    const paint = () => {
      const rows = data.reports.filter((r) => paymentsTab === 'todos' || r.status === paymentsTab);
      el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === paymentsTab));
      el.querySelector('[data-pending-count]').textContent = pendingReports().length || '';
      el.querySelector('[data-body]').innerHTML = rows.map((r) => {
        const c = clinicById(r.clinic_id);
        return `<tr>
          <td class="nowrap">${fmtDateTime(r.created_at)}</td>
          <td>${c ? `<button class="link-row" data-open="${c.id}"><strong>${esc(c.name)}</strong></button>` : '<span class="muted">Clínica eliminada</span>'}</td>
          <td class="num money">${money(r.amount, r.currency)}</td>
          <td>${r.months}</td>
          <td>${esc(r.reference) || '—'}<br><small class="muted">${esc([r.bank, r.payer_phone].filter(Boolean).join(' · '))}</small></td>
          <td>${fmtDate(r.paid_on)}</td>
          <td><span class="badge ${{ pendiente: 'b-warn', aprobado: 'b-ok', rechazado: 'b-danger' }[r.status]}">${{ pendiente: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' }[r.status]}</span>${r.admin_note ? `<br><small class="muted">${esc(r.admin_note)}</small>` : ''}</td>
          <td><button class="btn btn-sm ${r.status === 'pendiente' ? 'btn-primary' : ''}" data-review="${r.id}">${r.status === 'pendiente' ? 'Revisar' : 'Ver'}</button></td></tr>`;
      }).join('') || `<tr><td colspan="8" class="empty">${paymentsTab === 'pendiente' ? 'No hay pagos esperando revisión.' : 'No hay pagos en esta lista.'}</td></tr>`;
    };
    el.innerHTML = `
      ${pageHead('Pagos recibidos', 'Comprobantes que envían las clínicas')}
      <div class="tabs">${[['pendiente', 'Por revisar'], ['aprobado', 'Aprobados'], ['rechazado', 'Rechazados'], ['todos', 'Todos']].map(([k, l]) => `<button data-tab="${k}">${l}${k === 'pendiente' ? ' <span class="count-pill" data-pending-count></span>' : ''}</button>`).join('')}</div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Enviado</th><th>Clínica</th><th class="num">Monto</th><th>Meses</th><th>Referencia</th><th>Fecha del pago</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    paint();
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { paymentsTab = b.dataset.tab; paint(); }));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const review = e.target.closest('[data-review]');
      if (review) { reviewPayment(data.reports.find((r) => r.id === review.dataset.review), reload); return; }
      const open = e.target.closest('[data-open]');
      if (open) openClinic(open.dataset.open, reload);
    });
  };

  /* =====================================================================
     VISTA: Ajustes
     ===================================================================== */
  const settingsView = async (el) => {
    loadingCard(el, 'Ajustes de cobro');
    try { await load(); } catch (err) { failCard(el, 'Ajustes de cobro', err); return; }
    const s = data.settings;
    el.innerHTML = `
      ${pageHead('Ajustes de cobro', 'Precio, Pago Móvil y plazos que ven todas las clínicas')}
      <form class="card" data-form novalidate>
        <div class="card-head"><h3>Plan mensual</h3></div>
        <div class="card-body form-grid">
          <label class="field">Precio mensual<input type="number" name="monthly_price" min="0" step="0.01" inputmode="decimal" value="${esc(s.monthly_price)}"></label>
          <label class="field">Moneda<select name="currency"><option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>Dólares ($)</option><option value="VES" ${s.currency === 'VES' ? 'selected' : ''}>Bolívares (Bs.)</option></select></label>
          <label class="field">Días de prueba gratis para clínicas nuevas<input type="number" name="trial_days" min="0" max="90" value="${esc(s.trial_days)}"></label>
          <label class="field">Días de gracia después del vencimiento<input type="number" name="grace_days" min="0" max="60" value="${esc(s.grace_days)}"></label>
          <label class="field full">Avisar a la clínica cuántos días antes de vencer<input type="number" name="reminder_days" min="0" max="30" value="${esc(s.reminder_days)}"></label>
        </div>
        <div class="card-head bordered"><h3>Datos de Pago Móvil</h3><span class="muted small">Se muestran en el panel de pago de cada clínica</span></div>
        <div class="card-body form-grid">
          <label class="field">Banco<input name="pm_bank" maxlength="80" placeholder="Ej: 0102 Banco de Venezuela" value="${esc(s.pm_bank)}"></label>
          <label class="field">Teléfono del Pago Móvil<input name="pm_phone" maxlength="30" inputmode="tel" placeholder="0414-1234567" value="${esc(s.pm_phone)}"></label>
          <label class="field">Cédula o RIF<input name="pm_id_doc" maxlength="30" placeholder="V-12345678" value="${esc(s.pm_id_doc)}"></label>
          <label class="field">Titular<input name="pm_holder" maxlength="80" placeholder="EU Digital Solutions" value="${esc(s.pm_holder)}"></label>
          <label class="field full">Nota para el pago (opcional)<input name="payment_note" maxlength="200" placeholder="Ej: si pagas en bolívares, usa la tasa BCV del día" value="${esc(s.payment_note)}"></label>
          <label class="field full">WhatsApp de soporte<input name="support_whatsapp" maxlength="30" inputmode="tel" placeholder="0414-1234567" value="${esc(s.support_whatsapp)}"></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">${icon('check')}Guardar ajustes</button></div>
      </form>`;
    el.querySelector('[data-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      const patch = {
        monthly_price: U.cents(d.monthly_price), currency: d.currency,
        trial_days: Math.max(0, Math.min(90, Number(d.trial_days) || 0)), grace_days: Math.max(0, Math.min(60, Number(d.grace_days) || 0)),
        reminder_days: Math.max(0, Math.min(30, Number(d.reminder_days) || 0)),
        pm_bank: d.pm_bank.trim(), pm_phone: d.pm_phone.trim(), pm_id_doc: d.pm_id_doc.trim(), pm_holder: d.pm_holder.trim(),
        payment_note: d.payment_note.trim(), support_whatsapp: d.support_whatsapp.trim(), updated_at: new Date().toISOString(),
      };
      const { error } = await Session.client.from('platform_settings').update(patch).eq('id', 1);
      if (error) { toast(Session.friendly(error), 'err'); return; }
      toast('Ajustes guardados');
      try { await Session.loadContext(); } catch { /* se recarga al navegar */ }
    });
  };

  window.Admin = { home, clinics: clinicsView, payments: paymentsView, settings: settingsView, pendingCount: () => pendingReports().length };
})();
