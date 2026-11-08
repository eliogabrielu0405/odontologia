/* Pantallas de la aplicación. Cada vista recibe (contenedor, parámetros). */
(function () {
  const { icon, esc, money, isoDate, parseDate, addDays, fmtDate, fmtDateLong, fmtDateTime, ageFrom, initials, fullName, pad, toast, openModal, confirmDialog, downloadFile, toCSV } = U;

  /* ---------- Helpers compartidos ---------- */
  const userName = (id) => {
    const u = DB.get('users', id);
    if (!u) return '—';
    return u.role === 'odontologo' ? `Dr/a. ${u.firstName} ${u.lastName}` : `${u.firstName} ${u.lastName}`;
  };
  const dentists = () => DB.all('users').filter((u) => u.role === 'odontologo' && u.active);
  const patientById = (id) => DB.get('patients', id);
  const treatmentById = (id) => DB.get('treatments', id);
  const sortedPatients = () => [...DB.all('patients')].sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const options = (list, selected, label, value = (x) => x.id) =>
    list.map((x) => `<option value="${esc(value(x))}" ${value(x) === selected ? 'selected' : ''}>${esc(label(x))}</option>`).join('');

  const APPT_BADGE = { programada: 'b-info', confirmada: 'b-violet', atendida: 'b-ok', cancelada: 'b-muted', ausente: 'b-danger' };
  const BUDGET_BADGE = { pendiente: 'b-warn', aceptado: 'b-info', en_curso: 'b-violet', finalizado: 'b-ok', rechazado: 'b-danger' };
  const apptBadge = (s) => `<span class="badge ${APPT_BADGE[s] || 'b-muted'}">${esc(DB.APPT_STATUS[s] || s)}</span>`;
  const budgetBadge = (s) => `<span class="badge ${BUDGET_BADGE[s] || 'b-muted'}">${esc(DB.BUDGET_STATUS[s] || s)}</span>`;

  const avatarFor = (p) => `<div class="avatar sm">${esc(initials(p.firstName, p.lastName))}</div>`;
  const patientHref = (id, tab = 'info') => `#paciente-${id}${tab === 'info' ? '' : `-${tab}`}`;
  const patientCell = (p) => (p
    ? `<a href="${patientHref(p.id)}" class="cell-user">${avatarFor(p)}<div><strong>${esc(fullName(p))}</strong><small>DNI ${esc(p.dni)}</small></div></a>`
    : '<span class="muted">Paciente eliminado</span>');

  const pageHead = (title, subtitle, actions = '') =>
    `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;

  const statTile = (tone, ic, value, label) =>
    `<div class="card stat"><div class="ico ico-${tone}">${icon(ic)}</div><div><div class="val">${value}</div><div class="lbl">${label}</div></div></div>`;

  const ring = (value, total, color, label) => {
    const r = 42; const c = 2 * Math.PI * r;
    const pct = total ? Math.min(1, value / total) : 0;
    return `<div class="ring"><svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" fill="none" stroke-width="9" style="stroke:var(--track)"/><circle cx="50" cy="50" r="${r}" fill="none" stroke-width="9" stroke-linecap="round" style="stroke:${color}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(2)}"/></svg><span>${label}</span></div>`;
  };

  const can = (perm) => App.can(perm);
  const csvFile = (name, rows, columns, module) => {
    downloadFile(name, toCSV(rows, columns), 'text/csv;charset=utf-8');
    DB.log('exportar', module, `Exportación CSV (${rows.length} filas)`);
  };

  /* ---------- Formularios reutilizables ---------- */
  const patientForm = (p = {}) => `
    <div class="form-grid">
      <label class="field"><span>Nombre <span class="req">*</span></span><input name="firstName" required value="${esc(p.firstName)}" autocomplete="off"></label>
      <label class="field"><span>Apellido <span class="req">*</span></span><input name="lastName" required value="${esc(p.lastName)}" autocomplete="off"></label>
      <label class="field"><span>DNI <span class="req">*</span></span><input name="dni" required inputmode="numeric" value="${esc(p.dni)}"></label>
      <label class="field">Fecha de nacimiento<input type="date" name="birthDate" value="${esc(p.birthDate)}"></label>
      <label class="field">Sexo<select name="sex"><option value="">—</option>${options([{ id: 'F', n: 'Femenino' }, { id: 'M', n: 'Masculino' }, { id: 'X', n: 'Otro' }], p.sex, (x) => x.n)}</select></label>
      <label class="field"><span>Teléfono <span class="req">*</span></span><input name="phone" required inputmode="tel" value="${esc(p.phone)}"></label>
      <label class="field full">Email<input type="email" name="email" value="${esc(p.email)}"></label>
      <label class="field full">Dirección<input name="address" value="${esc(p.address)}"></label>
      <label class="field">Obra social / prepaga<input name="insurance" value="${esc(p.insurance)}" placeholder="Particular"></label>
      <label class="field">N.º de afiliado<input name="insuranceNumber" value="${esc(p.insuranceNumber)}"></label>
      <label class="field">Alergias<input name="allergies" value="${esc(p.allergies)}" placeholder="Ninguna conocida"></label>
      <label class="field">Medicación actual<input name="medications" value="${esc(p.medications)}"></label>
      <label class="field full">Antecedentes médicos<input name="conditions" value="${esc(p.conditions)}" placeholder="Diabetes, hipertensión, embarazo…"></label>
      <label class="field full">Observaciones<textarea name="notes">${esc(p.notes)}</textarea></label>
    </div>`;

  const openPatientModal = (p, after) => openModal({
    title: p ? 'Editar paciente' : 'Nuevo paciente', size: 'lg', body: patientForm(p || {}),
    submitLabel: p ? 'Guardar cambios' : 'Crear paciente',
    onSubmit: (data) => {
      const dni = data.dni.trim();
      const dup = DB.all('patients').find((x) => String(x.dni) === dni && (!p || x.id !== p.id));
      if (dup) { toast(`Ya existe un paciente con el DNI ${dni}: ${fullName(dup)}.`, 'err'); return false; }
      const record = { ...data, dni };
      if (p) {
        if (!DB.update('patients', p.id, record, `Paciente ${record.lastName}, ${record.firstName} actualizado`)) return undefined;
        toast('Paciente actualizado');
        if (after) after(p.id);
      } else {
        const created = DB.insert('patients', { ...record, createdAt: isoDate() }, `Paciente ${record.lastName}, ${record.firstName} creado`);
        if (!created) return undefined;
        toast('Paciente creado');
        if (after) after(created.id);
      }
      return undefined;
    },
  });

  const openAppointmentModal = (appt, preset = {}, after) => {
    const a = appt || { date: preset.date || isoDate(), time: preset.time || '09:00', duration: 30, status: 'programada', patientId: preset.patientId || '', dentistId: preset.dentistId || '' };
    openModal({
      title: appt ? 'Editar cita' : 'Nueva cita',
      body: `<div class="form-grid">
        <label class="field full"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Elegí un paciente</option>${options(sortedPatients(), a.patientId, fullName)}</select></label>
        <label class="field full"><span>Odontólogo/a <span class="req">*</span></span><select name="dentistId" required><option value="">Elegí un profesional</option>${options(dentists(), a.dentistId, (u) => `${u.firstName} ${u.lastName} · ${u.specialty}`)}</select></label>
        <label class="field"><span>Fecha <span class="req">*</span></span><input type="date" name="date" required value="${esc(a.date)}"></label>
        <label class="field"><span>Hora <span class="req">*</span></span><input type="time" name="time" required step="900" value="${esc(a.time)}"></label>
        <label class="field">Duración<select name="duration">${options([15, 30, 45, 60, 90, 120].map((m) => ({ id: String(m) })), String(a.duration), (x) => `${x.id} min`)}</select></label>
        <label class="field">Estado<select name="status">${options(Object.keys(DB.APPT_STATUS).map((k) => ({ id: k })), a.status, (x) => DB.APPT_STATUS[x.id])}</select></label>
        <label class="field full">Motivo / tratamiento<select name="treatmentId"><option value="">Consulta general</option>${options(DB.all('treatments'), a.treatmentId, (t) => t.name)}</select></label>
        <label class="field full">Notas<textarea name="notes">${esc(a.notes)}</textarea></label>
      </div>`,
      submitLabel: appt ? 'Guardar cambios' : 'Crear cita',
      onSubmit: (data) => {
        const record = { ...data, duration: Number(data.duration) };
        const clash = DB.all('appointments').find((x) => x.id !== (appt && appt.id) && x.dentistId === record.dentistId && x.date === record.date && x.time === record.time && x.status !== 'cancelada');
        if (clash) { toast(`${userName(record.dentistId)} ya tiene una cita el ${fmtDate(record.date)} a las ${record.time}.`, 'err'); return false; }
        const p = patientById(record.patientId);
        if (appt) { if (DB.update('appointments', appt.id, record, `Cita de ${fullName(p)} actualizada`)) toast('Cita actualizada'); }
        else if (DB.insert('appointments', record, `Cita para ${fullName(p)} el ${fmtDate(record.date)} a las ${record.time}`)) toast('Cita creada');
        if (after) after();
        return undefined;
      },
    });
  };

  const openPaymentModal = (preset = {}, after) => {
    const patientBudgets = (pid) => DB.all('budgets').filter((b) => b.patientId === pid && b.status !== 'rechazado');
    openModal({
      title: 'Registrar pago',
      body: `<div class="form-grid">
        <label class="field full"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Elegí un paciente</option>${options(sortedPatients(), preset.patientId, fullName)}</select></label>
        <label class="field full">Presupuesto asociado<select name="budgetId"></select></label>
        <label class="field"><span>Monto <span class="req">*</span></span><input type="number" name="amount" min="1" step="1" inputmode="numeric" required></label>
        <label class="field"><span>Fecha <span class="req">*</span></span><input type="date" name="date" required value="${isoDate()}"></label>
        <label class="field full">Método de pago<select name="method">${options(DB.PAYMENT_METHODS.map((m) => ({ id: m })), 'Efectivo', (x) => x.id)}</select></label>
        <label class="field full">Concepto<input name="concept" placeholder="Seña, cuota, pago total…"></label>
      </div>`,
      submitLabel: 'Registrar pago',
      onMount: (form) => {
        const fill = () => {
          const pid = form.patientId.value;
          const list = pid ? patientBudgets(pid) : [];
          form.budgetId.innerHTML = '<option value="">Sin presupuesto (pago a cuenta)</option>' + list.map((b) => `<option value="${b.id}" ${preset.budgetId === b.id ? 'selected' : ''}>#${b.number} · ${money(DB.budgetTotal(b))} · ${DB.BUDGET_STATUS[b.status]}</option>`).join('');
          const balance = pid ? DB.patientBalance(pid).balance : 0;
          form.amount.placeholder = balance > 0 ? `Saldo pendiente: ${money(balance)}` : '';
        };
        form.patientId.addEventListener('change', fill);
        fill();
      },
      onSubmit: (data) => {
        const amount = Number(data.amount);
        if (!(amount > 0)) { toast('Ingresá un monto mayor a cero.', 'err'); return false; }
        const b = data.budgetId ? DB.get('budgets', data.budgetId) : null;
        const record = { ...data, amount, concept: data.concept || (b ? `Pago presupuesto #${b.number}` : 'Pago a cuenta'), receipt: DB.nextReceipt() };
        const p = patientById(record.patientId);
        if (DB.insert('payments', record, `Pago de ${money(amount)} de ${fullName(p)}`)) toast(`Pago registrado · recibo ${record.receipt}`);
        if (after) after();
        return undefined;
      },
    });
  };

  const openBudgetModal = (budget, preset = {}, after) => {
    const b = budget ? JSON.parse(JSON.stringify(budget)) : { patientId: preset.patientId || '', dentistId: '', date: isoDate(), status: 'pendiente', discount: 0, notes: '', items: [] };
    const treatments = DB.all('treatments');
    openModal({
      title: budget ? `Editar presupuesto #${budget.number}` : 'Nuevo presupuesto', size: 'lg',
      body: `<div class="form-grid">
        <label class="field"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Elegí un paciente</option>${options(sortedPatients(), b.patientId, fullName)}</select></label>
        <label class="field"><span>Odontólogo/a <span class="req">*</span></span><select name="dentistId" required><option value="">Elegí un profesional</option>${options(dentists(), b.dentistId, (u) => `${u.firstName} ${u.lastName}`)}</select></label>
        <label class="field">Fecha<input type="date" name="date" value="${esc(b.date)}"></label>
        <label class="field">Estado<select name="status">${options(Object.keys(DB.BUDGET_STATUS).map((k) => ({ id: k })), b.status, (x) => DB.BUDGET_STATUS[x.id])}</select></label>
        <div class="full stack">
          <div class="item-adder">
            <label class="field grow">Agregar tratamiento<select data-add-t><option value="">Elegí del catálogo…</option>${options(treatments, '', (t) => `${t.name} — ${money(t.price)}`)}</select></label>
            <label class="field tooth-input">Pieza<input data-add-tooth placeholder="Ej: 16" inputmode="numeric"></label>
            <button type="button" class="btn" data-add-item>${icon('plus')}Agregar</button>
          </div>
          <div class="table-wrap card flat"><table><thead><tr><th>Tratamiento</th><th>Pieza</th><th>Cant.</th><th>Precio</th><th class="num">Subtotal</th><th><span class="sr-only">Quitar</span></th></tr></thead><tbody data-items></tbody></table></div>
        </div>
        <label class="field">Descuento (%)<input type="number" name="discount" min="0" max="100" value="${esc(b.discount)}"></label>
        <div class="field total-field"><span class="muted">Total</span><strong data-total></strong></div>
        <label class="field full">Observaciones<textarea name="notes">${esc(b.notes)}</textarea></label>
      </div>`,
      submitLabel: budget ? 'Guardar cambios' : 'Crear presupuesto',
      onMount: (form) => {
        const tbody = form.querySelector('[data-items]');
        const totalEl = form.querySelector('[data-total]');
        const paintTotal = () => { totalEl.textContent = money(DB.budgetTotal({ items: b.items, discount: form.discount.value })); };
        const paint = () => {
          tbody.innerHTML = b.items.length ? b.items.map((it, i) => `<tr>
              <td>${esc(it.description)}</td>
              <td><input data-i="${i}" data-k="tooth" value="${esc(it.tooth)}" class="cell-input sm" aria-label="Pieza"></td>
              <td><input type="number" min="1" data-i="${i}" data-k="qty" value="${it.qty}" class="cell-input sm" aria-label="Cantidad"></td>
              <td><input type="number" min="0" data-i="${i}" data-k="price" value="${it.price}" class="cell-input" aria-label="Precio"></td>
              <td class="num money">${money(it.qty * it.price)}</td>
              <td><div class="act"><button type="button" class="del" data-rm="${i}" aria-label="Quitar">${icon('trash')}</button></div></td></tr>`).join('')
            : '<tr><td colspan="6" class="empty">Agregá tratamientos desde el catálogo.</td></tr>';
          paintTotal();
        };
        form.querySelector('[data-add-item]').addEventListener('click', () => {
          const select = form.querySelector('[data-add-t]');
          const t = treatmentById(select.value);
          if (!t) { toast('Elegí un tratamiento del catálogo.', 'err'); return; }
          const toothInput = form.querySelector('[data-add-tooth]');
          b.items.push({ treatmentId: t.id, description: t.name, qty: 1, price: t.price, tooth: toothInput.value.trim() });
          select.value = ''; toothInput.value = '';
          paint();
        });
        tbody.addEventListener('input', (e) => {
          const el = e.target; const i = el.dataset.i;
          if (i === undefined) return;
          b.items[i][el.dataset.k] = el.dataset.k === 'tooth' ? el.value : Number(el.value);
          el.closest('tr').querySelector('.money').textContent = money(b.items[i].qty * b.items[i].price);
          paintTotal();
        });
        tbody.addEventListener('click', (e) => { const rm = e.target.closest('[data-rm]'); if (rm) { b.items.splice(Number(rm.dataset.rm), 1); paint(); } });
        form.discount.addEventListener('input', paintTotal);
        paint();
      },
      onSubmit: (data) => {
        if (!b.items.length) { toast('Agregá al menos un tratamiento.', 'err'); return false; }
        const record = { ...data, discount: Math.min(100, Math.max(0, Number(data.discount) || 0)), items: b.items };
        const p = patientById(record.patientId);
        if (budget) { if (DB.update('budgets', budget.id, record, `Presupuesto #${budget.number} actualizado`)) toast('Presupuesto actualizado'); }
        else {
          const number = DB.nextBudgetNumber();
          if (DB.insert('budgets', { ...record, number }, `Presupuesto #${number} para ${fullName(p)}`)) toast(`Presupuesto #${number} creado`);
        }
        if (after) after();
        return undefined;
      },
    });
  };

  /* ---------- Documentos: presupuesto y recibo ---------- */
  const DOC_CSS = 'body{font-family:Figtree,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#10201e;background:#ffffff;margin:0;padding:32px}'
    + '.doc{max-width:760px;margin:0 auto;display:grid;gap:16px}.doc-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-bottom:14px;border-bottom:3px solid #0d9488}'
    + '.doc-brand{font-size:20px;font-weight:800;display:block;color:#0f766e}small{color:#5d7370;display:block}.doc-num{text-align:right}'
    + '.doc-num span{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#5d7370;font-weight:700}.doc-num strong{font-size:18px;display:block}'
    + '.doc-meta{display:grid;grid-template-columns:110px 1fr;gap:6px 12px;margin:0}.doc-meta dt{color:#5d7370}.doc-meta dd{margin:0;font-weight:600}'
    + 'table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #dce6e4;text-align:left}th{background:#f5f8f8;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5d7370}'
    + '.num{text-align:right}.doc-total{text-align:right;display:grid;gap:4px;justify-items:end}.doc-total strong{font-size:22px;color:#0f766e}'
    + '.doc-amount{font-size:34px;font-weight:800;color:#0f766e}.doc-foot{color:#5d7370;font-size:12.5px;margin:0}p{margin:0}@media print{body{padding:0}}';

  const clinicLine = (s) => [s.address, s.phone, s.email, s.taxId ? `CUIT ${s.taxId}` : ''].filter(Boolean).map(esc).join(' · ');

  const budgetDoc = (b) => {
    const s = DB.settings(); const p = patientById(b.patientId);
    const subtotal = b.items.reduce((acc, it) => acc + it.qty * it.price, 0);
    return `
      <header class="doc-head"><div><strong class="doc-brand">${esc(s.clinicName)}</strong><small>${clinicLine(s)}</small></div>
        <div class="doc-num"><span>Presupuesto</span><strong>N.º ${b.number}</strong><small>${fmtDate(b.date)}</small></div></header>
      <dl class="doc-meta"><dt>Paciente</dt><dd>${esc(fullName(p))}${p ? ` · DNI ${esc(p.dni)}` : ''}</dd><dt>Profesional</dt><dd>${esc(userName(b.dentistId))}</dd><dt>Estado</dt><dd>${esc(DB.BUDGET_STATUS[b.status])}</dd></dl>
      <div class="table-wrap"><table><thead><tr><th>Tratamiento</th><th>Pieza</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${b.items.map((it) => `<tr><td>${esc(it.description)}</td><td>${esc(it.tooth || '—')}</td><td class="num">${it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.qty * it.price)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="doc-total"><span>Subtotal: ${money(subtotal)}</span>${b.discount ? `<span>Descuento ${b.discount}%: −${money((subtotal * b.discount) / 100)}</span>` : ''}<strong>Total: ${money(DB.budgetTotal(b))}</strong></div>
      ${b.notes ? `<p><strong>Observaciones:</strong> ${esc(b.notes)}</p>` : ''}
      <p class="doc-foot">Presupuesto válido por 30 días. ${esc(s.receiptFooter)}</p>`;
  };

  const receiptDoc = (pay) => {
    const s = DB.settings(); const p = patientById(pay.patientId);
    return `
      <header class="doc-head"><div><strong class="doc-brand">${esc(s.clinicName)}</strong><small>${clinicLine(s)}</small></div>
        <div class="doc-num"><span>Recibo</span><strong>${esc(pay.receipt)}</strong><small>${fmtDate(pay.date)}</small></div></header>
      <p>Recibimos de <strong>${esc(fullName(p))}</strong>${p ? ` (DNI ${esc(p.dni)})` : ''} la suma de:</p>
      <div class="doc-amount">${money(pay.amount)}</div>
      <dl class="doc-meta"><dt>Concepto</dt><dd>${esc(pay.concept)}</dd><dt>Método</dt><dd>${esc(pay.method)}</dd></dl>
      <p class="doc-foot">${esc(s.receiptFooter)}</p>`;
  };

  const showDocument = (title, filename, inner) => {
    const standalone = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body><div class="doc">${inner}</div></body></html>`;
    openModal({
      title, size: 'lg', hideFooter: true,
      body: `<div class="doc">${inner}</div>
        <div class="doc-actions">
          ${U.canPrint ? `<button type="button" class="btn" data-print>${icon('print')}Imprimir</button>` : ''}
          <button type="button" class="btn btn-primary" data-dl>${icon('download')}Descargar (.html)</button>
        </div>`,
      onMount: (form) => {
        form.querySelector('[data-dl]').addEventListener('click', () => downloadFile(filename, standalone, 'text/html;charset=utf-8'));
        const printBtn = form.querySelector('[data-print]');
        if (printBtn) printBtn.addEventListener('click', () => U.printHTML(standalone));
      },
    });
  };
  const showBudget = (b) => b && showDocument(`Presupuesto #${b.number}`, `presupuesto-${b.number}.html`, budgetDoc(b));
  const showReceipt = (pay) => pay && showDocument(`Recibo ${pay.receipt}`, `recibo-${pay.receipt}.html`, receiptDoc(pay));

  /* =====================================================================
     DASHBOARD
     ===================================================================== */
  const dashboard = (el) => {
    const today = isoDate();
    const now = new Date();
    const monthPrefix = today.slice(0, 7);
    const appts = DB.all('appointments');
    const payments = DB.all('payments');
    const todays = appts.filter((a) => a.date === today && a.status !== 'cancelada').sort((a, b) => a.time.localeCompare(b.time));
    const upcoming = appts.filter((a) => a.date >= today && ['programada', 'confirmada'].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
    const pendingBudgets = DB.all('budgets').filter((b) => b.status === 'pendiente').sort((a, b) => b.date.localeCompare(a.date));
    const monthIncome = payments.filter((p) => p.date.startsWith(monthPrefix)).reduce((s, p) => s + Number(p.amount), 0);
    const monthAppts = appts.filter((a) => a.date.startsWith(monthPrefix) && a.date <= today);
    const attended = monthAppts.filter((a) => a.status === 'atendida').length;
    const closedMonth = monthAppts.filter((a) => ['atendida', 'ausente'].includes(a.status)).length;
    const allBudgets = DB.all('budgets');
    const accepted = allBudgets.filter((b) => ['aceptado', 'en_curso', 'finalizado'].includes(b.status)).length;
    const decided = allBudgets.filter((b) => b.status !== 'pendiente').length;

    const weekBars = [];
    for (let i = 6; i >= 0; i--) {
      const d = isoDate(addDays(now, -i));
      weekBars.push({ label: parseDate(d).toLocaleDateString('es-AR', { weekday: 'short' }), value: appts.filter((a) => a.date === d && a.status === 'atendida').length });
    }
    const maxBar = Math.max(1, ...weekBars.map((b) => b.value));

    const perDentist = dentists().map((d) => {
      const mine = monthAppts.filter((a) => a.dentistId === d.id);
      const budgetIds = new Set(allBudgets.filter((b) => b.dentistId === d.id).map((b) => b.id));
      const income = payments.filter((p) => budgetIds.has(p.budgetId) && p.date.startsWith(monthPrefix)).reduce((s, p) => s + Number(p.amount), 0);
      return { d, total: mine.length, done: mine.filter((a) => a.status === 'atendida').length, income };
    });

    const recentPatients = [...DB.all('patients')].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 5);

    el.innerHTML = `
      ${pageHead('Dashboard', `Resumen general · ${esc(fmtDateLong(now))}`, `<button class="btn btn-primary" data-new-appt>${icon('plus')}Nueva cita</button>`)}
      <div class="grid grid-4">
        ${statTile('teal', 'users', DB.all('patients').length, 'Pacientes')}
        ${statTile('sky', 'calendar', todays.length, 'Citas hoy')}
        ${statTile('amber', 'file', pendingBudgets.length, 'Presupuestos pendientes')}
        ${statTile('violet', 'cash', money(monthIncome), 'Ingresos del mes')}
      </div>

      <div class="grid grid-3 mt">
        <div class="card ring-card"><h4>Asistencia del mes</h4>${ring(attended, closedMonth, 'var(--primary)', closedMonth ? `${Math.round((attended / closedMonth) * 100)}%` : '—')}<small class="muted">${attended} atendidas de ${closedMonth}</small></div>
        <div class="card ring-card"><h4>Aceptación de presupuestos</h4>${ring(accepted, decided, 'var(--warn)', decided ? `${Math.round((accepted / decided) * 100)}%` : '—')}<small class="muted">${accepted} aceptados de ${decided} respondidos</small></div>
        <div class="card ring-card"><h4>Pacientes atendidos (7 días)</h4>
          <div class="bars short">${weekBars.map((b) => `<div class="bar" title="${b.value} atendidos"><small>${b.value || ''}</small><div style="height:${(b.value / maxBar) * 78}%"></div><small>${esc(b.label)}</small></div>`).join('')}</div>
        </div>
      </div>

      <div class="grid grid-2 mt">
        <div class="card">
          <div class="card-head"><h3>Agenda de hoy</h3><a href="#agenda">Ver agenda ›</a></div>
          <div class="card-body">${todays.length ? todays.map((a) => { const p = patientById(a.patientId); const t = treatmentById(a.treatmentId); return `
            <div class="list-item"><span class="badge b-info time-chip">${esc(a.time)}</span>
            <div class="grow"><strong>${esc(fullName(p))}</strong><br><small>${esc(t ? t.name : 'Consulta')} · ${esc(userName(a.dentistId))}</small></div>${apptBadge(a.status)}</div>`; }).join('') : '<div class="empty">No hay citas para hoy. Agendá una desde <a href="#agenda">la agenda</a>.</div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Próximas citas</h3><a href="#agenda">Ver todas ›</a></div>
          <div class="card-body">${upcoming.length ? upcoming.map((a) => { const p = patientById(a.patientId); return `
            <div class="list-item">${p ? avatarFor(p) : ''}<div class="grow"><strong>${esc(fullName(p))}</strong><br><small>${fmtDate(a.date)} · ${esc(a.time)} · ${esc(userName(a.dentistId))}</small></div>${apptBadge(a.status)}</div>`; }).join('') : '<div class="empty">No hay próximas citas.</div>'}</div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-head"><h3>Rendimiento por profesional</h3><span class="muted">Mes actual</span></div>
        <div class="card-body grid grid-2">${perDentist.map(({ d, total, done, income }) => `
          <div class="list-item flat"><div class="avatar" style="background:${esc(d.color)}">${esc(initials(d.firstName, d.lastName))}</div>
            <div class="grow"><strong>Dr/a. ${esc(d.firstName)} ${esc(d.lastName)}</strong><br><small>${esc(d.specialty)}</small>
              <div class="hbar tight"><div class="track"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div></div>
            </div>
            <div class="align-end"><strong class="num">${done}/${total}</strong><br><small class="muted">citas atendidas</small><br><span class="money">${money(income)}</span></div>
          </div>`).join('') || '<div class="empty">Todavía no hay odontólogos cargados.</div>'}</div>
      </div>

      <div class="grid grid-2 mt">
        <div class="card">
          <div class="card-head"><h3>Pacientes recientes</h3><a href="#pacientes">Ver todos ›</a></div>
          <div class="card-body">${recentPatients.map((p) => `<div class="list-item">${patientCell(p)}<small class="grow align-end">${fmtDate(p.createdAt)}</small></div>`).join('') || '<div class="empty">Todavía no hay pacientes. Creá el primero desde <a href="#pacientes">Pacientes</a>.</div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Presupuestos pendientes</h3><a href="#presupuestos">Ver todos ›</a></div>
          <div class="table-wrap"><table><thead><tr><th>Paciente</th><th class="num">Total</th><th>Fecha</th></tr></thead><tbody>
            ${pendingBudgets.slice(0, 6).map((b) => `<tr><td>${esc(fullName(patientById(b.patientId)))}</td><td class="num money">${money(DB.budgetTotal(b))}</td><td class="muted">${fmtDate(b.date)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin presupuestos pendientes.</td></tr>'}
          </tbody></table></div>
        </div>
      </div>`;

    el.querySelector('[data-new-appt]').addEventListener('click', () => openAppointmentModal(null, {}, () => App.render({ keepScroll: true })));
  };

  /* =====================================================================
     PACIENTES
     ===================================================================== */
  const patients = (el) => {
    let q = '';
    let insurance = '';
    let current = [];
    const render = () => {
      current = sortedPatients().filter((p) => {
        const hay = `${p.firstName} ${p.lastName} ${p.dni} ${p.phone} ${p.email}`.toLowerCase();
        return (!q || hay.includes(q.toLowerCase())) && (!insurance || (p.insurance || 'Particular') === insurance);
      });
      el.querySelector('[data-body]').innerHTML = current.length ? current.map((p) => {
        const balance = DB.patientBalance(p.id).balance;
        const last = DB.all('appointments').filter((a) => a.patientId === p.id && a.status === 'atendida').sort((a, b) => b.date.localeCompare(a.date))[0];
        return `<tr>
          <td>${patientCell(p)}</td>
          <td>${esc(p.phone)}<br><small class="muted">${esc(p.email)}</small></td>
          <td>${esc(p.insurance || 'Particular')}</td>
          <td class="num">${p.birthDate ? `${ageFrom(p.birthDate)} años` : '—'}</td>
          <td>${last ? fmtDate(last.date) : '<span class="muted">—</span>'}</td>
          <td class="num"><span class="money ${balance > 0 ? 'neg' : ''}">${balance > 0 ? money(balance) : 'Al día'}</span></td>
          <td><div class="act">
            <button title="Ver ficha" aria-label="Ver ficha" data-view="${p.id}">${icon('eye')}</button>
            <button title="Editar" aria-label="Editar" data-edit="${p.id}">${icon('edit')}</button>
            ${can('delete') ? `<button class="del" title="Eliminar" aria-label="Eliminar" data-del="${p.id}">${icon('trash')}</button>` : ''}
          </div></td></tr>`;
      }).join('') : `<tr><td colspan="7" class="empty">${DB.all('patients').length ? 'Ningún paciente coincide con la búsqueda.' : 'Todavía no hay pacientes. Tocá “Nuevo paciente” para cargar el primero.'}</td></tr>`;
      el.querySelector('[data-count]').textContent = `${current.length} paciente${current.length === 1 ? '' : 's'}`;
    };

    const insurers = [...new Set(DB.all('patients').map((p) => p.insurance || 'Particular'))].sort();
    el.innerHTML = `
      ${pageHead('Pacientes', 'Fichas, cobertura y saldo de cada paciente', `<button class="btn" data-csv>${icon('download')}CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Nuevo paciente</button>`)}
      <div class="card">
        <div class="toolbar">
          <input class="grow" data-q type="search" placeholder="Buscar por nombre, DNI, teléfono o email…" aria-label="Buscar pacientes">
          <select data-insurance aria-label="Cobertura"><option value="">Todas las coberturas</option>${insurers.map((i) => `<option>${esc(i)}</option>`).join('')}</select>
          <span class="muted" data-count></span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Contacto</th><th>Cobertura</th><th class="num">Edad</th><th>Última visita</th><th class="num">Saldo</th><th>Acciones</th></tr></thead><tbody data-body></tbody></table></div>
      </div>`;

    render();
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; render(); });
    el.querySelector('[data-insurance]').addEventListener('change', (e) => { insurance = e.target.value; render(); });
    el.querySelector('[data-new]').addEventListener('click', () => openPatientModal(null, (id) => App.go(`paciente-${id}`)));
    el.querySelector('[data-csv]').addEventListener('click', () => csvFile('pacientes.csv', current, [
      { label: 'Apellido', value: (p) => p.lastName }, { label: 'Nombre', value: (p) => p.firstName }, { label: 'DNI', value: (p) => p.dni },
      { label: 'Nacimiento', value: (p) => p.birthDate }, { label: 'Teléfono', value: (p) => p.phone }, { label: 'Email', value: (p) => p.email },
      { label: 'Cobertura', value: (p) => p.insurance }, { label: 'Afiliado', value: (p) => p.insuranceNumber }, { label: 'Saldo', value: (p) => DB.patientBalance(p.id).balance },
    ], 'Pacientes'));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.view) App.go(`paciente-${b.dataset.view}`);
      if (b.dataset.edit) openPatientModal(patientById(b.dataset.edit), render);
      if (b.dataset.del) {
        const p = patientById(b.dataset.del);
        confirmDialog(`¿Eliminar a ${fullName(p)}? También se borran sus citas, presupuestos, pagos, historia clínica y odontograma.`, () => {
          if (DB.removePatient(p.id, `Paciente ${fullName(p)} eliminado con sus registros`)) toast('Paciente eliminado');
          render();
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
    let p = patientById(id);
    if (!p) { el.innerHTML = '<div class="card empty">No encontramos este paciente. Puede que lo hayan eliminado. <a href="#pacientes">Volver a pacientes</a></div>'; return; }
    if (!PATIENT_TABS.some(([k]) => k === tab)) tab = 'info';

    const renderHeader = () => {
      const { balance } = DB.patientBalance(p.id);
      const alerts = [p.allergies && `Alergia: ${esc(p.allergies)}`, p.conditions && esc(p.conditions), p.medications && `Medicación: ${esc(p.medications)}`].filter(Boolean);
      return `<div class="patient-head">
        <a href="#pacientes" class="icon-btn" title="Volver a pacientes" aria-label="Volver a pacientes">${icon('back')}</a>
        <div class="avatar lg">${esc(initials(p.firstName, p.lastName))}</div>
        <div class="grow"><h1>${esc(fullName(p))}</h1><div class="muted">DNI ${esc(p.dni)}${p.birthDate ? ` · ${ageFrom(p.birthDate)} años` : ''} · ${esc(p.insurance || 'Particular')}</div></div>
        <div class="balance-box ${balance > 0 ? 'balance-debt' : 'balance-ok'}"><small>Saldo</small><strong>${balance > 0 ? money(balance) : 'Al día'}</strong></div>
      </div>
      ${alerts.length ? `<div class="banner banner-warn">${icon('alert')}<div class="grow"><strong>Alertas médicas:</strong> ${alerts.join(' · ')}</div></div>` : ''}
      <div class="tabs" role="tablist">${PATIENT_TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    };

    const body = () => {
      switch (tab) {
        case 'odontograma':
          return '<div class="card card-pad"><h3 class="section-title">Odontograma digital</h3><div data-odo></div></div>';
        case 'historia': {
          const list = DB.all('history').filter((h) => h.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          return `<div class="card"><div class="card-head"><h3>Historia clínica</h3>${can('clinical') ? `<button class="btn btn-primary btn-sm" data-new-h>${icon('plus')}Nueva evolución</button>` : ''}</div>
            <div class="card-body">${list.length ? `<div class="timeline">${list.map((h) => `<div class="tl-item"><div class="date">${fmtDate(h.date)} · ${esc(userName(h.dentistId))}</div><h4>${esc(h.title)}</h4><p>${esc(h.notes)}</p>
              ${can('clinical') ? `<div class="act"><button data-edit-h="${h.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>${can('delete') ? `<button class="del" data-del-h="${h.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>` : ''}</div>` : ''}</div>`).join('')}</div>` : '<div class="empty">Todavía no hay evoluciones en la historia clínica.</div>'}</div></div>`;
        }
        case 'consentimientos': {
          const list = DB.all('consents').filter((c) => c.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          return `<div class="card"><div class="card-head"><h3>Consentimientos informados</h3><button class="btn btn-primary btn-sm" data-new-c>${icon('plus')}Nuevo consentimiento</button></div>
            <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Notas</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
            ${list.map((c) => `<tr><td><strong>${esc(c.type)}</strong></td><td>${fmtDate(c.date)}</td><td>${c.signed ? '<span class="badge b-ok">Firmado</span>' : '<span class="badge b-warn">Falta firmar</span>'}</td><td class="muted">${esc(c.notes)}</td>
              <td><div class="act">${c.signed ? '' : `<button title="Marcar como firmado" aria-label="Marcar como firmado" data-sign="${c.id}">${icon('check')}</button>`}${can('delete') ? `<button class="del" data-del-c="${c.id}" aria-label="Eliminar">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin consentimientos registrados.</td></tr>'}
            </tbody></table></div></div>`;
        }
        case 'cuenta': {
          const accepted = DB.all('budgets').filter((b) => b.patientId === p.id && ['aceptado', 'en_curso', 'finalizado'].includes(b.status));
          const pays = DB.all('payments').filter((x) => x.patientId === p.id);
          const moves = [
            ...accepted.map((b) => ({ date: b.date, concept: `Presupuesto #${b.number} (${DB.BUDGET_STATUS[b.status]})`, debit: DB.budgetTotal(b), credit: 0 })),
            ...pays.map((x) => ({ date: x.date, concept: `${x.concept} · ${x.method}`, debit: 0, credit: Number(x.amount) })),
          ].sort((a, b) => a.date.localeCompare(b.date));
          let running = 0;
          const { charged, paid, balance } = DB.patientBalance(p.id);
          return `<div class="grid grid-3 gap-bottom">
              ${statTile('sky', 'file', money(charged), 'Total presupuestado')}
              ${statTile('green', 'cash', money(paid), 'Total pagado')}
              ${statTile(balance > 0 ? 'rose' : 'teal', 'wallet', money(Math.max(0, balance)), balance < 0 ? `Saldo a favor: ${money(-balance)}` : 'Saldo pendiente')}
            </div>
            <div class="card"><div class="card-head"><h3>Movimientos</h3><button class="btn btn-primary btn-sm" data-new-pay>${icon('plus')}Registrar pago</button></div>
            <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead><tbody>
            ${moves.map((m) => { running += m.debit - m.credit; return `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.concept)}</td><td class="num">${m.debit ? money(m.debit) : ''}</td><td class="num credit">${m.credit ? money(m.credit) : ''}</td><td class="num"><span class="money ${running > 0 ? 'neg' : ''}">${money(running)}</span></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">Sin movimientos.</td></tr>'}
            </tbody></table></div></div>`;
        }
        case 'citas': {
          const list = DB.all('appointments').filter((a) => a.patientId === p.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
          return `<div class="card"><div class="card-head"><h3>Citas</h3><button class="btn btn-primary btn-sm" data-new-appt>${icon('plus')}Agendar cita</button></div>
            <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Profesional</th><th>Motivo</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
            ${list.map((a) => { const t = treatmentById(a.treatmentId); return `<tr><td>${fmtDate(a.date)}</td><td class="num">${esc(a.time)}</td><td>${esc(userName(a.dentistId))}</td><td>${esc(t ? t.name : 'Consulta')}</td><td>${apptBadge(a.status)}</td><td><div class="act"><button data-edit-appt="${a.id}" aria-label="Editar cita">${icon('edit')}</button></div></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Sin citas registradas.</td></tr>'}
            </tbody></table></div></div>`;
        }
        case 'pagos': {
          const list = DB.all('payments').filter((x) => x.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          const budgets = DB.all('budgets').filter((b) => b.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
          return `<div class="card gap-bottom"><div class="card-head"><h3>Presupuestos</h3><button class="btn btn-sm" data-new-budget>${icon('plus')}Nuevo presupuesto</button></div>
            <div class="table-wrap"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Profesional</th><th class="num">Total</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
            ${budgets.map((b) => `<tr><td>#${b.number}</td><td>${fmtDate(b.date)}</td><td>${esc(userName(b.dentistId))}</td><td class="num money">${money(DB.budgetTotal(b))}</td><td>${budgetBadge(b.status)}</td><td><div class="act"><button data-show-b="${b.id}" title="Ver documento" aria-label="Ver documento">${icon('eye')}</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin presupuestos.</td></tr>'}
            </tbody></table></div></div>
            <div class="card"><div class="card-head"><h3>Pagos</h3><button class="btn btn-primary btn-sm" data-new-pay>${icon('plus')}Registrar pago</button></div>
            <div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
            ${list.map((x) => `<tr><td>${esc(x.receipt)}</td><td>${fmtDate(x.date)}</td><td>${esc(x.concept)}</td><td>${esc(x.method)}</td><td class="num money">${money(x.amount)}</td><td><div class="act"><button data-show-r="${x.id}" title="Ver recibo" aria-label="Ver recibo">${icon('eye')}</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin pagos registrados.</td></tr>'}
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
                <dt>Cobertura</dt><dd>${esc(p.insurance || 'Particular')}${p.insuranceNumber ? ` · N.º ${esc(p.insuranceNumber)}` : ''}</dd>
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
      p = patientById(id) || p;
      el.innerHTML = renderHeader() + `<div>${body()}</div>`;
      if (tab === 'odontograma') {
        const readOnly = !can('clinical') || DB.isReadOnly();
        Odontogram.mount(el.querySelector('[data-odo]'), DB.getOdontogram(p.id), (data, detail) => DB.setOdontogram(p.id, data, `${fullName(p)} · ${detail}`), readOnly);
      }
    };

    const historyModal = (h) => openModal({
      title: h ? 'Editar evolución' : 'Nueva evolución',
      body: `<div class="stack">
        <div class="form-grid"><label class="field">Fecha<input type="date" name="date" value="${h ? h.date : isoDate()}" required></label>
        <label class="field">Profesional<select name="dentistId" required>${options(dentists(), h ? h.dentistId : (App.user().role === 'odontologo' ? App.user().id : ''), (u) => `${u.firstName} ${u.lastName}`)}</select></label></div>
        <label class="field"><span>Título <span class="req">*</span></span><input name="title" required value="${esc(h && h.title)}" placeholder="Ej: Endodoncia pieza 36 (1.ª sesión)"></label>
        <label class="field"><span>Evolución / notas <span class="req">*</span></span><textarea name="notes" required rows="6">${esc(h && h.notes)}</textarea></label></div>`,
      submitLabel: h ? 'Guardar cambios' : 'Agregar evolución',
      onSubmit: (data) => {
        const ok = h ? DB.update('history', h.id, data, `Evolución de ${fullName(p)} editada`) : DB.insert('history', { ...data, patientId: p.id }, `Evolución agregada a ${fullName(p)}`);
        if (ok) toast('Historia clínica actualizada');
        render();
        return undefined;
      },
    });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.tab) { App.go(patientHref(p.id, d.tab).slice(1)); return; }
      if ('editP' in d) openPatientModal(p, render);
      if ('newH' in d) historyModal(null);
      if (d.editH) historyModal(DB.get('history', d.editH));
      if (d.delH) confirmDialog('¿Eliminar esta evolución de la historia clínica?', () => { if (DB.remove('history', d.delH, `Evolución de ${fullName(p)} eliminada`)) toast('Evolución eliminada'); render(); });
      if ('newC' in d) openModal({
        title: 'Nuevo consentimiento',
        body: `<div class="stack"><label class="field"><span>Tipo <span class="req">*</span></span><select name="type" required>${['Tratamiento general', 'Extracción dental', 'Endodoncia', 'Implante dental', 'Tratamiento de ortodoncia', 'Blanqueamiento', 'Anestesia local', 'Uso de datos personales'].map((t) => `<option>${t}</option>`).join('')}</select></label>
          <label class="field">Fecha<input type="date" name="date" value="${isoDate()}"></label>
          <label class="field inline"><input type="checkbox" name="signed"> Firmado por el paciente</label>
          <label class="field">Notas<textarea name="notes"></textarea></label></div>`,
        submitLabel: 'Registrar consentimiento',
        onSubmit: (data) => { if (DB.insert('consents', { ...data, signed: !!data.signed, patientId: p.id }, `Consentimiento "${data.type}" para ${fullName(p)}`)) toast('Consentimiento registrado'); render(); return undefined; },
      });
      if (d.sign) { if (DB.update('consents', d.sign, { signed: true }, `Consentimiento firmado por ${fullName(p)}`)) toast('Consentimiento marcado como firmado'); render(); }
      if (d.delC) confirmDialog('¿Eliminar este consentimiento?', () => { DB.remove('consents', d.delC, `Consentimiento de ${fullName(p)} eliminado`); render(); });
      if ('newPay' in d) openPaymentModal({ patientId: p.id }, render);
      if ('newBudget' in d) openBudgetModal(null, { patientId: p.id }, render);
      if (d.showB) showBudget(DB.get('budgets', d.showB));
      if (d.showR) showReceipt(DB.get('payments', d.showR));
      if ('newAppt' in d) openAppointmentModal(null, { patientId: p.id }, render);
      if (d.editAppt) openAppointmentModal(DB.get('appointments', d.editAppt), {}, render);
    });

    render();
  };

  /* =====================================================================
     AGENDA
     ===================================================================== */
  const agendaState = { start: null, view: 'semana', dentist: '' };
  const agenda = (el) => {
    const s = DB.settings();
    const startOfWeek = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };
    const thisWeek = () => startOfWeek(new Date().getDay() === 0 ? addDays(new Date(), 1) : new Date());
    if (!agendaState.start) agendaState.start = thisWeek();

    const render = () => {
      const days = agendaState.view === 'dia' ? 1 : 6;
      const start = agendaState.view === 'dia' ? agendaState.start : startOfWeek(agendaState.start);
      const dates = Array.from({ length: days }, (_, i) => isoDate(addDays(start, i)));
      const openHour = Number(String(s.openTime || '09:00').slice(0, 2));
      const closeHour = Math.max(openHour + 1, Number(String(s.closeTime || '19:00').slice(0, 2)));
      const hours = [];
      for (let h = openHour; h < closeHour; h++) hours.push(h);
      const appts = DB.all('appointments').filter((a) => dates.includes(a.date) && (!agendaState.dentist || a.dentistId === agendaState.dentist) && a.status !== 'cancelada');
      const today = isoDate();

      let grid = '<div class="hcell"></div>' + dates.map((d) => { const dt = parseDate(d); return `<div class="hcell ${d === today ? 'today' : ''}">${dt.toLocaleDateString('es-AR', { weekday: 'short' })}<small>${dt.getDate()}</small></div>`; }).join('');
      hours.forEach((h) => {
        grid += `<div class="tcell">${pad(h)}:00</div>`;
        dates.forEach((d) => {
          const inHour = appts.filter((a) => a.date === d && Number(a.time.slice(0, 2)) === h).sort((a, b) => a.time.localeCompare(b.time));
          grid += `<div class="slot" data-slot="${d}|${pad(h)}:00" title="Agendar el ${fmtDate(d)} a las ${pad(h)}:00">${inHour.map((a, i) => {
            const p = patientById(a.patientId); const u = DB.get('users', a.dentistId); const color = u ? u.color : '#0d9488';
            const top = 3 + (Number(a.time.slice(3, 5)) / 60) * 50;
            const height = Math.max(24, (Number(a.duration) / 60) * 56 - 6);
            const width = inHour.length > 1 ? `left:calc(${(i * 100) / inHour.length}% + 3px);right:auto;width:calc(${100 / inHour.length}% - 6px);` : '';
            return `<div class="appt" role="button" tabindex="0" data-appt="${a.id}" style="top:${top}px;height:${height}px;${width}background:${esc(color)}26;border-color:${esc(color)}" title="${esc(fullName(p))} · ${esc(a.time)} · ${esc(userName(a.dentistId))}"><strong>${esc(p ? p.lastName : '?')}</strong>${esc(a.time)} · ${esc(u ? u.lastName : '')}</div>`;
          }).join('')}</div>`;
        });
      });

      el.querySelector('[data-cal]').innerHTML = `<div class="agenda ${days === 1 ? 'day' : ''}" style="--days:${days}">${grid}</div>`;
      el.querySelector('[data-title]').textContent = days === 1 ? fmtDateLong(start) : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;

      const listDates = dates.filter((d) => d >= today);
      const list = DB.all('appointments').filter((a) => listDates.includes(a.date) && (!agendaState.dentist || a.dentistId === agendaState.dentist)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      el.querySelector('[data-list]').innerHTML = list.map((a) => `<tr><td>${fmtDate(a.date)}</td><td class="num">${esc(a.time)}</td><td>${patientCell(patientById(a.patientId))}</td><td>${esc(userName(a.dentistId))}</td>
        <td><select class="badge-select" data-status="${a.id}" aria-label="Estado de la cita">${options(Object.keys(DB.APPT_STATUS).map((k) => ({ id: k })), a.status, (x) => DB.APPT_STATUS[x.id])}</select></td>
        <td><div class="act"><button data-appt="${a.id}" aria-label="Editar cita">${icon('edit')}</button>${can('delete') ? `<button class="del" data-del-appt="${a.id}" aria-label="Eliminar cita">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No quedan citas en este período.</td></tr>';
    };

    el.innerHTML = `
      ${pageHead('Agenda de citas', 'Tocá un horario libre para agendar', `<button class="btn btn-primary" data-new>${icon('plus')}Nueva cita</button>`)}
      <div class="card">
        <div class="toolbar">
          <div class="nav-group">
            <button class="icon-btn" data-prev aria-label="Período anterior">${icon('chevronL')}</button>
            <button class="btn btn-sm" data-today>Hoy</button>
            <button class="icon-btn" data-next aria-label="Período siguiente">${icon('chevronR')}</button>
          </div>
          <strong data-title class="grow agenda-title"></strong>
          <select data-dentist aria-label="Profesional"><option value="">Todos los profesionales</option>${options(dentists(), agendaState.dentist, (u) => `${u.firstName} ${u.lastName}`)}</select>
          <div class="seg"><button data-view="dia" class="${agendaState.view === 'dia' ? 'active' : ''}">Día</button><button data-view="semana" class="${agendaState.view === 'semana' ? 'active' : ''}">Semana</button></div>
        </div>
        <div class="table-wrap agenda-wrap" data-cal></div>
        <div class="legend">${dentists().map((u) => `<span><i style="background:${esc(u.color)}"></i>${esc(u.firstName)} ${esc(u.lastName)}</span>`).join('')}</div>
      </div>
      <div class="card mt"><div class="card-head"><h3>Próximas citas del período</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-list></tbody></table></div></div>`;

    const step = () => (agendaState.view === 'dia' ? 1 : 7);
    el.querySelector('[data-prev]').addEventListener('click', () => { agendaState.start = addDays(agendaState.start, -step()); render(); });
    el.querySelector('[data-next]').addEventListener('click', () => { agendaState.start = addDays(agendaState.start, step()); render(); });
    el.querySelector('[data-today]').addEventListener('click', () => { agendaState.start = agendaState.view === 'dia' ? new Date() : thisWeek(); render(); });
    el.querySelector('[data-dentist]').addEventListener('change', (e) => { agendaState.dentist = e.target.value; render(); });
    el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      agendaState.view = b.dataset.view;
      agendaState.start = agendaState.view === 'dia' ? new Date() : thisWeek();
      el.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    el.querySelector('[data-new]').addEventListener('click', () => openAppointmentModal(null, { dentistId: agendaState.dentist }, render));
    const openAppt = (id) => openAppointmentModal(DB.get('appointments', id), {}, render);
    el.addEventListener('click', (e) => {
      const ap = e.target.closest('[data-appt]');
      if (ap) { e.stopPropagation(); openAppt(ap.dataset.appt); return; }
      const del = e.target.closest('[data-del-appt]');
      if (del) { confirmDialog('¿Eliminar esta cita?', () => { if (DB.remove('appointments', del.dataset.delAppt, 'Cita eliminada')) toast('Cita eliminada'); render(); }); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) { const [date, time] = slot.dataset.slot.split('|'); openAppointmentModal(null, { date, time, dentistId: agendaState.dentist }, render); }
    });
    el.addEventListener('keydown', (e) => {
      const ap = e.target.closest && e.target.closest('.appt[data-appt]');
      if (ap && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAppt(ap.dataset.appt); }
    });
    el.addEventListener('change', (e) => {
      const id = e.target.dataset.status;
      if (!id) return;
      if (DB.update('appointments', id, { status: e.target.value }, `Cita marcada como ${DB.APPT_STATUS[e.target.value]}`)) toast('Estado actualizado');
      render();
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
        <label class="field full"><span>Precio <span class="req">*</span></span><input type="number" name="price" min="0" required inputmode="numeric" value="${t ? t.price : ''}"></label>
        <label class="field full">Descripción<textarea name="description">${esc(t && t.description)}</textarea></label></div>`,
      submitLabel: t ? 'Guardar cambios' : 'Crear tratamiento',
      onSubmit: (data) => {
        const record = { ...data, price: Number(data.price) || 0, duration: Number(data.duration) || 30 };
        const ok = t ? DB.update('treatments', t.id, record, `Tratamiento "${record.name}" actualizado`) : DB.insert('treatments', record, `Tratamiento "${record.name}" creado`);
        if (ok) toast('Catálogo actualizado');
        render();
        return undefined;
      },
    });
    const render = () => {
      const list = DB.all('treatments').filter((t) => (!q || t.name.toLowerCase().includes(q.toLowerCase())) && (!cat || t.category === cat)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      el.querySelector('[data-body]').innerHTML = list.map((t) => `<tr><td><strong>${esc(t.name)}</strong>${t.description ? `<br><small class="muted">${esc(t.description)}</small>` : ''}</td><td><span class="badge b-muted">${esc(t.category)}</span></td><td class="num">${t.duration} min</td><td class="num money">${money(t.price)}</td>
        <td><div class="act">${can('catalog') ? `<button data-edit="${t.id}" aria-label="Editar">${icon('edit')}</button><button class="del" data-del="${t.id}" aria-label="Eliminar">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || `<tr><td colspan="5" class="empty">${DB.all('treatments').length ? 'Ningún tratamiento coincide con la búsqueda.' : 'El catálogo está vacío. Agregá tu primer tratamiento con su precio.'}</td></tr>`;
    };
    el.innerHTML = `${pageHead('Catálogo de tratamientos', 'Precios y duraciones de referencia', can('catalog') ? `<button class="btn btn-primary" data-new>${icon('plus')}Nuevo tratamiento</button>` : '')}
      <div class="card"><div class="toolbar"><input class="grow" data-q type="search" placeholder="Buscar tratamiento…" aria-label="Buscar tratamiento"><select data-cat aria-label="Categoría"><option value="">Todas las categorías</option>${DB.TREATMENT_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>Tratamiento</th><th>Categoría</th><th class="num">Duración</th><th class="num">Precio</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; render(); });
    el.querySelector('[data-cat]').addEventListener('change', (e) => { cat = e.target.value; render(); });
    const newBtn = el.querySelector('[data-new]');
    if (newBtn) newBtn.addEventListener('click', () => modal(null));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.edit) modal(DB.get('treatments', b.dataset.edit));
      if (b.dataset.del) { const t = DB.get('treatments', b.dataset.del); confirmDialog(`¿Eliminar "${t.name}" del catálogo? Los presupuestos que ya lo incluyen no cambian.`, () => { DB.remove('treatments', t.id, `Tratamiento "${t.name}" eliminado`); render(); }); }
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
          <td class="num money">${money(total)}</td><td class="num">${money(paid)}<br><small class="muted">${total ? Math.round((paid / total) * 100) : 0}%</small></td>
          <td><select class="badge-select" data-status="${b.id}" aria-label="Estado del presupuesto">${options(Object.keys(DB.BUDGET_STATUS).map((k) => ({ id: k })), b.status, (x) => DB.BUDGET_STATUS[x.id])}</select></td>
          <td class="muted">${fmtDate(b.date)}</td>
          <td><div class="act"><button title="Ver documento" aria-label="Ver documento" data-show="${b.id}">${icon('eye')}</button><button title="Editar" aria-label="Editar" data-edit="${b.id}">${icon('edit')}</button>${can('delete') ? `<button class="del" title="Eliminar" aria-label="Eliminar" data-del="${b.id}">${icon('trash')}</button>` : ''}</div></td></tr>`;
      }).join('') || `<tr><td colspan="8" class="empty">${DB.all('budgets').length ? 'Ningún presupuesto coincide con el filtro.' : 'Todavía no hay presupuestos. Tocá “Nuevo presupuesto” para armar el primero.'}</td></tr>`;
    };
    el.innerHTML = `${pageHead('Presupuestos', 'Planes de tratamiento y su seguimiento', `<button class="btn" data-csv>${icon('download')}CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Nuevo presupuesto</button>`)}
      <div class="card"><div class="toolbar"><input class="grow" data-q type="search" placeholder="Buscar por paciente o número…" aria-label="Buscar presupuestos"><select data-st aria-label="Estado"><option value="">Todos los estados</option>${Object.entries(DB.BUDGET_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>N.º</th><th>Paciente</th><th>Profesional</th><th class="num">Total</th><th class="num">Cobrado</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; render(); });
    el.querySelector('[data-st]').addEventListener('change', (e) => { status = e.target.value; render(); });
    el.querySelector('[data-new]').addEventListener('click', () => openBudgetModal(null, {}, render));
    el.querySelector('[data-csv]').addEventListener('click', () => csvFile('presupuestos.csv', current, [
      { label: 'Número', value: (b) => b.number }, { label: 'Paciente', value: (b) => fullName(patientById(b.patientId)) }, { label: 'Profesional', value: (b) => userName(b.dentistId) },
      { label: 'Total', value: (b) => DB.budgetTotal(b) }, { label: 'Estado', value: (b) => DB.BUDGET_STATUS[b.status] }, { label: 'Fecha', value: (b) => b.date },
    ], 'Presupuestos'));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.show) showBudget(DB.get('budgets', b.dataset.show));
      if (b.dataset.edit) openBudgetModal(DB.get('budgets', b.dataset.edit), {}, render);
      if (b.dataset.del) { const bud = DB.get('budgets', b.dataset.del); confirmDialog(`¿Eliminar el presupuesto #${bud.number}?`, () => { DB.remove('budgets', bud.id, `Presupuesto #${bud.number} eliminado`); render(); }); }
    });
    el.querySelector('[data-body]').addEventListener('change', (e) => {
      const id = e.target.dataset.status;
      if (!id) return;
      const b = DB.get('budgets', id);
      if (DB.update('budgets', id, { status: e.target.value }, `Presupuesto #${b.number}: ${DB.BUDGET_STATUS[e.target.value]}`)) toast('Estado actualizado');
      render();
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
        <td><div class="act"><button title="Ver recibo" aria-label="Ver recibo" data-show="${x.id}">${icon('eye')}</button>${can('delete') ? `<button class="del" title="Anular" aria-label="Anular pago" data-del="${x.id}">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No hay pagos en el período elegido.</td></tr>';
    };
    el.innerHTML = `${pageHead('Pagos', 'Cobros registrados y recibos', `<button class="btn" data-csv>${icon('download')}CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Registrar pago</button>`)}
      <div class="card"><div class="toolbar">
        <label class="field">Desde<input type="date" data-from value="${from}"></label>
        <label class="field">Hasta<input type="date" data-to value="${to}"></label>
        <label class="field">Método<select data-method><option value="">Todos</option>${DB.PAYMENT_METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label>
        <div class="total-box"><small>Total del período</small><div class="money" data-total></div></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th>Recibo</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-from]').addEventListener('change', (e) => { from = e.target.value; render(); });
    el.querySelector('[data-to]').addEventListener('change', (e) => { to = e.target.value; render(); });
    el.querySelector('[data-method]').addEventListener('change', (e) => { method = e.target.value; render(); });
    el.querySelector('[data-new]').addEventListener('click', () => openPaymentModal({}, render));
    el.querySelector('[data-csv]').addEventListener('click', () => csvFile(`pagos_${from}_${to}.csv`, current, [
      { label: 'Fecha', value: (x) => x.date }, { label: 'Paciente', value: (x) => fullName(patientById(x.patientId)) }, { label: 'Concepto', value: (x) => x.concept },
      { label: 'Método', value: (x) => x.method }, { label: 'Monto', value: (x) => x.amount }, { label: 'Recibo', value: (x) => x.receipt },
    ], 'Pagos'));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.show) showReceipt(DB.get('payments', b.dataset.show));
      if (b.dataset.del) confirmDialog('¿Anular este pago? El saldo del paciente vuelve a sumarlo como deuda.', () => { const x = DB.get('payments', b.dataset.del); if (DB.remove('payments', x.id, `Pago ${x.receipt} de ${money(x.amount)} anulado`)) toast('Pago anulado'); render(); }, 'Anular pago');
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
        const months = [];
        let cursor = parseDate(`${from.slice(0, 7)}-01`);
        while (isoDate(cursor) <= to && months.length < 36) { months.push(isoDate(cursor).slice(0, 7)); cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); }
        const max = Math.max(1, ...months.map((m) => byMonth[m] || 0));
        const byMethod = {};
        pays.forEach((x) => { byMethod[x.method] = (byMethod[x.method] || 0) + Number(x.amount); });
        const maxMethod = Math.max(1, ...Object.values(byMethod));
        html = `<div class="hero-figure"><p>Ingresos del período</p><h2>${money(total)}</h2><p>${pays.length} pagos · ticket promedio ${money(pays.length ? total / pays.length : 0)}</p></div>
          <div class="grid grid-2"><div class="card card-pad"><h3 class="section-title">Ingresos por mes</h3>
            <div class="bars">${months.map((m) => `<div class="bar" title="${money(byMonth[m] || 0)}"><small>${byMonth[m] ? `${money((byMonth[m] || 0) / 1000)}k` : ''}</small><div style="height:${((byMonth[m] || 0) / max) * 80}%"></div><small>${parseDate(`${m}-01`).toLocaleDateString('es-AR', { month: 'short' })}</small></div>`).join('')}</div></div>
          <div class="card card-pad"><h3 class="section-title">Por método de pago</h3>${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><div class="top"><span>${esc(k)}</span><strong class="num">${money(v)}</strong></div><div class="track"><div style="width:${(v / maxMethod) * 100}%"></div></div></div>`).join('') || '<div class="empty">Sin pagos en el período.</div>'}</div></div>`;
      } else if (tab === 'citas') {
        const counts = Object.fromEntries(Object.keys(DB.APPT_STATUS).map((k) => [k, appts.filter((a) => a.status === k).length]));
        const closed = counts.atendida + counts.ausente;
        html = `<div class="grid grid-4 gap-bottom">
            ${statTile('sky', 'calendar', appts.length, 'Citas totales')}
            ${statTile('green', 'check', counts.atendida, 'Atendidas')}
            ${statTile('rose', 'x', counts.ausente, 'Ausencias')}
            ${statTile('amber', 'activity', `${closed ? Math.round((counts.ausente / closed) * 100) : 0}%`, 'Tasa de ausentismo')}</div>
          <div class="card card-pad"><h3 class="section-title">Citas por profesional</h3>${dentists().map((u) => { const n = appts.filter((a) => a.dentistId === u.id).length; return `<div class="hbar"><div class="top"><span>${esc(u.firstName)} ${esc(u.lastName)}</span><strong class="num">${n}</strong></div><div class="track"><div style="width:${appts.length ? (n / appts.length) * 100 : 0}%;background:${esc(u.color)}"></div></div></div>`; }).join('') || '<div class="empty">Sin profesionales cargados.</div>'}</div>`;
      } else if (tab === 'tratamientos') {
        const usage = {};
        DB.all('budgets').filter((b) => b.date >= from && b.date <= to && b.status !== 'rechazado').forEach((b) => b.items.forEach((it) => {
          usage[it.description] = usage[it.description] || { qty: 0, amount: 0 };
          usage[it.description].qty += Number(it.qty);
          usage[it.description].amount += it.qty * it.price;
        }));
        const rows = Object.entries(usage).sort((a, b) => b[1].amount - a[1].amount);
        const max = Math.max(1, ...rows.map(([, v]) => v.amount));
        html = `<div class="card card-pad"><h3 class="section-title">Tratamientos más presupuestados</h3>${rows.map(([k, v]) => `<div class="hbar"><div class="top"><span>${esc(k)} <small class="muted">×${v.qty}</small></span><strong class="num">${money(v.amount)}</strong></div><div class="track"><div style="width:${(v.amount / max) * 100}%"></div></div></div>`).join('') || '<div class="empty">Sin presupuestos en el período.</div>'}</div>`;
      } else {
        const debtors = DB.all('patients').map((p) => ({ p, ...DB.patientBalance(p.id) })).filter((x) => x.balance > 0).sort((a, b) => b.balance - a.balance);
        const totalDebt = debtors.reduce((s, x) => s + x.balance, 0);
        html = `<div class="hero-figure ${totalDebt ? 'debt' : ''}"><p>Deuda total de pacientes</p><h2>${money(totalDebt)}</h2><p>${debtors.length} paciente${debtors.length === 1 ? '' : 's'} con saldo pendiente</p></div>
          <div class="card"><div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Teléfono</th><th class="num">Presupuestado</th><th class="num">Pagado</th><th class="num">Saldo</th></tr></thead><tbody>
          ${debtors.map((x) => `<tr><td>${patientCell(x.p)}</td><td>${esc(x.p.phone)}</td><td class="num">${money(x.charged)}</td><td class="num">${money(x.paid)}</td><td class="num money neg">${money(x.balance)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No hay deudas pendientes.</td></tr>'}</tbody></table></div></div>`;
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
      el.querySelector('[data-from]').value = from;
      el.querySelector('[data-to]').value = to;
      render();
    };
    el.innerHTML = `${pageHead('Reportes', 'Indicadores de la clínica')}
      <div class="tabs">${[['ingresos', 'Ingresos'], ['citas', 'Citas'], ['tratamientos', 'Tratamientos'], ['deudas', 'Deudas']].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="card gap-bottom"><div class="toolbar flat">
        <label class="field">Desde<input type="date" data-from value="${from}"></label><label class="field">Hasta<input type="date" data-to value="${to}"></label>
        <div class="quick-ranges"><button class="btn btn-sm" data-q="mes">Este mes</button><button class="btn btn-sm" data-q="mesant">Mes anterior</button><button class="btn btn-sm" data-q="trim">Últimos 3 meses</button><button class="btn btn-sm" data-q="anio">Este año</button></div>
      </div></div>
      <div data-rep></div>`;
    el.querySelector('[data-from]').addEventListener('change', (e) => { from = e.target.value; render(); });
    el.querySelector('[data-to]').addEventListener('change', (e) => { to = e.target.value; render(); });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; render(); }
      if (b.dataset.q) quick(b.dataset.q);
    });
    render();
  };

  /* =====================================================================
     USUARIOS
     ===================================================================== */
  const users = (el) => {
    const COLORS = [['#0d9488', 'Verde azulado'], ['#0284c7', 'Azul'], ['#7c3aed', 'Violeta'], ['#d97706', 'Ámbar'], ['#db2777', 'Rosa'], ['#16a34a', 'Verde'], ['#475569', 'Gris pizarra']];
    const modal = (u) => openModal({
      title: u ? 'Editar usuario' : 'Nuevo usuario',
      body: `<div class="form-grid">
        <label class="field"><span>Nombre <span class="req">*</span></span><input name="firstName" required value="${esc(u && u.firstName)}"></label>
        <label class="field"><span>Apellido <span class="req">*</span></span><input name="lastName" required value="${esc(u && u.lastName)}"></label>
        <label class="field full"><span>Email <span class="req">*</span></span><input type="email" name="email" required value="${esc(u && u.email)}" autocomplete="off"></label>
        <label class="field">${u ? 'Nueva contraseña <span class="form-hint">(vacío = no cambiar)</span>' : '<span>Contraseña <span class="req">*</span></span>'}<input type="password" name="password" ${u ? '' : 'required'} minlength="6" autocomplete="new-password"></label>
        <label class="field">Teléfono<input name="phone" value="${esc(u && u.phone)}" inputmode="tel"></label>
        <label class="field">Rol<select name="role">${options(Object.keys(DB.ROLES).map((k) => ({ id: k })), u ? u.role : 'odontologo', (x) => DB.ROLES[x.id])}</select></label>
        <label class="field">Especialidad<select name="specialty"><option value="">—</option>${options(DB.SPECIALTIES.map((s) => ({ id: s })), u && u.specialty, (x) => x.id)}</select></label>
        <label class="field">Color en la agenda<select name="color">${COLORS.map(([c, n]) => `<option value="${c}" ${u && u.color === c ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field">Estado<select name="active"><option value="1" ${!u || u.active ? 'selected' : ''}>Activo</option><option value="0" ${u && !u.active ? 'selected' : ''}>Inactivo</option></select></label>
        <p class="form-hint full">Las contraseñas se guardan cifradas. Cada persona entra con su email y contraseña.</p></div>`,
      submitLabel: u ? 'Guardar cambios' : 'Crear usuario',
      onSubmit: (data) => {
        const record = { ...data, email: data.email.trim(), active: data.active === '1' };
        if (DB.all('users').some((x) => String(x.email).toLowerCase() === record.email.toLowerCase() && (!u || x.id !== u.id))) { toast('Ya existe un usuario con ese email.', 'err'); return false; }
        if (record.password && record.password.length < 6) { toast('La contraseña debe tener al menos 6 caracteres.', 'err'); return false; }
        if (u && u.id === App.user().id && (!record.active || record.role !== 'admin')) { toast('No podés quitarte el rol de administrador ni desactivar tu propio usuario.', 'err'); return false; }
        if (!record.password) delete record.password;
        const ok = u ? DB.update('users', u.id, record, `Usuario ${record.email} actualizado`) : DB.insert('users', record, `Usuario ${record.email} creado`);
        if (ok) toast('Usuario guardado');
        render();
        return undefined;
      },
    });
    const render = () => {
      el.querySelector('[data-body]').innerHTML = DB.all('users').slice().sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)).map((u) => `<tr>
        <td><div class="cell-user"><div class="avatar sm" style="background:${esc(u.color)}">${esc(initials(u.firstName, u.lastName))}</div><div><strong>${esc(u.firstName)} ${esc(u.lastName)}</strong><small>${esc(u.phone)}</small></div></div></td>
        <td>${esc(u.email)}</td><td><span class="badge ${u.role === 'admin' ? 'b-violet' : u.role === 'odontologo' ? 'b-info' : 'b-muted'}">${DB.ROLES[u.role] || esc(u.role)}</span></td>
        <td>${esc(u.specialty) || '<span class="muted">—</span>'}</td><td>${u.active ? '<span class="badge b-ok">Activo</span>' : '<span class="badge b-muted">Inactivo</span>'}</td>
        <td><div class="act"><button data-edit="${u.id}" aria-label="Editar">${icon('edit')}</button>${u.id !== App.user().id ? `<button class="del" data-del="${u.id}" aria-label="Eliminar">${icon('trash')}</button>` : ''}</div></td></tr>`).join('');
    };
    el.innerHTML = `${pageHead('Usuarios', 'Profesionales y personal con acceso al sistema', `<button class="btn btn-primary" data-new>${icon('plus')}Nuevo usuario</button>`)}
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Especialidad</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-new]').addEventListener('click', () => modal(null));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.edit) modal(DB.get('users', b.dataset.edit));
      if (b.dataset.del) { const u = DB.get('users', b.dataset.del); confirmDialog(`¿Eliminar al usuario ${u.email}? Sus citas e historial se conservan.`, () => { DB.remove('users', u.id, `Usuario ${u.email} eliminado`); render(); }); }
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
        return `<tr><td class="muted nowrap">${fmtDateTime(a.date)}</td><td>${u ? `${esc(u.firstName)} ${esc(u.lastName)}` : '<span class="muted">—</span>'}</td><td><span class="badge ${ACTION_BADGE[a.action] || 'b-muted'}">${esc(a.action)}</span></td><td>${esc(a.module)}</td><td>${esc(a.detail)}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="empty">Todavía no hay actividad registrada.</td></tr>';
    };
    const modules = [...new Set(DB.all('activity').map((a) => a.module))].sort();
    el.innerHTML = `${pageHead('Registro de actividad', 'Últimas 300 acciones realizadas en el sistema')}
      <div class="card"><div class="toolbar"><select data-mod aria-label="Módulo"><option value="">Todos los módulos</option>${modules.map((m) => `<option>${esc(m)}</option>`).join('')}</select>
      <select data-who aria-label="Usuario"><option value="">Todos los usuarios</option>${options(DB.all('users'), '', (u) => `${u.firstName} ${u.lastName}`)}</select></div>
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
    const cloud = DB.mode() === 'cloud';
    el.innerHTML = `${pageHead('Configuración', 'Datos de la clínica, horarios y respaldo de la información')}
      <form class="card gap-bottom" data-form novalidate>
        <div class="card-head"><h3>Datos de la clínica</h3></div>
        <div class="card-body form-grid">
          <label class="field full">Nombre de la clínica<input name="clinicName" value="${esc(s.clinicName)}" required></label>
          <label class="field">CUIT<input name="taxId" value="${esc(s.taxId)}"></label>
          <label class="field">Teléfono<input name="phone" value="${esc(s.phone)}"></label>
          <label class="field">Email<input name="email" type="email" value="${esc(s.email)}"></label>
          <label class="field">Dirección<input name="address" value="${esc(s.address)}"></label>
        </div>
        <div class="card-head bordered"><h3>Horario de atención</h3></div>
        <div class="card-body form-grid">
          <label class="field">Apertura<input type="time" name="openTime" value="${esc(s.openTime)}"></label>
          <label class="field">Cierre<input type="time" name="closeTime" value="${esc(s.closeTime)}"></label>
          <label class="field">Días de atención<input name="workDays" value="${esc(s.workDays)}"></label>
          <label class="field">Duración de turno por defecto (min)<input type="number" name="slotMinutes" min="5" step="5" value="${esc(s.slotMinutes)}"></label>
          <label class="field full">Pie de recibos y presupuestos<input name="receiptFooter" value="${esc(s.receiptFooter)}"></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check')}Guardar configuración</button></div>
      </form>

      <div class="stack">
        <div class="zone zone-info">${icon('info')}<div class="grow"><h4>Dónde se guardan los datos</h4><p>${cloud
          ? 'En la base de datos de este artefacto de Claude. La ven y la editan las personas a las que les compartas el artefacto como Colaborador o Editor.'
          : 'En este navegador. Si borrás los datos del navegador o cambiás de equipo se pierden, así que descargá un respaldo seguido.'}</p></div></div>
        <div class="zone zone-info">${icon('download')}<div class="grow"><h4>Copia de seguridad</h4><p>Descargá un archivo con toda la información: pacientes, citas, presupuestos, pagos, odontogramas y usuarios.</p></div><button class="btn" data-backup>${icon('download')}Descargar respaldo</button></div>
        <div class="zone zone-warn">${icon('upload')}<div class="grow"><h4>Restaurar desde un respaldo</h4><p>Reemplaza todos los datos actuales por los del archivo.</p></div><label class="btn">${icon('upload')}Elegir archivo<input type="file" accept="application/json,.json" data-restore hidden></label></div>
        <div class="zone zone-danger">${icon('alert')}<div class="grow"><h4>Empezar con tu clínica</h4><p>Borra pacientes, citas, presupuestos, pagos, odontogramas y el resto de los usuarios. Se conservan el catálogo de tratamientos, los datos de la clínica y tu usuario.</p></div>
          <div class="page-actions">${DB.canResetDemo() ? '<button class="btn" data-demo>Volver a los datos de ejemplo</button>' : ''}<button class="btn btn-danger" data-wipe>Borrar datos</button></div></div>
      </div>`;

    el.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.clinicName.trim()) { toast('Escribí el nombre de la clínica.', 'err'); return; }
      if (data.openTime >= data.closeTime) { toast('El horario de cierre tiene que ser posterior a la apertura.', 'err'); return; }
      data.slotMinutes = Number(data.slotMinutes) || 30;
      if (DB.saveSettings(data)) toast('Configuración guardada');
      App.render({ keepScroll: true });
    });
    el.querySelector('[data-backup]').addEventListener('click', () => {
      downloadFile(`respaldo-dentagest-${isoDate()}.json`, DB.exportBackup(), 'application/json');
      DB.log('exportar', 'Respaldo', 'Copia de seguridad descargada');
    });
    el.querySelector('[data-restore]').addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => confirmDialog(`Se reemplazarán todos los datos actuales por los de “${file.name}”. ¿Continuar?`, () => {
        try { DB.importBackup(String(reader.result)); toast('Sistema restaurado desde el respaldo'); App.render(); } catch (err) { toast(err.message || 'No se pudo leer el archivo.', 'err'); }
      }, 'Restaurar');
      reader.onerror = () => toast('No se pudo leer el archivo.', 'err');
      reader.readAsText(file);
    });
    const demoBtn = el.querySelector('[data-demo]');
    if (demoBtn) demoBtn.addEventListener('click', () => confirmDialog('Se reemplazarán los datos actuales por los datos de ejemplo. ¿Continuar?', () => { DB.resetDemo(); toast('Datos de ejemplo restaurados'); App.logout(); }, 'Restaurar ejemplo'));
    el.querySelector('[data-wipe]').addEventListener('click', () => {
      const me = App.user();
      openModal({
        title: 'Borrar datos y empezar', danger: true, submitLabel: 'Borrar definitivamente',
        body: `<div class="stack"><p class="no-margin">Esta acción <strong>no se puede deshacer</strong>. Te conviene descargar un respaldo antes.</p>
          <p class="no-margin muted">Elegí el email y la contraseña con los que vas a entrar desde ahora.</p>
          <label class="field"><span>Tu email <span class="req">*</span></span><input type="email" name="email" required value="${esc(me.email)}" autocomplete="off"></label>
          <label class="field"><span>Nueva contraseña <span class="req">*</span></span><input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
          <label class="field"><span>Escribí <strong>BORRAR</strong> para confirmar <span class="req">*</span></span><input name="confirm" required autocomplete="off"></label></div>`,
        onSubmit: (data) => {
          if (data.confirm.trim().toUpperCase() !== 'BORRAR') { toast('Escribí BORRAR para confirmar.', 'err'); return false; }
          if (data.password.length < 6) { toast('La contraseña debe tener al menos 6 caracteres.', 'err'); return false; }
          if (DB.wipeForNewClinic({ email: data.email, password: data.password })) toast('Listo: el sistema quedó vacío para tu clínica.');
          App.go('inicio');
          return undefined;
        },
      });
    });
  };

  window.Views = { dashboard, patients, patientDetail, agenda, treatments, budgets, payments, reports, users, activity, settings, openPatientModal };
})();
