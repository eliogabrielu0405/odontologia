-- Sonrisas · EU Digital Solutions
-- Esquema multi-clínica con suscripción mensual, reporte de pagos (Pago Móvil) y panel de administración.

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- Plataforma (EU Digital Solutions)
-- =====================================================================
create table public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  monthly_price numeric(12,2) not null default 0 check (monthly_price >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'VES')),
  trial_days int not null default 7 check (trial_days between 0 and 90),
  grace_days int not null default 3 check (grace_days between 0 and 60),
  reminder_days int not null default 5 check (reminder_days between 0 and 30),
  pm_bank text not null default '',
  pm_phone text not null default '',
  pm_id_doc text not null default '',
  pm_holder text not null default '',
  support_whatsapp text not null default '',
  payment_note text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1);

-- Código de un solo uso para crear la cuenta de administrador (se guarda solo su hash).
create table public.platform_secrets (
  id smallint primary key default 1 check (id = 1),
  admin_claim_hash text
);
insert into public.platform_secrets (id) values (1);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Clínicas (cada odontólogo que contrata Sonrisas) y su equipo
-- =====================================================================
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  rif text not null default '',
  phone text not null default '',
  address text not null default '',
  owner_id uuid references auth.users (id) on delete set null,
  status text not null default 'activa' check (status in ('activa', 'suspendida', 'bloqueada')),
  trial boolean not null default true,
  paid_until date not null default current_date,
  admin_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  role text not null check (role in ('titular', 'odontologo', 'recepcion')),
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  specialty text not null default '',
  color text not null default '#0d9488',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_clinic_idx on public.profiles (clinic_id);

create table public.clinic_invites (
  code text primary key check (code ~ '^[A-Z0-9]{6,12}$'),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  role text not null check (role in ('odontologo', 'recepcion')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);
create index clinic_invites_clinic_idx on public.clinic_invites (clinic_id);

-- Datos clínicos de cada consultorio (pacientes, citas, presupuestos…) como documentos JSON.
create table public.records (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  collection text not null check (collection in ('patients', 'appointments', 'treatments', 'budgets', 'payments', 'history', 'consents', 'activity', 'odontograms', 'config')),
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,120}$'),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (clinic_id, collection, id)
);

-- Pagos de la mensualidad que reporta cada clínica, con foto del comprobante.
create table public.payment_reports (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'VES')),
  months int not null default 1 check (months between 1 and 12),
  reference text not null default '' check (char_length(reference) <= 60),
  bank text not null default '' check (char_length(bank) <= 80),
  payer_phone text not null default '' check (char_length(payer_phone) <= 30),
  paid_on date not null default current_date,
  receipt_path text not null default '',
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);
create index payment_reports_clinic_idx on public.payment_reports (clinic_id, created_at desc);
create index payment_reports_status_idx on public.payment_reports (status, created_at desc);

-- =====================================================================
-- Funciones auxiliares (las usa la seguridad por filas)
-- =====================================================================
create or replace function public.today_ve() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Caracas')::date;
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function public.my_clinic_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select clinic_id from public.profiles where id = (select auth.uid()) and active;
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and active;
$$;

-- La clínica puede usar el sistema si está activa y no pasó el período de gracia.
create or replace function public.clinic_has_access(p_clinic uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.clinics c
    cross join public.platform_settings s
    where c.id = p_clinic
      and s.id = 1
      and c.status = 'activa'
      and public.today_ve() <= c.paid_until + s.grace_days
  );
$$;

create or replace function public.clinic_status(p_clinic uuid) returns text
language sql stable security definer set search_path = '' as $$
  select status from public.clinics where id = p_clinic;
$$;

