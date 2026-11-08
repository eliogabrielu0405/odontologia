/* Capa de datos de DentaGest.
   - Dentro de claude.ai (artefacto): usa la base compartida del artefacto (capacidad `db`),
     con actualizaciones en vivo cuando otra persona modifica algo.
   - Fuera de claude.ai: guarda todo en este navegador (localStorage) y arranca con datos de ejemplo.
   Las vistas trabajan siempre sobre una copia en memoria; las escrituras se envían en segundo plano. */
(function () {
  const { storage, inClaude, capability, newSalt, hashPassword } = U;

  const LOCAL_KEY = 'dentagest-db-v1';
  const SESSION_KEY = 'dentagest-session';
  const LISTS = ['users', 'patients', 'appointments', 'treatments', 'budgets', 'payments', 'history', 'consents', 'activity'];
  const CLOUD_COLLECTIONS = [...LISTS, 'odontograms', 'config'];
  const ACTIVITY_KEEP = 300;
  const ACTIVITY_MAX = 360;
  const MAX_PARALLEL_WRITES = 4;
  const SAFE_ID = /^[A-Za-z0-9_-]{1,120}$/;

  const ROLES = { admin: 'Administrador', odontologo: 'Odontólogo/a', recepcion: 'Recepción' };
  const SPECIALTIES = ['Odontología general', 'Ortodoncia', 'Endodoncia', 'Periodoncia', 'Implantología', 'Odontopediatría', 'Cirugía maxilofacial'];
  const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito', 'Obra social'];
  const APPT_STATUS = { programada: 'Programada', confirmada: 'Confirmada', atendida: 'Atendida', cancelada: 'Cancelada', ausente: 'No asistió' };
  const BUDGET_STATUS = { pendiente: 'Pendiente', aceptado: 'Aceptado', en_curso: 'En curso', finalizado: 'Finalizado', rechazado: 'Rechazado' };
  const TREATMENT_CATEGORIES = ['Diagnóstico', 'Prevención', 'Operatoria', 'Endodoncia', 'Periodoncia', 'Cirugía', 'Prótesis', 'Ortodoncia', 'Implantes', 'Estética'];
  const DEFAULT_SETTINGS = {
    clinicName: 'Mi clínica dental', taxId: '', phone: '', email: '', address: '',
    openTime: '09:00', closeTime: '19:00', workDays: 'Lunes a viernes', slotMinutes: 30,
    receiptFooter: 'Gracias por confiar en nosotros.',
  };
  const PREFIX = { users: 'u', patients: 'p', appointments: 'a', treatments: 't', budgets: 'b', payments: 'pay', history: 'h', consents: 'c', activity: 'log' };
  const MODULE_LABEL = { users: 'Usuarios', patients: 'Pacientes', appointments: 'Citas', treatments: 'Tratamientos', budgets: 'Presupuestos', payments: 'Pagos', history: 'Historia clínica', consents: 'Consentimientos' };

  const emptyState = () => ({
    users: [], patients: [], appointments: [], treatments: [], budgets: [], payments: [], history: [], consents: [], activity: [],
    odontograms: {}, settings: { ...DEFAULT_SETTINGS },
  });

  let state = emptyState();
  let mode = 'loading'; // 'local' | 'cloud' | 'unavailable'
  let readOnly = false;
  const confirmed = new Set();
  const changeListeners = new Set();
  const syncListeners = new Set();

  let seq = 0;
  const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const canon = (v) => {
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
    return JSON.stringify(v === undefined ? null : v);
  };
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const listSignature = (list) => canon([...list].sort(byId));

  let changeTimer;
  const notifyChange = () => {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => changeListeners.forEach((fn) => fn()), 150);
  };

  /* =====================================================================
     Base compartida del artefacto
     ===================================================================== */
  let cloud = null;
  const overrides = new Map(); // ruta -> { body, seq }: cambios locales aún no confirmados
  const slots = new Map();     // ruta -> estado de la cola de escritura de ese documento
  const waiting = [];
  let activeWrites = 0;
  let writeSeq = 0;

  const pendingWrites = () => { let n = 0; slots.forEach((s) => { if (s.has || s.busy) n++; }); return n; };
  const notifySync = () => { const n = pendingWrites(); syncListeners.forEach((fn) => fn(n)); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastSaveErrorAt = 0;
  const reportWriteError = (code) => {
    if (code === 'invalid_argument' || code === 'transform_error' || code === 'not_granted') {
      if (!readOnly) { readOnly = true; notifyChange(); }
      U.toast('No tenés permiso para modificar los datos de esta clínica.', 'err');
      return;
    }
    if (code === 'quota_exceeded') { U.toast('La base de datos está llena. Eliminá registros antiguos para seguir guardando.', 'err'); return; }
    if (code === 'revoked' || code === 'capability_disabled' || code === 'capability_removed') { mode = 'unavailable'; notifyChange(); return; }
    if (Date.now() - lastSaveErrorAt > 4000) {
      lastSaveErrorAt = Date.now();
      U.toast('No se pudo guardar un cambio. Revisá la conexión e intentá de nuevo.', 'err');
    }
  };

  const runWrite = async (path, body) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const ref = cloud.doc(path);
        if (body === null) await ref.delete(); else await ref.set(body);
        return true;
      } catch (err) {
        const code = (err && err.code) || 'unavailable';
        if (code === 'unavailable' && attempt === 0) { await sleep(300 + Math.random() * 700); continue; }
        if (code === 'resource_exhausted' && attempt < 2) { await sleep(1500 * (attempt + 1) + Math.random() * 500); continue; }
        reportWriteError(code);
        return false;
      }
    }
    return false;
  };

  const applyDoc = (path, body) => {
    if (overrides.has(path)) return;
    const [col, id] = path.split('/');
    if (col === 'config') {
      const next = { ...DEFAULT_SETTINGS, ...(body || {}) };
      if (canon(next) !== canon(state.settings)) { state.settings = next; notifyChange(); }
      return;
    }
    if (col === 'odontograms') {
      const next = { ...state.odontograms };
      if (body) next[id] = body.teeth || {}; else delete next[id];
      if (canon(next) !== canon(state.odontograms)) { state.odontograms = next; notifyChange(); }
      return;
    }
    const list = state[col];
    if (!list) return;
    const index = list.findIndex((x) => x.id === id);
    const next = list.slice();
    if (body) { if (index >= 0) next[index] = body; else next.push(body); }
    else if (index >= 0) next.splice(index, 1);
    else return;
    if (col === 'activity') next.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    state[col] = next;
    notifyChange();
  };

  const refetch = async (path) => {
    try {
      const snap = await cloud.doc(path).get();
      applyDoc(path, snap.exists ? clone(snap.data()) : null);
    } catch { /* la próxima actualización en vivo lo corrige */ }
  };

  const pump = () => {
    while (activeWrites < MAX_PARALLEL_WRITES && waiting.length) {
      const path = waiting.shift();
      const slot = slots.get(path);
      if (!slot) continue;
      slot.queued = false;
      if (!slot.has) continue;
      const { body, seq: mySeq } = slot;
      slot.has = false;
      slot.busy = true;
      activeWrites++;
      runWrite(path, body)
        .then((ok) => {
          const pending = overrides.get(path);
          if (pending && pending.seq === mySeq) overrides.delete(path);
          if (!ok) refetch(path);
        })
        .finally(() => {
          slot.busy = false;
          activeWrites--;
          if (slot.has && !slot.queued) { slot.queued = true; waiting.push(path); }
          if (!slot.has && !slot.busy && !slot.queued) slots.delete(path);
          notifySync();
          pump();
        });
    }
    notifySync();
  };

  /** Encola la escritura de un documento (body = null lo borra). Solo viaja el último estado de cada documento. */
  const schedule = (path, body) => {
    const slot = slots.get(path) || { has: false, busy: false, queued: false };
    slot.body = body === null ? null : clone(body);
    slot.seq = ++writeSeq;
    slot.has = true;
    slots.set(path, slot);
    overrides.set(path, { body: slot.body, seq: slot.seq });
    if (!slot.busy && !slot.queued) { slot.queued = true; waiting.push(path); }
    pump();
  };

  const applySnapshot = (col, snap) => {
    const docs = new Map();
    snap.docs.forEach((doc) => { if (doc.exists) docs.set(doc.id, doc.data()); });
    overrides.forEach((pending, path) => {
      const [c, id] = path.split('/');
      if (c !== col) return;
      if (pending.body === null) docs.delete(id); else docs.set(id, pending.body);
    });
    if (col === 'config') {
      const next = { ...DEFAULT_SETTINGS, ...clone(docs.get('clinic') || {}) };
      if (canon(next) === canon(state.settings)) return false;
      state.settings = next;
      return true;
    }
    if (col === 'odontograms') {
      const next = {};
      docs.forEach((value, id) => { next[id] = clone((value && value.teeth) || {}); });
      if (canon(next) === canon(state.odontograms)) return false;
      state.odontograms = next;
      return true;
    }
    const next = [...docs.values()].map(clone);
    if (listSignature(next) === listSignature(state[col])) return false;
    if (col === 'activity') next.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    state[col] = next;
    return true;
  };

  const subscribe = (col, onFirst) => {
    let first = true;
    const done = () => { if (first) { first = false; onFirst(); } };
    cloud.collection(col).onSnapshot(
      (snap) => {
        const changed = applySnapshot(col, snap);
        const wasConfirmed = confirmed.has(col);
        if (!snap.metadata || !snap.metadata.fromCache) confirmed.add(col);
        if (first) { done(); return; }
        if (changed || (!wasConfirmed && confirmed.has(col))) notifyChange();
      },
      (err) => {
        const code = err && err.code;
        done();
        if (code === 'revoked') { mode = 'unavailable'; notifyChange(); return; }
        if (code === 'unavailable') { setTimeout(() => subscribe(col, () => {}), 2000 + Math.random() * 2000); return; }
        console.warn('DentaGest: no se pudo leer la colección', col, err);
      },
    );
  };

  const initCloud = (dbNamespace) => new Promise((resolve) => {
    cloud = dbNamespace;
    mode = 'cloud';
    let remaining = CLOUD_COLLECTIONS.length;
    CLOUD_COLLECTIONS.forEach((col) => {
      try {
        subscribe(col, () => { remaining--; if (remaining === 0) resolve(); });
      } catch (err) {
        console.warn('DentaGest: no se pudo suscribir a', col, err);
        remaining--;
        if (remaining === 0) resolve();
      }
    });
  });

  /* =====================================================================
     Navegador (sin claude.ai)
     ===================================================================== */
  const persistLocal = () => storage.set(LOCAL_KEY, JSON.stringify(state));

  const securePassword = (user) => {
    const { password, ...rest } = user;
    if (!password) return rest;
    const salt = newSalt();
    return { ...rest, salt, passwordHash: hashPassword(password, salt) };
  };
  const prepareSeed = (seed) => ({ ...seed, users: seed.users.map(securePassword) });

  const normalize = (raw) => {
    const next = { ...emptyState(), ...raw, settings: { ...DEFAULT_SETTINGS, ...((raw && raw.settings) || {}) } };
    LISTS.forEach((c) => { next[c] = Array.isArray(next[c]) ? next[c].filter((x) => x && SAFE_ID.test(String(x.id))) : []; });
    if (!next.odontograms || typeof next.odontograms !== 'object') next.odontograms = {};
    Object.keys(next.odontograms).forEach((pid) => { if (!SAFE_ID.test(pid)) delete next.odontograms[pid]; });
    next.activity = next.activity.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, ACTIVITY_KEEP);
    return next;
  };

  const initLocal = () => {
    mode = 'local';
    let loaded = null;
    try { const raw = storage.get(LOCAL_KEY); loaded = raw ? JSON.parse(raw) : null; } catch { loaded = null; }
    if (!loaded || !Array.isArray(loaded.users) || !loaded.users.length) {
      loaded = window.DentaSeed ? prepareSeed(window.DentaSeed(new Date())) : emptyState();
    }
    state = normalize(loaded);
    CLOUD_COLLECTIONS.forEach((c) => confirmed.add(c));
    persistLocal();
  };

  /* =====================================================================
     Arranque
     ===================================================================== */
  const init = async () => {
    if (inClaude) {
      const [dbNamespace, user] = await Promise.all([capability('db'), capability('user')]);
      if (dbNamespace) {
        if (user && typeof user.can === 'function') {
          try { readOnly = (await user.can('data.write')) === false; } catch { readOnly = false; }
        }
        await initCloud(dbNamespace);
        return mode;
      }
      if (!window.DentaSeed) { mode = 'unavailable'; return mode; }
    }
    initLocal();
    return mode;
  };

  /* =====================================================================
     Persistencia común
     ===================================================================== */
  const persistItem = (col, item) => {
    if (mode === 'local') persistLocal();
    else if (mode === 'cloud') schedule(`${col}/${item.id}`, item);
  };
  const persistDelete = (col, id) => {
    if (mode === 'local') persistLocal();
    else if (mode === 'cloud') schedule(`${col}/${id}`, null);
  };
  const persistSettings = () => {
    if (mode === 'local') persistLocal();
    else if (mode === 'cloud') schedule('config/clinic', state.settings);
  };
  const persistOdontogram = (pid) => {
    if (mode === 'local') { persistLocal(); return; }
    if (mode !== 'cloud') return;
    const teeth = state.odontograms[pid];
    schedule(`odontograms/${pid}`, teeth && Object.keys(teeth).length ? { patientId: pid, teeth } : null);
  };

  const writable = () => {
    if (mode !== 'local' && mode !== 'cloud') { U.toast('Los datos de la clínica no están disponibles en esta vista.', 'err'); return false; }
    if (readOnly) { U.toast('Solo lectura: no tenés permiso para modificar los datos de esta clínica.', 'err'); return false; }
    return true;
  };

  /* ---------- Sesión ---------- */
  const sessionUserId = () => storage.get(SESSION_KEY) || storage.get(SESSION_KEY, 'session');
  const currentUser = () => {
    const id = sessionUserId();
    return id ? state.users.find((u) => u.id === id && u.active) || null : null;
  };
  const verifyPassword = (user, password) => {
    if (user.passwordHash) return hashPassword(password, user.salt || '') === user.passwordHash;
    return typeof user.password === 'string' && user.password === password;
  };

  /* ---------- Auditoría ---------- */
  const log = (action, module, detail, user = currentUser()) => {
    if (readOnly || (mode !== 'local' && mode !== 'cloud')) return;
    const entry = { id: uid('log'), date: new Date().toISOString(), userId: user ? user.id : null, action, module, detail: String(detail || '') };
    state.activity.unshift(entry);
    if (state.activity.length > ACTIVITY_MAX) {
      const removed = state.activity.splice(ACTIVITY_KEEP);
      if (mode === 'cloud') removed.forEach((old) => schedule(`activity/${old.id}`, null));
    }
    persistItem('activity', entry);
  };

  const login = (email, password, remember) => {
    const user = state.users.find((u) => String(u.email).toLowerCase() === String(email).trim().toLowerCase());
    if (!user || !verifyPassword(user, password)) return { error: 'Email o contraseña incorrectos.' };
    if (!user.active) return { error: 'Este usuario está desactivado. Pedile a un administrador que lo active.' };
    storage.remove(SESSION_KEY);
    storage.remove(SESSION_KEY, 'session');
    storage.set(SESSION_KEY, user.id, remember ? 'local' : 'session');
    if (user.password && !user.passwordHash && !readOnly) {
      const upgraded = securePassword({ ...user });
      Object.keys(user).forEach((k) => delete user[k]);
      Object.assign(user, upgraded);
      persistItem('users', user);
    }
    log('login', 'Sesión', 'Inicio de sesión', user);
    return { user };
  };
  const logout = () => {
    const user = currentUser();
    if (user) log('logout', 'Sesión', 'Cierre de sesión', user);
    storage.remove(SESSION_KEY);
    storage.remove(SESSION_KEY, 'session');
  };

  /* ---------- CRUD genérico ---------- */
  const all = (col) => state[col];
  const get = (col, id) => state[col].find((x) => x.id === id) || null;

  const insert = (col, data, detail) => {
    if (!writable()) return null;
    const base = col === 'users' ? securePassword(data) : { ...data };
    const item = { ...base, id: uid(PREFIX[col]) };
    state[col].push(item);
    persistItem(col, item);
    log('crear', MODULE_LABEL[col], detail || 'Nuevo registro');
    return item;
  };
  const update = (col, id, patch, detail) => {
    if (!writable()) return null;
    const item = get(col, id);
    if (!item) return null;
    let changes = { ...patch };
    if (col === 'users') {
      if (changes.password) changes = securePassword(changes);
      else delete changes.password;
      if (changes.passwordHash) delete item.password;
    }
    Object.assign(item, changes);
    persistItem(col, item);
    log('editar', MODULE_LABEL[col], detail || 'Registro actualizado');
    return item;
  };
  const remove = (col, id, detail) => {
    if (!writable()) return false;
    state[col] = state[col].filter((x) => x.id !== id);
    persistDelete(col, id);
    log('eliminar', MODULE_LABEL[col], detail || 'Registro eliminado');
    return true;
  };

  /** Elimina un paciente con todo lo asociado (citas, presupuestos, pagos, historia, consentimientos y odontograma). */
  const removePatient = (pid, detail) => {
    if (!writable()) return false;
    ['appointments', 'budgets', 'payments', 'history', 'consents'].forEach((col) => {
      const gone = state[col].filter((x) => x.patientId === pid);
      if (!gone.length) return;
      state[col] = state[col].filter((x) => x.patientId !== pid);
      gone.forEach((x) => persistDelete(col, x.id));
    });
    if (state.odontograms[pid]) { delete state.odontograms[pid]; persistOdontogram(pid); }
    state.patients = state.patients.filter((x) => x.id !== pid);
    persistDelete('patients', pid);
    log('eliminar', 'Pacientes', detail || 'Paciente eliminado');
    return true;
  };

  /* ---------- Consultas de dominio ---------- */
  const budgetTotal = (b) => {
    const subtotal = b.items.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);
    return Math.round(subtotal * (1 - (Number(b.discount) || 0) / 100));
  };
  const patientBalance = (patientId) => {
    const charged = state.budgets
      .filter((b) => b.patientId === patientId && ['aceptado', 'en_curso', 'finalizado'].includes(b.status))
      .reduce((s, b) => s + budgetTotal(b), 0);
    const paid = state.payments.filter((p) => p.patientId === patientId).reduce((s, p) => s + Number(p.amount), 0);
    return { charged, paid, balance: charged - paid };
  };
  const nextBudgetNumber = () => state.budgets.reduce((m, b) => Math.max(m, Number(b.number) || 0), 1000) + 1;
  const nextReceipt = () => {
    const last = state.payments.reduce((m, p) => Math.max(m, Number(String(p.receipt || '').replace(/\D/g, '')) || 0), 2000);
    return `R-${String(last + 1).padStart(6, '0')}`;
  };

  const getOdontogram = (patientId) => state.odontograms[patientId] || {};
  const setOdontogram = (patientId, data, detail) => {
    if (!writable()) return false;
    if (Object.keys(data).length) state.odontograms[patientId] = clone(data); else delete state.odontograms[patientId];
    persistOdontogram(patientId);
    log('editar', 'Odontograma', detail);
    return true;
  };

  const settings = () => state.settings;
  const saveSettings = (patch) => {
    if (!writable()) return false;
    state.settings = { ...state.settings, ...patch };
    persistSettings();
    log('editar', 'Configuración', 'Datos de la clínica actualizados');
    return true;
  };

  /** Primera puesta en marcha con la base vacía: crea la clínica y su administrador. */
  const setupClinic = ({ clinicName, firstName, lastName, email, password }) => {
    if (!writable()) return null;
    state.settings = { ...DEFAULT_SETTINGS, clinicName: clinicName || DEFAULT_SETTINGS.clinicName };
    persistSettings();
    const admin = { ...securePassword({ firstName, lastName, email: String(email).trim(), password, role: 'admin', specialty: '', phone: '', active: true, color: '#0d9488' }), id: uid('u') };
    state.users.push(admin);
    persistItem('users', admin);
    storage.set(SESSION_KEY, admin.id);
    log('crear', 'Configuración', 'Clínica configurada por primera vez', admin);
    return admin;
  };

  /* ---------- Reemplazo completo (respaldos y reinicios) ---------- */
  const replaceAll = (raw) => {
    const prev = state;
    const next = normalize(raw);
    state = next;
    if (mode === 'local') { persistLocal(); return; }
    if (mode !== 'cloud') return;
    LISTS.forEach((col) => {
      const keep = new Set(next[col].map((x) => x.id));
      prev[col].forEach((x) => { if (!keep.has(x.id)) schedule(`${col}/${x.id}`, null); });
      next[col].forEach((x) => schedule(`${col}/${x.id}`, x));
    });
    Object.keys(prev.odontograms).forEach((pid) => { if (!next.odontograms[pid]) schedule(`odontograms/${pid}`, null); });
    Object.entries(next.odontograms).forEach(([pid, teeth]) => schedule(`odontograms/${pid}`, { patientId: pid, teeth }));
    schedule('config/clinic', next.settings);
  };

  const exportBackup = () => JSON.stringify({ app: 'DentaGest', version: 2, exportedAt: new Date().toISOString(), data: state }, null, 2);
  const importBackup = (text) => {
    if (!writable()) throw new Error('No tenés permiso para modificar los datos de esta clínica.');
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido.'); }
    const data = parsed && (parsed.data || parsed);
    if (!data || !Array.isArray(data.users) || !Array.isArray(data.patients)) throw new Error('El archivo no es un respaldo de DentaGest.');
    const me = currentUser();
    replaceAll({ ...clone(data), users: data.users.map((u) => (u.password && !u.passwordHash ? securePassword(u) : u)) });
    log('restaurar', 'Respaldo', 'Sistema restaurado desde un archivo', me);
  };

  /** Borra todo excepto el catálogo de tratamientos y el usuario actual, que recibe email y contraseña nuevos. */
  const wipeForNewClinic = ({ email, password }) => {
    if (!writable()) return false;
    const me = currentUser();
    const next = emptyState();
    next.treatments = clone(state.treatments);
    next.settings = { ...state.settings };
    delete next.settings.exampleData;
    delete next.settings.demoAccounts;
    if (me) {
      const fresh = securePassword({ ...clone(me), email: String(email || me.email).trim(), password });
      delete fresh.password;
      next.users = [fresh];
    }
    replaceAll(next);
    log('reiniciar', 'Sistema', 'Sistema reiniciado para una nueva clínica', me);
    return true;
  };

  const canResetDemo = () => mode === 'local' && typeof window.DentaSeed === 'function';
  const resetDemo = () => {
    if (!canResetDemo()) return;
    replaceAll(prepareSeed(window.DentaSeed(new Date())));
  };

  window.DB = {
    ROLES, SPECIALTIES, PAYMENT_METHODS, APPT_STATUS, BUDGET_STATUS, TREATMENT_CATEGORIES,
    init,
    mode: () => mode,
    isReadOnly: () => readOnly,
    isConfirmed: (col) => confirmed.has(col),
    onChange: (fn) => changeListeners.add(fn),
    onSync: (fn) => { syncListeners.add(fn); fn(pendingWrites()); },
    pendingWrites,
    all, get, insert, update, remove, removePatient, log,
    currentUser, login, logout, setupClinic,
    budgetTotal, patientBalance, nextBudgetNumber, nextReceipt,
    getOdontogram, setOdontogram, settings, saveSettings,
    exportBackup, importBackup, wipeForNewClinic, canResetDemo, resetDemo,
  };
})();
