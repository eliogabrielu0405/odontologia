/* Pantallas de la aplicación. Cada vista recibe (contenedor, parámetros). */
(function () {
  const { icon, esc, money, isoDate, parseDate, addDays, fmtDate, fmtDateLong, fmtDateTime, ageFrom, initials, fullName, pad, toast, openModal, confirmDialog, downloadFile, toCSV } = U;

  /* ---------- Helpers compartidos ---------- */
  const userName = (id) => { const u = DB.get('users', id); return u ? (u.role === 'odontologo' ? `Dr/a. ${u.firstName} ${u.lastName}` : `${u.firstName} ${u.lastName}`) : '—'; };
  const dentists = () => DB.all('users').filter((u) => u.role === 'odontologo' && u.active);
  const patientById = (id) => DB.get('patients', id);
  const treatmentById = (id) => DB.get('treatments', id);
  const sortedPatients = () => [...DB.all('patients')].sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const options = (list, selected, label, value = (x) => x.id) =>
    list.map((x) => `<option value="${esc(value(x))}" ${value(x) === selected ? 'selected' : ''}>${esc(label(x))}</option>`).join('');

  const APPT_BADGE = { programada: 'b-info', confirmada: 'b-violet', atendida: 'b-ok', cancelada: 'b-muted', ausente: 'b-danger' };
  const BUDGET_BADGE = { pendiente: 'b-warn', aceptado: 'b-info', en_curso: 'b-violet', finalizado: 'b-ok', rechazado: 'b-danger' };
  const apptBadge = (s) => `<span class="badge ${APPT_BADGE[s]}">${DB.APPT_STATUS[s]}</span>`;
  const budgetBadge = (s) => `<span class="badge ${BUDGET_BADGE[s]}">${DB.BUDGET_STATUS[s]}</span>`;

  const avatarFor = (p, sm = true) => `<div class="avatar ${sm ? 'sm' : ''}">${esc(initials(p.firstName, p.lastName))}</div>`;
  const patientCell = (p) => p
    ? `<a href="#/pacientes/${p.id}" class="cell-user" style="color:inherit">${avatarFor(p)}<div><strong>${esc(fullName(p))}</strong><small>DNI ${esc(p.dni)}</small></div></a>`
    : '<span class="muted">Paciente eliminado</span>';

  const pageHead = (title, subtitle, actions = '') =>
    `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;

  const ring = (value, total, color, label) => {
    const r = 40; const c = 2 * Math.PI * r;
    const pct = total ? Math.min(1, value / total) : 0;
    return `<div class="ring"><svg viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="${r}" stroke="#eef2f6" stroke-width="9" fill="none"/><circle cx="48" cy="48" r="${r}" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg><span>${label}</span></div>`;
  };

  const can = (perm) => App.can(perm);

  /* ---------- Formularios reutilizables ---------- */
  const patientForm = (p = {}) => `
    <div class="form-grid">
      <label class="field"><span>Nombre <span class="req">*</span></span><input name="firstName" required value="${esc(p.firstName)}"></label>
      <label class="field"><span>Apellido <span class="req">*</span></span><input name="lastName" required value="${esc(p.lastName)}"></label>
      <label class="field"><span>DNI <span class="req">*</span></span><input name="dni" required inputmode="numeric" value="${esc(p.dni)}"></label>
      <label class="field">Fecha de nacimiento<input type="date" name="birthDate" value="${esc(p.birthDate)}"></label>
      <label class="field">Sexo<select name="sex"><option value="">—</option>${options([{ id: 'F', n: 'Femenino' }, { id: 'M', n: 'Masculino' }, { id: 'X', n: 'Otro' }], p.sex, (x) => x.n)}</select></label>
      <label class="field"><span>Teléfono <span class="req">*</span></span><input name="phone" required value="${esc(p.phone)}"></label>
      <label class="field full">Email<input type="email" name="email" value="${esc(p.email)}"></label>
      <label class="field full">Dirección<input name="address" value="${esc(p.address)}"></label>
      <label class="field">Obra social / prepaga<input name="insurance" value="${esc(p.insurance)}" placeholder="Particular"></label>
      <label class="field">N° de afiliado<input name="insuranceNumber" value="${esc(p.insuranceNumber)}"></label>
      <label class="field">Alergias<input name="allergies" value="${esc(p.allergies)}" placeholder="Ninguna conocida"></label>
      <label class="field">Medicación actual<input name="medications" value="${esc(p.medications)}"></label>
      <label class="field full">Antecedentes médicos<input name="conditions" value="${esc(p.conditions)}" placeholder="Diabetes, hipertensión, embarazo..."></label>
      <label class="field full">Observaciones<textarea name="notes">${esc(p.notes)}</textarea></label>
    </div>`;

  const openPatientModal = (p, after) => openModal({
    title: p ? 'Editar paciente' : 'Nuevo paciente', size: 'lg', body: patientForm(p || {}),
    onSubmit: (data) => {
      const dup = DB.all('patients').find((x) => x.dni === data.dni.trim() && (!p || x.id !== p.id));
      if (dup) { toast('Ya existe un paciente con ese DNI', 'err'); return false; }
      if (p) { DB.update('patients', p.id, data, `Paciente ${data.lastName}, ${data.firstName} actualizado`); toast('Paciente actualizado'); after && after(p.id); }
      else { const n = DB.insert('patients', { ...data, createdAt: isoDate() }, `Paciente ${data.lastName}, ${data.firstName} creado`); toast('Paciente creado'); after && after(n.id); }
    },
  });

  const openAppointmentModal = (appt, preset = {}, after) => {
    const a = appt || { date: preset.date || isoDate(), time: preset.time || '09:00', duration: 30, status: 'programada', patientId: preset.patientId || '', dentistId: preset.dentistId || '' };
    openModal({
      title: appt ? 'Editar cita' : 'Nueva cita',
      body: `<div class="form-grid">
        <label class="field full"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Seleccionar paciente</option>${options(sortedPatients(), a.patientId, fullName)}</select></label>
        <label class="field full"><span>Odontólogo/a <span class="req">*</span></span><select name="dentistId" required><option value="">Seleccionar profesional</option>${options(dentists(), a.dentistId, (u) => `${u.firstName} ${u.lastName} · ${u.specialty}`)}</select></label>
        <label class="field"><span>Fecha <span class="req">*</span></span><input type="date" name="date" required value="${esc(a.date)}"></label>
        <label class="field"><span>Hora <span class="req">*</span></span><input type="time" name="time" required step="900" value="${esc(a.time)}"></label>
        <label class="field">Duración<select name="duration">${options([15, 30, 45, 60, 90, 120].map((m) => ({ id: String(m) })), String(a.duration), (x) => x.id + ' min')}</select></label>
        <label class="field">Estado<select name="status">${options(Object.keys(DB.APPT_STATUS).map((k) => ({ id: k })), a.status, (x) => DB.APPT_STATUS[x.id])}</select></label>
        <label class="field full">Motivo / tratamiento<select name="treatmentId"><option value="">Consulta general</option>${options(DB.all('treatments'), a.treatmentId, (t) => t.name)}</select></label>
        <label class="field full">Notas<textarea name="notes">${esc(a.notes)}</textarea></label>
      </div>`,
      submitLabel: appt ? 'Guardar cambios' : 'Crear cita',
      onSubmit: (data) => {
        data.duration = Number(data.duration);
        const clash = DB.all('appointments').find((x) => x.id !== (appt && appt.id) && x.dentistId === data.dentistId && x.date === data.date && x.time === data.time && !['cancelada'].includes(x.status));
        if (clash) { toast('El profesional ya tiene una cita en ese horario', 'err'); return false; }
        const p = patientById(data.patientId);
        if (appt) { DB.update('appointments', appt.id, data, `Cita de ${fullName(p)} actualizada`); toast('Cita actualizada'); }
        else { DB.insert('appointments', data, `Cita para ${fullName(p)} el ${fmtDate(data.date)} ${data.time}`); toast('Cita creada'); }
        after && after();
      },
    });
  };

  const openPaymentModal = (preset = {}, after) => {
    const patientBudgets = (pid) => DB.all('budgets').filter((b) => b.patientId === pid && b.status !== 'rechazado');
    openModal({
      title: 'Registrar pago',
      body: `<div class="form-grid">
        <label class="field full"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Seleccionar paciente</option>${options(sortedPatients(), preset.patientId, fullName)}</select></label>
        <label class="field full">Presupuesto asociado<select name="budgetId"></select></label>
        <label class="field"><span>Monto <span class="req">*</span></span><input type="number" name="amount" min="1" step="1" required></label>
        <label class="field"><span>Fecha <span class="req">*</span></span><input type="date" name="date" required value="${isoDate()}"></label>
        <label class="field full">Método de pago<select name="method">${options(DB.PAYMENT_METHODS.map((m) => ({ id: m })), 'Efectivo', (x) => x.id)}</select></label>
        <label class="field full">Concepto<input name="concept" placeholder="Seña, cuota, pago total..."></label>
      </div>`,
      submitLabel: 'Registrar pago',
      onMount: (form) => {
        const fill = () => {
          const pid = form.patientId.value;
          const list = pid ? patientBudgets(pid) : [];
          form.budgetId.innerHTML = '<option value="">Sin presupuesto (pago a cuenta)</option>' + list.map((b) => `<option value="${b.id}" ${preset.budgetId === b.id ? 'selected' : ''}>#${b.number} · ${money(DB.budgetTotal(b))} · ${DB.BUDGET_STATUS[b.status]}</option>`).join('');
          if (pid) {
            const bal = DB.patientBalance(pid).balance;
            if (bal > 0 && !form.amount.value) form.amount.placeholder = `Saldo pendiente: ${money(bal)}`;
          }
        };
        form.patientId.addEventListener('change', fill);
        fill();
      },
      onSubmit: (data) => {
        data.amount = Number(data.amount);
        if (!(data.amount > 0)) { toast('Ingresá un monto válido', 'err'); return false; }
        const b = data.budgetId ? DB.get('budgets', data.budgetId) : null;
        if (!data.concept) data.concept = b ? `Pago presupuesto #${b.number}` : 'Pago a cuenta';
        data.receipt = 'R-' + String(DB.all('payments').length + 2001).padStart(6, '0');
        const p = patientById(data.patientId);
        DB.insert('payments', data, `Pago de ${money(data.amount)} de ${fullName(p)}`);
        toast('Pago registrado');
        after && after();
      },
    });
  };

  const openBudgetModal = (budget, preset = {}, after) => {
    const b = budget ? JSON.parse(JSON.stringify(budget)) : { patientId: preset.patientId || '', dentistId: '', date: isoDate(), status: 'pendiente', discount: 0, notes: '', items: [] };
    const treatments = DB.all('treatments');
    openModal({
      title: budget ? `Editar presupuesto #${budget.number}` : 'Nuevo presupuesto', size: 'lg',
      body: `<div class="form-grid">
        <label class="field"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Seleccionar paciente</option>${options(sortedPatients(), b.patientId, fullName)}</select></label>
        <label class="field"><span>Odontólogo/a <span class="req">*</span></span><select name="dentistId" required><option value="">Seleccionar</option>${options(dentists(), b.dentistId, (u) => `${u.firstName} ${u.lastName}`)}</select></label>
        <label class="field">Fecha<input type="date" name="date" value="${esc(b.date)}"></label>
        <label class="field">Estado<select name="status">${options(Object.keys(DB.BUDGET_STATUS).map((k) => ({ id: k })), b.status, (x) => DB.BUDGET_STATUS[x.id])}</select></label>
        <div class="full">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <label class="field" style="flex:1;min-width:220px">Agregar tratamiento<select data-add-t><option value="">Seleccionar del catálogo…</option>${options(treatments, '', (t) => `${t.name} — ${money(t.price)}`)}</select></label>
            <label class="field" style="width:90px">Pieza<input data-add-tooth placeholder="Ej: 16"></label>
            <button type="button" class="btn" data-add-item>${icon('plus')}Agregar</button>
          </div>
          <div class="table-wrap card" style="margin-top:12px;box-shadow:none"><table><thead><tr><th>Tratamiento</th><th>Pieza</th><th style="width:80px">Cant.</th><th style="width:130px">Precio</th><th class="num">Subtotal</th><th></th></tr></thead><tbody data-items></tbody></table></div>
        </div>
        <label class="field">Descuento (%)<input type="number" name="discount" min="0" max="100" value="${esc(b.discount)}"></label>
        <div class="field" style="justify-content:flex-end;align-items:flex-end"><span class="muted" style="display:block">Total</span><strong data-total style="display:block;font-size:22px;color:var(--primary-600)"></strong></div>
        <label class="field full">Observaciones<textarea name="notes">${esc(b.notes)}</textarea></label>
      </div>`,
      submitLabel: budget ? 'Guardar cambios' : 'Crear presupuesto',
      onMount: (form) => {
        const tbody = form.querySelector('[data-items]');
        const paint = () => {
          tbody.innerHTML = b.items.length ? b.items.map((it, i) => `<tr>
              <td>${esc(it.description)}</td>
              <td><input data-i="${i}" data-k="tooth" value="${esc(it.tooth)}" style="width:64px;padding:6px"></td>
              <td><input type="number" min="1" data-i="${i}" data-k="qty" value="${it.qty}" style="padding:6px"></td>
              <td><input type="number" min="0" data-i="${i}" data-k="price" value="${it.price}" style="padding:6px"></td>
              <td class="num money">${money(it.qty * it.price)}</td>
              <td><div class="act"><button type="button" class="del" data-rm="${i}">${icon('trash')}</button></div></td></tr>`).join('')
            : '<tr><td colspan="6" class="empty">Agregá tratamientos desde el catálogo</td></tr>';
          form.querySelector('[data-total]').textContent = money(DB.budgetTotal({ items: b.items, discount: form.discount.value }));
        };
        form.querySelector('[data-add-item]').addEventListener('click', () => {
          const sel = form.querySelector('[data-add-t]');
          const t = treatmentById(sel.value);
          if (!t) { toast('Elegí un tratamiento', 'err'); return; }
          b.items.push({ treatmentId: t.id, description: t.name, qty: 1, price: t.price, tooth: form.querySelector('[data-add-tooth]').value });
          sel.value = ''; form.querySelector('[data-add-tooth]').value = '';
          paint();
        });
        tbody.addEventListener('input', (e) => {
          const el = e.target; const i = el.dataset.i; if (i === undefined) return;
          b.items[i][el.dataset.k] = el.dataset.k === 'tooth' ? el.value : Number(el.value);
          el.closest('tr').querySelector('.money').textContent = money(b.items[i].qty * b.items[i].price);
          form.querySelector('[data-total]').textContent = money(DB.budgetTotal({ items: b.items, discount: form.discount.value }));
        });
        tbody.addEventListener('click', (e) => { const rm = e.target.closest('[data-rm]'); if (rm) { b.items.splice(Number(rm.dataset.rm), 1); paint(); } });
        form.discount.addEventListener('input', paint);
        paint();
      },
      onSubmit: (data) => {
        if (!b.items.length) { toast('Agregá al menos un tratamiento', 'err'); return false; }
        const record = { ...data, discount: Number(data.discount) || 0, items: b.items };
        const p = patientById(data.patientId);
        if (budget) { DB.update('budgets', budget.id, record, `Presupuesto #${budget.number} actualizado`); toast('Presupuesto actualizado'); }
        else { const number = DB.nextBudgetNumber(); DB.insert('budgets', { ...record, number }, `Presupuesto #${number} para ${fullName(p)}`); toast('Presupuesto creado'); }
        after && after();
      },
    });
  };

  const printBudget = (b) => {
    const s = DB.settings(); const p = patientById(b.patientId);
    const sub = b.items.reduce((acc, it) => acc + it.qty * it.price, 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto #${b.number}</title>
      <style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;padding:32px;max-width:780px;margin:auto}h1{margin:0;color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc;font-size:12px}td.n,th.n{text-align:right}.head{display:flex;justify-content:space-between;border-bottom:3px solid #0d9488;padding-bottom:14px}.tot{text-align:right;margin-top:14px;font-size:18px}small{color:#64748b}</style></head><body>
      <div class="head"><div><h1>${esc(s.clinicName)}</h1><small>${esc(s.address)} · ${esc(s.phone)} · ${esc(s.email)}</small></div><div style="text-align:right"><strong>PRESUPUESTO #${b.number}</strong><br><small>${fmtDate(b.date)}</small></div></div>
      <p><strong>Paciente:</strong> ${esc(fullName(p))} · DNI ${esc(p ? p.dni : '')}<br><strong>Profesional:</strong> ${esc(userName(b.dentistId))}</p>
      <table><thead><tr><th>Tratamiento</th><th>Pieza</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Subtotal</th></tr></thead><tbody>
      ${b.items.map((it) => `<tr><td>${esc(it.description)}</td><td>${esc(it.tooth || '—')}</td><td class="n">${it.qty}</td><td class="n">${money(it.price)}</td><td class="n">${money(it.qty * it.price)}</td></tr>`).join('')}
      </tbody></table>
      <div class="tot">Subtotal: ${money(sub)}${b.discount ? `<br>Descuento ${b.discount}%: -${money(sub * b.discount / 100)}` : ''}<br><strong>Total: ${money(DB.budgetTotal(b))}</strong></div>
      ${b.notes ? `<p><strong>Observaciones:</strong> ${esc(b.notes)}</p>` : ''}
      <p style="margin-top:40px"><small>Presupuesto válido por 30 días. ${esc(s.receiptFooter)}</small></p>
      <script>window.onload=()=>window.print()<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('Permití las ventanas emergentes para imprimir', 'err'); return; }
    w.document.write(html); w.document.close();
  };

  const printReceipt = (pay) => {
    const s = DB.settings(); const p = patientById(pay.patientId);
    const w = window.open('', '_blank');
    if (!w) { toast('Permití las ventanas emergentes para imprimir', 'err'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${esc(pay.receipt)}</title><style>body{font-family:Inter,Arial,sans-serif;padding:32px;max-width:560px;margin:auto;color:#0f172a}h1{color:#0f766e;margin:0}.box{border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-top:18px}.amt{font-size:28px;font-weight:800;color:#0f766e}small{color:#64748b}</style></head><body>
      <h1>${esc(s.clinicName)}</h1><small>${esc(s.address)} · CUIT ${esc(s.taxId)}</small>
      <div class="box"><strong>RECIBO ${esc(pay.receipt)}</strong> <small style="float:right">${fmtDate(pay.date)}</small>
      <p>Recibimos de <strong>${esc(fullName(p))}</strong> (DNI ${esc(p ? p.dni : '')}) la suma de:</p><div class="amt">${money(pay.amount)}</div>
      <p>Concepto: ${esc(pay.concept)}<br>Método: ${esc(pay.method)}</p></div>
      <p><small>${esc(s.receiptFooter)}</small></p><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  /* =====================================================================
     DASHBOARD
     ===================================================================== */
  const dashboard = (el) => {
    const today = isoDate();
    const now = new Date();
    const monthPrefix = today.slice(0, 7);
    const appts = DB.all('appointments');
    const todays = appts.filter((a) => a.date === today && a.status !== 'cancelada').sort((a, b) => a.time.localeCompare(b.time));
    const upcoming = appts.filter((a) => a.date >= today && ['programada', 'confirmada'].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
    const pendingBudgets = DB.all('budgets').filter((b) => b.status === 'pendiente').sort((a, b) => b.date.localeCompare(a.date));
    const monthIncome = DB.all('payments').filter((p) => p.date.startsWith(monthPrefix)).reduce((s, p) => s + Number(p.amount), 0);
    const monthAppts = appts.filter((a) => a.date.startsWith(monthPrefix) && a.date <= today);
    const attended = monthAppts.filter((a) => a.status === 'atendida').length;
    const closedMonth = monthAppts.filter((a) => ['atendida', 'ausente'].includes(a.status)).length;
    const budgetsAll = DB.all('budgets');
    const accepted = budgetsAll.filter((b) => ['aceptado', 'en_curso', 'finalizado'].includes(b.status)).length;
    const decided = budgetsAll.filter((b) => b.status !== 'pendiente').length;

    const weekBars = [];
    for (let i = 6; i >= 0; i--) {
      const d = isoDate(addDays(now, -i));
      weekBars.push({ label: parseDate(d).toLocaleDateString('es-AR', { weekday: 'short' }), value: appts.filter((a) => a.date === d && a.status === 'atendida').length });
    }
    const maxBar = Math.max(1, ...weekBars.map((b) => b.value));

    const perDentist = dentists().map((d) => {
      const mine = monthAppts.filter((a) => a.dentistId === d.id);
      const income = DB.all('budgets').filter((b) => b.dentistId === d.id).reduce((s, b) => s + DB.all('payments').filter((p) => p.budgetId === b.id && p.date.startsWith(monthPrefix)).reduce((x, p) => x + Number(p.amount), 0), 0);
      return { d, total: mine.length, done: mine.filter((a) => a.status === 'atendida').length, income };
    });

    const recentPatients = [...DB.all('patients')].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);

    el.innerHTML = `
      ${pageHead('Dashboard', `Resumen general · ${(() => { const t = fmtDateLong(now); return t[0].toUpperCase() + t.slice(1); })()}`, `<button class="btn btn-primary" data-new-appt>${icon('plus')}Nueva cita</button>`)}
      <div class="grid grid-4">
        <div class="card stat"><div class="ico" style="background:linear-gradient(135deg,#14b8a6,#0d9488)">${icon('users')}</div><div><div class="val">${DB.all('patients').length}</div><div class="lbl">Pacientes</div></div></div>
        <div class="card stat"><div class="ico" style="background:linear-gradient(135deg,#38bdf8,#0284c7)">${icon('calendar')}</div><div><div class="val">${todays.length}</div><div class="lbl">Citas hoy</div></div></div>
        <div class="card stat"><div class="ico" style="background:linear-gradient(135deg,#fbbf24,#d97706)">${icon('file')}</div><div><div class="val">${pendingBudgets.length}</div><div class="lbl">Presupuestos pendientes</div></div></div>
        <div class="card stat"><div class="ico" style="background:linear-gradient(135deg,#a78bfa,#7c3aed)">${icon('cash')}</div><div><div class="val">${money(monthIncome)}</div><div class="lbl">Ingresos del mes</div></div></div>
      </div>

      <div class="grid grid-3" style="margin-top:16px">
        <div class="card ring-card"><h4>Asistencia del mes</h4>${ring(attended, closedMonth, '#0d9488', closedMonth ? Math.round(attended / closedMonth * 100) + '%' : '—')}<small class="muted">${attended} atendidas de ${closedMonth}</small></div>
        <div class="card ring-card"><h4>Aceptación de presupuestos</h4>${ring(accepted, decided, '#f59e0b', decided ? Math.round(accepted / decided * 100) + '%' : '—')}<small class="muted">${accepted} aceptados de ${decided} respondidos</small></div>
        <div class="card ring-card"><h4>Pacientes atendidos (7 días)</h4>
          <div class="bars" style="height:120px">${weekBars.map((b) => `<div class="bar"><div style="height:${(b.value / maxBar) * 100}%" title="${b.value}"></div><small>${b.label}</small></div>`).join('')}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:16px">
        <div class="card">
          <div class="card-head"><h3>Agenda de hoy</h3><a href="#/agenda">Ver agenda ${'›'}</a></div>
          <div class="card-body">${todays.length ? todays.map((a) => { const p = patientById(a.patientId); const t = treatmentById(a.treatmentId); return `
            <div class="list-item"><div class="badge b-info" style="min-width:56px;justify-content:center">${a.time}</div>
            <div class="grow"><strong>${esc(fullName(p))}</strong><br><small>${esc(t ? t.name : 'Consulta')} · ${esc(userName(a.dentistId))}</small></div>${apptBadge(a.status)}</div>`; }).join('') : '<div class="empty">No hay citas programadas para hoy</div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Próximas citas</h3><a href="#/agenda">Ver todas ›</a></div>
          <div class="card-body">${upcoming.length ? upcoming.map((a) => { const p = patientById(a.patientId); return `
            <div class="list-item">${p ? avatarFor(p) : ''}<div class="grow"><strong>${esc(fullName(p))}</strong><br><small>${fmtDate(a.date)} · ${a.time} · ${esc(userName(a.dentistId))}</small></div>${apptBadge(a.status)}</div>`; }).join('') : '<div class="empty">No hay próximas citas</div>'}</div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Rendimiento por profesional (mes actual)</h3></div>
        <div class="card-body grid grid-2">${perDentist.map(({ d, total, done, income }) => `
          <div class="list-item" style="border:0"><div class="avatar" style="background:${d.color}">${esc(initials(d.firstName, d.lastName))}</div>
            <div class="grow"><strong>Dr/a. ${esc(d.firstName)} ${esc(d.lastName)}</strong><br><small>${esc(d.specialty)}</small>
              <div class="hbar" style="margin:6px 0 0"><div class="track"><div style="width:${total ? done / total * 100 : 0}%"></div></div></div>
            </div>
            <div style="text-align:right"><strong>${done}/${total}</strong><br><small class="muted">citas</small><br><span class="money">${money(income)}</span></div>
          </div>`).join('')}</div>
      </div>

      <div class="grid grid-2" style="margin-top:16px">
        <div class="card">
          <div class="card-head"><h3>Pacientes recientes</h3><a href="#/pacientes">Ver todos ›</a></div>
          <div class="card-body">${recentPatients.map((p) => `<div class="list-item">${patientCell(p)}<small class="grow" style="text-align:right">${fmtDate(p.createdAt)}</small></div>`).join('') || '<div class="empty">Sin pacientes</div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Presupuestos pendientes</h3><a href="#/presupuestos">Ver todos ›</a></div>
          <div class="table-wrap"><table><thead><tr><th>Paciente</th><th class="num">Total</th><th>Fecha</th></tr></thead><tbody>
            ${pendingBudgets.slice(0, 6).map((b) => `<tr><td>${esc(fullName(patientById(b.patientId)))}</td><td class="num money">${money(DB.budgetTotal(b))}</td><td class="muted">${fmtDate(b.date)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin presupuestos pendientes</td></tr>'}
          </tbody></table></div>
        </div>
      </div>`;

    el.querySelector('[data-new-appt]').addEventListener('click', () => openAppointmentModal(null, {}, () => App.render()));
  };

  /* =====================================================================
     PACIENTES
     ===================================================================== */
  const patients = (el) => {
    let q = '';
    let insurance = '';
    const render = () => {
      const list = sortedPatients().filter((p) => {
        const hay = `${p.firstName} ${p.lastName} ${p.dni} ${p.phone} ${p.email}`.toLowerCase();
        return (!q || hay.includes(q.toLowerCase())) && (!insurance || p.insurance === insurance);
      });
      const insurers = [...new Set(DB.all('patients').map((p) => p.insurance).filter(Boolean))].sort();
      el.querySelector('[data-body]').innerHTML = list.length ? list.map((p) => {
        const bal = DB.patientBalance(p.id).balance;
        const last = DB.all('appointments').filter((a) => a.patientId === p.id && a.status === 'atendida').sort((a, b) => b.date.localeCompare(a.date))[0];
        return `<tr>
          <td>${patientCell(p)}</td>
          <td>${esc(p.phone)}<br><small class="muted">${esc(p.email)}</small></td>
          <td>${esc(p.insurance || 'Particular')}</td>
          <td>${p.birthDate ? ageFrom(p.birthDate) + ' años' : '—'}</td>
          <td>${last ? fmtDate(last.date) : '<span class="muted">—</span>'}</td>
          <td class="num"><span class="money ${bal > 0 ? 'neg' : ''}">${bal > 0 ? money(bal) : 'Al día'}</span></td>
          <td><div class="act">
            <button title="Ver ficha" data-view="${p.id}">${icon('eye')}</button>
            <button title="Editar" data-edit="${p.id}">${icon('edit')}</button>
            ${can('delete') ? `<button class="del" title="Eliminar" data-del="${p.id}">${icon('trash')}</button>` : ''}
          </div></td></tr>`;
      }).join('') : '<tr><td colspan="7" class="empty">No se encontraron pacientes</td></tr>';
      el.querySelector('[data-count]').textContent = `${list.length} paciente${list.length === 1 ? '' : 's'}`;
      const sel = el.querySelector('[data-insurance]');
      if (sel.options.length <= 1) sel.innerHTML += insurers.map((i) => `<option>${esc(i)}</option>`).join('');
      return list;
    };

    el.innerHTML = `
      ${pageHead('Pacientes', 'Gestión de pacientes de la clínica', `<button class="btn" data-csv>${icon('download')}CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Nuevo paciente</button>`)}
      <div class="card">
        <div class="toolbar">
          <input class="grow" data-q placeholder="Buscar por nombre, DNI, teléfono o email…">
          <select data-insurance><option value="">Todas las coberturas</option></select>
          <span class="muted" data-count></span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Contacto</th><th>Cobertura</th><th>Edad</th><th>Última visita</th><th class="num">Saldo</th><th>Acciones</th></tr></thead><tbody data-body></tbody></table></div>
      </div>`;

    let current = render();
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; current = render(); });
    el.querySelector('[data-insurance]').addEventListener('change', (e) => { insurance = e.target.value; current = render(); });
    el.querySelector('[data-new]').addEventListener('click', () => openPatientModal(null, (id) => App.go(`/pacientes/${id}`)));
    el.querySelector('[data-csv]').addEventListener('click', () => {
      downloadFile('pacientes.csv', toCSV(current, [
        { label: 'Apellido', value: (p) => p.lastName }, { label: 'Nombre', value: (p) => p.firstName }, { label: 'DNI', value: (p) => p.dni },
        { label: 'Nacimiento', value: (p) => p.birthDate }, { label: 'Teléfono', value: (p) => p.phone }, { label: 'Email', value: (p) => p.email },
        { label: 'Cobertura', value: (p) => p.insurance }, { label: 'Afiliado', value: (p) => p.insuranceNumber }, { label: 'Saldo', value: (p) => DB.patientBalance(p.id).balance },
      ]), 'text/csv;charset=utf-8');
      DB.log('exportar', 'Pacientes', 'Exportación CSV de pacientes');
    });
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.view) App.go(`/pacientes/${b.dataset.view}`);
      if (b.dataset.edit) openPatientModal(patientById(b.dataset.edit), () => (current = render()));
      if (b.dataset.del) {
        const p = patientById(b.dataset.del);
        confirmDialog(`¿Eliminar a ${fullName(p)}? Se borrarán también sus citas, presupuestos, pagos e historia clínica.`, () => {
          ['appointments', 'budgets', 'payments', 'history', 'consents'].forEach((c) => DB.all(c).filter((x) => x.patientId === p.id).forEach((x) => DB.remove(c, x.id, `Eliminado junto con paciente ${fullName(p)}`)));
          DB.remove('patients', p.id, `Paciente ${fullName(p)} eliminado`);
          toast('Paciente eliminado');
          current = render();
        });
      }
    });
  };

  /* =====================================================================
     FICHA DEL PACIENTE
     ===================================================================== */
  const PATIENT_TABS = [
    ['info', 'Información'], ['odontograma', 'Odontograma'], ['historia', 'Historia clínica'], ['consentimientos', 'Consentimientos'],
    ['cuenta', 'Cuenta corriente'], ['citas', 'Citas'], ['pagos', 'Pagos'],
  ];

  const patientDetail = (el, { id, tab = 'info' }) => {
    const p = patientById(id);
    if (!p) { el.innerHTML = `<div class="card empty">Paciente no encontrado. <a href="#/pacientes">Volver</a></div>`; return; }

    const renderHeader = () => {
      const { balance } = DB.patientBalance(p.id);
      return `<div class="patient-head">
        <a href="#/pacientes" class="icon-btn back" title="Volver">${icon('back')}</a>
        <div class="avatar" style="width:52px;height:52px;font-size:18px;border-radius:14px">${esc(initials(p.firstName, p.lastName))}</div>
        <div><h1>${esc(fullName(p))}</h1><div class="muted">DNI ${esc(p.dni)}${p.birthDate ? ` · ${ageFrom(p.birthDate)} años` : ''} · ${esc(p.insurance || 'Particular')}</div></div>
        <div class="balance-box ${balance > 0 ? 'balance-debt' : 'balance-ok'}"><small>Saldo</small><strong>${balance > 0 ? money(balance) : 'Al día'}</strong></div>
      </div>
      ${(p.allergies || p.conditions) ? `<div class="zone zone-warn" style="margin-bottom:16px;padding:12px 16px">${icon('alert').replace('<svg', '<svg width="20" height="20"')}<div class="grow"><strong>Alertas médicas:</strong> ${[p.allergies && 'Alergia: ' + esc(p.allergies), p.conditions && esc(p.conditions), p.medications && 'Medicación: ' + esc(p.medications)].filter(Boolean).join(' · ')}</div></div>` : ''}
      <div class="tabs">${PATIENT_TABS.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    };

    const body = () => {
      switch (tab) {
        case 'odontograma': return `<div class="card card-pad"><h3 style="font-size:16px;margin-bottom:6px">Odontograma digital</h3><div data-odo></div></div>`;
        case 'historia': {
          const list = DB.all('history').filter((h) => h.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          return `<div class="card"><div class="card-head"><h3>Historia clínica</h3><button class="btn btn-primary btn-sm" data-new-h>${icon('plus')}Nueva evolución</button></div>
            <div class="card-body">${list.length ? `<div class="timeline">${list.map((h) => `<div class="tl-item"><div class="date">${fmtDate(h.date)} · ${esc(userName(h.dentistId))}</div><h4>${esc(h.title)}</h4><p>${esc(h.notes)}</p>
              <div class="act" style="margin-top:4px"><button data-edit-h="${h.id}" title="Editar">${icon('edit')}</button>${can('delete') ? `<button class="del" data-del-h="${h.id}" title="Eliminar">${icon('trash')}</button>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">Sin registros en la historia clínica</div>'}</div></div>`;
        }
        case 'consentimientos': {
          const list = DB.all('consents').filter((c) => c.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          return `<div class="card"><div class="card-head"><h3>Consentimientos informados</h3><button class="btn btn-primary btn-sm" data-new-c>${icon('plus')}Nuevo consentimiento</button></div>
            <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Notas</th><th></th></tr></thead><tbody>
            ${list.map((c) => `<tr><td><strong>${esc(c.type)}</strong></td><td>${fmtDate(c.date)}</td><td>${c.signed ? '<span class="badge b-ok">Firmado</span>' : '<span class="badge b-warn">Pendiente de firma</span>'}</td><td class="muted">${esc(c.notes)}</td>
              <td><div class="act">${c.signed ? '' : `<button title="Marcar firmado" data-sign="${c.id}">${icon('check')}</button>`}${can('delete') ? `<button class="del" data-del-c="${c.id}">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin consentimientos registrados</td></tr>'}
            </tbody></table></div></div>`;
        }
        case 'cuenta': {
          const budgets = DB.all('budgets').filter((b) => b.patientId === p.id && ['aceptado', 'en_curso', 'finalizado'].includes(b.status));
          const pays = DB.all('payments').filter((x) => x.patientId === p.id);
          const moves = [
            ...budgets.map((b) => ({ date: b.date, concept: `Presupuesto #${b.number} (${DB.BUDGET_STATUS[b.status]})`, debit: DB.budgetTotal(b), credit: 0 })),
            ...pays.map((x) => ({ date: x.date, concept: `${x.concept} · ${x.method}`, debit: 0, credit: Number(x.amount) })),
          ].sort((a, b) => a.date.localeCompare(b.date));
          let run = 0;
          const { charged, paid, balance } = DB.patientBalance(p.id);
          return `<div class="grid grid-3" style="margin-bottom:16px">
              <div class="card stat"><div class="ico" style="background:#0284c7">${icon('file')}</div><div><div class="val">${money(charged)}</div><div class="lbl">Total presupuestado</div></div></div>
              <div class="card stat"><div class="ico" style="background:#16a34a">${icon('cash')}</div><div><div class="val">${money(paid)}</div><div class="lbl">Total pagado</div></div></div>
              <div class="card stat"><div class="ico" style="background:${balance > 0 ? '#e11d48' : '#0d9488'}">${icon('wallet')}</div><div><div class="val">${money(Math.max(0, balance))}</div><div class="lbl">${balance < 0 ? 'Saldo a favor: ' + money(-balance) : 'Saldo pendiente'}</div></div></div>
            </div>
            <div class="card"><div class="card-head"><h3>Movimientos</h3><button class="btn btn-primary btn-sm" data-new-pay>${icon('plus')}Registrar pago</button></div>
            <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead><tbody>
            ${moves.map((m) => { run += m.debit - m.credit; return `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.concept)}</td><td class="num">${m.debit ? money(m.debit) : ''}</td><td class="num" style="color:var(--ok)">${m.credit ? money(m.credit) : ''}</td><td class="num"><span class="money ${run > 0 ? 'neg' : ''}">${money(run)}</span></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">Sin movimientos</td></tr>'}
            </tbody></table></div></div>`;
        }
        case 'citas': {
          const list = DB.all('appointments').filter((a) => a.patientId === p.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
          return `<div class="card"><div class="card-head"><h3>Citas</h3><button class="btn btn-primary btn-sm" data-new-appt>${icon('plus')}Agendar cita</button></div>
            <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Profesional</th><th>Motivo</th><th>Estado</th><th></th></tr></thead><tbody>
            ${list.map((a) => { const t = treatmentById(a.treatmentId); return `<tr><td>${fmtDate(a.date)}</td><td>${a.time}</td><td>${esc(userName(a.dentistId))}</td><td>${esc(t ? t.name : 'Consulta')}</td><td>${apptBadge(a.status)}</td><td><div class="act"><button data-edit-appt="${a.id}">${icon('edit')}</button></div></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Sin citas registradas</td></tr>'}
            </tbody></table></div></div>`;
        }
        case 'pagos': {
          const list = DB.all('payments').filter((x) => x.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          const budgets = DB.all('budgets').filter((b) => b.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          return `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>Presupuestos</h3><button class="btn btn-sm" data-new-budget>${icon('plus')}Nuevo presupuesto</button></div>
            <div class="table-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Profesional</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody>
            ${budgets.map((b) => `<tr><td>#${b.number}</td><td>${fmtDate(b.date)}</td><td>${esc(userName(b.dentistId))}</td><td class="num money">${money(DB.budgetTotal(b))}</td><td>${budgetBadge(b.status)}</td><td><div class="act"><button data-print-b="${b.id}" title="Imprimir">${icon('print')}</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin presupuestos</td></tr>'}
            </tbody></table></div></div>
            <div class="card"><div class="card-head"><h3>Pagos</h3><button class="btn btn-primary btn-sm" data-new-pay>${icon('plus')}Registrar pago</button></div>
            <div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th></th></tr></thead><tbody>
            ${list.map((x) => `<tr><td>${esc(x.receipt)}</td><td>${fmtDate(x.date)}</td><td>${esc(x.concept)}</td><td>${esc(x.method)}</td><td class="num money">${money(x.amount)}</td><td><div class="act"><button data-print-r="${x.id}" title="Imprimir recibo">${icon('print')}</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin pagos registrados</td></tr>'}
            </tbody></table></div></div>`;
        }
        default:
          return `<div class="grid grid-2">
            <div class="card"><div class="card-head"><h3>Datos personales</h3><button class="btn btn-sm" data-edit-p>${icon('edit')}Editar</button></div>
              <div class="card-body"><dl class="kv">
                <dt>Nombre completo</dt><dd>${esc(p.firstName)} ${esc(p.lastName)}</dd>
                <dt>DNI</dt><dd>${esc(p.dni)}</dd>
                <dt>Fecha de nacimiento</dt><dd>${fmtDate(p.birthDate)}${p.birthDate ? ` (${ageFrom(p.birthDate)} años)` : ''}</dd>
                <dt>Sexo</dt><dd>${{ F: 'Femenino', M: 'Masculino', X: 'Otro' }[p.sex] || '—'}</dd>
                <dt>Teléfono</dt><dd>${esc(p.phone) || '—'}</dd>
                <dt>Email</dt><dd>${esc(p.email) || '—'}</dd>
                <dt>Dirección</dt><dd>${esc(p.address) || '—'}</dd>
                <dt>Cobertura</dt><dd>${esc(p.insurance || 'Particular')}${p.insuranceNumber ? ` · N° ${esc(p.insuranceNumber)}` : ''}</dd>
                <dt>Paciente desde</dt><dd>${fmtDate(p.createdAt)}</dd>
              </dl></div></div>
            <div class="card"><div class="card-head"><h3>Información médica</h3></div>
              <div class="card-body"><dl class="kv">
                <dt>Alergias</dt><dd>${esc(p.allergies) || 'Ninguna conocida'}</dd>
                <dt>Medicación</dt><dd>${esc(p.medications) || '—'}</dd>
                <dt>Antecedentes</dt><dd>${esc(p.conditions) || '—'}</dd>
                <dt>Observaciones</dt><dd>${esc(p.notes) || '—'}</dd>
              </dl></div></div>
          </div>`;
      }
    };

    const render = () => {
      el.innerHTML = renderHeader() + `<div data-tabbody>${body()}</div>`;
      if (tab === 'odontograma') {
        Odontogram.mount(el.querySelector('[data-odo]'), DB.getOdontogram(p.id), (data, detail) => DB.setOdontogram(p.id, data, `${fullName(p)} · ${detail}`), !can('clinical'));
      }
    };

    const historyModal = (h) => openModal({
      title: h ? 'Editar evolución' : 'Nueva evolución',
      body: `<div class="stack">
        <div class="form-grid"><label class="field">Fecha<input type="date" name="date" value="${h ? h.date : isoDate()}" required></label>
        <label class="field">Profesional<select name="dentistId" required>${options(dentists(), h ? h.dentistId : (App.user().role === 'odontologo' ? App.user().id : ''), (u) => `${u.firstName} ${u.lastName}`)}</select></label></div>
        <label class="field"><span>Título <span class="req">*</span></span><input name="title" required value="${esc(h && h.title)}" placeholder="Ej: Endodoncia pieza 36 (1ra sesión)"></label>
        <label class="field"><span>Evolución / notas <span class="req">*</span></span><textarea name="notes" required rows="6">${esc(h && h.notes)}</textarea></label></div>`,
      onSubmit: (data) => {
        if (h) DB.update('history', h.id, data, `Evolución de ${fullName(p)} editada`);
        else DB.insert('history', { ...data, patientId: p.id }, `Evolución agregada a ${fullName(p)}`);
        toast('Historia clínica actualizada'); render();
      },
    });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.tab) { App.go(`/pacientes/${p.id}/${d.tab}`); return; }
      if ('editP' in d) openPatientModal(p, render);
      if ('newH' in d) historyModal(null);
      if (d.editH) historyModal(DB.get('history', d.editH));
      if (d.delH) confirmDialog('¿Eliminar esta evolución?', () => { DB.remove('history', d.delH, `Evolución de ${fullName(p)} eliminada`); render(); });
      if ('newC' in d) openModal({
        title: 'Nuevo consentimiento',
        body: `<div class="stack"><label class="field"><span>Tipo <span class="req">*</span></span><select name="type" required>${['Tratamiento general', 'Extracción dental', 'Endodoncia', 'Implante dental', 'Tratamiento de ortodoncia', 'Blanqueamiento', 'Anestesia local', 'Uso de datos personales'].map((t) => `<option>${t}</option>`).join('')}</select></label>
          <label class="field">Fecha<input type="date" name="date" value="${isoDate()}"></label>
          <label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="signed" style="width:auto"> Firmado por el paciente</label>
          <label class="field">Notas<textarea name="notes"></textarea></label></div>`,
        onSubmit: (data) => { DB.insert('consents', { ...data, signed: !!data.signed, patientId: p.id }, `Consentimiento "${data.type}" para ${fullName(p)}`); toast('Consentimiento registrado'); render(); },
      });
      if (d.sign) { DB.update('consents', d.sign, { signed: true }, `Consentimiento firmado por ${fullName(p)}`); render(); }
      if (d.delC) confirmDialog('¿Eliminar este consentimiento?', () => { DB.remove('consents', d.delC); render(); });
      if ('newPay' in d) openPaymentModal({ patientId: p.id }, render);
      if ('newBudget' in d) openBudgetModal(null, { patientId: p.id }, render);
      if (d.printB) printBudget(DB.get('budgets', d.printB));
      if (d.printR) printReceipt(DB.get('payments', d.printR));
      if ('newAppt' in d) openAppointmentModal(null, { patientId: p.id }, render);
      if (d.editAppt) openAppointmentModal(DB.get('appointments', d.editAppt), {}, render);
    });

    render();
  };

  /* =====================================================================
     AGENDA
     ===================================================================== */
  let agendaState = { start: null, view: 'semana', dentist: '' };
  const agenda = (el) => {
    const s = DB.settings();
    const startOfWeek = (d) => { const r = new Date(d); const day = (r.getDay() + 6) % 7; r.setDate(r.getDate() - day); return r; };
    const thisWeek = () => startOfWeek(new Date().getDay() === 0 ? addDays(new Date(), 1) : new Date());
    if (!agendaState.start) agendaState.start = thisWeek();

    const render = () => {
      const days = agendaState.view === 'dia' ? 1 : 6;
      const start = agendaState.view === 'dia' ? agendaState.start : startOfWeek(agendaState.start);
      const dates = Array.from({ length: days }, (_, i) => isoDate(addDays(start, i)));
      const [oh] = s.openTime.split(':').map(Number);
      const [ch] = s.closeTime.split(':').map(Number);
      const hours = [];
      for (let h = oh; h < ch; h++) hours.push(h);
      const appts = DB.all('appointments').filter((a) => dates.includes(a.date) && (!agendaState.dentist || a.dentistId === agendaState.dentist) && a.status !== 'cancelada');
      const today = isoDate();

      const title = days === 1 ? (() => { const t = fmtDateLong(start); return t[0].toUpperCase() + t.slice(1); })() : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;
      let grid = `<div class="hcell"></div>` + dates.map((d) => { const dt = parseDate(d); return `<div class="hcell ${d === today ? 'today' : ''}">${dt.toLocaleDateString('es-AR', { weekday: 'short' })}<small>${dt.getDate()}</small></div>`; }).join('');
      hours.forEach((h) => {
        grid += `<div class="tcell">${pad(h)}:00</div>`;
        dates.forEach((d) => {
          const inHour = appts.filter((a) => a.date === d && Number(a.time.slice(0, 2)) === h).sort((a, b) => a.time.localeCompare(b.time));
          grid += `<div class="slot" data-slot="${d}|${pad(h)}:00">${inHour.map((a, i) => {
            const p = patientById(a.patientId); const u = DB.get('users', a.dentistId); const color = u ? u.color : '#0d9488';
            const top = 3 + (Number(a.time.slice(3, 5)) / 60) * 50;
            const height = Math.max(22, (a.duration / 60) * 56 - 6);
            const width = inHour.length > 1 ? `left:${3 + i * (100 / inHour.length)}%;right:auto;width:calc(${100 / inHour.length}% - 6px);` : '';
            return `<div class="appt" data-appt="${a.id}" style="top:${top}px;height:${height}px;${width}background:${color}1f;border-color:${color}" title="${esc(fullName(p))} · ${a.time}"><strong>${esc(p ? p.lastName : '?')}</strong>${a.time} · ${esc(u ? u.lastName : '')}</div>`;
          }).join('')}</div>`;
        });
      });

      el.querySelector('[data-cal]').innerHTML = `<div class="agenda" style="--days:${days}">${grid}</div>`;
      el.querySelector('[data-title]').textContent = title;

      const listDates = dates.filter((d) => d >= today).slice(0, 2);
      const list = DB.all('appointments').filter((a) => listDates.includes(a.date) && (!agendaState.dentist || a.dentistId === agendaState.dentist)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      el.querySelector('[data-list]').innerHTML = list.map((a) => `<tr><td>${fmtDate(a.date)}</td><td>${a.time}</td><td>${patientCell(patientById(a.patientId))}</td><td>${esc(userName(a.dentistId))}</td>
        <td><select class="badge-select" data-status="${a.id}">${options(Object.keys(DB.APPT_STATUS).map((k) => ({ id: k })), a.status, (x) => DB.APPT_STATUS[x.id])}</select></td>
        <td><div class="act"><button data-appt="${a.id}">${icon('edit')}</button>${can('delete') ? `<button class="del" data-del-appt="${a.id}">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin citas próximas en este período</td></tr>';
    };

    el.innerHTML = `
      ${pageHead('Agenda de citas', 'Hacé clic en un horario libre para agendar', `<button class="btn btn-primary" data-new>${icon('plus')}Nueva cita</button>`)}
      <div class="card">
        <div class="toolbar">
          <button class="icon-btn" data-prev>${icon('chevronL')}</button>
          <button class="btn btn-sm" data-today>Hoy</button>
          <button class="icon-btn" data-next>${icon('chevronR')}</button>
          <strong data-title style="flex:1;min-width:160px"></strong>
          <select data-dentist><option value="">Todos los profesionales</option>${options(dentists(), agendaState.dentist, (u) => `${u.firstName} ${u.lastName}`)}</select>
          <div class="seg"><button data-view="dia" class="${agendaState.view === 'dia' ? 'active' : ''}">Día</button><button data-view="semana" class="${agendaState.view === 'semana' ? 'active' : ''}">Semana</button></div>
        </div>
        <div class="table-wrap" data-cal style="max-height:640px;overflow:auto"></div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;padding:12px 16px;border-top:1px solid var(--border);font-size:12px">${dentists().map((u) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${u.color};margin-right:5px"></i>${esc(u.firstName)} ${esc(u.lastName)}</span>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Próximas citas del período</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Estado</th><th></th></tr></thead><tbody data-list></tbody></table></div></div>`;

    const step = () => (agendaState.view === 'dia' ? 1 : 7);
    el.querySelector('[data-prev]').addEventListener('click', () => { agendaState.start = addDays(agendaState.start, -step()); render(); });
    el.querySelector('[data-next]').addEventListener('click', () => { agendaState.start = addDays(agendaState.start, step()); render(); });
    el.querySelector('[data-today]').addEventListener('click', () => { agendaState.start = agendaState.view === 'dia' ? new Date() : thisWeek(); render(); });
    el.querySelector('[data-dentist]').addEventListener('change', (e) => { agendaState.dentist = e.target.value; render(); });
    el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      agendaState.view = b.dataset.view;
      if (agendaState.view === 'dia') agendaState.start = new Date();
      el.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    el.querySelector('[data-new]').addEventListener('click', () => openAppointmentModal(null, { dentistId: agendaState.dentist }, render));
    el.addEventListener('click', (e) => {
      const ap = e.target.closest('[data-appt]');
      if (ap) { e.stopPropagation(); openAppointmentModal(DB.get('appointments', ap.dataset.appt), {}, render); return; }
      const del = e.target.closest('[data-del-appt]');
      if (del) { confirmDialog('¿Eliminar esta cita?', () => { DB.remove('appointments', del.dataset.delAppt, 'Cita eliminada'); toast('Cita eliminada'); render(); }); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) { const [date, time] = slot.dataset.slot.split('|'); openAppointmentModal(null, { date, time, dentistId: agendaState.dentist }, render); }
    });
    el.addEventListener('change', (e) => {
      const st = e.target.dataset.status;
      if (st) { DB.update('appointments', st, { status: e.target.value }, `Cita marcada como ${DB.APPT_STATUS[e.target.value]}`); toast('Estado actualizado'); render(); }
    });
    render();
  };

  /* =====================================================================
     TRATAMIENTOS
     ===================================================================== */
  const treatments = (el) => {
    let q = ''; let cat = '';
    const modal = (t) => openModal({
      title: t ? 'Editar tratamiento' : 'Nuevo tratamiento',
      body: `<div class="form-grid">
        <label class="field full"><span>Nombre <span class="req">*</span></span><input name="name" required value="${esc(t && t.name)}"></label>
        <label class="field">Categoría<select name="category">${options(DB.TREATMENT_CATEGORIES.map((c) => ({ id: c })), t ? t.category : 'Operatoria', (x) => x.id)}</select></label>
        <label class="field">Duración (min)<input type="number" name="duration" min="5" step="5" value="${t ? t.duration : 30}"></label>
        <label class="field full"><span>Precio <span class="req">*</span></span><input type="number" name="price" min="0" required value="${t ? t.price : ''}"></label>
        <label class="field full">Descripción<textarea name="description">${esc(t && t.description)}</textarea></label></div>`,
      onSubmit: (data) => {
        data.price = Number(data.price); data.duration = Number(data.duration);
        if (t) DB.update('treatments', t.id, data, `Tratamiento "${data.name}" actualizado`); else DB.insert('treatments', data, `Tratamiento "${data.name}" creado`);
        toast('Catálogo actualizado'); render();
      },
    });
    const render = () => {
      const list = DB.all('treatments').filter((t) => (!q || t.name.toLowerCase().includes(q.toLowerCase())) && (!cat || t.category === cat)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      el.querySelector('[data-body]').innerHTML = list.map((t) => `<tr><td><strong>${esc(t.name)}</strong>${t.description ? `<br><small class="muted">${esc(t.description)}</small>` : ''}</td><td><span class="badge b-muted">${esc(t.category)}</span></td><td>${t.duration} min</td><td class="num money">${money(t.price)}</td>
        <td><div class="act">${can('catalog') ? `<button data-edit="${t.id}">${icon('edit')}</button><button class="del" data-del="${t.id}">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin tratamientos</td></tr>';
    };
    el.innerHTML = `${pageHead('Catálogo de tratamientos', 'Precios y duraciones de referencia', can('catalog') ? `<button class="btn btn-primary" data-new>${icon('plus')}Nuevo tratamiento</button>` : '')}
      <div class="card"><div class="toolbar"><input class="grow" data-q placeholder="Buscar tratamiento…"><select data-cat><option value="">Todas las categorías</option>${DB.TREATMENT_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>Tratamiento</th><th>Categoría</th><th>Duración</th><th class="num">Precio</th><th></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; render(); });
    el.querySelector('[data-cat]').addEventListener('change', (e) => { cat = e.target.value; render(); });
    const nb = el.querySelector('[data-new]'); if (nb) nb.addEventListener('click', () => modal(null));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) modal(DB.get('treatments', b.dataset.edit));
      if (b.dataset.del) { const t = DB.get('treatments', b.dataset.del); confirmDialog(`¿Eliminar "${t.name}" del catálogo?`, () => { DB.remove('treatments', t.id, `Tratamiento "${t.name}" eliminado`); render(); }); }
    });
    render();
  };

  /* =====================================================================
     PRESUPUESTOS
     ===================================================================== */
  const budgets = (el) => {
    let q = ''; let status = '';
    let current = [];
    const render = () => {
      current = DB.all('budgets').filter((b) => {
        const p = patientById(b.patientId);
        return (!status || b.status === status) && (!q || `${fullName(p)} ${b.number}`.toLowerCase().includes(q.toLowerCase()));
      }).sort((a, b) => b.number - a.number);
      el.querySelector('[data-body]').innerHTML = current.map((b) => {
        const paid = DB.all('payments').filter((x) => x.budgetId === b.id).reduce((s, x) => s + Number(x.amount), 0);
        const total = DB.budgetTotal(b);
        return `<tr><td><strong>#${b.number}</strong></td><td>${patientCell(patientById(b.patientId))}</td><td>${esc(userName(b.dentistId))}</td>
          <td class="num money">${money(total)}</td><td class="num">${money(paid)}<br><small class="muted">${total ? Math.round(paid / total * 100) : 0}%</small></td>
          <td><select class="badge-select" data-status="${b.id}">${options(Object.keys(DB.BUDGET_STATUS).map((k) => ({ id: k })), b.status, (x) => DB.BUDGET_STATUS[x.id])}</select></td>
          <td class="muted">${fmtDate(b.date)}</td>
          <td><div class="act"><button title="Editar" data-edit="${b.id}">${icon('edit')}</button><button title="Imprimir" data-print="${b.id}">${icon('print')}</button>${can('delete') ? `<button class="del" title="Eliminar" data-del="${b.id}">${icon('trash')}</button>` : ''}</div></td></tr>`;
      }).join('') || '<tr><td colspan="8" class="empty">Sin presupuestos</td></tr>';
    };
    el.innerHTML = `${pageHead('Presupuestos', 'Planes de tratamiento y su seguimiento', `<button class="btn" data-csv>${icon('download')}CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Nuevo presupuesto</button>`)}
      <div class="card"><div class="toolbar"><input class="grow" data-q placeholder="Buscar por paciente o número…"><select data-st><option value="">Todos los estados</option>${Object.entries(DB.BUDGET_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>N°</th><th>Paciente</th><th>Profesional</th><th class="num">Total</th><th class="num">Cobrado</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; render(); });
    el.querySelector('[data-st]').addEventListener('change', (e) => { status = e.target.value; render(); });
    el.querySelector('[data-new]').addEventListener('click', () => openBudgetModal(null, {}, render));
    el.querySelector('[data-csv]').addEventListener('click', () => downloadFile('presupuestos.csv', toCSV(current, [
      { label: 'Número', value: (b) => b.number }, { label: 'Paciente', value: (b) => fullName(patientById(b.patientId)) }, { label: 'Profesional', value: (b) => userName(b.dentistId) },
      { label: 'Total', value: (b) => DB.budgetTotal(b) }, { label: 'Estado', value: (b) => DB.BUDGET_STATUS[b.status] }, { label: 'Fecha', value: (b) => b.date },
    ]), 'text/csv;charset=utf-8'));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) openBudgetModal(DB.get('budgets', b.dataset.edit), {}, render);
      if (b.dataset.print) printBudget(DB.get('budgets', b.dataset.print));
      if (b.dataset.del) { const bud = DB.get('budgets', b.dataset.del); confirmDialog(`¿Eliminar el presupuesto #${bud.number}?`, () => { DB.remove('budgets', bud.id, `Presupuesto #${bud.number} eliminado`); render(); }); }
    });
    el.querySelector('[data-body]').addEventListener('change', (e) => {
      const id = e.target.dataset.status; if (!id) return;
      const b = DB.get('budgets', id);
      DB.update('budgets', id, { status: e.target.value }, `Presupuesto #${b.number}: ${DB.BUDGET_STATUS[e.target.value]}`);
      toast('Estado actualizado'); render();
    });
    render();
  };

  /* =====================================================================
     PAGOS
     ===================================================================== */
  const payments = (el) => {
    const now = new Date();
    let from = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    let to = isoDate(now);
    let method = '';
    let current = [];
    const render = () => {
      current = DB.all('payments').filter((x) => x.date >= from && x.date <= to && (!method || x.method === method)).sort((a, b) => b.date.localeCompare(a.date));
      el.querySelector('[data-total]').textContent = money(current.reduce((s, x) => s + Number(x.amount), 0));
      el.querySelector('[data-body]').innerHTML = current.map((x) => `<tr><td>${fmtDate(x.date)}</td><td>${patientCell(patientById(x.patientId))}</td><td>${esc(x.concept)}</td><td><span class="badge b-muted">${esc(x.method)}</span></td><td class="num money">${money(x.amount)}</td><td class="muted">${esc(x.receipt)}</td>
        <td><div class="act"><button title="Imprimir recibo" data-print="${x.id}">${icon('print')}</button>${can('delete') ? `<button class="del" data-del="${x.id}">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sin pagos en el período</td></tr>';
    };
    el.innerHTML = `${pageHead('Pagos', 'Cobros registrados', `<button class="btn" data-csv>${icon('download')}Exportar CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Registrar pago</button>`)}
      <div class="card"><div class="toolbar">
        <label class="field">Desde<input type="date" data-from value="${from}"></label>
        <label class="field">Hasta<input type="date" data-to value="${to}"></label>
        <label class="field">Método<select data-method><option value="">Todos</option>${DB.PAYMENT_METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label>
        <div style="margin-left:auto;text-align:right;background:var(--primary-50);padding:10px 16px;border-radius:12px"><small class="muted">Total del período</small><div class="money" style="font-size:22px" data-total></div></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th>Recibo</th><th></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-from]').addEventListener('change', (e) => { from = e.target.value; render(); });
    el.querySelector('[data-to]').addEventListener('change', (e) => { to = e.target.value; render(); });
    el.querySelector('[data-method]').addEventListener('change', (e) => { method = e.target.value; render(); });
    el.querySelector('[data-new]').addEventListener('click', () => openPaymentModal({}, render));
    el.querySelector('[data-csv]').addEventListener('click', () => downloadFile(`pagos_${from}_${to}.csv`, toCSV(current, [
      { label: 'Fecha', value: (x) => x.date }, { label: 'Paciente', value: (x) => fullName(patientById(x.patientId)) }, { label: 'Concepto', value: (x) => x.concept },
      { label: 'Método', value: (x) => x.method }, { label: 'Monto', value: (x) => x.amount }, { label: 'Recibo', value: (x) => x.receipt },
    ]), 'text/csv;charset=utf-8'));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.print) printReceipt(DB.get('payments', b.dataset.print));
      if (b.dataset.del) confirmDialog('¿Anular este pago?', () => { const x = DB.get('payments', b.dataset.del); DB.remove('payments', x.id, `Pago ${x.receipt} de ${money(x.amount)} anulado`); toast('Pago anulado'); render(); }, 'Anular');
    });
    render();
  };

  /* =====================================================================
     REPORTES
     ===================================================================== */
  const reports = (el) => {
    const now = new Date();
    let from = isoDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    let to = isoDate(now);
    let tab = 'ingresos';
    const render = () => {
      const pays = DB.all('payments').filter((x) => x.date >= from && x.date <= to);
      const appts = DB.all('appointments').filter((a) => a.date >= from && a.date <= to);
      const total = pays.reduce((s, x) => s + Number(x.amount), 0);
      let html = '';
      if (tab === 'ingresos') {
        const byMonth = {};
        pays.forEach((x) => { const k = x.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + Number(x.amount); });
        const months = []; let d = parseDate(from.slice(0, 7) + '-01');
        while (isoDate(d) <= to) { months.push(isoDate(d).slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
        const max = Math.max(1, ...months.map((m) => byMonth[m] || 0));
        const byMethod = {}; pays.forEach((x) => { byMethod[x.method] = (byMethod[x.method] || 0) + Number(x.amount); });
        const maxM = Math.max(1, ...Object.values(byMethod));
        html = `<div class="zone zone-info" style="margin-bottom:16px"><div class="grow"><p>Ingresos del período</p><h2 style="font-size:30px">${money(total)}</h2><p>${pays.length} pagos · ticket promedio ${money(pays.length ? total / pays.length : 0)}</p></div></div>
          <div class="grid grid-2"><div class="card card-pad"><h3 style="font-size:14px">Ingresos por mes</h3>
            <div class="bars">${months.map((m) => `<div class="bar"><small>${byMonth[m] ? money(byMonth[m] / 1000) + 'k' : ''}</small><div style="height:${((byMonth[m] || 0) / max) * 80}%"></div><small>${parseDate(m + '-01').toLocaleDateString('es-AR', { month: 'short' })}</small></div>`).join('')}</div></div>
          <div class="card card-pad"><h3 style="font-size:14px;margin-bottom:14px">Por método de pago</h3>${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><div class="top"><span>${esc(k)}</span><strong>${money(v)}</strong></div><div class="track"><div style="width:${v / maxM * 100}%"></div></div></div>`).join('') || '<div class="empty">Sin datos</div>'}</div></div>`;
      } else if (tab === 'citas') {
        const counts = Object.fromEntries(Object.keys(DB.APPT_STATUS).map((k) => [k, appts.filter((a) => a.status === k).length]));
        const closed = counts.atendida + counts.ausente;
        html = `<div class="grid grid-4" style="margin-bottom:16px">
            <div class="card stat"><div class="ico" style="background:#0284c7">${icon('calendar')}</div><div><div class="val">${appts.length}</div><div class="lbl">Citas totales</div></div></div>
            <div class="card stat"><div class="ico" style="background:#16a34a">${icon('check')}</div><div><div class="val">${counts.atendida}</div><div class="lbl">Atendidas</div></div></div>
            <div class="card stat"><div class="ico" style="background:#e11d48">${icon('x')}</div><div><div class="val">${counts.ausente}</div><div class="lbl">Ausencias</div></div></div>
            <div class="card stat"><div class="ico" style="background:#d97706">${icon('activity')}</div><div><div class="val">${closed ? Math.round(counts.ausente / closed * 100) : 0}%</div><div class="lbl">Tasa de ausentismo</div></div></div></div>
          <div class="card card-pad"><h3 style="font-size:14px;margin-bottom:14px">Citas por profesional</h3>${dentists().map((u) => { const n = appts.filter((a) => a.dentistId === u.id).length; return `<div class="hbar"><div class="top"><span>${esc(u.firstName)} ${esc(u.lastName)}</span><strong>${n}</strong></div><div class="track"><div style="width:${appts.length ? n / appts.length * 100 : 0}%;background:${u.color}"></div></div></div>`; }).join('')}</div>`;
      } else if (tab === 'tratamientos') {
        const usage = {};
        DB.all('budgets').filter((b) => b.date >= from && b.date <= to && b.status !== 'rechazado').forEach((b) => b.items.forEach((it) => { usage[it.description] = usage[it.description] || { qty: 0, amount: 0 }; usage[it.description].qty += Number(it.qty); usage[it.description].amount += it.qty * it.price; }));
        const rows = Object.entries(usage).sort((a, b) => b[1].amount - a[1].amount);
        const max = Math.max(1, ...rows.map(([, v]) => v.amount));
        html = `<div class="card card-pad"><h3 style="font-size:14px;margin-bottom:14px">Tratamientos más presupuestados</h3>${rows.map(([k, v]) => `<div class="hbar"><div class="top"><span>${esc(k)} <small class="muted">×${v.qty}</small></span><strong>${money(v.amount)}</strong></div><div class="track"><div style="width:${v.amount / max * 100}%"></div></div></div>`).join('') || '<div class="empty">Sin datos en el período</div>'}</div>`;
      } else {
        const debtors = DB.all('patients').map((p) => ({ p, ...DB.patientBalance(p.id) })).filter((x) => x.balance > 0).sort((a, b) => b.balance - a.balance);
        const totalDebt = debtors.reduce((s, x) => s + x.balance, 0);
        html = `<div class="zone ${totalDebt ? 'zone-danger' : 'zone-info'}" style="margin-bottom:16px;${totalDebt ? 'background:linear-gradient(135deg,#f43f5e,#e11d48);color:#fff;border:0' : ''}"><div class="grow"><p>Deuda total de pacientes</p><h2 style="font-size:30px">${money(totalDebt)}</h2><p>${debtors.length} pacientes con saldo pendiente</p></div></div>
          <div class="card"><div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Teléfono</th><th class="num">Presupuestado</th><th class="num">Pagado</th><th class="num">Saldo</th></tr></thead><tbody>
          ${debtors.map((x) => `<tr><td>${patientCell(x.p)}</td><td>${esc(x.p.phone)}</td><td class="num">${money(x.charged)}</td><td class="num">${money(x.paid)}</td><td class="num money neg">${money(x.balance)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No hay deudas pendientes</td></tr>'}</tbody></table></div></div>`;
      }
      el.querySelector('[data-rep]').innerHTML = html;
      el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    };
    const quick = (k) => {
      const t = new Date();
      if (k === 'mes') { from = isoDate(new Date(t.getFullYear(), t.getMonth(), 1)); to = isoDate(t); }
      if (k === 'mesant') { from = isoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)); to = isoDate(new Date(t.getFullYear(), t.getMonth(), 0)); }
      if (k === 'trim') { from = isoDate(new Date(t.getFullYear(), t.getMonth() - 2, 1)); to = isoDate(t); }
      if (k === 'anio') { from = `${t.getFullYear()}-01-01`; to = isoDate(t); }
      el.querySelector('[data-from]').value = from; el.querySelector('[data-to]').value = to;
      render();
    };
    el.innerHTML = `${pageHead('Reportes', 'Indicadores de la clínica')}
      <div class="tabs">${[['ingresos', 'Ingresos'], ['citas', 'Citas'], ['tratamientos', 'Tratamientos'], ['deudas', 'Deudas']].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="card" style="margin-bottom:16px"><div class="toolbar" style="border:0">
        <label class="field">Desde<input type="date" data-from value="${from}"></label><label class="field">Hasta<input type="date" data-to value="${to}"></label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-self:flex-end"><button class="btn btn-sm" data-q="mes">Este mes</button><button class="btn btn-sm" data-q="mesant">Mes anterior</button><button class="btn btn-sm" data-q="trim">Últimos 3 meses</button><button class="btn btn-sm" data-q="anio">Este año</button></div>
      </div></div>
      <div data-rep></div>`;
    el.querySelector('[data-from]').addEventListener('change', (e) => { from = e.target.value; render(); });
    el.querySelector('[data-to]').addEventListener('change', (e) => { to = e.target.value; render(); });
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tab) { tab = b.dataset.tab; render(); } if (b.dataset.q) quick(b.dataset.q); });
    render();
  };

  /* =====================================================================
     USUARIOS
     ===================================================================== */
  const users = (el) => {
    const COLORS = ['#0d9488', '#0284c7', '#7c3aed', '#d97706', '#db2777', '#16a34a', '#475569'];
    const modal = (u) => openModal({
      title: u ? 'Editar usuario' : 'Nuevo usuario',
      body: `<div class="form-grid">
        <label class="field"><span>Nombre <span class="req">*</span></span><input name="firstName" required value="${esc(u && u.firstName)}"></label>
        <label class="field"><span>Apellido <span class="req">*</span></span><input name="lastName" required value="${esc(u && u.lastName)}"></label>
        <label class="field full"><span>Email <span class="req">*</span></span><input type="email" name="email" required value="${esc(u && u.email)}"></label>
        <label class="field">Contraseña ${u ? '<small class="muted">(vacío = no cambiar)</small>' : '<span class="req">*</span>'}<input type="password" name="password" ${u ? '' : 'required'} autocomplete="new-password"></label>
        <label class="field">Teléfono<input name="phone" value="${esc(u && u.phone)}"></label>
        <label class="field">Rol<select name="role">${options(Object.keys(DB.ROLES).map((k) => ({ id: k })), u ? u.role : 'odontologo', (x) => DB.ROLES[x.id])}</select></label>
        <label class="field">Especialidad<select name="specialty"><option value="">—</option>${options(DB.SPECIALTIES.map((s) => ({ id: s })), u && u.specialty, (x) => x.id)}</select></label>
        <label class="field">Color en agenda<select name="color">${COLORS.map((c) => `<option value="${c}" ${u && u.color === c ? 'selected' : ''} style="color:${c}">■ ${c}</option>`).join('')}</select></label>
        <label class="field">Estado<select name="active"><option value="1" ${!u || u.active ? 'selected' : ''}>Activo</option><option value="0" ${u && !u.active ? 'selected' : ''}>Inactivo</option></select></label></div>`,
      onSubmit: (data) => {
        if (DB.all('users').some((x) => x.email.toLowerCase() === data.email.toLowerCase() && (!u || x.id !== u.id))) { toast('Ya existe un usuario con ese email', 'err'); return false; }
        data.active = data.active === '1';
        if (u && u.id === App.user().id && (!data.active || data.role !== 'admin')) { toast('No podés quitarte el rol de administrador ni desactivarte', 'err'); return false; }
        if (!data.password) delete data.password;
        if (u) DB.update('users', u.id, data, `Usuario ${data.email} actualizado`); else DB.insert('users', data, `Usuario ${data.email} creado`);
        toast('Usuario guardado'); render();
      },
    });
    const render = () => {
      el.querySelector('[data-body]').innerHTML = DB.all('users').map((u) => `<tr>
        <td><div class="cell-user"><div class="avatar sm" style="background:${u.color}">${esc(initials(u.firstName, u.lastName))}</div><div><strong>${esc(u.firstName)} ${esc(u.lastName)}</strong><small>${esc(u.phone)}</small></div></div></td>
        <td>${esc(u.email)}</td><td><span class="badge ${u.role === 'admin' ? 'b-violet' : u.role === 'odontologo' ? 'b-info' : 'b-muted'}">${DB.ROLES[u.role]}</span></td>
        <td>${esc(u.specialty) || '<span class="muted">—</span>'}</td><td>${u.active ? '<span class="badge b-ok">Activo</span>' : '<span class="badge b-muted">Inactivo</span>'}</td>
        <td><div class="act"><button data-edit="${u.id}">${icon('edit')}</button>${u.id !== App.user().id ? `<button class="del" data-del="${u.id}">${icon('trash')}</button>` : ''}</div></td></tr>`).join('');
    };
    el.innerHTML = `${pageHead('Usuarios', 'Profesionales y personal con acceso al sistema', `<button class="btn btn-primary" data-new>${icon('plus')}Nuevo usuario</button>`)}
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Especialidad</th><th>Estado</th><th></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-new]').addEventListener('click', () => modal(null));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) modal(DB.get('users', b.dataset.edit));
      if (b.dataset.del) { const u = DB.get('users', b.dataset.del); confirmDialog(`¿Eliminar al usuario ${u.email}?`, () => { DB.remove('users', u.id, `Usuario ${u.email} eliminado`); render(); }); }
    });
    render();
  };

  /* =====================================================================
     REGISTRO DE ACTIVIDAD
     ===================================================================== */
  const activity = (el) => {
    let mod = ''; let who = '';
    const ACTION_BADGE = { crear: 'b-ok', editar: 'b-info', eliminar: 'b-danger', login: 'b-violet', logout: 'b-muted', exportar: 'b-warn', restaurar: 'b-warn', reiniciar: 'b-danger' };
    const render = () => {
      const list = DB.all('activity').filter((a) => (!mod || a.module === mod) && (!who || a.userId === who));
      el.querySelector('[data-body]').innerHTML = list.slice(0, 300).map((a) => {
        const u = DB.get('users', a.userId);
        return `<tr><td class="muted" style="white-space:nowrap">${fmtDateTime(a.date)}</td><td>${u ? `${esc(u.firstName)} ${esc(u.lastName)}` : '<span class="muted">—</span>'}</td><td><span class="badge ${ACTION_BADGE[a.action] || 'b-muted'}">${esc(a.action)}</span></td><td>${esc(a.module)}</td><td>${esc(a.detail)}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="empty">Sin actividad registrada</td></tr>';
    };
    const modules = [...new Set(DB.all('activity').map((a) => a.module))].sort();
    el.innerHTML = `${pageHead('Registro de actividad', 'Auditoría de todas las acciones realizadas en el sistema')}
      <div class="card"><div class="toolbar"><select data-mod><option value="">Todos los módulos</option>${modules.map((m) => `<option>${esc(m)}</option>`).join('')}</select>
      <select data-who><option value="">Todos los usuarios</option>${options(DB.all('users'), '', (u) => `${u.firstName} ${u.lastName}`)}</select></div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-mod]').addEventListener('change', (e) => { mod = e.target.value; render(); });
    el.querySelector('[data-who]').addEventListener('change', (e) => { who = e.target.value; render(); });
    render();
  };

  /* =====================================================================
     CONFIGURACIÓN Y RESPALDO
     ===================================================================== */
  const settings = (el) => {
    const s = DB.settings();
    el.innerHTML = `${pageHead('Configuración', 'Datos de la clínica, horarios y respaldo de información')}
      <form class="card" data-form style="margin-bottom:16px">
        <div class="card-head"><h3>Datos de la clínica</h3></div>
        <div class="card-body form-grid">
          <label class="field full">Nombre de la clínica<input name="clinicName" value="${esc(s.clinicName)}" required></label>
          <label class="field">CUIT<input name="taxId" value="${esc(s.taxId)}"></label>
          <label class="field">Teléfono<input name="phone" value="${esc(s.phone)}"></label>
          <label class="field">Email<input name="email" value="${esc(s.email)}"></label>
          <label class="field">Dirección<input name="address" value="${esc(s.address)}"></label>
        </div>
        <div class="card-head" style="border-top:1px solid var(--border)"><h3>Horario de atención</h3></div>
        <div class="card-body form-grid">
          <label class="field">Apertura<input type="time" name="openTime" value="${esc(s.openTime)}"></label>
          <label class="field">Cierre<input type="time" name="closeTime" value="${esc(s.closeTime)}"></label>
          <label class="field">Días de atención<input name="workDays" value="${esc(s.workDays)}"></label>
          <label class="field">Duración de turno por defecto (min)<input type="number" name="slotMinutes" value="${esc(s.slotMinutes)}"></label>
          <label class="field full">Pie de recibos y presupuestos<input name="receiptFooter" value="${esc(s.receiptFooter)}"></label>
        </div>
        <div class="modal-foot" style="position:static"><button class="btn btn-primary" type="submit">${icon('check')}Guardar configuración</button></div>
      </form>

      <div class="stack">
        <div class="zone zone-info"><div class="grow"><h4>Copia de seguridad</h4><p>Descargá un archivo con toda la información del sistema: pacientes, citas, presupuestos, pagos, odontogramas y usuarios.</p></div><button class="btn" data-backup>${icon('download')}Descargar respaldo</button></div>
        <div class="zone zone-warn"><div class="grow"><h4>Restaurar sistema</h4><p>Reemplaza TODOS los datos actuales por los de un archivo de respaldo.</p></div><label class="btn">${icon('upload')}Elegir archivo<input type="file" accept="application/json,.json" data-restore hidden></label></div>
        <div class="zone zone-danger"><div class="grow"><h4>Reiniciar sistema para nueva clínica</h4><p>Borra pacientes, citas, presupuestos, pagos y usuarios (excepto el tuyo). El catálogo de tratamientos se conserva.</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-demo>Restaurar datos de ejemplo</button><button class="btn btn-danger" data-wipe>Reiniciar</button></div></div>
      </div>`;
    el.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      data.slotMinutes = Number(data.slotMinutes) || 30;
      if (data.openTime >= data.closeTime) { toast('El horario de cierre debe ser posterior a la apertura', 'err'); return; }
      DB.saveSettings(data); toast('Configuración guardada'); App.render();
    });
    el.querySelector('[data-backup]').addEventListener('click', () => {
      downloadFile(`respaldo-dentagest-${isoDate()}.json`, DB.exportBackup(), 'application/json');
      DB.log('exportar', 'Respaldo', 'Copia de seguridad descargada');
      toast('Respaldo descargado');
    });
    el.querySelector('[data-restore]').addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => confirmDialog('Se reemplazarán todos los datos actuales. ¿Continuar?', () => {
        try { DB.importBackup(reader.result); toast('Sistema restaurado'); App.render(); } catch (err) { toast(err.message || 'Archivo inválido', 'err'); }
      }, 'Restaurar');
      reader.readAsText(file);
      e.target.value = '';
    });
    el.querySelector('[data-demo]').addEventListener('click', () => confirmDialog('Se reemplazarán los datos actuales por los datos de ejemplo. ¿Continuar?', () => { DB.resetDemo(); toast('Datos de ejemplo restaurados'); App.logout(); }, 'Restaurar'));
    el.querySelector('[data-wipe]').addEventListener('click', () => openModal({
      title: 'Reiniciar sistema', danger: true, submitLabel: 'Reiniciar definitivamente',
      body: `<p>Esta acción <strong>no se puede deshacer</strong>. Te recomendamos descargar un respaldo antes.</p><label class="field">Escribí <strong>REINICIAR</strong> para confirmar<input name="confirm" required autocomplete="off"></label>`,
      onSubmit: (data) => { if (data.confirm !== 'REINICIAR') { toast('Texto de confirmación incorrecto', 'err'); return false; } DB.wipeForNewClinic(); toast('Sistema reiniciado'); App.go('/'); },
    }));
  };

  window.Views = { dashboard, patients, patientDetail, agenda, treatments, budgets, payments, reports, users, activity, settings, openPatientModal };
})();