-- Qué colecciones puede modificar cada rol.
create or replace function public.can_write_collection(p_collection text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_collection in ('patients', 'appointments', 'budgets', 'payments', 'consents', 'activity') then public.my_role() is not null
    when p_collection in ('history', 'odontograms', 'treatments') then public.my_role() in ('titular', 'odontologo')
    when p_collection = 'config' then public.my_role() = 'titular'
    else false
  end;
$$;

-- =====================================================================
-- Seguridad por filas (RLS)
-- =====================================================================
alter table public.platform_settings enable row level security;
alter table public.platform_secrets enable row level security;
alter table public.platform_admins enable row level security;
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_invites enable row level security;
alter table public.records enable row level security;
alter table public.payment_reports enable row level security;

-- Precio y datos de Pago Móvil: solo para usuarios con sesión (los visitantes ven public_settings()); solo el administrador los cambia.
create policy settings_read on public.platform_settings for select to authenticated using (true);
create policy settings_admin_update on public.platform_settings for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- platform_secrets no tiene políticas: solo la función del servidor (service role) la lee.

create policy admins_read on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

create policy clinics_read on public.clinics for select to authenticated
  using (id = (select public.my_clinic_id()) or (select public.is_platform_admin()));
create policy clinics_admin_update on public.clinics for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

create policy profiles_read on public.profiles for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) or id = (select auth.uid()) or (select public.is_platform_admin()));

create policy invites_read on public.clinic_invites for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'titular');
create policy invites_insert on public.clinic_invites for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'titular' and created_by = (select auth.uid()) and used_by is null);
create policy invites_delete on public.clinic_invites for delete to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'titular');

create policy records_read on public.records for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) and public.clinic_has_access(clinic_id));
create policy records_insert on public.records for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and public.clinic_has_access(clinic_id) and public.can_write_collection(collection));
create policy records_update on public.records for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and public.clinic_has_access(clinic_id) and public.can_write_collection(collection))
  with check (clinic_id = (select public.my_clinic_id()) and public.can_write_collection(collection));
create policy records_delete on public.records for delete to authenticated
  using (clinic_id = (select public.my_clinic_id()) and public.clinic_has_access(clinic_id) and ((select public.my_role()) = 'titular' or collection = 'activity'));

create policy reports_read on public.payment_reports for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) or (select public.is_platform_admin()));
create policy reports_insert on public.payment_reports for insert to authenticated
  with check (
    clinic_id = (select public.my_clinic_id())
    and user_id = (select auth.uid())
    and status = 'pendiente'
    and reviewed_at is null
    and reviewed_by is null
    and admin_note = ''
    and (select public.my_role()) in ('titular', 'recepcion')
    and public.clinic_status(clinic_id) <> 'bloqueada'
  );
create policy reports_admin_update on public.payment_reports for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy reports_admin_delete on public.payment_reports for delete to authenticated
  using ((select public.is_platform_admin()));

-- =====================================================================
-- Comprobantes de pago (fotos) en Storage, privados por clínica
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
    and (select public.my_role()) in ('titular', 'recepcion')
  );
create policy receipts_read on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and ((storage.foldername(name))[1] = (select public.my_clinic_id())::text or (select public.is_platform_admin()))
  );
create policy receipts_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (select public.is_platform_admin()));

-- =====================================================================
-- Funciones que llama la app
-- =====================================================================

-- Todo lo que la app necesita al iniciar sesión, en una sola llamada.
create or replace function public.my_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_clinic public.clinics;
  v_settings public.platform_settings;
begin
  if v_uid is null then
    return null;
  end if;
  select * into v_settings from public.platform_settings where id = 1;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is not null then
    select * into v_clinic from public.clinics where id = v_profile.clinic_id;
  end if;
  return jsonb_build_object(
    'user_id', v_uid,
    'is_admin', exists (select 1 from public.platform_admins where user_id = v_uid),
    'admin', (select jsonb_build_object('email', a.email, 'full_name', a.full_name) from public.platform_admins a where a.user_id = v_uid),
    'profile', case when v_profile.id is null then null else to_jsonb(v_profile) end,
    'clinic', case when v_clinic.id is null then null else to_jsonb(v_clinic) end,
    'settings', to_jsonb(v_settings),
    'today', public.today_ve(),
    'has_access', case when v_clinic.id is null then false else public.clinic_has_access(v_clinic.id) end
  );
end;
$$;

-- Lo único que necesita la pantalla de entrada antes de iniciar sesión.
create or replace function public.public_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('trial_days', trial_days, 'support_whatsapp', support_whatsapp, 'monthly_price', monthly_price, 'currency', currency)
  from public.platform_settings where id = 1;
$$;
grant execute on function public.public_settings() to anon, authenticated;

