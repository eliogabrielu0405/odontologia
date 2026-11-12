/* Pantallas de la clínica. Cada vista recibe (contenedor, parámetros). */
(function () {
  const { icon, esc, money, isoDate, parseDate, addDays, fmtDate, fmtDateLong, fmtDateTime, ageFrom, initials, fullName, pad, toast, openModal, confirmDialog, downloadFile, toCSV } = U;

  /* ---------- Helpers compartidos ---------- */
  const isDentist = (u) => ['titular', 'odontologo'].includes(u.role);
  const userName = (id) => {
    const u = DB.get('users', id);
    if (!u) return '—';
    return isDentist(u) ? `Dr/a. ${u.firstName} ${u.lastName}` : `${u.firstName} ${u.lastName}`;
  };
  const dentists = () => DB.all('users').filter((u) => isDentist(u) && u.active);
  const patientById = (id) => DB.get('patients', id);
  const treatmentById = (id) => DB.get('treatments', id);
  const sortedPatients = () => [...DB.all('patients')].sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const options = (list, selected, label, value = (x) => x.id) =>
    list.map((x) => `<option value="${esc(value(x))}" ${value(x) === selected ? 'selected' : ''}>${esc(label(x))}</option>`).join('');

  const APPT_BADGE = { programada: 'b-info', confirmada: 'b-violet', atendida: 'b-ok', cancelada: 'b-muted', ausente: 'b-danger' };
  const BUDGET_BADGE = { pendiente: 'b-warn', aceptado: 'b-info', en_curso: 'b-violet', finalizado: 'b-ok', rechazado: 'b-danger' };
  const apptBadge = (s) => `<span class="badge ${APPT_BADGE[s] || 'b-muted'}">${esc(DB.APPT_STATUS[s] || s)}</span>`;
  const budgetBadge = (s) => `<span class="badge ${BUDGET_BADGE[s] || 'b-muted'}">${esc(DB.BUDGET_STATUS[s] || s)}</span>`;

  const photoAttr = (path) => (path ? ` data-photo="${esc(path)}" data-photo-alt=""` : '');
  const avatarFor = (p) => `<div class="avatar sm"${photoAttr(p.photo)}><span>${esc(initials(p.firstName, p.lastName))}</span></div>`;
  /** Número de pieza FDI: permanentes 11–48, temporales 51–85. */
  const validTooth = (t) => /^([1-4][1-8]|[5-8][1-5])$/.test(String(t).trim());
  const patientHref = (id, tab = 'info') => `#paciente-${id}${tab === 'info' ? '' : `-${tab}`}`;
  const patientCell = (p) => (p
    ? `<a href="${patientHref(p.id)}" class="cell-user">${avatarFor(p)}<div><strong>${esc(fullName(p))}</strong><small>C.I. ${esc(p.dni)}</small></div></a>`
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
  const compactMoney = (n) => {
    const v = Number(n) || 0;
    if (Math.abs(v) < 10000) return money(v).replace(/,00$/, '');
    const text = new Intl.NumberFormat('es-VE', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    return money(0).startsWith('Bs') ? `Bs. ${text}` : `$${text}`;
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
      <label class="field"><span>Cédula <span class="req">*</span></span><input name="dni" required value="${esc(p.dni)}" placeholder="V-12345678"></label>
      <label class="field">Fecha de nacimiento<input type="date" name="birthDate" value="${esc(p.birthDate)}"></label>
      <label class="field">Sexo<select name="sex"><option value="">—</option>${options([{ id: 'F', n: 'Femenino' }, { id: 'M', n: 'Masculino' }], p.sex, (x) => x.n)}</select></label>
      <label class="field"><span>Teléfono <span class="req">*</span></span><input name="phone" required inputmode="tel" value="${esc(p.phone)}" placeholder="0414-1234567"></label>
      <label class="field full">Correo<input type="email" name="email" value="${esc(p.email)}"></label>
      <label class="field full">Dirección<input name="address" value="${esc(p.address)}"></label>
      <label class="field">Seguro médico<input name="insurance" value="${esc(p.insurance)}" placeholder="Particular"></label>
      <label class="field">N.º de póliza<input name="insuranceNumber" value="${esc(p.insuranceNumber)}"></label>
      <label class="field">Alergias<input name="allergies" value="${esc(p.allergies)}" placeholder="Ninguna conocida"></label>
      <label class="field">Medicación actual<input name="medications" value="${esc(p.medications)}"></label>
      <label class="field full">Antecedentes médicos<input name="conditions" value="${esc(p.conditions)}" placeholder="Diabetes, hipertensión, embarazo…"></label>
      <label class="field full">Observaciones<textarea name="notes">${esc(p.notes)}</textarea></label>
    </div>`;

  const openPatientModal = (p, after) => openModal({
    title: p ? 'Editar paciente' : 'Nuevo paciente', size: 'lg', body: patientForm(p || {}),
    submitLabel: p ? 'Guardar cambios' : 'Registrar paciente',
    onSubmit: (data) => {
      const dni = data.dni.trim().toUpperCase();
      const dup = DB.all('patients').find((x) => String(x.dni).toUpperCase() === dni && (!p || x.id !== p.id));
      if (dup) { toast(`Ya existe un paciente con la cédula ${dni}: ${fullName(dup)}.`, 'err'); return false; }
      const record = { ...data, dni };
      if (p) {
        DB.update('patients', p.id, record, `Paciente ${record.lastName}, ${record.firstName} actualizado`);
        toast('Paciente actualizado');
        if (after) after(p.id);
      } else {
        const created = DB.insert('patients', { ...record, createdAt: isoDate() }, `Paciente ${record.lastName}, ${record.firstName} registrado`);
        toast('Paciente registrado');
        if (after) after(created.id);
      }
      return undefined;
    },
  });

  const openAppointmentModal = (appt, preset = {}, after) => {
    const me = DB.currentUser();
    const defaultDentist = preset.dentistId || (me && isDentist(me) ? me.id : '');
    const a = appt || { date: preset.date || isoDate(), time: preset.time || '09:00', duration: 30, status: 'programada', patientId: preset.patientId || '', dentistId: defaultDentist };
    if (!DB.all('patients').length) { toast('Primero registra un paciente.', 'err'); return; }
    openModal({
      title: appt ? 'Editar cita' : 'Nueva cita',
      body: `<div class="form-grid">
        <label class="field full"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Elige un paciente</option>${options(sortedPatients(), a.patientId, fullName)}</select></label>
        <label class="field full"><span>Odontólogo/a <span class="req">*</span></span><select name="dentistId" required><option value="">Elige un profesional</option>${options(dentists(), a.dentistId, (u) => `${u.firstName} ${u.lastName}${u.specialty ? ` · ${u.specialty}` : ''}`)}</select></label>
        <label class="field"><span>Fecha <span class="req">*</span></span><input type="date" name="date" required value="${esc(a.date)}"></label>
        <label class="field"><span>Hora <span class="req">*</span></span><input type="time" name="time" required step="900" value="${esc(a.time)}"></label>
        <label class="field">Duración<select name="duration">${options([15, 30, 45, 60, 90, 120].map((m) => ({ id: String(m) })), String(a.duration), (x) => `${x.id} min`)}</select></label>
        <label class="field">Estado<select name="status">${options(Object.keys(DB.APPT_STATUS).map((k) => ({ id: k })), a.status, (x) => DB.APPT_STATUS[x.id])}</select></label>
        <label class="field full">Motivo / tratamiento<select name="treatmentId"><option value="">Consulta general</option>${options(DB.all('treatments'), a.treatmentId, (t) => t.name)}</select></label>
        <label class="field full">Notas<textarea name="notes">${esc(a.notes)}</textarea></label>
      </div>`,
      submitLabel: appt ? 'Guardar cambios' : 'Agendar cita',
      onSubmit: (data) => {
        const record = { ...data, duration: Number(data.duration) };
        const clash = DB.all('appointments').find((x) => x.id !== (appt && appt.id) && x.dentistId === record.dentistId && x.date === record.date && x.time === record.time && x.status !== 'cancelada');
        if (clash) { toast(`${userName(record.dentistId)} ya tiene una cita el ${fmtDate(record.date)} a las ${record.time}.`, 'err'); return false; }
        const p = patientById(record.patientId);
        if (appt) { DB.update('appointments', appt.id, record, `Cita de ${fullName(p)} actualizada`); toast('Cita actualizada'); }
        else { DB.insert('appointments', record, `Cita para ${fullName(p)} el ${fmtDate(record.date)} a las ${record.time}`); toast('Cita agendada'); }
        if (after) after();
        return undefined;
      },
    });
  };

  const openPaymentModal = (preset = {}, after) => {
    const patientBudgets = (pid) => DB.all('budgets').filter((b) => b.patientId === pid && b.status !== 'rechazado');
    if (!DB.all('patients').length) { toast('Primero registra un paciente.', 'err'); return; }
    openModal({
      title: 'Registrar cobro',
      body: `<div class="form-grid">
        <label class="field full"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Elige un paciente</option>${options(sortedPatients(), preset.patientId, fullName)}</select></label>
        <label class="field full">Presupuesto asociado<select name="budgetId"></select></label>
        <label class="field"><span>Monto <span class="req">*</span></span><input type="number" name="amount" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label class="field"><span>Fecha <span class="req">*</span></span><input type="date" name="date" required value="${isoDate()}"></label>
        <label class="field">Método de pago<select name="method">${options(DB.PAYMENT_METHODS.map((m) => ({ id: m })), 'Pago móvil', (x) => x.id)}</select></label>
        <label class="field">Referencia<input name="reference" placeholder="Opcional"></label>
        <label class="field full">Concepto<input name="concept" placeholder="Abono, cuota, pago total…"></label>
      </div>`,
      submitLabel: 'Registrar cobro',
      onMount: (form) => {
        const fill = () => {
          const pid = form.patientId.value;
          const list = pid ? patientBudgets(pid) : [];
          form.budgetId.innerHTML = '<option value="">Sin presupuesto (abono a cuenta)</option>' + list.map((b) => `<option value="${b.id}" ${preset.budgetId === b.id ? 'selected' : ''}>#${b.number} · ${money(DB.budgetTotal(b))} · ${DB.BUDGET_STATUS[b.status]}</option>`).join('');
          const balance = pid ? DB.patientBalance(pid).balance : 0;
          form.amount.placeholder = balance > 0 ? `Saldo pendiente: ${money(balance)}` : '';
        };
        form.patientId.addEventListener('change', fill);
        fill();
      },
      onSubmit: (data) => {
        const amount = U.cents(data.amount);
        if (!(amount > 0)) { toast('Escribe un monto mayor a cero.', 'err'); return false; }
        const b = data.budgetId ? DB.get('budgets', data.budgetId) : null;
        const record = { ...data, amount, concept: data.concept || (b ? `Pago presupuesto #${b.number}` : 'Abono a cuenta'), receipt: DB.nextReceipt() };
        const p = patientById(record.patientId);
        DB.insert('payments', record, `Cobro de ${money(amount)} a ${fullName(p)}`);
        toast(`Cobro registrado · recibo ${record.receipt}`);
        if (after) after();
        return undefined;
      },
    });
  };

  const openBudgetModal = (budget, preset = {}, after) => {
    const b = budget ? JSON.parse(JSON.stringify(budget)) : {
      patientId: preset.patientId || '', dentistId: preset.dentistId || '', date: isoDate(), status: 'pendiente', discount: 0,
      notes: preset.notes || '', items: preset.items ? JSON.parse(JSON.stringify(preset.items)) : [],
    };
    const treatments = DB.all('treatments');
    if (!DB.all('patients').length) { toast('Primero registra un paciente.', 'err'); return; }
    if (!treatments.length && !b.items.length) { toast('Primero carga tus tratamientos en el catálogo.', 'err'); App.go('tratamientos'); return; }
    openModal({
      title: budget ? `Editar presupuesto #${budget.number}` : 'Nuevo presupuesto', size: 'lg',
      body: `<div class="form-grid">
        <label class="field"><span>Paciente <span class="req">*</span></span><select name="patientId" required><option value="">Elige un paciente</option>${options(sortedPatients(), b.patientId, fullName)}</select></label>
        <label class="field"><span>Odontólogo/a <span class="req">*</span></span><select name="dentistId" required><option value="">Elige un profesional</option>${options(dentists(), b.dentistId, (u) => `${u.firstName} ${u.lastName}`)}</select></label>
        <label class="field">Fecha<input type="date" name="date" value="${esc(b.date)}"></label>
        <label class="field">Estado<select name="status">${options(Object.keys(DB.BUDGET_STATUS).map((k) => ({ id: k })), b.status, (x) => DB.BUDGET_STATUS[x.id])}</select></label>
        <div class="full stack">
          <div class="item-adder">
            <label class="field grow">Agregar tratamiento<select data-add-t><option value="">Elige del catálogo…</option>${options(treatments, '', (t) => `${t.name} — ${money(t.price)}`)}</select></label>
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
              <td><input type="number" min="0" step="0.01" data-i="${i}" data-k="price" value="${it.price}" class="cell-input" aria-label="Precio"></td>
              <td class="num money">${money(it.qty * it.price)}</td>
              <td><div class="act"><button type="button" class="del" data-rm="${i}" aria-label="Quitar">${icon('trash')}</button></div></td></tr>`).join('')
            : '<tr><td colspan="6" class="empty">Agrega tratamientos desde el catálogo.</td></tr>';
          paintTotal();
        };
        form.querySelector('[data-add-item]').addEventListener('click', () => {
          const select = form.querySelector('[data-add-t]');
          const t = treatmentById(select.value);
          if (!t) { toast('Elige un tratamiento del catálogo.', 'err'); return; }
          const toothInput = form.querySelector('[data-add-tooth]');
          b.items.push({ treatmentId: t.id, description: t.name, qty: 1, price: Number(t.price) || 0, tooth: toothInput.value.trim() });
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
        if (!b.items.length) { toast('Agrega al menos un tratamiento.', 'err'); return false; }
        const record = { ...data, discount: Math.min(100, Math.max(0, Number(data.discount) || 0)), items: b.items };
        const p = patientById(record.patientId);
        if (budget) { DB.update('budgets', budget.id, record, `Presupuesto #${budget.number} actualizado`); toast('Presupuesto actualizado'); }
        else {
          const number = DB.nextBudgetNumber();
          DB.insert('budgets', { ...record, number }, `Presupuesto #${number} para ${fullName(p)}`);
          toast(`Presupuesto #${number} creado`);
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
    + '.doc-amount{font-size:34px;font-weight:800;color:#0f766e}.doc-foot{color:#5d7370;font-size:12.5px;margin:0}p{margin:0}.table-wrap{overflow:visible}@media print{body{padding:0}}';

  const clinicLine = (s) => [s.address, s.phone, s.email, s.rif ? `RIF ${s.rif}` : ''].filter(Boolean).map(esc).join(' · ');

  const budgetDoc = (b) => {
    const s = DB.settings(); const p = patientById(b.patientId);
    const subtotal = b.items.reduce((acc, it) => acc + it.qty * it.price, 0);
    return `
      <header class="doc-head"><div><strong class="doc-brand">${esc(s.clinicName)}</strong><small>${clinicLine(s)}</small></div>
        <div class="doc-num"><span>Presupuesto</span><strong>N.º ${b.number}</strong><small>${fmtDate(b.date)}</small></div></header>
      <dl class="doc-meta"><dt>Paciente</dt><dd>${esc(fullName(p))}${p ? ` · C.I. ${esc(p.dni)}` : ''}</dd><dt>Profesional</dt><dd>${esc(userName(b.dentistId))}</dd><dt>Estado</dt><dd>${esc(DB.BUDGET_STATUS[b.status])}</dd></dl>
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
      <p>Recibimos de <strong>${esc(fullName(p))}</strong>${p ? ` (C.I. ${esc(p.dni)})` : ''} la cantidad de:</p>
      <div class="doc-amount">${money(pay.amount)}</div>
      <dl class="doc-meta"><dt>Concepto</dt><dd>${esc(pay.concept)}</dd><dt>Método</dt><dd>${esc(pay.method)}${pay.reference ? ` · ref. ${esc(pay.reference)}` : ''}</dd></dl>
      <p class="doc-foot">${esc(s.receiptFooter)}</p>`;
  };

  const showDocument = (title, filename, inner) => {
    const standalone = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body><div class="doc">${inner}</div></body></html>`;
    openModal({
      title, size: 'lg', hideFooter: true,
      body: `<div class="doc">${inner}</div>
        <div class="doc-actions">
          <button type="button" class="btn" data-dl>${icon('download')}Descargar</button>
          <button type="button" class="btn btn-primary" data-print>${icon('print')}Imprimir</button>
        </div>`,
      onMount: (form) => {
        form.querySelector('[data-dl]').addEventListener('click', () => downloadFile(filename, standalone, 'text/html;charset=utf-8'));
        form.querySelector('[data-print]').addEventListener('click', () => U.printHTML(standalone));
      },
    });
  };
  const showBudget = (b) => b && showDocument(`Presupuesto #${b.number}`, `presupuesto-${b.number}.html`, budgetDoc(b));
  const showReceipt = (pay) => pay && showDocument(`Recibo ${pay.receipt}`, `recibo-${pay.receipt}.html`, receiptDoc(pay));

  /* =====================================================================
     INICIO
     ===================================================================== */
  const firstSteps = () => {
    const s = DB.settings();
    const treatments = DB.all('treatments');
    const steps = [
      { done: !!(s.rif || s.address), label: 'Completa los datos de tu clínica', hint: 'Aparecen en presupuestos y recibos.', href: '#configuracion' },
      { done: treatments.length > 0 && treatments.some((t) => Number(t.price) > 0), label: 'Ponle precio a tus tratamientos', hint: treatments.length ? 'Ya están cargados los más comunes: solo falta tu precio.' : 'Puedes empezar con el catálogo sugerido.', href: '#tratamientos' },
      { done: DB.all('users').length > 1, label: 'Invita a tu recepción', hint: 'Cada persona entra con su propio correo.', href: '#equipo' },
      { done: DB.all('patients').length > 0, label: 'Registra tu primer paciente', hint: 'Con su cédula, teléfono y alergias.', href: '#pacientes' },
      { done: DB.all('appointments').length > 0, label: 'Agenda tu primera cita', hint: 'Toca un horario libre en la agenda.', href: '#agenda' },
    ];
    const done = steps.filter((x) => x.done).length;
    if (done === steps.length) return '';
    return `<div class="card steps-card gap-bottom">
      <div class="card-head"><h3>Primeros pasos</h3><span class="muted small">${done} de ${steps.length} listos</span></div>
      <div class="steps">${steps.map((x) => `<a class="step ${x.done ? 'done' : ''}" href="${x.href}"><span class="step-check">${x.done ? icon('check') : ''}</span><span><strong>${x.label}</strong><small>${x.hint}</small></span>${icon('chevronR')}</a>`).join('')}</div>
    </div>`;
  };

  const dashboard = (el) => {
    const today = isoDate();
    const now = new Date();
    const monthPrefix = today.slice(0, 7);
    const appts = DB.all('appointments');
    const payments = DB.all('payments');
    const todays = appts.filter((a) => a.date === today && a.status !== 'cancelada').sort((a, b) => a.time.localeCompare(b.time));
    const upcoming = appts.filter((a) => a.date > today && ['programada', 'confirmada'].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
    const pendingBudgets = DB.all('budgets').filter((b) => b.status === 'pendiente').sort((a, b) => b.date.localeCompare(a.date));
    const monthIncome = payments.filter((p) => p.date.startsWith(monthPrefix)).reduce((s, p) => s + Number(p.amount), 0);
    const monthAppts = appts.filter((a) => a.date.startsWith(monthPrefix) && a.date <= today);
    const attended = monthAppts.filter((a) => a.status === 'atendida').length;
    const closedMonth = monthAppts.filter((a) => ['atendida', 'ausente'].includes(a.status)).length;
    const me = DB.currentUser();

    const weekBars = [];
    for (let i = 6; i >= 0; i--) {
      const d = isoDate(addDays(now, -i));
      weekBars.push({ label: parseDate(d).toLocaleDateString('es-VE', { weekday: 'short' }), value: appts.filter((a) => a.date === d && a.status === 'atendida').length });
    }
    const maxBar = Math.max(1, ...weekBars.map((b) => b.value));
    const recentPatients = [...DB.all('patients')].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 5);

    el.innerHTML = `
      ${pageHead(`Hola, ${esc(me ? me.firstName : '')}`, esc(fmtDateLong(now)), `<button class="btn btn-primary" data-new-appt>${icon('plus')}Nueva cita</button>`)}
      ${can('team') ? firstSteps() : ''}
      <div class="grid grid-4">
        ${statTile('sky', 'calendar', todays.length, 'Citas hoy')}
        ${statTile('teal', 'users', DB.all('patients').length, 'Pacientes')}
        ${statTile('amber', 'file', pendingBudgets.length, 'Presupuestos pendientes')}
        ${statTile('violet', 'cash', money(monthIncome), 'Cobrado este mes')}
      </div>

      <div class="grid grid-2 mt">
        <div class="card">
          <div class="card-head"><h3>Agenda de hoy</h3><a href="#agenda">Ver agenda ›</a></div>
          <div class="card-body">${todays.length ? todays.map((a) => { const p = patientById(a.patientId); const t = treatmentById(a.treatmentId); return `
            <div class="list-item"><span class="badge b-info time-chip">${esc(a.time)}</span>
            <div class="grow"><strong>${esc(fullName(p))}</strong><br><small>${esc(t ? t.name : 'Consulta')} · ${esc(userName(a.dentistId))}</small></div>${apptBadge(a.status)}</div>`; }).join('') : '<div class="empty">No hay citas para hoy. <a href="#agenda">Abrir la agenda</a></div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Próximas citas</h3><a href="#agenda">Ver todas ›</a></div>
          <div class="card-body">${upcoming.length ? upcoming.map((a) => { const p = patientById(a.patientId); return `
            <div class="list-item">${p ? avatarFor(p) : ''}<div class="grow"><strong>${esc(fullName(p))}</strong><br><small>${fmtDate(a.date)} · ${esc(a.time)} · ${esc(userName(a.dentistId))}</small></div>${apptBadge(a.status)}</div>`; }).join('') : '<div class="empty">No hay próximas citas.</div>'}</div>
        </div>
      </div>

      <div class="grid grid-3 mt">
        <div class="card ring-card"><h4>Asistencia del mes</h4>${ring(attended, closedMonth, 'var(--primary)', closedMonth ? `${Math.round((attended / closedMonth) * 100)}%` : '—')}<small class="muted">${attended} atendidas de ${closedMonth}</small></div>
        <div class="card ring-card span-2"><h4>Pacientes atendidos (últimos 7 días)</h4>
          <div class="bars short">${weekBars.map((b) => `<div class="bar" title="${b.value} atendidos"><small>${b.value || ''}</small><div style="height:${(b.value / maxBar) * 78}%"></div><small>${esc(b.label)}</small></div>`).join('')}</div>
        </div>
      </div>

      <div class="grid grid-2 mt">
        <div class="card">
          <div class="card-head"><h3>Pacientes recientes</h3><a href="#pacientes">Ver todos ›</a></div>
          <div class="card-body">${recentPatients.map((p) => `<div class="list-item">${patientCell(p)}<small class="grow align-end">${fmtDate(p.createdAt)}</small></div>`).join('') || '<div class="empty">Todavía no hay pacientes. <a href="#pacientes">Registra el primero</a></div>'}</div>
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
          <td>${esc(p.phone)}${p.phone ? ` <a class="wa-mini" href="${esc(U.waLink(p.phone))}" target="_blank" rel="noopener" title="Escribir por WhatsApp" aria-label="Escribir por WhatsApp">${icon('whatsapp')}</a>` : ''}<br><small class="muted">${esc(p.email)}</small></td>
          <td>${esc(p.insurance || 'Particular')}</td>
          <td class="num">${p.birthDate ? `${ageFrom(p.birthDate)} años` : '—'}</td>
          <td>${last ? fmtDate(last.date) : '<span class="muted">—</span>'}</td>
          <td class="num"><span class="money ${balance > 0 ? 'neg' : ''}">${balance > 0 ? money(balance) : 'Al día'}</span></td>
          <td><div class="act">
            <button title="Ver ficha" aria-label="Ver ficha" data-view="${p.id}">${icon('eye')}</button>
            <button title="Editar" aria-label="Editar" data-edit="${p.id}">${icon('edit')}</button>
            ${can('delete') ? `<button class="del" title="Eliminar" aria-label="Eliminar" data-del="${p.id}">${icon('trash')}</button>` : ''}
          </div></td></tr>`;
      }).join('') : `<tr><td colspan="7" class="empty">${DB.all('patients').length ? 'Ningún paciente coincide con la búsqueda.' : 'Todavía no hay pacientes. Toca “Nuevo paciente” para registrar el primero.'}</td></tr>`;
      el.querySelector('[data-count]').textContent = U.plural(current.length, 'paciente', 'pacientes');
    };

    const insurers = [...new Set(DB.all('patients').map((p) => p.insurance || 'Particular'))].sort();
    el.innerHTML = `
      ${pageHead('Pacientes', 'Fichas, seguro y saldo de cada paciente', `<button class="btn" data-csv>${icon('download')}CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Nuevo paciente</button>`)}
      <div class="card">
        <div class="toolbar">
          <input class="grow" data-q type="search" placeholder="Buscar por nombre, cédula, teléfono o correo…" aria-label="Buscar pacientes">
          <select data-insurance aria-label="Seguro"><option value="">Todos los seguros</option>${insurers.map((i) => `<option>${esc(i)}</option>`).join('')}</select>
          <span class="muted" data-count></span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Contacto</th><th>Seguro</th><th class="num">Edad</th><th>Última visita</th><th class="num">Saldo</th><th>Acciones</th></tr></thead><tbody data-body></tbody></table></div>
      </div>`;

    render();
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; render(); });
    el.querySelector('[data-insurance]').addEventListener('change', (e) => { insurance = e.target.value; render(); });
    el.querySelector('[data-new]').addEventListener('click', () => openPatientModal(null, (id) => App.go(`paciente-${id}`)));
    el.querySelector('[data-csv]').addEventListener('click', () => csvFile('pacientes.csv', current, [
      { label: 'Apellido', value: (p) => p.lastName }, { label: 'Nombre', value: (p) => p.firstName }, { label: 'Cédula', value: (p) => p.dni },
      { label: 'Nacimiento', value: (p) => p.birthDate }, { label: 'Teléfono', value: (p) => p.phone }, { label: 'Correo', value: (p) => p.email },
      { label: 'Seguro', value: (p) => p.insurance }, { label: 'Póliza', value: (p) => p.insuranceNumber }, { label: 'Saldo', value: (p) => DB.patientBalance(p.id).balance },
    ], 'Pacientes'));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.view) App.go(`paciente-${b.dataset.view}`);
      if (b.dataset.edit) openPatientModal(patientById(b.dataset.edit), render);
      if (b.dataset.del) {
        const p = patientById(b.dataset.del);
        confirmDialog(`¿Eliminar a ${fullName(p)}? También se borran sus citas, presupuestos, cobros, historia clínica y odontograma.`, () => {
          DB.removePatient(p.id, `Paciente ${fullName(p)} eliminado con sus registros`);
          toast('Paciente eliminado');
          render();
        });
      }
    });
  };

  /* =====================================================================
     FICHA DEL PACIENTE
     ===================================================================== */
  /** El titular elige qué tratamiento del catálogo se cobra por cada tipo de hallazgo del odontograma. */
  const findingPricesModal = (after) => {
    const treatments = [...DB.all('treatments')].sort((a, b) => a.name.localeCompare(b.name));
    const mapping = DB.settings().findingTreatments || {};
    const kinds = Odontogram.STATES.filter((st) => st.key !== 'sano');
    const priceOf = (t) => (!t ? '—' : Number(t.price) > 0 ? money(t.price) : 'Sin precio');
    const priceText = (key, value) => {
      if (value === '') return '—';
      if (value === '__auto') {
        const label = Odontogram.autoLabel(key, treatments);
        if (!label) return '—';
        // Mismo orden que los nombres del tratamiento automático.
        return label.split(' / ').map((name) => priceOf(treatments.find((x) => x.name === name))).join(' / ');
      }
      return priceOf(treatments.find((x) => x.id === value));
    };
    openModal({
      title: 'Precios de los hallazgos', size: 'lg',
      body: `<div class="stack">
        <p class="hint">Elige qué tratamiento de tu catálogo se cobra por cada hallazgo. El precio es el del catálogo y lo cambias en <a href="#tratamientos">Tratamientos</a>. En cada paciente también puedes cambiar el tratamiento o el precio de un hallazgo.</p>
        <div class="table-wrap"><table><thead><tr><th>Hallazgo</th><th>Se cobra</th><th class="num">Precio</th></tr></thead><tbody>
        ${kinds.map((st) => {
          const value = mapping[st.key] === undefined ? '__auto' : mapping[st.key];
          const auto = Odontogram.autoLabel(st.key, treatments);
          return `<tr>
            <td><span class="badge" style="background:${st.color}1a;color:${st.color}">${esc(st.label)}</span></td>
            <td><select class="cell-input finding-map" name="map_${st.key}" data-kind="${st.key}" aria-label="Tratamiento que se cobra por ${esc(st.label)}">
              <option value="__auto" ${value === '__auto' ? 'selected' : ''}>Automático${auto ? `: ${esc(auto)}` : ' (no se cobra)'}</option>
              <option value="" ${value === '' ? 'selected' : ''}>No se cobra</option>
              ${treatments.map((t) => `<option value="${esc(t.id)}" ${value === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
            </select></td>
            <td class="num" data-price-for="${st.key}">${priceText(st.key, value)}</td></tr>`;
        }).join('')}
        </tbody></table></div>
      </div>`,
      submitLabel: 'Guardar',
      onMount: (form) => form.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-kind]');
        if (sel) form.querySelector(`[data-price-for="${sel.dataset.kind}"]`).textContent = priceText(sel.dataset.kind, sel.value);
      }),
      onSubmit: (data) => {
        const map = {};
        kinds.forEach((st) => { const v = data[`map_${st.key}`]; if (v !== undefined && v !== '__auto') map[st.key] = v; });
        DB.saveConfig({ findingTreatments: map });
        toast('Precios de los hallazgos guardados');
        if (after) after();
        return undefined;
      },
    });
  };

  const PATIENT_TABS = [
    ['info', 'Información'], ['odontograma', 'Odontograma'], ['historia', 'Historia clínica'], ['fotos', 'Fotos'], ['consentimientos', 'Consentimientos'],
    ['cuenta', 'Cuenta corriente'], ['citas', 'Citas'], ['pagos', 'Cobros'],
  ];

  const patientDetail = (el, { id, tab = 'info' }) => {
    let p = patientById(id);
    if (!p) { el.innerHTML = '<div class="card empty">No encontramos este paciente. Puede que lo hayan eliminado. <a href="#pacientes">Volver a pacientes</a></div>'; return; }
    if (!PATIENT_TABS.some(([k]) => k === tab)) tab = 'info';
    let photoFilter = '';

    const renderHeader = () => {
      const { balance } = DB.patientBalance(p.id);
      const alerts = [p.allergies && `Alergia: ${esc(p.allergies)}`, p.conditions && esc(p.conditions), p.medications && `Medicación: ${esc(p.medications)}`].filter(Boolean);
      return `<div class="patient-head">
        <a href="#pacientes" class="icon-btn" title="Volver a pacientes" aria-label="Volver a pacientes">${icon('back')}</a>
        <button type="button" class="avatar lg avatar-edit" data-avatar${photoAttr(p.photo)} title="${p.photo ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}" aria-label="${p.photo ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}"><span>${esc(initials(p.firstName, p.lastName))}</span><i class="avatar-cam" aria-hidden="true">${icon('camera')}</i></button>
        <div class="grow"><h1>${esc(fullName(p))}</h1><div class="muted">C.I. ${esc(p.dni)}${p.birthDate ? ` · ${ageFrom(p.birthDate)} años` : ''} · ${esc(p.insurance || 'Particular')}${p.phone ? ` · <a href="${esc(U.waLink(p.phone))}" target="_blank" rel="noopener">${esc(p.phone)}</a>` : ''}</div></div>
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
              ${can('clinical') ? `<div class="act"><button data-edit-h="${h.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>${can('delete') ? `<button class="del" data-del-h="${h.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>` : ''}</div>` : ''}</div>`).join('')}</div>` : `<div class="empty">Todavía no hay evoluciones en la historia clínica.${can('clinical') ? '' : ' Solo los odontólogos pueden agregarlas.'}</div>`}</div></div>`;
        }
        case 'fotos': {
          const photos = DB.all('photos').filter((x) => x.patientId === p.id)
            .sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`));
          const counts = photos.reduce((acc, x) => { acc[x.category] = (acc[x.category] || 0) + 1; return acc; }, {});
          const cats = Object.keys(counts);
          if (photoFilter && !counts[photoFilter]) photoFilter = '';
          const list = photoFilter ? photos.filter((x) => x.category === photoFilter) : photos;
          const chips = cats.length > 1
            ? `<div class="chips" role="group" aria-label="Filtrar fotos">${[['', 'Todas', photos.length], ...cats.map((c) => [c, c, counts[c]])].map(([v, l, n]) => `<button type="button" class="chip ${v === photoFilter ? 'active' : ''}" data-photo-filter="${esc(v)}" aria-pressed="${v === photoFilter}">${esc(l)} <span>${n}</span></button>`).join('')}</div>`
            : '';
          return `<div class="card"><div class="card-head"><h3>Fotos clínicas</h3>${can('clinical') ? `<button class="btn btn-primary btn-sm" data-new-photo>${icon('camera')}Agregar fotos</button>` : ''}</div>
            ${chips}
            <div class="card-body">${list.length ? `<div class="photo-grid">${list.map((x) => `<button type="button" class="photo-tile" data-open-photo="${x.id}">
                <div class="photo-thumb"${photoAttr(x.thumb || x.path)}></div>
                <div class="photo-cap"><strong>${esc(x.category)}${x.tooth ? ` · Pieza ${esc(x.tooth)}` : ''}</strong><small>${fmtDate(x.date)}</small></div>
              </button>`).join('')}</div>`
              : `<div class="empty">Todavía no hay fotos de este paciente.${can('clinical') ? ' Agrega fotos de caries, fracturas o del antes y después de un tratamiento.' : ' Solo los odontólogos pueden agregarlas.'}</div>`}</div></div>`;
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
              ${statTile('green', 'cash', money(paid), 'Total cobrado')}
              ${statTile(balance > 0 ? 'rose' : 'teal', 'wallet', money(Math.max(0, balance)), balance < 0 ? `Saldo a favor: ${money(-balance)}` : 'Saldo pendiente')}
            </div>
            <div class="card"><div class="card-head"><h3>Movimientos</h3><button class="btn btn-primary btn-sm" data-new-pay>${icon('plus')}Registrar cobro</button></div>
            <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead><tbody>
            ${moves.map((m) => { running = U.cents(running + m.debit - m.credit); return `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.concept)}</td><td class="num">${m.debit ? money(m.debit) : ''}</td><td class="num credit">${m.credit ? money(m.credit) : ''}</td><td class="num"><span class="money ${running > 0 ? 'neg' : ''}">${money(running)}</span></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">Sin movimientos.</td></tr>'}
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
            <div class="card"><div class="card-head"><h3>Cobros</h3><button class="btn btn-primary btn-sm" data-new-pay>${icon('plus')}Registrar cobro</button></div>
            <div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
            ${list.map((x) => `<tr><td>${esc(x.receipt)}</td><td>${fmtDate(x.date)}</td><td>${esc(x.concept)}</td><td>${esc(x.method)}</td><td class="num money">${money(x.amount)}</td><td><div class="act"><button data-show-r="${x.id}" title="Ver recibo" aria-label="Ver recibo">${icon('eye')}</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin cobros registrados.</td></tr>'}
            </tbody></table></div></div>`;
        }
        default:
          return `<div class="grid grid-2">
            <div class="card"><div class="card-head"><h3>Datos personales</h3><button class="btn btn-sm" data-edit-p>${icon('edit')}Editar</button></div>
              <div class="card-body"><dl class="kv">
                <dt>Nombre completo</dt><dd>${esc(p.firstName)} ${esc(p.lastName)}</dd>
                <dt>Cédula</dt><dd>${esc(p.dni)}</dd>
                <dt>Fecha de nacimiento</dt><dd>${fmtDate(p.birthDate)}${p.birthDate ? ` (${ageFrom(p.birthDate)} años)` : ''}</dd>
                <dt>Sexo</dt><dd>${{ F: 'Femenino', M: 'Masculino' }[p.sex] || '—'}</dd>
                <dt>Teléfono</dt><dd>${esc(p.phone) || '—'}</dd>
                <dt>Correo</dt><dd>${esc(p.email) || '—'}</dd>
                <dt>Dirección</dt><dd>${esc(p.address) || '—'}</dd>
                <dt>Seguro</dt><dd>${esc(p.insurance || 'Particular')}${p.insuranceNumber ? ` · Póliza ${esc(p.insuranceNumber)}` : ''}</dd>
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
      // En el celular las pestañas se deslizan de lado: la abierta queda siempre a la vista.
      const tabsBar = el.querySelector('.tabs');
      const activeTab = tabsBar && tabsBar.querySelector('.active');
      if (activeTab && tabsBar.scrollWidth > tabsBar.clientWidth) tabsBar.scrollLeft = activeTab.offsetLeft - tabsBar.offsetLeft - (tabsBar.clientWidth - activeTab.offsetWidth) / 2;
      if (tab === 'odontograma') {
        const me = App.user();
        Odontogram.mount(el.querySelector('[data-odo]'), DB.getOdontogram(p.id), (data, detail) => DB.setOdontogram(p.id, data, `${fullName(p)} · ${detail}`), !can('clinical'), {
          treatments: [...DB.all('treatments')].sort((a, b) => a.name.localeCompare(b.name)),
          mapping: DB.settings().findingTreatments || {},
          money,
          onCreateBudget: (items) => openBudgetModal(null, {
            patientId: p.id, items, dentistId: me && isDentist(me) ? me.id : '',
            notes: `Según los hallazgos del odontograma del ${fmtDate(isoDate())}.`,
          }, () => App.go(patientHref(p.id, 'pagos').slice(1))),
          onEditPrices: can('settings') ? () => findingPricesModal(render) : null,
          onCatalogPrices: can('catalog') ? () => catalogPricesModal(render) : null,
          onCatalogPrice: can('catalog') ? (t, price) => {
            DB.update('treatments', t.id, { price }, `Precio de "${t.name}": ${money(price)} (desde el odontograma)`);
            toast(`Listo: ${t.name} queda en ${money(price)} para todos tus pacientes`);
          } : null,
        });
      }
    };

    const historyModal = (h) => openModal({
      title: h ? 'Editar evolución' : 'Nueva evolución',
      body: `<div class="stack">
        <div class="form-grid"><label class="field">Fecha<input type="date" name="date" value="${h ? h.date : isoDate()}" required></label>
        <label class="field">Profesional<select name="dentistId" required>${options(dentists(), h ? h.dentistId : (App.user() && isDentist(App.user()) ? App.user().id : ''), (u) => `${u.firstName} ${u.lastName}`)}</select></label></div>
        <label class="field"><span>Título <span class="req">*</span></span><input name="title" required value="${esc(h && h.title)}" placeholder="Ej: Endodoncia pieza 36 (1.ª sesión)"></label>
        <label class="field"><span>Evolución / notas <span class="req">*</span></span><textarea name="notes" required rows="6">${esc(h && h.notes)}</textarea></label></div>`,
      submitLabel: h ? 'Guardar cambios' : 'Agregar evolución',
      onSubmit: (data) => {
        if (h) DB.update('history', h.id, data, `Evolución de ${fullName(p)} editada`);
        else DB.insert('history', { ...data, patientId: p.id }, `Evolución agregada a ${fullName(p)}`);
        toast('Historia clínica actualizada');
        render();
        return undefined;
      },
    });

    const previewFiles = (input, box) => {
      box.innerHTML = '';
      [...input.files].slice(0, 12).forEach((f) => {
        if (!f.type.startsWith('image/')) return;
        const img = new Image();
        img.alt = '';
        img.src = URL.createObjectURL(f);
        img.onload = () => URL.revokeObjectURL(img.src);
        box.appendChild(img);
      });
    };

    const profilePhotoModal = () => openModal({
      title: 'Foto de perfil',
      body: `<div class="stack">
        <div class="profile-preview"><div class="avatar xl" data-preview${photoAttr(p.photo)}><span>${esc(initials(p.firstName, p.lastName))}</span></div></div>
        <label class="field"><span>Elige una foto o tómala con la cámara <span class="req">*</span></span><input type="file" name="file" accept="image/*" required></label>
        ${p.photo ? `<button type="button" class="btn btn-sm btn-danger-soft" data-remove-photo>${icon('trash')}Quitar la foto actual</button>` : ''}
      </div>`,
      submitLabel: 'Guardar foto',
      onMount: (form) => {
        const input = form.querySelector('[name=file]');
        const box = form.querySelector('[data-preview]');
        input.addEventListener('change', () => {
          const f = input.files[0];
          if (!f || !f.type.startsWith('image/')) return;
          box.removeAttribute('data-photo');
          box.dataset.photoState = 'local';
          box.querySelectorAll('img').forEach((x) => x.remove());
          const img = new Image();
          img.alt = '';
          img.src = URL.createObjectURL(f);
          box.appendChild(img);
          box.classList.add('has-photo');
        });
        const removeBtn = form.querySelector('[data-remove-photo]');
        if (removeBtn) removeBtn.addEventListener('click', () => {
          const old = p.photo;
          DB.update('patients', p.id, { photo: '' }, `Foto de perfil de ${fullName(p)} quitada`);
          Photos.remove([old]).catch(() => {});
          U.closeModal();
          toast('Foto de perfil quitada');
          render();
        });
      },
      onSubmit: async (data, form) => {
        const file = form.querySelector('[name=file]').files[0];
        const { path } = await Photos.upload(p.id, file, 'perfil');
        const old = p.photo;
        DB.update('patients', p.id, { photo: path }, `Foto de perfil de ${fullName(p)} actualizada`);
        if (old) Photos.remove([old]).catch(() => {});
        toast('Foto de perfil guardada');
        render();
        return undefined;
      },
    });

    const addPhotosModal = () => openModal({
      title: 'Agregar fotos',
      body: `<div class="stack">
        <label class="field"><span>Fotos <span class="req">*</span></span><input type="file" name="files" accept="image/*" multiple required></label>
        <div class="photo-picks" data-picks></div>
        <div class="form-grid form-grid-3">
          <label class="field">Tipo<select name="category">${Photos.CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label class="field">Pieza dental<input name="tooth" inputmode="numeric" maxlength="2" placeholder="Ej: 36"></label>
          <label class="field">Fecha<input type="date" name="date" value="${isoDate()}" required></label>
        </div>
        <label class="field">Nota<textarea name="note" rows="3" placeholder="Ej: Caries oclusal profunda, se indica restauración"></textarea></label>
        <p class="hint">Las fotos son privadas: solo las ve el equipo de tu clínica. Puedes elegir varias a la vez.</p>
      </div>`,
      submitLabel: 'Subir fotos',
      onMount: (form) => {
        const input = form.querySelector('[name=files]');
        input.addEventListener('change', () => previewFiles(input, form.querySelector('[data-picks]')));
      },
      onSubmit: async (data, form) => {
        const tooth = String(data.tooth || '').trim();
        if (tooth && !validTooth(tooth)) { toast('Escribe la pieza en numeración FDI: de 11 a 48, o de 51 a 85 en dientes de leche.', 'err'); return false; }
        const files = [...form.querySelector('[name=files]').files];
        const submit = form.querySelector('[data-submit]');
        const me = App.user();
        let saved = 0;
        let firstError = '';
        for (const file of files) {
          if (submit) submit.textContent = `Subiendo ${saved + 1} de ${files.length}…`;
          try {
            const { path, thumb } = await Photos.upload(p.id, file, 'foto');
            DB.insert('photos', {
              patientId: p.id, path, thumb, category: data.category, tooth, date: data.date,
              note: String(data.note || '').trim(), by: me ? me.id : '', createdAt: new Date().toISOString(),
            }, `Foto (${data.category}${tooth ? `, pieza ${tooth}` : ''}) agregada a ${fullName(p)}`);
            saved += 1;
          } catch (err) { if (!firstError) firstError = err.message; }
        }
        if (saved) { toast(saved === 1 ? 'Foto guardada' : `${saved} fotos guardadas`); render(); }
        if (firstError) { toast(saved ? `${firstError} (${files.length - saved} sin subir)` : firstError, 'err'); return saved ? undefined : false; }
        return undefined;
      },
    });

    const viewPhoto = (ph) => {
      const title = `${ph.category}${ph.tooth ? ` · Pieza ${ph.tooth}` : ''}`;
      openModal({
        title, size: 'lg', hideFooter: true,
        body: `<div class="photo-view">
          <div class="photo-full"${photoAttr(ph.path)}></div>
          <dl class="kv">
            <dt>Fecha</dt><dd>${fmtDate(ph.date)}</dd>
            <dt>Subida por</dt><dd>${esc(userName(ph.by))}</dd>
            ${ph.note ? `<dt>Nota</dt><dd>${esc(ph.note)}</dd>` : ''}
          </dl>
          <div class="photo-actions">
            <a class="btn btn-sm" data-full target="_blank" rel="noopener" hidden>${icon('eye')}Abrir en tamaño completo</a>
            ${can('delete') ? `<button type="button" class="btn btn-sm btn-danger-soft" data-del-photo>${icon('trash')}Eliminar foto</button>` : ''}
          </div>
        </div>`,
        onMount: (form) => {
          Photos.url(ph.path).then((u) => { const a = form.querySelector('[data-full]'); if (u && a) { a.href = u; a.hidden = false; } }).catch(() => {});
          const del = form.querySelector('[data-del-photo]');
          if (del) del.addEventListener('click', () => confirmDialog('¿Eliminar esta foto? No se puede deshacer.', () => {
            DB.remove('photos', ph.id, `Foto (${ph.category}) de ${fullName(p)} eliminada`);
            Photos.remove([...new Set([ph.path, ph.thumb].filter(Boolean))]).catch(() => {});
            toast('Foto eliminada');
            render();
          }));
        },
      });
    };

    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.tab) { App.go(patientHref(p.id, d.tab).slice(1)); return; }
      if ('avatar' in d) { profilePhotoModal(); return; }
      if ('newPhoto' in d) { addPhotosModal(); return; }
      if (d.openPhoto) { const ph = DB.get('photos', d.openPhoto); if (ph) viewPhoto(ph); return; }
      if ('photoFilter' in d) { photoFilter = d.photoFilter; render(); return; }
      if ('editP' in d) openPatientModal(p, render);
      if ('newH' in d) historyModal(null);
      if (d.editH) historyModal(DB.get('history', d.editH));
      if (d.delH) confirmDialog('¿Eliminar esta evolución de la historia clínica?', () => { DB.remove('history', d.delH, `Evolución de ${fullName(p)} eliminada`); toast('Evolución eliminada'); render(); });
      if ('newC' in d) openModal({
        title: 'Nuevo consentimiento',
        body: `<div class="stack"><label class="field"><span>Tipo <span class="req">*</span></span><select name="type" required>${['Tratamiento general', 'Extracción dental', 'Endodoncia', 'Implante dental', 'Tratamiento de ortodoncia', 'Blanqueamiento', 'Anestesia local', 'Uso de datos personales'].map((t) => `<option>${t}</option>`).join('')}</select></label>
          <label class="field">Fecha<input type="date" name="date" value="${isoDate()}"></label>
          <label class="field inline"><input type="checkbox" name="signed"> Firmado por el paciente</label>
          <label class="field">Notas<textarea name="notes"></textarea></label></div>`,
        submitLabel: 'Registrar consentimiento',
        onSubmit: (data) => { DB.insert('consents', { ...data, signed: !!data.signed, patientId: p.id }, `Consentimiento "${data.type}" para ${fullName(p)}`); toast('Consentimiento registrado'); render(); return undefined; },
      });
      if (d.sign) { DB.update('consents', d.sign, { signed: true }, `Consentimiento firmado por ${fullName(p)}`); toast('Consentimiento marcado como firmado'); render(); }
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
    if (!agendaState.touched) agendaState.view = window.matchMedia('(max-width: 560px)').matches ? 'dia' : 'semana';
    if (!agendaState.start) agendaState.start = agendaState.view === 'dia' ? new Date() : thisWeek();

    const render = () => {
      const days = agendaState.view === 'dia' ? 1 : 6;
      const start = agendaState.view === 'dia' ? agendaState.start : startOfWeek(agendaState.start);
      const dates = Array.from({ length: days }, (_, i) => isoDate(addDays(start, i)));
      const openHour = Number(String(s.openTime || '08:00').slice(0, 2));
      const closeHour = Math.max(openHour + 1, Number(String(s.closeTime || '17:00').slice(0, 2)));
      const hours = [];
      for (let h = openHour; h < closeHour; h++) hours.push(h);
      const appts = DB.all('appointments').filter((a) => dates.includes(a.date) && (!agendaState.dentist || a.dentistId === agendaState.dentist) && a.status !== 'cancelada');
      const today = isoDate();

      let grid = '<div class="hcell"></div>' + dates.map((d) => { const dt = parseDate(d); return `<div class="hcell ${d === today ? 'today' : ''}">${dt.toLocaleDateString('es-VE', { weekday: 'short' })}<small>${dt.getDate()}</small></div>`; }).join('');
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
      el.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x.dataset.view === agendaState.view));

      const listDates = dates.filter((d) => d >= today);
      const list = DB.all('appointments').filter((a) => listDates.includes(a.date) && (!agendaState.dentist || a.dentistId === agendaState.dentist)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      el.querySelector('[data-list]').innerHTML = list.map((a) => {
        const p = patientById(a.patientId);
        const reminder = p && p.phone ? `<a class="icon-btn sm" href="${esc(U.waLink(p.phone, `Hola ${p.firstName}, te recordamos tu cita en ${s.clinicName} el ${fmtDate(a.date)} a las ${a.time}. ¿Nos confirmas tu asistencia?`))}" target="_blank" rel="noopener" title="Recordar por WhatsApp" aria-label="Recordar cita por WhatsApp">${icon('whatsapp')}</a>` : '';
        return `<tr><td>${fmtDate(a.date)}</td><td class="num">${esc(a.time)}</td><td>${patientCell(p)}</td><td>${esc(userName(a.dentistId))}</td>
        <td><select class="badge-select" data-status="${a.id}" aria-label="Estado de la cita">${options(Object.keys(DB.APPT_STATUS).map((k) => ({ id: k })), a.status, (x) => DB.APPT_STATUS[x.id])}</select></td>
        <td><div class="act">${reminder}<button data-appt="${a.id}" aria-label="Editar cita">${icon('edit')}</button>${can('delete') ? `<button class="del" data-del-appt="${a.id}" aria-label="Eliminar cita">${icon('trash')}</button>` : ''}</div></td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">No quedan citas en este período.</td></tr>';
    };

    el.innerHTML = `
      ${pageHead('Agenda', 'Toca un horario libre para agendar una cita', `<button class="btn btn-primary" data-new>${icon('plus')}Nueva cita</button>`)}
      <div class="card">
        <div class="toolbar">
          <div class="nav-group">
            <button class="icon-btn" data-prev aria-label="Anterior">${icon('chevronL')}</button>
            <button class="btn btn-sm" data-today>Hoy</button>
            <button class="icon-btn" data-next aria-label="Siguiente">${icon('chevronR')}</button>
          </div>
          <strong data-title class="grow agenda-title"></strong>
          <select data-dentist aria-label="Profesional"><option value="">Todos los profesionales</option>${options(dentists(), agendaState.dentist, (u) => `${u.firstName} ${u.lastName}`)}</select>
          <div class="seg"><button data-view="dia">Día</button><button data-view="semana">Semana</button></div>
        </div>
        <div class="table-wrap agenda-wrap" data-cal></div>
        <div class="legend">${dentists().map((u) => `<span><i style="background:${esc(u.color)}"></i>${esc(u.firstName)} ${esc(u.lastName)}</span>`).join('')}</div>
      </div>
      <div class="card mt"><div class="card-head"><h3>Próximas citas del período</h3><span class="muted small">Usa WhatsApp para recordarle la cita al paciente</span></div>
        <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-list></tbody></table></div></div>`;

    const step = () => (agendaState.view === 'dia' ? 1 : 7);
    el.querySelector('[data-prev]').addEventListener('click', () => { agendaState.start = addDays(agendaState.start, -step()); render(); });
    el.querySelector('[data-next]').addEventListener('click', () => { agendaState.start = addDays(agendaState.start, step()); render(); });
    el.querySelector('[data-today]').addEventListener('click', () => { agendaState.start = agendaState.view === 'dia' ? new Date() : thisWeek(); render(); });
    el.querySelector('[data-dentist]').addEventListener('change', (e) => { agendaState.dentist = e.target.value; render(); });
    el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      agendaState.view = b.dataset.view;
      agendaState.touched = true;
      agendaState.start = agendaState.view === 'dia' ? new Date() : thisWeek();
      render();
    }));
    el.querySelector('[data-new]').addEventListener('click', () => openAppointmentModal(null, { dentistId: agendaState.dentist }, render));
    const openAppt = (apptId) => openAppointmentModal(DB.get('appointments', apptId), {}, render);
    el.addEventListener('click', (e) => {
      const ap = e.target.closest('[data-appt]');
      if (ap) { e.stopPropagation(); openAppt(ap.dataset.appt); return; }
      const del = e.target.closest('[data-del-appt]');
      if (del) { confirmDialog('¿Eliminar esta cita?', () => { DB.remove('appointments', del.dataset.delAppt, 'Cita eliminada'); toast('Cita eliminada'); render(); }); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) { const [date, time] = slot.dataset.slot.split('|'); openAppointmentModal(null, { date, time, dentistId: agendaState.dentist }, render); }
    });
    el.addEventListener('keydown', (e) => {
      const ap = e.target.closest && e.target.closest('.appt[data-appt]');
      if (ap && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAppt(ap.dataset.appt); }
    });
    el.addEventListener('change', (e) => {
      const apptId = e.target.dataset.status;
      if (!apptId) return;
      DB.update('appointments', apptId, { status: e.target.value }, `Cita marcada como ${DB.APPT_STATUS[e.target.value]}`);
      toast('Estado actualizado');
      render();
    });
    render();
  };

  /* =====================================================================
     TRATAMIENTOS
     ===================================================================== */
  const SUGGESTED_TREATMENTS = [
    ['Consulta y diagnóstico', 'Diagnóstico', 30], ['Radiografía periapical', 'Diagnóstico', 15], ['Radiografía panorámica', 'Diagnóstico', 15],
    ['Limpieza y profilaxis', 'Prevención', 45], ['Aplicación de flúor', 'Prevención', 20], ['Sellante de fosas y fisuras', 'Prevención', 20],
    ['Restauración con resina (1 cara)', 'Operatoria', 40], ['Restauración con resina (2 o más caras)', 'Operatoria', 60],
    ['Endodoncia unirradicular', 'Endodoncia', 60], ['Endodoncia multirradicular', 'Endodoncia', 90],
    ['Tartrectomía y alisado radicular', 'Periodoncia', 60], ['Exodoncia simple', 'Cirugía', 30], ['Exodoncia de cordal', 'Cirugía', 60],
    ['Corona de porcelana', 'Prótesis', 60], ['Prótesis parcial removible', 'Prótesis', 60],
    ['Control de ortodoncia', 'Ortodoncia', 30], ['Instalación de brackets', 'Ortodoncia', 90],
    ['Implante dental', 'Implantes', 120], ['Blanqueamiento en consultorio', 'Estética', 60],
  ];
  // Hallazgos del odontograma que se cobran solos y el tratamiento sugerido que les toca
  // (la pieza de ejemplo decide entre uni y multirradicular, y entre exodoncia simple y de cordal).
  const FINDING_NEEDS = [
    ['caries', 16, 'Restauración con resina (1 cara)'], ['fractura', 16, 'Restauración con resina (2 o más caras)'],
    ['endodoncia', 11, 'Endodoncia unirradicular'], ['endodoncia', 36, 'Endodoncia multirradicular'],
    ['extraccion', 11, 'Exodoncia simple'], ['extraccion', 38, 'Exodoncia de cordal'],
    ['corona', 11, 'Corona de porcelana'], ['implante', 11, 'Implante dental'], ['protesis', 11, 'Prótesis parcial removible'],
  ];

  /**
   * Tratamientos automáticos. La primera vez que entra el titular, un catálogo vacío se llena con los
   * tratamientos más comunes, sin precio; si ya tenía catálogo, se agregan solo los que el odontograma
   * necesita y no encuentra. Pasa una sola vez por clínica: si después borran alguno, no vuelve.
   * Devuelve cuántos agregó.
   */
  const ensureCatalog = () => {
    if (!can('catalog') || !can('settings') || DB.settings().catalogReady) return 0;
    const current = DB.all('treatments');
    const wanted = current.length
      ? new Set(FINDING_NEEDS.filter(([state, num]) => !Odontogram.autoTreatment(state, num, current)).map(([, , name]) => name))
      : null;
    const rows = SUGGESTED_TREATMENTS.filter(([name]) => !wanted || wanted.has(name))
      .map(([name, category, duration]) => ({ name, category, duration, price: 0, description: '' }));
    if (rows.length) DB.insertMany('treatments', rows, `${U.plural(rows.length, 'tratamiento cargado', 'tratamientos cargados')} solos en el catálogo, sin precio`);
    DB.saveConfig({ catalogReady: true }, { silent: true });
    return rows.length;
  };

  /** Precios de todo el catálogo en una sola pantalla: escribes cada precio y guardas una vez. */
  const catalogPricesModal = (after) => {
    const all = DB.all('treatments');
    const odo = new Set(FINDING_NEEDS.map(([state, num]) => Odontogram.autoTreatment(state, num, all)).filter(Boolean).map((t) => t.id));
    const rank = (c) => { const i = DB.TREATMENT_CATEGORIES.indexOf(c); return i < 0 ? 99 : i; };
    const list = [...all].sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name));
    const unit = DB.settings().currency === 'VES' ? 'Bs.' : '$';
    const groups = [...new Set(list.map((t) => t.category))];
    openModal({
      title: 'Ponle precio a tus tratamientos', size: 'lg',
      body: `<div class="stack">
        <p class="hint">Escribe el precio de cada tratamiento y toca <strong>Guardar precios</strong>. Los que dicen <strong>Odontograma</strong> se cobran solos cuando marcas ese hallazgo en un paciente.</p>
        ${groups.map((g) => `<section class="price-group"><h4>${esc(g)}</h4>
          ${list.filter((t) => t.category === g).map((t) => `<label class="price-row">
            <span class="price-name">${esc(t.name)}${odo.has(t.id) ? ' <span class="badge b-info">Odontograma</span>' : ''}</span>
            <span class="price-field"><span>${unit}</span><input class="cell-input" type="number" name="p_${esc(t.id)}" min="0" step="0.01" inputmode="decimal" value="${Number(t.price) > 0 ? Number(t.price) : ''}" placeholder="Sin precio" aria-label="Precio de ${esc(t.name)}"></span>
          </label>`).join('')}</section>`).join('')}
      </div>`,
      submitLabel: 'Guardar precios',
      onSubmit: (data) => {
        const changes = list.map((t) => {
          const raw = String(data[`p_${t.id}`] || '').trim();
          return { id: t.id, before: Number(t.price) || 0, patch: { price: raw === '' ? 0 : U.cents(Math.max(0, Number(raw) || 0)) } };
        }).filter((c) => c.patch.price !== c.before);
        if (changes.length) DB.updateMany('treatments', changes, `Precios del catálogo: ${U.plural(changes.length, 'tratamiento cambió', 'tratamientos cambiaron')} de precio`);
        toast(changes.length ? `Listo: ${U.plural(changes.length, 'precio guardado', 'precios guardados')}` : 'No cambiaste ningún precio');
        if (after) after();
        return undefined;
      },
    });
  };

  const treatments = (el) => {
    let q = ''; let cat = '';
    const modal = (t) => openModal({
      title: t ? 'Editar tratamiento' : 'Nuevo tratamiento',
      body: `<div class="form-grid">
        <label class="field full"><span>Nombre <span class="req">*</span></span><input name="name" required value="${esc(t && t.name)}"></label>
        <label class="field">Categoría<select name="category">${options(DB.TREATMENT_CATEGORIES.map((c) => ({ id: c })), t ? t.category : 'Operatoria', (x) => x.id)}</select></label>
        <label class="field">Duración (min)<input type="number" name="duration" min="5" step="5" value="${t ? t.duration : 30}"></label>
        <label class="field full"><span>Precio <span class="req">*</span></span><input type="number" name="price" min="0" step="0.01" required inputmode="decimal" value="${t ? t.price : ''}"></label>
        <label class="field full">Descripción<textarea name="description">${esc(t && t.description)}</textarea></label></div>`,
      submitLabel: t ? 'Guardar cambios' : 'Crear tratamiento',
      onSubmit: (data) => {
        const record = { ...data, price: U.cents(data.price), duration: Number(data.duration) || 30 };
        if (t) DB.update('treatments', t.id, record, `Tratamiento "${record.name}" actualizado`);
        else DB.insert('treatments', record, `Tratamiento "${record.name}" creado`);
        toast('Catálogo actualizado');
        render();
        return undefined;
      },
    });
    const render = () => {
      const all = DB.all('treatments');
      const list = all.filter((t) => (!q || t.name.toLowerCase().includes(q.toLowerCase())) && (!cat || t.category === cat)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      const noPrice = all.filter((t) => !(Number(t.price) > 0)).length;
      el.querySelector('[data-hint]').innerHTML = noPrice && can('catalog') ? `<div class="banner banner-warn">${icon('alert')}<div class="grow">${U.plural(noPrice, 'tratamiento no tiene', 'tratamientos no tienen')} precio.</div><button type="button" class="btn btn-sm" data-prices>Ponerles precio</button></div>` : '';
      const pricesBtn = el.querySelector('.page-actions [data-prices]');
      if (pricesBtn) pricesBtn.hidden = !all.length;
      el.querySelector('[data-body]').innerHTML = list.map((t) => `<tr ${can('catalog') ? `class="clickable" data-edit="${t.id}"` : ''}><td><strong>${esc(t.name)}</strong><small class="muted treat-meta">${esc(t.category)} · ${t.duration} min</small>${t.description ? `<br><small class="muted">${esc(t.description)}</small>` : ''}</td><td><span class="badge b-muted">${esc(t.category)}</span></td><td class="num">${t.duration} min</td><td class="num">${Number(t.price) > 0 ? `<span class="money">${money(t.price)}</span>` : '<span class="badge b-warn">Sin precio</span>'}</td>
        <td><div class="act">${can('catalog') ? `<button data-edit="${t.id}" aria-label="Editar">${icon('edit')}</button><button class="del" data-del="${t.id}" aria-label="Eliminar">${icon('trash')}</button>` : ''}</div></td></tr>`).join('')
        || (all.length ? '<tr><td colspan="5" class="empty">Ningún tratamiento coincide con la búsqueda.</td></tr>'
          : `<tr><td colspan="5" class="empty">El catálogo está vacío.${can('catalog') ? ` Agrega tus tratamientos uno por uno o <button class="link-btn" data-suggested>carga el catálogo sugerido</button> y después ponle tus precios.` : ''}</td></tr>`);
    };
    el.innerHTML = `${pageHead('Tratamientos', 'Tu catálogo con precios y duraciones', can('catalog') ? `<button class="btn" data-prices>${icon('cash')}Poner precios</button><button class="btn btn-primary" data-new>${icon('plus')}Nuevo tratamiento</button>` : '')}
      <div data-hint></div>
      <div class="card"><div class="toolbar"><input class="grow" data-q type="search" placeholder="Buscar tratamiento…" aria-label="Buscar tratamiento"><select data-cat aria-label="Categoría"><option value="">Todas las categorías</option>${DB.TREATMENT_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="table-wrap"><table class="treat-table"><thead><tr><th>Tratamiento</th><th>Categoría</th><th class="num">Duración</th><th class="num">Precio</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; render(); });
    el.querySelector('[data-cat]').addEventListener('change', (e) => { cat = e.target.value; render(); });
    const newBtn = el.querySelector('[data-new]');
    if (newBtn) newBtn.addEventListener('click', () => modal(null));
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-suggested]')) {
        DB.insertMany('treatments', SUGGESTED_TREATMENTS.map(([name, category, duration]) => ({ name, category, duration, price: 0, description: '' })), `${U.plural(SUGGESTED_TREATMENTS.length, 'tratamiento agregado', 'tratamientos agregados')} del catálogo sugerido`);
        render();
        catalogPricesModal(render);
        return;
      }
      if (e.target.closest('[data-prices]')) { catalogPricesModal(render); return; }
      const del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); const t = DB.get('treatments', del.dataset.del); confirmDialog(`¿Eliminar "${t.name}" del catálogo? Los presupuestos que ya lo incluyen no cambian.`, () => { DB.remove('treatments', t.id, `Tratamiento "${t.name}" eliminado`); render(); }); return; }
      const edit = e.target.closest('[data-edit]');
      if (edit && can('catalog')) modal(DB.get('treatments', edit.dataset.edit));
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
      }).join('') || `<tr><td colspan="8" class="empty">${DB.all('budgets').length ? 'Ningún presupuesto coincide con el filtro.' : 'Todavía no hay presupuestos. Toca “Nuevo presupuesto” para armar el primero.'}</td></tr>`;
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
      const budgetId = e.target.dataset.status;
      if (!budgetId) return;
      const b = DB.get('budgets', budgetId);
      DB.update('budgets', budgetId, { status: e.target.value }, `Presupuesto #${b.number}: ${DB.BUDGET_STATUS[e.target.value]}`);
      toast('Estado actualizado');
      render();
    });
    render();
  };

  /* =====================================================================
     COBROS A PACIENTES
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
      el.querySelector('[data-body]').innerHTML = current.map((x) => `<tr><td>${fmtDate(x.date)}</td><td>${patientCell(patientById(x.patientId))}</td><td>${esc(x.concept)}</td><td><span class="badge b-muted">${esc(x.method)}</span>${x.reference ? `<br><small class="muted">ref. ${esc(x.reference)}</small>` : ''}</td><td class="num money">${money(x.amount)}</td><td class="muted">${esc(x.receipt)}</td>
        <td><div class="act"><button title="Ver recibo" aria-label="Ver recibo" data-show="${x.id}">${icon('eye')}</button>${can('delete') ? `<button class="del" title="Anular" aria-label="Anular cobro" data-del="${x.id}">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No hay cobros en el período elegido.</td></tr>';
    };
    el.innerHTML = `${pageHead('Cobros', 'Pagos de tus pacientes y sus recibos', `<button class="btn" data-csv>${icon('download')}CSV</button><button class="btn btn-primary" data-new>${icon('plus')}Registrar cobro</button>`)}
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
    el.querySelector('[data-csv]').addEventListener('click', () => csvFile(`cobros_${from}_${to}.csv`, current, [
      { label: 'Fecha', value: (x) => x.date }, { label: 'Paciente', value: (x) => fullName(patientById(x.patientId)) }, { label: 'Concepto', value: (x) => x.concept },
      { label: 'Método', value: (x) => x.method }, { label: 'Referencia', value: (x) => x.reference }, { label: 'Monto', value: (x) => x.amount }, { label: 'Recibo', value: (x) => x.receipt },
    ], 'Cobros'));
    el.querySelector('[data-body]').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.show) showReceipt(DB.get('payments', b.dataset.show));
      if (b.dataset.del) confirmDialog('¿Anular este cobro? El saldo del paciente vuelve a sumarlo como deuda.', () => { const x = DB.get('payments', b.dataset.del); DB.remove('payments', x.id, `Cobro ${x.receipt} de ${money(x.amount)} anulado`); toast('Cobro anulado'); render(); }, 'Anular cobro');
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
        html = `<div class="hero-figure"><p>Cobrado en el período</p><h2>${money(total)}</h2><p>${U.plural(pays.length, 'cobro', 'cobros')} · promedio ${money(pays.length ? total / pays.length : 0)}</p></div>
          <div class="grid grid-2"><div class="card card-pad"><h3 class="section-title">Cobrado por mes</h3>
            <div class="bars">${months.map((m) => `<div class="bar" title="${money(byMonth[m] || 0)}"><small>${byMonth[m] ? compactMoney(byMonth[m]) : ''}</small><div style="height:${((byMonth[m] || 0) / max) * 80}%"></div><small>${parseDate(`${m}-01`).toLocaleDateString('es-VE', { month: 'short' })}</small></div>`).join('')}</div></div>
          <div class="card card-pad"><h3 class="section-title">Por método de pago</h3>${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><div class="top"><span>${esc(k)}</span><strong class="num">${money(v)}</strong></div><div class="track"><div style="width:${(v / maxMethod) * 100}%"></div></div></div>`).join('') || '<div class="empty">Sin cobros en el período.</div>'}</div></div>`;
      } else if (tab === 'citas') {
        const counts = Object.fromEntries(Object.keys(DB.APPT_STATUS).map((k) => [k, appts.filter((a) => a.status === k).length]));
        const closed = counts.atendida + counts.ausente;
        html = `<div class="grid grid-4 gap-bottom">
            ${statTile('sky', 'calendar', appts.length, 'Citas totales')}
            ${statTile('green', 'check', counts.atendida, 'Atendidas')}
            ${statTile('rose', 'x', counts.ausente, 'No asistieron')}
            ${statTile('amber', 'activity', `${closed ? Math.round((counts.ausente / closed) * 100) : 0}%`, 'Inasistencia')}</div>
          <div class="card card-pad"><h3 class="section-title">Citas por profesional</h3>${dentists().map((u) => { const n = appts.filter((a) => a.dentistId === u.id).length; return `<div class="hbar"><div class="top"><span>${esc(u.firstName)} ${esc(u.lastName)}</span><strong class="num">${n}</strong></div><div class="track"><div style="width:${appts.length ? (n / appts.length) * 100 : 0}%;background:${esc(u.color)}"></div></div></div>`; }).join('') || '<div class="empty">Sin profesionales.</div>'}</div>`;
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
        html = `<div class="hero-figure ${totalDebt ? 'debt' : ''}"><p>Lo que te deben tus pacientes</p><h2>${money(totalDebt)}</h2><p>${U.plural(debtors.length, 'paciente con saldo pendiente', 'pacientes con saldo pendiente')}</p></div>
          <div class="card"><div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Teléfono</th><th class="num">Presupuestado</th><th class="num">Cobrado</th><th class="num">Saldo</th></tr></thead><tbody>
          ${debtors.map((x) => `<tr><td>${patientCell(x.p)}</td><td>${esc(x.p.phone)}</td><td class="num">${money(x.charged)}</td><td class="num">${money(x.paid)}</td><td class="num money neg">${money(x.balance)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No hay saldos pendientes.</td></tr>'}</tbody></table></div></div>`;
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
    el.innerHTML = `${pageHead('Reportes', 'Cómo va tu consultorio')}
      <div class="tabs">${[['ingresos', 'Cobros'], ['citas', 'Citas'], ['tratamientos', 'Tratamientos'], ['deudas', 'Saldos pendientes']].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</div>
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
     REGISTRO DE ACTIVIDAD
     ===================================================================== */
  const activity = (el) => {
    let mod = ''; let who = '';
    const ACTION_BADGE = { crear: 'b-ok', editar: 'b-info', eliminar: 'b-danger', exportar: 'b-warn', restaurar: 'b-warn' };
    const render = () => {
      const list = DB.all('activity').filter((a) => (!mod || a.module === mod) && (!who || a.userId === who));
      el.querySelector('[data-body]').innerHTML = list.slice(0, 300).map((a) => {
        const u = DB.get('users', a.userId);
        return `<tr><td class="muted nowrap">${fmtDateTime(a.date)}</td><td>${u ? `${esc(u.firstName)} ${esc(u.lastName)}` : '<span class="muted">—</span>'}</td><td><span class="badge ${ACTION_BADGE[a.action] || 'b-muted'}">${esc(a.action)}</span></td><td>${esc(a.module)}</td><td>${esc(a.detail)}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="empty">Todavía no hay actividad registrada.</td></tr>';
    };
    const modules = [...new Set(DB.all('activity').map((a) => a.module))].sort();
    el.innerHTML = `${pageHead('Actividad', 'Las últimas 300 acciones de tu equipo')}
      <div class="card"><div class="toolbar"><select data-mod aria-label="Módulo"><option value="">Todos los módulos</option>${modules.map((m) => `<option>${esc(m)}</option>`).join('')}</select>
      <select data-who aria-label="Persona"><option value="">Todas las personas</option>${options(DB.all('users'), '', (u) => `${u.firstName} ${u.lastName}`)}</select></div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr></thead><tbody data-body></tbody></table></div></div>`;
    el.querySelector('[data-mod]').addEventListener('change', (e) => { mod = e.target.value; render(); });
    el.querySelector('[data-who]').addEventListener('change', (e) => { who = e.target.value; render(); });
    render();
  };

  /* =====================================================================
     CONFIGURACIÓN DE LA CLÍNICA
     ===================================================================== */
  const settings = (el) => {
    const s = DB.settings();
    el.innerHTML = `${pageHead('Configuración', 'Datos de tu clínica, horario y respaldo')}
      <form class="card gap-bottom" data-form novalidate>
        <div class="card-head"><h3>Datos de la clínica</h3><span class="muted small">Aparecen en presupuestos y recibos</span></div>
        <div class="card-body form-grid">
          <label class="field full"><span>Nombre de la clínica <span class="req">*</span></span><input name="clinicName" value="${esc(s.clinicName)}" required></label>
          <label class="field">RIF<input name="rif" value="${esc(s.rif)}" placeholder="J-12345678-9"></label>
          <label class="field">Teléfono<input name="phone" inputmode="tel" value="${esc(s.phone)}" placeholder="0212-1234567"></label>
          <label class="field">Correo<input name="email" type="email" value="${esc(s.email)}"></label>
          <label class="field">Dirección<input name="address" value="${esc(s.address)}"></label>
        </div>
        <div class="card-head bordered"><h3>Horario y moneda</h3></div>
        <div class="card-body form-grid">
          <label class="field">Abre a las<input type="time" name="openTime" value="${esc(s.openTime)}"></label>
          <label class="field">Cierra a las<input type="time" name="closeTime" value="${esc(s.closeTime)}"></label>
          <label class="field">Días de atención<input name="workDays" value="${esc(s.workDays)}"></label>
          <label class="field">Duración de cita por defecto (min)<input type="number" name="slotMinutes" min="5" step="5" value="${esc(s.slotMinutes)}"></label>
          <label class="field">Moneda de tus precios<select name="currency"><option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>Dólares ($)</option><option value="VES" ${s.currency === 'VES' ? 'selected' : ''}>Bolívares (Bs.)</option></select></label>
          <label class="field">Pie de recibos y presupuestos<input name="receiptFooter" value="${esc(s.receiptFooter)}"></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check')}Guardar configuración</button></div>
      </form>

      <div class="stack">
        <div class="zone zone-info">${icon('download')}<div class="grow"><h4>Copia de seguridad</h4><p>Descarga un archivo con pacientes, citas, presupuestos, cobros y odontogramas de tu clínica.</p></div><button class="btn" data-backup>${icon('download')}Descargar respaldo</button></div>
        <div class="zone zone-warn">${icon('upload')}<div class="grow"><h4>Restaurar desde un respaldo</h4><p>Reemplaza los datos actuales de la clínica por los del archivo.</p></div><label class="btn">${icon('upload')}Elegir archivo<input type="file" accept="application/json,.json" data-restore hidden></label></div>
      </div>`;

    el.querySelector('[data-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.clinicName.trim()) { toast('Escribe el nombre de la clínica.', 'err'); return; }
      if (data.openTime >= data.closeTime) { toast('La hora de cierre tiene que ser después de la apertura.', 'err'); return; }
      try {
        await Session.updateClinic({ clinicName: data.clinicName, rif: data.rif, phone: data.phone, address: data.address });
        DB.saveConfig({ email: data.email.trim(), openTime: data.openTime, closeTime: data.closeTime, workDays: data.workDays, slotMinutes: Number(data.slotMinutes) || 30, currency: data.currency, receiptFooter: data.receiptFooter });
        toast('Configuración guardada');
        App.render({ keepScroll: true });
      } catch (err) { toast(err.message, 'err'); }
    });
    el.querySelector('[data-backup]').addEventListener('click', () => {
      downloadFile(`respaldo-sonrisas-${isoDate()}.json`, DB.exportBackup(), 'application/json');
      DB.log('exportar', 'Respaldo', 'Copia de seguridad descargada');
    });
    el.querySelector('[data-restore]').addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => confirmDialog(`Se reemplazarán los datos de la clínica por los de “${file.name}”. ¿Continuar?`, () => {
        try { DB.importBackup(String(reader.result)); toast('Datos restaurados desde el respaldo'); App.render(); } catch (err) { toast(err.message || 'No se pudo leer el archivo.', 'err'); return false; }
        return undefined;
      }, 'Restaurar');
      reader.onerror = () => toast('No se pudo leer el archivo.', 'err');
      reader.readAsText(file);
    });
  };

  window.Views = { dashboard, patients, patientDetail, agenda, treatments, budgets, payments, reports, activity, settings, openPatientModal, ensureCatalog };
})();
