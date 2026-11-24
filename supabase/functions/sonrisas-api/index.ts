// Sonrisas · función del servidor (Supabase Edge Function).
// Hace lo que requiere permisos de servidor: crear cuentas ya confirmadas (sin depender del correo),
// unir personal con un código de invitación, crear la cuenta de administrador y las acciones del panel
// de administración (eliminar clínicas, restablecer contraseñas).
// Se despliega con verify_jwt = false porque el registro es público; las acciones protegidas validan el token.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class Fail extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Body = Record<string, unknown>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COLORS = ['#0284c7', '#7c3aed', '#d97706', '#db2777', '#16a34a', '#475569'];
const clean = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max);

/** Fecha de hoy en Venezuela (UTC-4, sin horario de verano). */
const todayVE = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const tempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `Sonrisa-${[...bytes].map((b) => chars[b % chars.length]).join('')}`;
};

const credentials = (body: Body) => {
  const email = clean(body.email, 160).toLowerCase();
  const password = String(body.password ?? '');
  if (!EMAIL.test(email)) throw new Fail(400, 'Escribe un correo válido.');
  if (password.length < 8) throw new Fail(400, 'La contraseña debe tener al menos 8 caracteres.');
  if (password.length > 72) throw new Fail(400, 'La contraseña es demasiado larga (máximo 72 caracteres).');
  return { email, password };
};
const person = (body: Body) => {
  const firstName = clean(body.firstName, 60);
  const lastName = clean(body.lastName, 60);
  const phone = clean(body.phone, 30);
  if (!firstName || !lastName) throw new Fail(400, 'Escribe tu nombre y apellido.');
  return { firstName, lastName, phone };
};

const createUser = async (email: string, password: string, meta: Record<string, string>) => {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error || !data.user) {
    const message = error?.message ?? '';
    if (/already|registered|exists/i.test(message)) throw new Fail(409, 'Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.');
    throw new Fail(400, `No se pudo crear la cuenta. ${message}`.trim());
  }
  return data.user;
};

const caller = async (req: Request) => {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Fail(401, 'Inicia sesión para continuar.');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Fail(401, 'Tu sesión venció. Vuelve a iniciar sesión.');
  return data.user;
};
const requirePlatformAdmin = async (userId: string) => {
  const { data } = await db.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (!data) throw new Fail(403, 'Solo el administrador de Sonrisas puede hacer esto.');
};
const requireTitular = async (userId: string) => {
  const { data } = await db.from('profiles').select('clinic_id, role, active').eq('id', userId).maybeSingle();
  if (!data || data.role !== 'titular' || !data.active) throw new Fail(403, 'Solo el titular de la clínica puede hacer esto.');
  return data as { clinic_id: string };
};

const findInvite = async (raw: unknown) => {
  const code = clean(raw, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 6) throw new Fail(400, 'Escribe el código de invitación completo.');
  const { data } = await db.from('clinic_invites').select('code, clinic_id, role, expires_at, used_by').eq('code', code).maybeSingle();
  if (!data || data.used_by) throw new Fail(404, 'Ese código no existe o ya se usó.');
  if (new Date(data.expires_at) < new Date()) throw new Fail(410, 'Ese código venció. Pide uno nuevo al titular de la clínica.');
  const { data: clinic } = await db.from('clinics').select('name, status').eq('id', data.clinic_id).single();
  if (!clinic || clinic.status === 'bloqueada') throw new Fail(403, 'Esa clínica no está disponible.');
  return { ...data, clinicName: clinic.name as string };
};

