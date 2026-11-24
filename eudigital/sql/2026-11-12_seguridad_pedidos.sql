-- EU Digital: registro cerrado, pagos registrados por el admin, límite de reportes de pago
-- y registro de pedidos con su resumen para el panel del cliente.

-- 1) Solo el panel de EU Digital crea usuarios. Cualquier otro registro (la API pública de
--    Supabase, el panel de Supabase) se rechaza.
create or replace function eu_priv.bloquear_registro()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('eu.alta', true), '') <> 'si' then
    raise exception 'El registro está cerrado. Los usuarios se crean desde el panel de EU Digital.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function eu_priv.bloquear_registro() from public, anon, authenticated;

drop trigger if exists eu_registro_cerrado on auth.users;
create trigger eu_registro_cerrado before insert on auth.users
  for each row execute function eu_priv.bloquear_registro();

create or replace function eu_priv.crear_usuario(p_email text, p_clave text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if not exists (select 1 from public.eu_admins where user_id = (select auth.uid())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if char_length(coalesce(p_clave,'')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Ese usuario ya existe' using errcode = '23505';
  end if;
  perform set_config('eu.alta', 'si', true);
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  perform set_config('eu.alta', '', true);
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', v_id::text, now(), now(), now());
  return v_id;
end $$;

-- 2) Pago recibido por fuera (efectivo, transferencia): se registra y se aprueba de una vez.
create or replace function public.eu_admin_registrar_pago(
  p_sitio uuid, p_monto numeric, p_metodo text, p_meses integer default 1,
  p_moneda text default 'USD', p_referencia text default null, p_nota text default null)
returns date language plpgsql set search_path = '' as $$
declare v_id uuid; v_meses int := coalesce(p_meses, 1);
begin
  perform eu_priv.exigir_admin();
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto debe ser mayor que cero' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_metodo, '')), '') is null then raise exception 'Falta la forma de pago' using errcode = '22023'; end if;
  if v_meses < 1 or v_meses > 24 then raise exception 'Meses inválidos' using errcode = '22023'; end if;
  insert into public.eu_pagos (sitio_id, monto, moneda, metodo, referencia, meses, nota, creado_por)
  values (p_sitio, round(p_monto, 2), coalesce(nullif(trim(p_moneda), ''), 'USD'), left(trim(p_metodo), 40),
          left(nullif(trim(coalesce(p_referencia, '')), ''), 80), v_meses,
          left(nullif(trim(coalesce(p_nota, '')), ''), 300), (select auth.uid()))
  returning id into v_id;
  return public.eu_admin_aprobar_pago(v_id, v_meses);
end $$;

revoke all on function public.eu_admin_registrar_pago(uuid, numeric, text, integer, text, text, text) from public, anon;
grant execute on function public.eu_admin_registrar_pago(uuid, numeric, text, integer, text, text, text) to authenticated, service_role;

-- 3) Límite de reportes de pago de un cliente (evita que se llene la lista con reportes repetidos).
create or replace function eu_priv.limitar_pagos()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.eu_es_admin() then return new; end if;
  if new.monto is null or new.monto <= 0 or new.monto > 100000000 then
    raise exception 'Revisa el monto del pago' using errcode = '22023';
  end if;
  if (select count(*) from public.eu_pagos where sitio_id = new.sitio_id and estado = 'pendiente') >= 5 then
    raise exception 'Tienes 5 pagos esperando revisión. Espera a que los revisemos para reportar otro.' using errcode = '22023';
  end if;
  if (select count(*) from public.eu_pagos where sitio_id = new.sitio_id and creado > now() - interval '1 day') >= 8 then
    raise exception 'Ya reportaste varios pagos hoy. Si necesitas corregir uno, escríbenos por WhatsApp.' using errcode = '22023';
  end if;
  return new;
end $$;

revoke all on function eu_priv.limitar_pagos() from public, anon, authenticated;

drop trigger if exists eu_pagos_limite on public.eu_pagos;
create trigger eu_pagos_limite before insert on public.eu_pagos
  for each row execute function eu_priv.limitar_pagos();

-- 4) Pedidos: se guardan cuando el cliente toca "enviar por WhatsApp" en la página.
--    Solo productos, total, tipo de entrega y forma de pago: nada de nombres, teléfonos ni direcciones.
create table if not exists public.eu_pedidos (
  id bigint generated always as identity primary key,
  sitio_id uuid not null references public.eu_sitios(id) on delete cascade,
  creado timestamptz not null default now(),
  total numeric(12,2) not null default 0 check (total >= 0),
  tipo text check (char_length(tipo) <= 40),
  pago text check (char_length(pago) <= 60),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array')
);
create index if not exists eu_pedidos_sitio_creado on public.eu_pedidos (sitio_id, creado desc);
alter table public.eu_pedidos enable row level security;
revoke all on public.eu_pedidos from anon;
revoke insert, update, truncate on public.eu_pedidos from authenticated;
grant select, delete on public.eu_pedidos to authenticated;

drop policy if exists eu_pedidos_ver on public.eu_pedidos;
create policy eu_pedidos_ver on public.eu_pedidos for select to authenticated
  using ((select public.eu_es_admin()) or exists (
    select 1 from public.eu_sitios s where s.id = eu_pedidos.sitio_id and s.dueno = (select auth.uid())));
