/* Datos de la clínica (pacientes, citas, presupuestos, pagos…) guardados en Supabase.
   Las vistas trabajan sobre una copia en memoria; cada cambio se envía en segundo plano,
   se reintenta si se corta la conexión y llega en vivo a las demás personas de la clínica. */
(function () {
  const LISTS = ['patients', 'appointments', 'treatments', 'budgets', 'payments', 'history', 'consents', 'photos', 'activity'];
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
  const PREFIX = { patients: 'p', appointments: 'a', treatments: 't', budgets: 'b', payments: 'pay', history: 'h', consents: 'c', photos: 'ph', activity: 'log' };
  const MODULE_LABEL = { patients: 'Pacientes', appointments: 'Citas', treatments: 'Tratamientos', budgets: 'Presupuestos', payments: 'Pagos', history: 'Historia clínica', consents: 'Consentimientos', photos: 'Fotos' };

  const emptyState = () => ({
    patients: [], appointments: [], treatments: [], budgets: [], payments: [], history: [], consents: [], photos: [], activity: [],
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
  /* La app trae todo una vez al entrar y después solo lo que cambió (la hora de cada cambio la pone el servidor).
     Los borrados llegan como marcas en records_deleted. Cada 30 minutos vuelve a traer todo, por las dudas. */
  const FULL_EVERY = 30 * 60000;
  const OVERLAP = 120000; // margen por cambios que se confirmaron un poco después de su hora
  const stamps = new Map(); // "coleccion/id" -> updated_at del servidor (para detectar si otra persona lo cambió)
  let cursor = 0; // mayor updated_at visto (ms)
  let delCursor = 0; // mayor deleted_at visto (ms)
  let lastFull = 0;
  let deltaReady = true; // false si la base todavía no tiene records_deleted

  const noteRow = (row) => {
    const t = Date.parse(row.updated_at || '');
    if (!Number.isNaN(t) && t > cursor) cursor = t;
    const key = `${row.collection}/${row.id}`;
    if (row.updated_at && !overrides.has(key)) stamps.set(key, row.updated_at);
  };

  const fetchRecords = async (sinceMs = 0) => {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = sb.from('records').select('collection,id,data,updated_at').eq('clinic_id', clinic.id);
      query = sinceMs ? query.gt('updated_at', new Date(sinceMs).toISOString()).order('updated_at').order('collection').order('id') : query.order('collection').order('id');
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    return rows;
  };
  const fetchDeleted = async (sinceMs) => {
    const { data, error } = await sb.from('records_deleted').select('collection,id,deleted_at')
      .eq('clinic_id', clinic.id).gt('deleted_at', new Date(sinceMs).toISOString()).order('deleted_at').limit(5000);
    if (error) throw error;
    return data;
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

  /** Trae todo y lo aplica sin pisar los cambios locales pendientes. */
  const fullSync = async () => {
    const rows = await fetchRecords();
    stamps.clear();
    cursor = 0;
    rows.forEach(noteRow);
    delCursor = Math.max(delCursor, cursor);
    lastFull = Date.now();
    return applyServerState(buildState(rows));
  };
  /** Solo lo que cambió desde la última vez. */
  const deltaSync = async () => {
    const since = Math.max(0, cursor - OVERLAP);
    const [rows, gone] = await Promise.all([fetchRecords(since || 1), fetchDeleted(Math.max(0, delCursor - OVERLAP))]);
    let changed = false;
    rows.forEach((row) => { noteRow(row); if (applyRow(row)) changed = true; });
    gone.forEach((d) => { const t = Date.parse(d.deleted_at); if (t > delCursor) delCursor = t; if (applyDelete(d)) changed = true; });
    return changed;
  };

  let syncing = null;
  const resync = () => {
    if (!sb || !clinic) return Promise.resolve();
    if (syncing) return syncing;
    lastResync = Date.now();
    syncing = (async () => {
      try {
        const full = !deltaReady || !cursor || Date.now() - lastFull > FULL_EVERY;
        let changed;
        try {
          changed = full ? await fullSync() : await deltaSync();
        } catch (err) {
          // Base sin records_deleted (versión anterior del esquema): se sigue trayendo todo.
          if (!full && /records_deleted|does not exist|schema cache/i.test(err.message || '')) { deltaReady = false; changed = await fullSync(); } else throw err;
        }
        const membersChanged = await loadMembers();
        if (changed || membersChanged) notifyChange();
      } catch (err) {
        if (isPermissionError(err)) notifyAccount();
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  };
  const resyncIfStale = () => { if (Date.now() - lastResync > 30000) resync(); };

  /** Aplica un registro que llegó del servidor. Devuelve true si cambió algo en pantalla. */
  const applyRow = (row) => {
    if (!row || (row.clinic_id && row.clinic_id !== clinic.id)) return false;
    const key = `${row.collection}/${row.id}`;
    if (overrides.has(key)) return false;
    if (row.collection === 'odontograms') {
      const teeth = (row.data && row.data.teeth) || {};
      if (canon(teeth) === canon(state.odontograms[row.id] || {})) return false;
      state.odontograms[row.id] = teeth;
    } else if (row.collection === 'config') {
      if (row.id !== 'clinic' || canon(row.data) === canon(state.config)) return false;
      state.config = row.data || {};
      U.setCurrency(settings().currency);
    } else {
      const list = state[row.collection];
      if (!list) return false;
      const item = { ...row.data, id: row.id };
      const index = list.findIndex((x) => x.id === row.id);
      if (index >= 0) {
        if (canon(list[index]) === canon(item)) return false;
        list[index] = item;
      } else {
        list.push(item);
        if (row.collection === 'activity') { sortActivity(list); if (list.length > ACTIVITY_MAX) list.splice(ACTIVITY_KEEP); }
      }
    }
    return true;
  };
  /** Algo que otra persona borró. */
  const applyDelete = ({ collection, id }) => {
    const key = `${collection}/${id}`;
    if (overrides.has(key)) return false;
    stamps.delete(key);
    if (collection === 'odontograms') { if (!state.odontograms[id]) return false; delete state.odontograms[id]; return true; }
    const list = state[collection];
    if (!list || !list.some((x) => x.id === id)) return false;
    state[collection] = list.filter((x) => x.id !== id);
    return true;
  };
  const applyRealtimeRow = (row) => {
    if (!row || row.clinic_id !== clinic.id) return;
    noteRow(row);
    if (applyRow(row)) notifyChange();
  };

  const subscribeRealtime = () => {
    if (!sb.channel) return;
    const filter = `clinic_id=eq.${clinic.id}`;
    channel = sb.channel(`clinica-${clinic.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'records', filter }, (p) => applyRealtimeRow(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'records', filter }, (p) => applyRealtimeRow(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records_deleted', filter }, (p) => {
        const d = p.new; if (!d || !d.id) return;
        const t = Date.parse(d.deleted_at || ''); if (t > delCursor) delCursor = t;
        if (applyDelete(d)) notifyChange();
      })
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
    state = emptyState();
    stamps.clear(); cursor = 0; delCursor = 0; lastFull = 0; deltaReady = true;
    const [rows] = await Promise.all([fetchRecords(), loadMembers()]);
    rows.forEach(noteRow);
    delCursor = cursor;
    lastFull = Date.now();
    // Cambios que quedaron sin enviar la última vez (sin conexión o la app se cerró): se vuelven a mandar.
    restorePending();
    applyServerState(buildState(rows));
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
    savePendingNow();
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
    stamps.clear();
    pendingKey = '';
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

  let mergeToastAt = 0;
  const mergedNotice = () => {
    if (Date.now() - mergeToastAt < 8000) return;
    mergeToastAt = Date.now();
    U.toast('Otra persona también modificó este registro. Combinamos los dos cambios.');
  };

  /**
   * Guarda un documento. Si ya existía, solo lo actualiza si nadie lo cambió desde que lo vimos (updated_at);
   * si otra persona lo cambió, combina: toma su versión y le aplica solo los campos que cambiamos aquí.
   * La actividad solo se agrega (no se edita ni se borra).
   */
  const runWrite = async (key, body, fields) => {
    const [collection, id] = key.split('/');
    const where = { clinic_id: clinic.id, collection, id };
    if (body === null) {
      const { error } = await sb.from('records').delete().match(where);
      if (error) throw error;
      stamps.delete(key);
      return null;
    }
    const insert = async (data) => {
      const { data: rows, error } = await sb.from('records')
        .upsert({ ...where, data, updated_at: new Date().toISOString() }, { onConflict: 'clinic_id,collection,id', ignoreDuplicates: collection === 'activity' })
        .select('updated_at');
      if (error) throw error;
      if (rows && rows[0]) stamps.set(key, rows[0].updated_at);
      return null;
    };
    let stamp = stamps.get(key);
    if (!stamp || collection === 'activity') return insert(body);
    let data = body;
    let merged = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: rows, error } = await sb.from('records').update({ data, updated_at: new Date().toISOString() })
        .match(where).eq('updated_at', stamp).select('updated_at');
      if (error) throw error;
      if (rows && rows.length) { stamps.set(key, rows[0].updated_at); return merged; }
      // Otra persona lo cambió (o lo borró) mientras tanto.
      const { data: current, error: readError } = await sb.from('records').select('data,updated_at').match(where).maybeSingle();
      if (readError) throw readError;
      if (!current) { stamps.delete(key); await insert(data); return merged; }
      stamp = current.updated_at;
      if (fields && fields.length) {
        const mine = {};
        fields.forEach((f) => { mine[f] = data[f]; });
        data = { ...current.data, ...mine };
        merged = data;
      }
    }
    throw new Error('Varias personas están cambiando este registro a la vez. Intenta de nuevo.');
  };

  /** Si se combinó con el cambio de otra persona, la pantalla muestra el resultado combinado. */
  const applyMerged = (key, data) => {
    const [collection, id] = key.split('/');
    if (overrides.has(key) || !state[collection] || !Array.isArray(state[collection])) return;
    const index = state[collection].findIndex((x) => x.id === id);
    if (index >= 0) { state[collection][index] = { ...data, id }; notifyChange(); }
    mergedNotice();
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
      const { body, seq: mySeq, fields } = slot;
      slot.has = false;
      slot.busy = true;
      slot.fields = undefined;
      activeWrites++;
      runWrite(key, body, fields)
        .then((merged) => {
          offline = false;
          slot.failures = 0;
          const pending = overrides.get(key);
          if (pending && pending.seq === mySeq) overrides.delete(key);
          if (merged) applyMerged(key, merged);
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
            if (!slot.has) { slot.has = true; slot.body = body; slot.seq = mySeq; slot.fields = fields; }
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
          savePending();
          notifySync();
          pump();
        });
    }
    notifySync();
  };

  /** Encola la escritura de un documento (body = null lo borra). Solo viaja el último estado de cada documento.
      fields: campos que cambió esta edición (para combinar si otra persona cambió el mismo documento); sin fields, va completo. */
  const schedule = (key, body, fields) => {
    const slot = slots.get(key) || { has: false, busy: false, queued: false, failures: 0 };
    if (body === null || !fields) slot.fields = undefined; // borrado o documento completo
    else if (slot.has && !slot.fields) slot.fields = undefined; // ya había pendiente un documento completo
    else slot.fields = [...new Set([...(slot.has ? slot.fields : []), ...fields])];
    slot.body = body === null ? null : clone(body);
    slot.seq = ++writeSeq;
    slot.has = true;
    slots.set(key, slot);
    overrides.set(key, { body: slot.body, seq: slot.seq });
    if (!slot.busy && !slot.queued) { slot.queued = true; waiting.push(key); }
    savePending();
    pump();
  };

  /* ---------- Cambios pendientes guardados en el equipo ----------
     Si se corta internet y se cierra la app, lo que no llegó al servidor se envía al volver a abrirla. */
  let pendingKey = '';
  let saveTimer = null;
  const pendingList = () => {
    const list = [];
    slots.forEach((slot, key) => { if (slot.has || slot.busy) { const o = overrides.get(key); if (o) list.push({ key, body: o.body, fields: slot.fields || null }); } });
    return list;
  };
  const savePendingNow = () => {
    clearTimeout(saveTimer);
    if (!pendingKey) return;
    try {
      const list = pendingList();
      if (list.length) localStorage.setItem(pendingKey, JSON.stringify(list)); else localStorage.removeItem(pendingKey);
    } catch { /* sin almacenamiento: se guarda igual mientras la app siga abierta */ }
  };
  const savePending = () => { clearTimeout(saveTimer); saveTimer = setTimeout(savePendingNow, 250); };
  const restorePending = () => {
    pendingKey = `sonrisas-pendientes-${clinic.id}-${myId}`;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(pendingKey) || '[]'); } catch { list = []; }
    list.filter((x) => x && typeof x.key === 'string' && /^[a-z]+\/[A-Za-z0-9_-]{1,120}$/.test(x.key))
      .forEach((x) => schedule(x.key, x.body === undefined ? null : x.body, Array.isArray(x.fields) ? x.fields : undefined));
  };
  window.addEventListener('pagehide', () => savePendingNow());

  const strip = (item) => { const { id, ...rest } = item; return rest; };
  const persistItem = (col, item, fields) => schedule(`${col}/${item.id}`, strip(item), fields);
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
    // En pantalla se guardan las últimas; el servidor recorta las viejas (la actividad no se borra desde la app).
    if (state.activity.length > ACTIVITY_MAX) state.activity.splice(ACTIVITY_KEEP);
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
  /** Varios registros de una vez, con una sola línea en la actividad. */
  const insertMany = (col, list, detail) => {
    const items = list.map((data) => ({ ...clone(data), id: uid(PREFIX[col]) }));
    items.forEach((item) => { state[col].push(item); persistItem(col, item); });
    if (items.length) log('crear', MODULE_LABEL[col], detail || 'Nuevos registros');
    return items;
  };
  /** changes: [{ id, patch }]. Una sola línea en la actividad. */
  const updateMany = (col, changes, detail) => {
    const items = changes.map(({ id, patch }) => {
      const item = get(col, id);
      if (item) { Object.assign(item, clone(patch)); persistItem(col, item, Object.keys(patch)); }
      return item;
    }).filter(Boolean);
    if (items.length) log('editar', MODULE_LABEL[col], detail || 'Registros actualizados');
    return items;
  };
  const update = (col, id, patch, detail) => {
    const item = get(col, id);
    if (!item) return null;
    Object.assign(item, clone(patch));
    persistItem(col, item, Object.keys(patch));
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
    const patient = get('patients', pid);
    const files = [patient && patient.photo, ...state.photos.filter((x) => x.patientId === pid).flatMap((x) => [x.path, x.thumb])].filter(Boolean);
    const unique = [...new Set(files)];
    if (unique.length && window.Photos) Photos.remove(unique).catch(() => {});
    ['appointments', 'budgets', 'payments', 'history', 'consents', 'photos'].forEach((col) => {
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
  /* ---------- N.º de historia clínica (expediente) de cada paciente ----------
     Se guarda en patients.record como texto ("0001"): se asigna solo al registrar y se puede editar,
     por si el consultorio ya usa sus propios números de carpeta. */
  const RECORD_DIGITS = 4;
  const recordDigits = (value) => String(value || '').replace(/\D/g, '');
  const nextRecordNumber = () => {
    const last = state.patients.reduce((m, p) => Math.max(m, Number(recordDigits(p.record)) || 0), 0);
    return String(last + 1).padStart(RECORD_DIGITS, '0');
  };
  /** Dos números de historia son el mismo: "12", "012" y "0012" cuentan como iguales. */
  const sameRecord = (a, b) => {
    const norm = (v) => String(v || '').trim().toLowerCase().replace(/[\s-]/g, '');
    const x = norm(a); const y = norm(b);
    if (!x || !y) return false;
    return /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) === Number(y) : x === y;
  };
  /** Pacientes sin número (registrados antes de que existiera): se numeran por fecha de registro.
      El orden es fijo, así dos equipos que lo hagan a la vez ponen los mismos números. Devuelve cuántos numeró. */
  const ensureRecordNumbers = () => {
    const missing = state.patients.filter((p) => !String(p.record || '').trim())
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
    if (!missing.length) return 0;
    let next = Number(nextRecordNumber());
    const changes = missing.map((p) => ({ id: p.id, patch: { record: String(next++).padStart(RECORD_DIGITS, '0') } }));
    updateMany('patients', changes, `${changes.length === 1 ? 'Se asignó 1 número' : `Se asignaron ${changes.length} números`} de historia clínica`);
    return changes.length;
  };
  /** Búsqueda de pacientes por nombre, cédula, teléfono, correo o N.º de historia ("12", "0012", "HC 12", "HC-0012"). */
  const patientMatches = (p, query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    if (`${p.firstName} ${p.lastName} ${p.lastName} ${p.firstName} ${p.dni} ${p.phone} ${p.email} ${p.record}`.toLowerCase().includes(q)) return true;
    const asRecord = q.replace(/^(h\.?\s*c\.?|historia( cl[ií]nica)?|n[.ºo°]*|#)\s*[-:#]?\s*/i, '').trim();
    const digits = recordDigits(asRecord);
    return !!digits && digits === asRecord.replace(/[\s-]/g, '') && Number(digits) === Number(recordDigits(p.record)) && !!recordDigits(p.record);
  };

  const nextBudgetNumber = () => state.budgets.reduce((m, b) => Math.max(m, Number(b.number) || 0), 1000) + 1;
  const nextReceipt = () => {
    const last = state.payments.reduce((m, p) => Math.max(m, Number(String(p.receipt || '').replace(/\D/g, '')) || 0), 0);
    return `R-${String(last + 1).padStart(6, '0')}`;
  };

  /* Números que no se repiten entre equipos: los da el servidor (next_number). Sin conexión, se calcula aquí. */
  const reserve = async (kind, local) => {
    try {
      const { data, error } = await sb.rpc('next_number', { p_kind: kind });
      if (error || !(Number(data) > 0)) throw error || new Error('sin número');
      return Number(data);
    } catch {
      return local();
    }
  };
  const reserveReceipt = async () => `R-${String(await reserve('receipt', () => Number(nextReceipt().slice(2)))).padStart(6, '0')}`;
  const reserveBudgetNumber = () => reserve('budget', nextBudgetNumber);
  const reserveRecordNumber = async () => String(await reserve('record', () => Number(nextRecordNumber()))).padStart(RECORD_DIGITS, '0');

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
  const saveConfig = (patch, { silent = false } = {}) => {
    const { clinicName, rif, phone, address, ...rest } = patch;
    state.config = { ...DEFAULT_CONFIG, ...state.config, ...rest };
    schedule('config/clinic', state.config, Object.keys(rest));
    U.setCurrency(state.config.currency);
    if (!silent) log('editar', 'Configuración', 'Ajustes de la clínica actualizados');
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
      // Los respaldos anteriores a las fotos no traen "photos": se conservan las que hay.
      if (col === 'photos' && !Array.isArray(data.photos)) return;
      const incoming = (Array.isArray(data[col]) ? data[col] : []).filter((x) => x && SAFE.test(String(x.id)));
      const keep = new Set(incoming.map((x) => x.id));
      // La actividad no se borra: se suman las entradas del respaldo a las que ya hay.
      if (col !== 'activity') state[col].forEach((x) => { if (!keep.has(x.id)) persistDelete(col, x.id); });
      incoming.forEach((x) => persistItem(col, x));
      state[col] = col === 'activity' ? [...state.activity.filter((x) => !keep.has(x.id)), ...clone(incoming)] : clone(incoming);
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
    all, get, insert, insertMany, update, updateMany, remove, removePatient, log,
    currentUser, role, clinic: () => clinic,
    budgetTotal, patientBalance, nextBudgetNumber, nextReceipt,
    nextRecordNumber, ensureRecordNumbers, patientMatches, sameRecord, reserveReceipt, reserveBudgetNumber, reserveRecordNumber,
    getOdontogram, setOdontogram, settings, saveConfig, setClinic,
    exportBackup, importBackup,
  };
})();
