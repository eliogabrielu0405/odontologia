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