// ---------- Google Play (app de Play Store) ----------
// Secretos de la función: PLAY_PACKAGE_NAME (ej. app.sonrisas.twa) y PLAY_SERVICE_ACCOUNT (el JSON completo de una
// cuenta de servicio de Google Cloud con acceso a la app en Play Console: "Ver datos financieros" y "Administrar pedidos").
const PLAY_PACKAGE = Deno.env.get('PLAY_PACKAGE_NAME') ?? '';
const PLAY_ACCOUNT = Deno.env.get('PLAY_SERVICE_ACCOUNT') ?? '';
const PLAY_NOT_READY = 'Los pagos con Google Play todavía no están configurados. Intenta más tarde.';
let googleToken: { value: string; expires: number } | null = null;

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Token de acceso a la API de Google Play con la cuenta de servicio (JWT firmado con RS256). */
const googleAccessToken = async () => {
  if (googleToken && googleToken.expires > Date.now() + 60_000) return googleToken.value;
  let account: { client_email?: string; private_key?: string } = {};
  try { account = JSON.parse(PLAY_ACCOUNT); } catch { throw new Fail(503, PLAY_NOT_READY); }
  if (!PLAY_PACKAGE || !account.client_email || !account.private_key) throw new Fail(503, PLAY_NOT_READY);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(signature)}` }),
  });
  if (!res.ok) {
    console.error('google token', res.status, await res.text());
    throw new Fail(502, 'No se pudo conectar con Google Play. Intenta de nuevo.');
  }
  const json = await res.json();
  googleToken = { value: json.access_token, expires: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
  return googleToken.value;
};
const playApi = async (path: string, init: RequestInit = {}) => {
  const token = await googleAccessToken();
  return fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PLAY_PACKAGE)}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
};
// Cancelada = no se va a renovar, pero vale hasta su vencimiento.
const PLAY_VALID = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'];
/** Fecha en Venezuela (UTC-4) de un instante. */
const dateVE = (iso: string) => new Date(new Date(iso).getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10);

const actions: Record<string, (body: Body, req: Request) => Promise<unknown>> = {
  /** Un odontólogo crea su cuenta y su clínica (con días de prueba). */
  async registrar(body) {
    const { email, password } = credentials(body);
    const who = person(body);
    const clinicName = clean(body.clinicName, 120);
    if (clinicName.length < 2) throw new Fail(400, 'Escribe el nombre de tu consultorio o clínica.');
    const { data: settings } = await db.from('platform_settings').select('trial_days').eq('id', 1).single();
    const user = await createUser(email, password, { first_name: who.firstName, last_name: who.lastName });
    try {
      const { data: clinic, error: clinicError } = await db.from('clinics').insert({
        name: clinicName, phone: who.phone, owner_id: user.id, status: 'activa', trial: true,
        paid_until: addDays(todayVE(), Number(settings?.trial_days ?? 7)),
      }).select('id').single();
      if (clinicError || !clinic) throw clinicError;
      const { error: profileError } = await db.from('profiles').insert({
        id: user.id, clinic_id: clinic.id, role: 'titular', first_name: who.firstName, last_name: who.lastName,
        email, phone: who.phone, specialty: 'Odontología general', color: '#0d9488',
      });
      if (profileError) throw profileError;
    } catch (err) {
      console.error('registrar', err);
      await db.auth.admin.deleteUser(user.id);
      throw new Fail(500, 'No se pudo crear la clínica. Intenta de nuevo.');
    }
    return { ok: true };
  },

  /** Muestra a qué clínica y con qué rol lleva un código de invitación. */
  async verificar_codigo(body) {
    const invite = await findInvite(body.code);
    return { clinicName: invite.clinicName, role: invite.role };
  },

  /** Recepción u odontólogos se unen a una clínica con el código que les dio el titular. */
  async unirse(body) {
    const { email, password } = credentials(body);
    const who = person(body);
    const invite = await findInvite(body.code);
    const user = await createUser(email, password, { first_name: who.firstName, last_name: who.lastName });
    try {
      const { data: claimed } = await db.from('clinic_invites')
        .update({ used_by: user.id, used_at: new Date().toISOString() })
        .eq('code', invite.code).is('used_by', null).select('code').maybeSingle();
      if (!claimed) throw new Fail(409, 'Ese código ya se usó.');
      const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('clinic_id', invite.clinic_id);
      const { error } = await db.from('profiles').insert({
        id: user.id, clinic_id: invite.clinic_id, role: invite.role, first_name: who.firstName, last_name: who.lastName,
        email, phone: who.phone, specialty: invite.role === 'odontologo' ? 'Odontología general' : '',
        color: COLORS[(count ?? 0) % COLORS.length],
      });
      if (error) throw error;
    } catch (err) {
      console.error('unirse', err);
      await db.auth.admin.deleteUser(user.id);
      if (err instanceof Fail) throw err;
      throw new Fail(500, 'No se pudo completar el registro. Intenta de nuevo.');
    }
    return { ok: true, clinicName: invite.clinicName };
  },

  /** Crea la cuenta de administrador con el código de un solo uso. */
  async crear_admin(body) {
    const { email, password } = credentials(body);
    const who = person(body);
    const code = clean(body.code, 100);
    const { data: secret } = await db.from('platform_secrets').select('admin_claim_hash').eq('id', 1).single();
    const hash = secret?.admin_claim_hash as string | null;
    if (!hash || !code || (await sha256Hex(code)) !== hash) throw new Fail(403, 'El código de administrador no es válido o ya se usó.');
    const { data: consumed } = await db.from('platform_secrets').update({ admin_claim_hash: null })
      .eq('id', 1).eq('admin_claim_hash', hash).select('id').maybeSingle();
    if (!consumed) throw new Fail(403, 'El código de administrador ya se usó.');
    const restore = () => db.from('platform_secrets').update({ admin_claim_hash: hash }).eq('id', 1);
    let user;
    try {
      user = await createUser(email, password, { first_name: who.firstName, last_name: who.lastName });
    } catch (err) {
      await restore();
      throw err;
    }
    const { error } = await db.from('platform_admins').insert({ user_id: user.id, email, full_name: `${who.firstName} ${who.lastName}` });
    if (error) {
      await db.auth.admin.deleteUser(user.id);
      await restore();
      throw new Fail(500, 'No se pudo crear el administrador. Intenta de nuevo.');
    }
    return { ok: true };
  },

  /** El titular quita a alguien de su equipo (borra su cuenta). */
  async quitar_miembro(body, req) {
    const me = await caller(req);
    const mine = await requireTitular(me.id);
    const memberId = clean(body.userId, 60);
    if (memberId === me.id) throw new Fail(400, 'No puedes quitarte a ti mismo.');
    const { data: member } = await db.from('profiles').select('clinic_id').eq('id', memberId).maybeSingle();
    if (!member || member.clinic_id !== mine.clinic_id) throw new Fail(404, 'Esa persona no pertenece a tu clínica.');
    const { error } = await db.auth.admin.deleteUser(memberId);
    if (error) throw new Fail(500, 'No se pudo quitar a esa persona.');
    return { ok: true };
  },

  /** El titular genera una contraseña temporal para alguien de su equipo. */
  async clave_miembro(body, req) {
    const me = await caller(req);
    const mine = await requireTitular(me.id);
    const memberId = clean(body.userId, 60);
    const { data: member } = await db.from('profiles').select('clinic_id').eq('id', memberId).maybeSingle();
    if (!member || member.clinic_id !== mine.clinic_id || memberId === me.id) throw new Fail(404, 'Esa persona no pertenece a tu equipo.');
    const password = tempPassword();
    const { error } = await db.auth.admin.updateUserById(memberId, { password });
    if (error) throw new Fail(500, 'No se pudo cambiar la contraseña.');
    return { ok: true, password };
  },

  /** El administrador genera una contraseña temporal para cualquier usuario de una clínica. */
  async admin_clave(body, req) {
    const me = await caller(req);
    await requirePlatformAdmin(me.id);
    const userId = clean(body.userId, 60);
    const { data: member } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!member) throw new Fail(404, 'No encontramos a ese usuario.');
    const password = tempPassword();
    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) throw new Fail(500, 'No se pudo cambiar la contraseña.');
    return { ok: true, password };
  },

  /** El administrador elimina una clínica completa: cuentas, datos, comprobantes y fotos de pacientes. */
  async admin_eliminar_clinica(body, req) {
    const me = await caller(req);
    await requirePlatformAdmin(me.id);
    const clinicId = clean(body.clinicId, 60);
    const { data: clinic } = await db.from('clinics').select('id').eq('id', clinicId).maybeSingle();
    if (!clinic) throw new Fail(404, 'No encontramos esa clínica.');
    const { data: files } = await db.storage.from('comprobantes').list(clinicId, { limit: 1000 });
    if (files && files.length) await db.storage.from('comprobantes').remove(files.map((f) => `${clinicId}/${f.name}`));
    // Fotos de pacientes: <clínica>/<paciente>/<archivo>.
    const { data: patientFolders } = await db.storage.from('pacientes').list(clinicId, { limit: 10000 });
    for (const folder of patientFolders ?? []) {
      const prefix = `${clinicId}/${folder.name}`;
      const { data: photos } = await db.storage.from('pacientes').list(prefix, { limit: 10000 });
      if (photos && photos.length) await db.storage.from('pacientes').remove(photos.map((f) => `${prefix}/${f.name}`));
    }
    const { data: members } = await db.from('profiles').select('id').eq('clinic_id', clinicId);
    const { error } = await db.from('clinics').delete().eq('id', clinicId);
    if (error) throw new Fail(500, 'No se pudo eliminar la clínica.');
    for (const m of members ?? []) await db.auth.admin.deleteUser(m.id as string);
    return { ok: true, removedUsers: members?.length ?? 0 };
  },
  /** Verifica con Google una compra de la app de Play y, si está vigente, extiende la suscripción de la clínica. */
  async play_verify(body, req) {
    const me = await caller(req);
    const { data: profile } = await db.from('profiles').select('clinic_id, role, active').eq('id', me.id).maybeSingle();
    if (!profile || !profile.active || !['titular', 'recepcion'].includes(profile.role as string)) {
      throw new Fail(403, 'Solo el titular de la clínica o la recepción pueden pagar la suscripción.');
    }
    const clinicId = profile.clinic_id as string;
    const productId = clean(body.productId, 60);
    const token = String(body.purchaseToken ?? '').trim();
    if (!/^[a-z0-9._]{1,60}$/.test(productId) || token.length < 10 || token.length > 4096) throw new Fail(400, 'Los datos de la compra no son válidos.');

    const { data: settings } = await db.from('platform_settings')
      .select('play_monthly_sku, play_annual_sku, monthly_price, annual_price, currency').eq('id', 1).single();
    if (!settings) throw new Fail(500, 'No se pudieron leer los ajustes.');
    const months = productId && productId === settings.play_annual_sku ? 12 : productId && productId === settings.play_monthly_sku ? 1 : 0;
    if (!months) throw new Fail(400, 'Ese plan no está configurado en Sonrisas.');

    // Cada compra queda asociada a la primera clínica que la registra: no se puede reusar en otra.
    const { data: known } = await db.from('play_purchases').select('clinic_id').eq('purchase_token', token).maybeSingle();
    if (known && known.clinic_id !== clinicId) throw new Fail(409, 'Esta compra de Google Play ya está asociada a otra clínica.');
    const res = await playApi(`purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
    if ([400, 404, 410].includes(res.status)) throw new Fail(400, 'Google Play no reconoce esta compra.');
    if (!res.ok) {
      console.error('play subscriptionsv2', res.status, await res.text());
      throw new Fail(502, 'No se pudo verificar la compra con Google Play. Intenta de nuevo.');
    }
    const purchase = await res.json();
    const lines = (purchase.lineItems ?? []) as Array<Record<string, any>>;
    const line = lines.find((l) => l.productId === productId);
    if (!line) throw new Fail(400, 'La compra no corresponde a ese plan.');
    const state = String(purchase.subscriptionState ?? '');
    const expiresAt = String(line.expiryTime ?? '');
    const orderId = String(purchase.latestOrderId ?? '');
    const valid = PLAY_VALID.includes(state) && !!expiresAt && new Date(expiresAt) > new Date();

    // Recién con la compra confirmada por Google se asocia a la clínica.
    if (!known) {
      const { error } = await db.from('play_purchases').insert({ purchase_token: token, clinic_id: clinicId, user_id: me.id, product_id: productId });
      if (error && error.code === '23505') {
        const { data: owner } = await db.from('play_purchases').select('clinic_id').eq('purchase_token', token).maybeSingle();
        if (!owner || owner.clinic_id !== clinicId) throw new Fail(409, 'Esta compra de Google Play ya está asociada a otra clínica.');
      } else if (error) {
        throw new Fail(500, 'No se pudo registrar la compra. Intenta de nuevo.');
      }
    }

    // Confirmar la compra a Google: si no se confirma en 3 días, Google le devuelve el dinero al cliente.
    let acknowledged = purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
    if (valid && !acknowledged) {
      const ack = await playApi(`purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, { method: 'POST', body: '{}' });
      acknowledged = ack.ok;
      if (!ack.ok) console.error('play acknowledge', ack.status, await ack.text());
    }
    await db.from('play_purchases').update({
      product_id: productId, order_id: orderId, state, expires_at: expiresAt || null,
      auto_renewing: !!line.autoRenewingPlan?.autoRenewEnabled, acknowledged, updated_at: new Date().toISOString(),
    }).eq('purchase_token', token);
    if (!valid) return { ok: true, active: false, changed: false };

    const { data: clinic } = await db.from('clinics').select('paid_until, status, trial').eq('id', clinicId).single();
    if (!clinic) throw new Fail(404, 'No encontramos tu clínica.');
    if (clinic.status === 'bloqueada') throw new Fail(403, 'Tu cuenta está bloqueada. Escríbenos por WhatsApp para resolverlo.');
    const until = dateVE(expiresAt);
    const paidUntil = until > clinic.paid_until ? until : (clinic.paid_until as string);
    const changed = paidUntil !== clinic.paid_until || clinic.trial || clinic.status === 'suspendida';
    if (changed) {
      const { error } = await db.from('clinics')
        .update({ paid_until: paidUntil, trial: false, status: clinic.status === 'suspendida' ? 'activa' : clinic.status })
        .eq('id', clinicId);
      if (error) throw new Fail(500, 'No se pudo activar tu plan. Intenta de nuevo.');
    }

    // Una fila en el historial de pagos por cada cobro de Google (compra o renovación), ya aprobada.
    if (orderId) {
      const price = months === 12 ? Number(settings.annual_price) || Number(settings.monthly_price) * 12 : Number(settings.monthly_price);
      if (price > 0) {
        const { error } = await db.from('payment_reports').insert({
          clinic_id: clinicId, user_id: me.id, method: 'Google Play', amount: price, currency: settings.currency, months,
          reference: orderId.slice(0, 60), paid_on: todayVE(), status: 'aprobado', reviewed_at: new Date().toISOString(),
          admin_note: 'Monto de referencia: lo cobrado está en Play Console.', external_id: orderId,
        });
        if (error && error.code !== '23505') console.error('play history', error.message);
      }
    }
    return { ok: true, active: true, changed, paid_until: paidUntil };
  },

};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = actions[String(body.action ?? '')];
    if (!action) throw new Fail(400, 'Acción desconocida.');
    return reply(200, await action(body, req));
  } catch (err) {
    if (err instanceof Fail) return reply(err.status, { error: err.message });
    console.error(err);
    return reply(500, { error: 'Ocurrió un error inesperado. Intenta de nuevo.' });
  }
});
