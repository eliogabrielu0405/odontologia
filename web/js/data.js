/* Datos de la clínica (pacientes, citas, presupuestos, pagos…) guardados en Supabase.
   Las vistas trabajan sobre una copia en memoria; cada cambio se envía en segundo plano,
   se reintenta si se corta la conexión y llega en vivo a las demás personas de la clínica. */
(function () {
  const LISTS = ['patients', 'appointments', 'treatments', 'budgets', 'payments', 'history', 'consents', 'activity'];
  const ACTIVITY_KEEP = 300;
  const ACTIVITY_MAX = 360;
  const MAX_PARALLEL_WRITES = 4;
  const PAGE_SIZE = 1000;

  const ROLES = { titular: 'Titular', odontologo: 'Odontólogo/a', recepcion: 'Recepción' };
  const SPECIALTIES = ['Odontología general', 'Ortodoncia', 'Endodoncia', 'Periodoncia', 'Implantología', 'Odontopediatría', 'Cirugía bucal', 'Rehabilitación oral', 'Estética dental'];
  const PAYMENT_METHODS = ['Pago móvil', 'Transferencia', 'Zelle', 'Efectivo ($)', 'Efectivo (Bs.)', 'Punto de venta', 'Tarjeta de crédito', 'Binance'];
  const APPT_STATUS = { programada: 'Programada', confirmada: 'Confirmada', atendida: 'Atendida', cancelada: 'Cancelada', ausente: 'No asistió' };
  const BUDGET_STATUS = { pendiente: 'Pendiente', aceptado: 'Aceptado', en_curso: 'En curso', finalizado: 'Finalizado', rechazado: 'Rechazado' };
  const TREATMENT_CATEGORIES = ['Diagnóstico', 'Prevención', 'Operatoria', 'Endodoncia', 'Periodoncia', 'Cirugía', 'Prótesis', 'Ortodoncia', 'Implantes', 'Estética'];
  const DEFAULT_CONFIG = {
    email: '', openTime: '08:00', closeTime: '17:00', workDays: 'Lunes a viernes', slotMinutes: 30,
    receiptFooter: 'Gracias por confiar en nosotros.', currency: 'USD',
  };
  const PREFIX = { patients: 'p', appointments: 'a', treatments: 't', budgets: 'b', payments: 'pay', history: 'h', consents: 'c', activity: 'log' };
  const MODULE_LABEL = { patients: 'Pacientes', appointments: 'Citas', treatments: 'Tratamientos', budgets: 'Presupuestos', payments: 'Pagos', history: 'Historia clínica', consents: 'Consentimientos' };

  const emptyState = () => ({
    patients: [], appointments: [], treatments: [], budgets: [], payments: [], history: [], consents: [], activity: [],
    odontograms: {}, config: {},
  });

  let sb = null;
  let clinic = null;
  let myId = null;
  let members = [];
  let state = emptyState();
  let channel = null;
  let resyncTimer = null;
  let lastResync = 0;
  const changeListeners = new Set();
  const syncListeners = new Set();
  const accountListeners = new Set();

  let seq = 0;
  const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const canon = (v) => {
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
    return JSON.stringify(v === undefined ? null : v);
  };
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const sortActivity = (list) => list.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  let changeTimer;
  const notifyChange = () => {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => changeListeners.forEach((fn) => fn()), 120);
  };
  const notifyAccount = () => accountListeners.forEach((fn) => fn());

  const toUser = (p) => ({
    id: p.id, firstName: p.first_name, lastName: p.last_name, email: p.email, phone: p.phone,
    role: p.role, specialty: p.specialty, color: p.color, active: p.active, createdAt: p.created_at,
  });

  /* =====================================================================
     Carga inicial y sincronización
     ===================================================================== */
  const fetchRecords = async () => {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await sb.from('records').select('collection,id,data')
        .eq('clinic_id', clinic.id).order('collection').order('id').range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    return rows;
  };

  const buildState = (rows) => {
    const next = emptyState();
    rows.forEach(({ collection, id, data }) => {
      if (collection === 'odontograms') next.odontograms[id] = (data && data.teeth) || {};
      else if (collection === 'config') { if (id === 'clinic') next.config = data || {}; }
      else if (next[collection]) next[collection].push({ ...data, id });
    });
    sortActivity(next.activity);
    return next;
  };

  /** Aplica lo que hay en el servidor sin pisar los cambios locales que aún no se guardaron. */
  const applyServerState = (serverState) => {
    overrides.forEach((pending, key) => {
      const [col, id] = key.split('/');
      if (col === 'odontograms') { if (pending.body === null) delete serverState.odontograms[id]; else serverState.odontograms[id] = pending.body.teeth || {}; return; }
      if (col === 'config') { if (pending.body) serverState.config = pending.body; return; }
      const list = serverState[col];
      if (!list) return;
      const index = list.findIndex((x) => x.id === id);
      if (pending.body === null) { if (index >= 0) list.splice(index, 1); }
      else if (index >= 0) list[index] = { ...pending.body, id };
      else list.push({ ...pending.body, id });
    });
    let changed = false;
    LISTS.forEach((col) => {
      if (canon([...serverState[col]].sort(byId)) !== canon([...state[col]].sort(byId))) { changed = true; state[col] = serverState[col]; }
    });
    if (canon(serverState.odontograms) !== canon(state.odontograms)) { changed = true; state.odontograms = serverState.odontograms; }
    if (canon(serverState.config) !== canon(state.config)) { changed = true; state.config = serverState.config; U.setCurrency(settings().currency); }
    if (changed) sortActivity(state.activity);
    return changed;
  };

  const loadMembers = async () => {
    const { data, error } = await sb.from('profiles').select('*').eq('clinic_id', clinic.id).order('created_at');
    if (error) throw error;
    const next = data.map(toUser);
    const changed = canon(next) !== canon(members);
    members = next;
    return changed;
  };

  const resync = async () => {
    if (!sb || !clinic) return;
    lastResync = Date.now();
    try {
      const [rows, membersChanged] = await Promise.all([fetchRecords(), loadMembers()]);
      if (applyServerState(buildState(rows)) || membersChanged) notifyChange();
    } catch (err) {
      if (isPermissionError(err)) notifyAccount();
    }
  };
  const resyncIfStale = () => { if (Date.now() - lastResync > 30000) resync(); };

  const applyRealtimeRow = (row) => {
    if (!row || row.clinic_id !== clinic.id) return;
    const key = `${row.collection}/${row.id}`;
    if (overrides.has(key)) return;
    if (row.collection === 'odontograms') {
      const teeth = (row.data && row.data.teeth) || {};
      if (canon(teeth) === canon(state.odontograms[row.id] || {})) return;
      state.odontograms[row.id] = teeth;
    } else if (row.collection === 'config') {
      if (row.id !== 'clinic' || canon(row.data) === canon(state.config)) return;
      state.config = row.data || {};
      U.setCurrency(settings().currency);
    } else {
      const list = state[row.collection];
      if (!list) return;
      const item = { ...row.data, id: row.id };
      const index = list.findIndex((x) => x.id === row.id);
      if (index >= 0) {
        if (canon(list[index]) === canon(item)) return;
        list[index] = item;
      } else {
        list.push(item);
        if (row.collection === 'activity') sortActivity(list);
      }
    }
    notifyChange();
  };

  const subscribeRealtime = () => {
    if (!sb.channel) return;
    const filter = `clinic_id=eq.${clinic.id}`;
    channel = sb.channel(`clinica-${clinic.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'records', filter }, (p) => applyRealtimeRow(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'records', filter }, (p) => applyRealtimeRow(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter }, () => { loadMembers().then((c) => { if (c) notifyChange(); }).catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_reports', filter }, () => notifyAccount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinics', filter: `id=eq.${clinic.id}` }, () => notifyAccount())
      .subscribe();
  };

  const onFocus = () => resyncIfStale();
  const onVisible = () => { if (document.visibilityState === 'visible') resyncIfStale(); };
  const onOnline = () => { retryAll(); resyncIfStale(); };

  const init = async ({ client, context }) => {
    teardown();
    sb = client;
    clinic = context.clinic;
    myId = context.profile.id;
    const [rows] = await Promise.all([fetchRecords(), loadMembers()]);
    state = buildState(rows);
    U.setCurrency(settings().currency);
    lastResync = Date.now();
    subscribeRealtime();
    resyncTimer = setInterval(resync, 180000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
  };

  /** Clínica sin acceso (suspendida o vencida): solo el equipo y avisos de la suscripción, sin datos clínicos. */
  const initLocked = async ({ client, context }) => {
    teardown();
    sb = client;
    clinic = context.clinic;
    myId = context.profile.id;
    await loadMembers();
    if (!sb.channel) return;
    channel = sb.channel(`suscripcion-${clinic.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_reports', filter: `clinic_id=eq.${clinic.id}` }, () => notifyAccount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinics', filter: `id=eq.${clinic.id}` }, () => notifyAccount())
      .subscribe();
    resyncTimer = setInterval(() => notifyAccount(), 120000);
  };

  const teardown = () => {
    if (channel && sb) { try { sb.removeChannel(channel); } catch { /* ya cerrado */ } }
    channel = null;
    clearInterval(resyncTimer);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    state = emptyState();
    members = [];
    clinic = null;
    overrides.clear();
    slots.clear();
    waiting.length = 0;
  };

  /* =====================================================================
     Escrituras en segundo plano (una a la vez por documento)
     ===================================================================== */
  const overrides = new Map(); // "coleccion/id" -> { body, seq } cambios locales aún no confirmados
  const slots = new Map();
  const waiting = [];
  let activeWrites = 0;
  let writeSeq = 0;
  let offline = false;

  const pendingWrites = () => { let n = 0; slots.forEach((s) => { if (s.has || s.busy) n++; }); return n; };
  const notifySync = () => { const n = pendingWrites(); syncListeners.forEach((fn) => fn({ pending: n, offline })); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isPermissionError = (err) => !!err && (err.code === '42501' || /row-level security|permission denied/i.test(err.message || ''));
  const isNetworkError = (err) => !err || !err.code || /fetch|network|timeout|Load failed/i.test(err.message || '');

  const runWrite = async (key, body) => {
    const [collection, id] = key.split('/');
    const query = body === null
      ? sb.from('records').delete().match({ clinic_id: clinic.id, collection, id })
      : sb.from('records').upsert({ clinic_id: clinic.id, collection, id, data: body, updated_at: new Date().toISOString() }, { onConflict: 'clinic_id,collection,id' });
    const { error } = await query;
    if (error) throw error;
  };

  const refetch = async (key) => {
    const [collection, id] = key.split('/');
    try {
      const { data } = await sb.from('records').select('collection,id,data,clinic_id').match({ clinic_id: clinic.id, collection, id }).maybeSingle();
      if (data) applyRealtimeRow(data);
      else if (collection === 'odontograms') { delete state.odontograms[id]; notifyChange(); }
      else if (state[collection]) { state[collection] = state[collection].filter((x) => x.id !== id); notifyChange(); }
    } catch { /* la próxima sincronización lo corrige */ }
  };

  const retryAll = () => { slots.forEach((slot, key) => { if (slot.has && !slot.busy && !slot.queued) { slot.queued = true; waiting.push(key); } }); pump(); };

  const pump = () => {
    while (activeWrites < MAX_PARALLEL_WRITES && waiting.length) {
      const key = waiting.shift();
      const slot = slots.get(key);
      if (!slot) continue;
      slot.queued = false;
      if (!slot.has) continue;
      const { body, seq: mySeq } = slot;
      slot.has = false;
      slot.busy = true;
      activeWrites++;
      runWrite(key, body)
        .then(() => {
          offline = false;
          slot.failures = 0;
          const pending = overrides.get(key);
          if (pending && pending.seq === mySeq) overrides.delete(key);
        })
        .catch(async (err) => {
          if (isPermissionError(err)) {
            const pending = overrides.get(key);
            if (pending && pending.seq === mySeq) overrides.delete(key);
            U.toast('No se guardó el cambio: tu cuenta no tiene permiso o la suscripción no está activa.', 'err');
            refetch(key);
            notifyAccount();
            return;
          }
          if (isNetworkError(err)) {
            offline = true;
            slot.failures = (slot.failures || 0) + 1;
            if (!slot.has) { slot.has = true; slot.body = body; slot.seq = mySeq; }
            const delay = Math.min(30000, 2000 * slot.failures);
            setTimeout(() => { if (slot.has && !slot.busy && !slot.queued) { slot.queued = true; waiting.push(key); pump(); } }, delay);
            return;
          }
          const pending = overrides.get(key);
          if (pending && pending.seq === mySeq) overrides.delete(key);
          U.toast(`No se pudo guardar un cambio: ${err.message || 'error desconocido'}.`, 'err');
          refetch(key);
        })
        .finally(() => {
          slot.busy = false;
          activeWrites--;
          if (slot.has && !slot.queued && !offline) { slot.queued = true; waiting.push(key); }
          if (!slot.has && !slot.busy && !slot.queued) slots.delete(key);
          notifySync();
          pump();
        });
    }
    notifySync();
  };

  /** Encola la escritura de un documento (body = null lo borra). Solo viaja el último estado de cada documento. */
  const schedule = (key, body) => {
    const slot = slots.get(key) || { has: false, busy: false, queued: false, failures: 0 };
    slot.body = body === null ? null : clone(body);
    slot.seq = ++writeSeq;
    slot.has = true;
    slots.set(key, slot);
    overrides.set(key, { body: slot.body, seq: slot.seq });
    if (!slot.busy && !slot.queued) { slot.queued = true; waiting.push(key); }
    pump();
  };

  const strip = (item) => { const { id, ...rest } = item; return rest; };
  const persistItem = (col, item) => schedule(`${col}/${item.id}`, strip(item));
  const persistDelete = (col, id) => schedule(`${col}/${id}`, null);

  /* =====================================================================
     API para las vistas
     ===================================================================== */
  const currentUser = () => members.find((m) => m.id === myId) || null;
  const role = () => (currentUser() || {}).role || null;

  const log = (action, module, detail) => {
    if (!clinic) return;
    const entry = { id: uid('log'), date: new Date().toISOString(), userId: myId, action, module, detail: String(detail || '') };
    state.activity.unshift(entry);
    persistItem('activity', entry);
    if (state.activity.length > ACTIVITY_MAX) state.activity.splice(ACTIVITY_KEEP).forEach((old) => persistDelete('activity', old.id));
  };

  const all = (col) => (col === 'users' ? members : state[col]);
  const get = (col, id) => all(col).find((x) => x.id === id) || null;

  const insert = (col, data, detail) => {
    const item = { ...clone(data), id: uid(PREFIX[col]) };
    state[col].push(item);
    persistItem(col, item);
    log('crear', MODULE_LABEL[col], detail || 'Nuevo registro');
    return item;
  };
  const update = (col, id, patch, detail) => {
    const item = get(col, id);
    if (!item) return null;
    Object.assign(item, clone(patch));
    persistItem(col, item);
    log('editar', MODULE_LABEL[col], detail || 'Registro actualizado');
    return item;
  };
  const remove = (col, id, detail) => {
    state[col] = state[col].filter((x) => x.id !== id);
    persistDelete(col, id);
    log('eliminar', MODULE_LABEL[col], detail || 'Registro eliminado');
    return true;
  };
  const removePatient = (pid, detail) => {
    ['appointments', 'budgets', 'payments', 'history', 'consents'].forEach((col) => {
      const gone = state[col].filter((x) => x.patientId === pid);
      if (!gone.length) return;
      state[col] = state[col].filter((x) => x.patientId !== pid);
      gone.forEach((x) => persistDelete(col, x.id));
    });
    if (state.odontograms[pid]) { delete state.odontograms[pid]; persistDelete('odontograms', pid); }
    state.patients = state.patients.filter((x) => x.id !== pid);
    persistDelete('patients', pid);
    log('eliminar', 'Pacientes', detail || 'Paciente eliminado');
    return true;
  };

  const budgetTotal = (b) => {
    const subtotal = b.items.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);
    return U.cents(subtotal * (1 - (Number(b.discount) || 0) / 100));
  };
  const patientBalance = (patientId) => {
    const charged = state.budgets
      .filter((b) => b.patientId === patientId && ['aceptado', 'en_curso', 'finalizado'].includes(b.status))
      .reduce((s, b) => s + budgetTotal(b), 0);
    const paid = state.payments.filter((p) => p.patientId === patientId).reduce((s, p) => s + Number(p.amount), 0);
    return { charged: U.cents(charged), paid: U.cents(paid), balance: U.cents(charged - paid) };
  };
  const nextBudgetNumber = () => state.budgets.reduce((m, b) => Math.max(m, Number(b.number) || 0), 1000) + 1;
  const nextReceipt = () => {
    const last = state.payments.reduce((m, p) => Math.max(m, Number(String(p.receipt || '').replace(/\D/g, '')) || 0), 0);
    return `R-${String(last + 1).padStart(6, '0')}`;
  };

  const getOdontogram = (patientId) => state.odontograms[patientId] || {};
  const setOdontogram = (patientId, data, detail) => {
    state.odontograms[patientId] = clone(data);
    schedule(`odontograms/${patientId}`, { patientId, teeth: clone(data) });
    log('editar', 'Odontograma', detail);
    return true;
  };

  const settings = () => ({
    ...DEFAULT_CONFIG,
    ...state.config,
    clinicName: clinic ? clinic.name : '',
    rif: clinic ? clinic.rif : '',
    phone: clinic ? clinic.phone : '',
    address: clinic ? clinic.address : '',
  });
  const saveConfig = (patch) => {
    const { clinicName, rif, phone, address, ...rest } = patch;
    state.config = { ...DEFAULT_CONFIG, ...state.config, ...rest };
    schedule('config/clinic', state.config);
    U.setCurrency(state.config.currency);
    log('editar', 'Configuración', 'Ajustes de la clínica actualizados');
  };
  const setClinic = (next) => { clinic = { ...clinic, ...next }; };

  const exportBackup = () => JSON.stringify({ app: 'Sonrisas', version: 1, exportedAt: new Date().toISOString(), clinic: { name: clinic.name, rif: clinic.rif }, data: { ...state } }, null, 2);
  const importBackup = (text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('El archivo no es un respaldo válido.'); }
    const data = parsed && (parsed.data || parsed);
    if (!data || !Array.isArray(data.patients)) throw new Error('El archivo no es un respaldo de Sonrisas.');
    const SAFE = /^[A-Za-z0-9_-]{1,120}$/;
    LISTS.forEach((col) => {
      const incoming = (Array.isArray(data[col]) ? data[col] : []).filter((x) => x && SAFE.test(String(x.id)));
      const keep = new Set(incoming.map((x) => x.id));
      state[col].forEach((x) => { if (!keep.has(x.id)) persistDelete(col, x.id); });
      incoming.forEach((x) => persistItem(col, x));
      state[col] = clone(incoming);
    });
    const odontograms = data.odontograms && typeof data.odontograms === 'object' ? data.odontograms : {};
    Object.keys(state.odontograms).forEach((pid) => { if (!odontograms[pid]) persistDelete('odontograms', pid); });
    Object.entries(odontograms).forEach(([pid, teeth]) => { if (SAFE.test(pid)) schedule(`odontograms/${pid}`, { patientId: pid, teeth }); });
    state.odontograms = clone(odontograms);
    if (data.config && typeof data.config === 'object') { state.config = { ...DEFAULT_CONFIG, ...data.config }; schedule('config/clinic', state.config); }
    sortActivity(state.activity);
    log('restaurar', 'Respaldo', 'Datos restaurados desde un archivo');
  };

  window.DB = {
    ROLES, SPECIALTIES, PAYMENT_METHODS, APPT_STATUS, BUDGET_STATUS, TREATMENT_CATEGORIES,
    init, initLocked, teardown, resync, reloadMembers: loadMembers,
    onChange: (fn) => changeListeners.add(fn),
    onSync: (fn) => { syncListeners.add(fn); fn({ pending: pendingWrites(), offline }); },
    onAccountChange: (fn) => accountListeners.add(fn),
    pendingWrites,
    all, get, insert, update, remove, removePatient, log,
    currentUser, role, clinic: () => clinic,
    budgetTotal, patientBalance, nextBudgetNumber, nextReceipt,
    getOdontogram, setOdontogram, settings, saveConfig, setClinic,
    exportBackup, importBackup,
  };
})();