create or replace function public.update_my_clinic(p_name text, p_rif text, p_phone text, p_address text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'titular' then
    raise exception 'Solo el titular puede editar los datos de la clínica.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Escribe el nombre de la clínica.' using errcode = '22023';
  end if;
  update public.clinics
     set name = left(trim(p_name), 120),
         rif = left(trim(coalesce(p_rif, '')), 30),
         phone = left(trim(coalesce(p_phone, '')), 30),
         address = left(trim(coalesce(p_address, '')), 200)
   where id = public.my_clinic_id();
end;
$$;

create or replace function public.update_my_profile(p_first text, p_last text, p_phone text, p_specialty text, p_color text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(coalesce(p_first, ''))) = 0 or char_length(trim(coalesce(p_last, ''))) = 0 then
    raise exception 'Escribe tu nombre y apellido.' using errcode = '22023';
  end if;
  update public.profiles
     set first_name = left(trim(p_first), 60),
         last_name = left(trim(p_last), 60),
         phone = left(trim(coalesce(p_phone, '')), 30),
         specialty = left(trim(coalesce(p_specialty, '')), 80),
         color = case when p_color ~ '^#[0-9a-fA-F]{6}$' then p_color else color end
   where id = auth.uid();
end;
$$;

create or replace function public.update_member(p_member uuid, p_role text, p_specialty text, p_color text, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'titular' then
    raise exception 'Solo el titular puede editar al equipo.' using errcode = '42501';
  end if;
  if p_member = auth.uid() then
    raise exception 'Para cambiar tus datos usa Mi perfil.' using errcode = '22023';
  end if;
  if p_role not in ('odontologo', 'recepcion') then
    raise exception 'Rol no válido.' using errcode = '22023';
  end if;
  update public.profiles
     set role = p_role,
         specialty = left(trim(coalesce(p_specialty, '')), 80),
         color = case when p_color ~ '^#[0-9a-fA-F]{6}$' then p_color else color end,
         active = coalesce(p_active, active)
   where id = p_member and clinic_id = public.my_clinic_id();
  if not found then
    raise exception 'Esa persona no pertenece a tu clínica.' using errcode = '22023';
  end if;
end;
$$;

-- Aprobar un pago extiende la suscripción desde la fecha de vencimiento (o desde hoy si ya venció).
create or replace function public.approve_payment(p_report uuid, p_months int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_report public.payment_reports;
  v_months int;
  v_until date;
begin
  if not public.is_platform_admin() then
    raise exception 'Solo el administrador puede aprobar pagos.' using errcode = '42501';
  end if;
  select * into v_report from public.payment_reports where id = p_report for update;
  if not found then
    raise exception 'No encontramos ese pago.' using errcode = '22023';
  end if;
  if v_report.status = 'aprobado' then
    raise exception 'Este pago ya fue aprobado.' using errcode = '22023';
  end if;
  v_months := greatest(1, least(12, coalesce(p_months, v_report.months)));
  update public.clinics
     set paid_until = (greatest(paid_until, public.today_ve()) + make_interval(months => v_months))::date,
         trial = false,
         status = case when status = 'suspendida' then 'activa' else status end
   where id = v_report.clinic_id
  returning paid_until into v_until;
  update public.payment_reports
     set status = 'aprobado', months = v_months, admin_note = '', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_report;
  return jsonb_build_object('paid_until', v_until);
end;
$$;

create or replace function public.reject_payment(p_report uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Solo el administrador puede rechazar pagos.' using errcode = '42501';
  end if;
  update public.payment_reports
     set status = 'rechazado', admin_note = left(trim(coalesce(p_note, '')), 300), reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_report and status = 'pendiente';
  if not found then
    raise exception 'Ese pago ya fue revisado.' using errcode = '22023';
  end if;
end;
$$;

-- Solo usuarios con sesión pueden llamar a estas funciones (además, cada una valida el rol).
revoke execute on function public.update_my_clinic(text, text, text, text) from public, anon;
revoke execute on function public.update_my_profile(text, text, text, text, text) from public, anon;
revoke execute on function public.update_member(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.approve_payment(uuid, int) from public, anon;
revoke execute on function public.reject_payment(uuid, text) from public, anon;
grant execute on function public.update_my_clinic(text, text, text, text) to authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text) to authenticated;
grant execute on function public.update_member(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.approve_payment(uuid, int) to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;

-- =====================================================================
-- Tiempo real: cambios de la clínica, su suscripción y sus pagos
-- =====================================================================
alter publication supabase_realtime add table public.records, public.clinics, public.payment_reports, public.profiles;
