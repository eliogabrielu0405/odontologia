-- Sonrisas · sincronización por cambios, numeración sin repetidos, actividad a prueba de borrados y registro protegido.
-- Todo es aditivo: no borra ni mueve datos. La versión anterior de la app sigue funcionando con este esquema.

-- =====================================================================
-- 1) La hora de cada cambio la pone el servidor (la app pide solo lo que cambió desde la última vez)
-- =====================================================================
create or replace function public.records_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

create index if not exists records_clinic_updated_idx on public.records (clinic_id, updated_at);

-- =====================================================================
-- 2) Borrados: queda una marca para que los demás equipos lo sepan al instante (tiempo real) o en la próxima sincronización
-- =====================================================================
create table public.records_deleted (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  collection text not null,
  id text not null,
  deleted_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, collection, id)
);
create index records_deleted_clinic_idx on public.records_deleted (clinic_id, deleted_at);
alter table public.records_deleted enable row level security;
create policy records_deleted_read on public.records_deleted for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.clinic_has_access((select public.my_clinic_id()))));

create or replace function public.records_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- La actividad vieja la recorta el servidor: no hace falta avisarlo. Si se está borrando la clínica entera, tampoco.
  if old.collection = 'activity' or not exists (select 1 from public.clinics where id = old.clinic_id) then
    return old;
  end if;
  insert into public.records_deleted (clinic_id, collection, id) values (old.clinic_id, old.collection, old.id)
  on conflict (clinic_id, collection, id) do update set deleted_at = clock_timestamp();
  return old;
end;
$$;
create trigger records_after_delete after delete on public.records
  for each row execute function public.records_after_delete();

-- Si algo borrado se vuelve a crear, su marca de borrado sobra.
create or replace function public.records_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  delete from public.records_deleted where clinic_id = new.clinic_id and collection = new.collection and id = new.id;
  -- Actividad: se guardan las últimas 500 por clínica (se recorta de a 50 para no hacerlo en cada registro).
  if new.collection = 'activity' then
    select count(*) into v_count from public.records where clinic_id = new.clinic_id and collection = 'activity';
    if v_count > 550 then
      delete from public.records r
       where r.clinic_id = new.clinic_id and r.collection = 'activity'
         and r.id in (select id from public.records where clinic_id = new.clinic_id and collection = 'activity' order by updated_at desc offset 500);
    end if;
  end if;
  return new;
end;
$$;
create trigger records_after_insert after insert on public.records
  for each row execute function public.records_after_insert();

alter publication supabase_realtime add table public.records_deleted;

-- =====================================================================
-- 3) Reglas de acceso más rápidas (el chequeo de suscripción se hace una vez por consulta, no por fila)
--    y la actividad no se puede modificar ni borrar desde la app.
-- =====================================================================
drop policy records_read on public.records;
drop policy records_insert on public.records;
drop policy records_update on public.records;
drop policy records_delete on public.records;

create policy records_read on public.records for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.clinic_has_access((select public.my_clinic_id()))));
create policy records_insert on public.records for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.clinic_has_access((select public.my_clinic_id()))) and public.can_write_collection(collection));
create policy records_update on public.records for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.clinic_has_access((select public.my_clinic_id()))) and public.can_write_collection(collection) and collection <> 'activity')
  with check (clinic_id = (select public.my_clinic_id()) and public.can_write_collection(collection) and collection <> 'activity');
create policy records_delete on public.records for delete to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.clinic_has_access((select public.my_clinic_id()))) and (select public.my_role()) = 'titular' and collection <> 'activity');

-- Si alguien cambia el monto o el método de un cobro ya registrado (la app no lo permite), queda anotado en la actividad.
create or replace function public.records_audit_payments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.collection = 'payments'
     and (old.data->>'amount' is distinct from new.data->>'amount' or old.data->>'method' is distinct from new.data->>'method') then
    insert into public.records (clinic_id, collection, id, data, updated_by)
    values (old.clinic_id, 'activity', 'log' || replace(gen_random_uuid()::text, '-', ''), jsonb_build_object(
      'date', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'userId', coalesce(auth.uid()::text, ''),
      'action', 'editar',
      'module', 'Pagos',
      'detail', format('Cobro %s modificado: %s %s → %s %s',
        coalesce(new.data->>'receipt', old.id), old.data->>'method', old.data->>'amount', new.data->>'method', new.data->>'amount')
    ), auth.uid());
  end if;
  return new;
end;
$$;
create trigger records_audit_payments after update on public.records
  for each row when (old.collection = 'payments') execute function public.records_audit_payments();

-- =====================================================================
-- 4) Numeración desde el servidor: recibos, presupuestos y N.º de historia nunca se repiten
-- =====================================================================
create table public.clinic_counters (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  kind text not null check (kind in ('receipt', 'budget', 'record')),
  value bigint not null,
  primary key (clinic_id, kind)
);
alter table public.clinic_counters enable row level security; -- sin políticas: solo la función next_number la usa

create or replace function public.next_number(p_kind text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_clinic uuid := public.my_clinic_id();
  v_field text;
  v_collection text;
  v_seed bigint;
  v_value bigint;
begin
  if v_clinic is null or not public.clinic_has_access(v_clinic) then
    raise exception 'Tu cuenta no tiene acceso.' using errcode = '42501';
  end if;
  case p_kind
    when 'receipt' then v_field := 'receipt'; v_collection := 'payments';
    when 'budget' then v_field := 'number'; v_collection := 'budgets';
    when 'record' then v_field := 'record'; v_collection := 'patients';
    else raise exception 'Tipo de número desconocido.' using errcode = '22023';
  end case;
  -- El mayor número ya usado (también por versiones anteriores de la app, que numeraban en el teléfono).
  select coalesce(max(nullif(right(regexp_replace(data->>v_field, '\D', '', 'g'), 12), '')::bigint), 0)
    into v_seed from public.records where clinic_id = v_clinic and collection = v_collection;
  if p_kind = 'budget' then v_seed := greatest(v_seed, 1000); end if;
  insert into public.clinic_counters as c (clinic_id, kind, value) values (v_clinic, p_kind, v_seed + 1)
  on conflict (clinic_id, kind) do update set value = greatest(c.value, v_seed) + 1
  returning value into v_value;
  return v_value;
end;
$$;
revoke execute on function public.next_number(text) from public, anon;
grant execute on function public.next_number(text) to authenticated;

-- Las funciones de los disparadores no se llaman desde la app.
revoke execute on function public.records_touch(), public.records_after_delete(), public.records_after_insert(), public.records_audit_payments() from public, anon, authenticated;

-- =====================================================================
-- 5) Registro de odontólogos: intentos por dirección de internet y correo (lo usa la función del servidor)
-- =====================================================================
create table public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  email_key text not null,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index signup_attempts_ip_idx on public.signup_attempts (ip_hash, created_at);
create index signup_attempts_email_idx on public.signup_attempts (email_key, created_at);
alter table public.signup_attempts enable row level security; -- sin políticas: solo la función del servidor (service role)

-- =====================================================================
-- 6) Índices que recomienda Supabase para las claves foráneas
-- =====================================================================
create index if not exists clinic_invites_created_by_idx on public.clinic_invites (created_by);
create index if not exists clinic_invites_used_by_idx on public.clinic_invites (used_by);
create index if not exists clinics_owner_idx on public.clinics (owner_id);
create index if not exists payment_reports_reviewed_by_idx on public.payment_reports (reviewed_by);
create index if not exists payment_reports_user_idx on public.payment_reports (user_id);
create index if not exists play_purchases_user_idx on public.play_purchases (user_id);