drop policy if exists eu_pedidos_admin_borrar on public.eu_pedidos;
create policy eu_pedidos_admin_borrar on public.eu_pedidos for delete to authenticated
  using ((select public.eu_es_admin()));

create or replace function public.eu_registrar_pedido(
  p_sitio uuid, p_items jsonb, p_total numeric, p_tipo text default null, p_pago text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_items jsonb;
begin
  if p_sitio is null or p_items is null or jsonb_typeof(p_items) <> 'array' then return; end if;
  if not exists (select 1 from public.eu_sitios where id = p_sitio and estado = 'activo') then return; end if;
  -- tope para que nadie llene las estadísticas de un negocio con pedidos falsos
  if (select count(*) from public.eu_pedidos where sitio_id = p_sitio and creado > now() - interval '10 minutes') >= 40 then return; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', left(trim(it->>'nombre'), 120),
           'cantidad', case when (it->>'cantidad') ~ '^[0-9]{1,6}(\.[0-9]+)?$' then least(greatest(round((it->>'cantidad')::numeric), 1), 200)::int else 1 end,
           'precio', case when (it->>'precio') ~ '^[0-9]{1,9}(\.[0-9]+)?$' then round(least((it->>'precio')::numeric, 20000), 2) else 0 end)), '[]'::jsonb)
    into v_items
    from (select e as it from jsonb_array_elements(p_items) e limit 60) x
   where jsonb_typeof(it) = 'object' and coalesce(trim(it->>'nombre'), '') <> '';
  if jsonb_array_length(v_items) = 0 then return; end if;
  insert into public.eu_pedidos (sitio_id, total, tipo, pago, items)
  values (p_sitio,
          case when p_total is null or p_total < 0 then 0 else round(least(p_total, 500000), 2) end,
          left(nullif(trim(coalesce(p_tipo, '')), ''), 40), left(nullif(trim(coalesce(p_pago, '')), ''), 60), v_items);
end $$;
revoke all on function public.eu_registrar_pedido(uuid, jsonb, numeric, text, text) from public;
grant execute on function public.eu_registrar_pedido(uuid, jsonb, numeric, text, text) to anon, authenticated, service_role;

-- Resumen para el panel (cada dueño solo ve lo suyo por las reglas de la tabla). Días en hora de Venezuela.
create or replace function public.eu_resumen_pedidos(p_sitio uuid)
returns jsonb language sql stable set search_path = '' as $$
  with h as (select (now() at time zone 'America/Caracas')::date as hoy),
  base as (
    select p.creado, (p.creado at time zone 'America/Caracas') as hora, p.total, p.tipo, p.items
      from public.eu_pedidos p
     where p.sitio_id = p_sitio and p.creado > now() - interval '75 days'),
  dias as (select generate_series(h.hoy - 13, h.hoy, interval '1 day')::date as dia from h),
  por_dia as (select hora::date as dia, count(*) as n, sum(total) as t from base group by 1)
  select jsonb_build_object(
    'hoy', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h where base.hora::date = h.hoy),
    'semana', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h where base.hora::date > h.hoy - 7),
    'mes', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h
             where date_trunc('month', base.hora) = date_trunc('month', h.hoy::timestamp)),
    'mesPasado', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h
             where date_trunc('month', base.hora) = date_trunc('month', h.hoy::timestamp) - interval '1 month'),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(d.dia, 'YYYY-MM-DD'), 'n', coalesce(x.n, 0), 'total', coalesce(x.t, 0)) order by d.dia), '[]'::jsonb)
               from dias d left join por_dia x on x.dia = d.dia),
    'top', (select coalesce(jsonb_agg(t order by t.cantidad desc, t.nombre), '[]'::jsonb) from (
               select it->>'nombre' as nombre, sum((it->>'cantidad')::int) as cantidad,
                      sum((it->>'cantidad')::int * (it->>'precio')::numeric) as total
                 from base, h, jsonb_array_elements(base.items) as it
                where base.hora::date > h.hoy - 30
                group by 1 order by 2 desc, 1 limit 5) t),
    'tipos', (select coalesce(jsonb_object_agg(coalesce(t.tipo, 'otro'), t.n), '{}'::jsonb) from (
               select base.tipo, count(*) as n from base, h where base.hora::date > h.hoy - 30 group by 1) t),
    'ultimos', (select coalesce(jsonb_agg(u order by u.creado desc), '[]'::jsonb) from (
               select p.creado, p.total, p.tipo, p.pago, p.items from public.eu_pedidos p
                where p.sitio_id = p_sitio order by p.creado desc limit 15) u),
    'historico', (select count(*) from public.eu_pedidos p where p.sitio_id = p_sitio)
  );
$$;
revoke all on function public.eu_resumen_pedidos(uuid) from public, anon;
grant execute on function public.eu_resumen_pedidos(uuid) to authenticated, service_role;

-- Los pedidos de más de 13 meses se borran solos el día 1 de cada mes.
select cron.schedule('eu-limpiar-pedidos', '45 4 1 * *', $$delete from public.eu_pedidos where creado < now() - interval '400 days'$$);
