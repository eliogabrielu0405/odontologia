-- EU Digital: planes (prueba gratis, básico, premium), registro propio y varias páginas por cuenta.
--
-- Una cuenta = un usuario. Su página principal es la que lleva su nombre de usuario y es la que
-- guarda la suscripción (eu_cuentas). Con Premium puede tener páginas adicionales, que apuntan a
-- la principal con eu_sitios.principal y se suspenden, reactivan y eliminan junto con ella.

/* ------------------------------------------------------------------ 1. Columnas */
alter table public.eu_sitios add column if not exists principal uuid references public.eu_sitios(id) on delete cascade;
create index if not exists eu_sitios_principal on public.eu_sitios (principal) where principal is not null;
create index if not exists eu_sitios_dueno on public.eu_sitios (dueno);

alter table public.eu_cuentas add column if not exists plan text not null default 'basico' check (plan in ('prueba', 'basico', 'premium'));
alter table public.eu_cuentas add column if not exists ciclo text not null default 'mensual' check (ciclo in ('mensual', 'anual'));
alter table public.eu_cuentas add column if not exists origen text not null default 'admin' check (origen in ('admin', 'registro'));
alter table public.eu_cuentas add column if not exists aviso_alta timestamptz; -- ya se avisó al administrador de este registro

alter table public.eu_pagos add column if not exists plan text check (plan in ('basico', 'premium'));
alter table public.eu_pagos add column if not exists ciclo text check (ciclo in ('mensual', 'anual'));

/* ------------------------------------------------------------------ 2. Ayudas internas */
-- Un número de los ajustes (precios, días de prueba) con su valor por defecto.
create or replace function eu_priv.ajuste_num(p_ruta text[], p_defecto numeric)
returns numeric language sql stable set search_path = '' as $$
  select coalesce((select case when (datos #>> p_ruta) ~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' then (datos #>> p_ruta)::numeric end
                     from public.eu_ajustes where id = 'eu'), p_defecto)
$$;

-- Teléfono solo con números y con el código de Venezuela cuando lo escriben como 0414...
create or replace function eu_priv.tel(p text)
returns text language sql immutable set search_path = '' as $$
  select case when d ~ '^0[24][0-9]{9}$' then '58' || substr(d, 2) else d end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function eu_priv.usuario_valido(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$', false)
     and p <> all (array['admin', 'panel', 'registro', 'planes', 'www', 'app', 'api', 'core', 'img', 'sql', 'tools', 'eudigital',
                         'eu-digital', 'soporte', 'ayuda', 'demo', 'prueba', 'test', 'login', 'entrar', 'pizzeria', 'arepera',
                         'burgers', 'sushi', 'boutique'])
$$;

create or replace function eu_priv.plantilla_valida(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p = any (array['pizzeria', 'arepera', 'burgers', 'sushi', 'boutique']), false)
$$;

-- Lo que una página conserva al cambiar de plantilla o al copiarse a una página nueva.
create or replace function eu_priv.contenido_comun(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(p, '{}'::jsonb)) as e(k, v)
   where k in ('negocio', 'pagos', 'tasa', 'hoy', 'pedidos', 'banner')
$$;

revoke all on function eu_priv.ajuste_num(text[], numeric), eu_priv.tel(text), eu_priv.usuario_valido(text),
  eu_priv.plantilla_valida(text), eu_priv.contenido_comun(jsonb) from public, anon, authenticated;
-- Las funciones del administrador corren con su propio permiso y leen los precios de los ajustes.
grant execute on function eu_priv.ajuste_num(text[], numeric) to authenticated;

/* ------------------------------------------------------------------ 3. Crear usuarios */
-- Crea el usuario sin revisar quién llama. Nadie la puede llamar directo: solo las funciones de abajo.
create or replace function eu_priv.alta_usuario(p_email text, p_clave text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if char_length(coalesce(p_clave, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres' using errcode = '22023';
  end if;
  if octet_length(p_clave) > 72 then
    raise exception 'La contraseña es demasiado larga' using errcode = '22023';
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
revoke all on function eu_priv.alta_usuario(text, text) from public, anon, authenticated;

create or replace function eu_priv.crear_usuario(p_email text, p_clave text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.eu_admins where user_id = (select auth.uid())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return eu_priv.alta_usuario(p_email, p_clave);
end $$;

/* ------------------------------------------------------------------ 4. Registro propio con prueba gratis */
-- Bitácora mínima para frenar abusos: cuándo, desde qué conexión (solo su huella) y qué usuario.
create table if not exists eu_priv.registros (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  origen text,
  slug text not null
);
create index if not exists registros_creado on eu_priv.registros (creado);
revoke all on eu_priv.registros from public, anon, authenticated;

-- Lo que la portada y el registro necesitan saber sin iniciar sesión.
create or replace function public.eu_planes_publicos()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'diasPrueba', greatest(1, least(90, eu_priv.ajuste_num('{diasPrueba}', 15)::int)),
    'registroAbierto', coalesce((select case when datos->>'registroAbierto' in ('true', 'false') then (datos->>'registroAbierto')::boolean end
                                   from public.eu_ajustes where id = 'eu'), true),
    'maxPaginas', greatest(1, least(20, eu_priv.ajuste_num('{maxPaginasPremium}', 5)::int)),
    'metodos', coalesce((select jsonb_agg(left(m->>'metodo', 40)) from public.eu_ajustes a, jsonb_array_elements(case when jsonb_typeof(a.datos->'pagos') = 'array' then a.datos->'pagos' else '[]'::jsonb end) m
                          where a.id = 'eu' and coalesce(m->>'metodo', '') <> ''), '[]'::jsonb),
    'whatsapp', (select left(regexp_replace(coalesce(datos->>'whatsapp', ''), '\D', '', 'g'), 15) from public.eu_ajustes where id = 'eu'),
    'precios', jsonb_build_object(
      'basico', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,basico,mensual}', 10), 'anual', eu_priv.ajuste_num('{precios,basico,anual}', 110)),
      'premium', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,premium,mensual}', 20), 'anual', eu_priv.ajuste_num('{precios,premium,anual}', 200))))
$$;
revoke all on function public.eu_planes_publicos() from public;
grant execute on function public.eu_planes_publicos() to anon, authenticated, service_role;

create or replace function public.eu_usuario_libre(p_usuario text)
returns boolean language sql stable security definer set search_path = '' as $$
  select eu_priv.usuario_valido(lower(trim(coalesce(p_usuario, ''))))
     and not exists (select 1 from public.eu_sitios where slug = lower(trim(p_usuario)))
$$;
revoke all on function public.eu_usuario_libre(text) from public;
grant execute on function public.eu_usuario_libre(text) to anon, authenticated, service_role;

create or replace function public.eu_registrarse(
  p_usuario text, p_clave text, p_nombre text, p_plantilla text, p_whatsapp text, p_contacto text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_slug text := lower(trim(coalesce(p_usuario, '')));
  v_nombre text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_tel text := eu_priv.tel(p_whatsapp);
  v_dias int := greatest(1, least(90, eu_priv.ajuste_num('{diasPrueba}', 15)::int));
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_cab jsonb; v_ip text; v_origen text; v_uid uuid; v_sitio uuid;
begin
  if not coalesce((select case when datos->>'registroAbierto' in ('true', 'false') then (datos->>'registroAbierto')::boolean end
                     from public.eu_ajustes where id = 'eu'), true) then
    raise exception 'El registro está cerrado por ahora. Escríbenos por WhatsApp y te creamos tu página.';
  end if;
  if not eu_priv.usuario_valido(v_slug) then
    raise exception 'Elige un usuario de 3 a 40 letras minúsculas, números o guiones. Algunos nombres están reservados.';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de tu negocio';
  end if;
  if not eu_priv.plantilla_valida(p_plantilla) then
    raise exception 'Elige una plantilla';
  end if;
  if char_length(v_tel) < 10 or char_length(v_tel) > 15 then
    raise exception 'Escribe tu WhatsApp completo, por ejemplo 0414 123 4567';
  end if;
  if exists (select 1 from public.eu_sitios where slug = v_slug) then
    raise exception 'Ese usuario ya está en uso. Prueba con otro.';
  end if;
  -- Una prueba gratis por negocio: el WhatsApp no puede tener ya una cuenta.
  if exists (select 1 from public.eu_cuentas c where eu_priv.tel(c.telefono) = v_tel) then
    raise exception 'Ya hay una cuenta con ese WhatsApp. Entra a tu panel o escríbenos si olvidaste tu usuario.';
  end if;

  -- Frenos contra registros en masa: por conexión y en total.
  begin
    v_cab := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_cab := null;
  end;
  v_ip := nullif(trim(coalesce(v_cab->>'cf-connecting-ip', v_cab->>'x-real-ip', split_part(coalesce(v_cab->>'x-forwarded-for', ''), ',', 1))), '');
  if v_ip is not null then
    v_origen := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
    if (select count(*) from eu_priv.registros where origen = v_origen and creado > now() - interval '1 day') >= 6 then
      raise exception 'Hoy ya se crearon varias cuentas desde tu conexión. Prueba mañana o escríbenos por WhatsApp.';
    end if;
  end if;
  if (select count(*) from eu_priv.registros where creado > now() - interval '1 hour') >= 40
     or (select count(*) from eu_priv.registros where creado > now() - interval '1 day') >= 200 then
    raise exception 'Estamos recibiendo muchos registros en este momento. Prueba en un rato.';
  end if;

  v_uid := eu_priv.alta_usuario(v_slug || '@clientes.eudigital.invalid', p_clave);
  -- La página arranca con el menú de muestra, pero sin la dirección ni las redes de la muestra.
  insert into public.eu_sitios (slug, nombre, plantilla, contenido, dueno)
  values (v_slug, v_nombre, p_plantilla,
          jsonb_build_object('negocio', jsonb_build_object('whatsapp', v_tel, 'direccion', '', 'referencia', '', 'ciudad', '', 'mapa', '',
                                                           'instagram', '', 'tiktok', '', 'facebook', '')),
          v_uid)
  returning id into v_sitio;
  insert into public.eu_cuentas (sitio_id, precio_mensual, vence, contacto, telefono, plan, ciclo, origen)
  values (v_sitio, eu_priv.ajuste_num('{precios,basico,mensual}', 10), v_hoy + v_dias,
          nullif(left(trim(coalesce(p_contacto, '')), 80), ''), v_tel, 'prueba', 'mensual', 'registro');
  insert into eu_priv.registros (origen, slug) values (v_origen, v_slug);
  delete from eu_priv.registros where creado < now() - interval '30 days';
  return jsonb_build_object('sitio', v_sitio, 'usuario', v_slug, 'vence', v_hoy + v_dias, 'dias', v_dias);
end $$;
revoke all on function public.eu_registrarse(text, text, text, text, text, text) from public;
grant execute on function public.eu_registrarse(text, text, text, text, text, text) to anon, authenticated, service_role;

/* ------------------------------------------------------------------ 5. Varias páginas y cambio de plantilla (Premium) */
-- Copia de lo que tenía una página en cada plantilla, para que al volver a una plantilla no se pierda su menú.
create table if not exists eu_priv.respaldos (
  sitio_id uuid not null references public.eu_sitios(id) on delete cascade,
  plantilla text not null,
  contenido jsonb not null,
  guardado timestamptz not null default now(),
  primary key (sitio_id, plantilla)
);
revoke all on eu_priv.respaldos from public, anon, authenticated;

create or replace function public.eu_crear_pagina(p_usuario text, p_nombre text, p_plantilla text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_slug text := lower(trim(coalesce(p_usuario, '')));
  v_nombre text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_max int := greatest(1, least(20, eu_priv.ajuste_num('{maxPaginasPremium}', 5)::int));
  v_p record; v_id uuid;
begin
  if v_uid is null then raise exception 'Entra a tu panel primero'; end if;
  select s.id, s.estado, s.contenido, c.plan into v_p
    from public.eu_sitios s join public.eu_cuentas c on c.sitio_id = s.id
   where s.dueno = v_uid and s.principal is null order by s.creado limit 1;
  if not found then raise exception 'No encontramos tu cuenta'; end if;
  if v_p.plan <> 'premium' then raise exception 'Tener varias páginas es parte del plan Premium'; end if;
  if v_p.estado <> 'activo' then raise exception 'Tu cuenta está suspendida. Ponte al día para crear más páginas.'; end if;
  if (select count(*) from public.eu_sitios where dueno = v_uid) >= v_max then
    raise exception 'Ya tienes las % páginas que incluye tu plan', v_max;
  end if;
  if not eu_priv.usuario_valido(v_slug) then
    raise exception 'Elige un enlace de 3 a 40 letras minúsculas, números o guiones. Algunos nombres están reservados.';
  end if;
  if exists (select 1 from public.eu_sitios where slug = v_slug) then
    raise exception 'Ese enlace ya está en uso. Prueba con otro.';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de la página';
  end if;
  if not eu_priv.plantilla_valida(p_plantilla) then raise exception 'Elige una plantilla'; end if;
  insert into public.eu_sitios (slug, nombre, plantilla, contenido, dueno, principal)
  values (v_slug, v_nombre, p_plantilla, (eu_priv.contenido_comun(v_p.contenido) - 'hoy' - 'banner') #- '{negocio,logo}', v_uid, v_p.id)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.eu_crear_pagina(text, text, text) from public, anon;
grant execute on function public.eu_crear_pagina(text, text, text) to authenticated, service_role;

-- El dueño (con Premium) o el administrador. Guarda el menú de la plantilla que deja y recupera el que tenía en la nueva.
create or replace function public.eu_cambiar_plantilla(p_sitio uuid, p_plantilla text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_s record; v_plan text; v_estado text; v_comun jsonb; v_guardado jsonb;
begin
  select * into v_s from public.eu_sitios where id = p_sitio for update;
  if not found then raise exception 'Esa página no existe'; end if;
  if not public.eu_es_admin() then
    if (select auth.uid()) is null or v_s.dueno is distinct from (select auth.uid()) then
      raise exception 'No autorizado';
    end if;
    select c.plan, s.estado into v_plan, v_estado
      from public.eu_sitios s join public.eu_cuentas c on c.sitio_id = s.id where s.id = coalesce(v_s.principal, v_s.id);
    if v_plan is distinct from 'premium' then raise exception 'Cambiar de plantilla es parte del plan Premium'; end if;
    if v_estado is distinct from 'activo' or v_s.estado <> 'activo' then
      raise exception 'Tu cuenta está suspendida. Ponte al día para cambiar de plantilla.';
    end if;
  end if;
  if not eu_priv.plantilla_valida(p_plantilla) then raise exception 'Elige una plantilla'; end if;
  if v_s.plantilla = p_plantilla then return; end if;
  v_comun := eu_priv.contenido_comun(v_s.contenido);
  insert into eu_priv.respaldos (sitio_id, plantilla, contenido)
  values (p_sitio, v_s.plantilla, v_s.contenido - array['negocio', 'pagos', 'tasa', 'hoy', 'pedidos', 'banner', 'compartir'])
  on conflict (sitio_id, plantilla) do update set contenido = excluded.contenido, guardado = now();
  select contenido into v_guardado from eu_priv.respaldos where sitio_id = p_sitio and plantilla = p_plantilla;
  update public.eu_sitios set plantilla = p_plantilla, contenido = coalesce(v_guardado, '{}'::jsonb) || v_comun where id = p_sitio;
end $$;
revoke all on function public.eu_cambiar_plantilla(uuid, text) from public, anon;
grant execute on function public.eu_cambiar_plantilla(uuid, text) to authenticated, service_role;

-- Fotos de la página que siguen en uso en los menús guardados de otras plantillas: el panel no las borra al limpiar.
create or replace function public.eu_fotos_guardadas(p_sitio uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct m[1]), '[]'::jsonb)
    from eu_priv.respaldos r join public.eu_sitios s on s.id = r.sitio_id,
         regexp_matches(r.contenido::text, '(' || p_sitio::text || '/[A-Za-z0-9._-]+)', 'g') m
   where r.sitio_id = p_sitio and (s.dueno = (select auth.uid()) or (select public.eu_es_admin()))
$$;
revoke all on function public.eu_fotos_guardadas(uuid) from public, anon;
grant execute on function public.eu_fotos_guardadas(uuid) to authenticated, service_role;

create or replace function public.eu_borrar_pagina(p_sitio uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.eu_sitios where id = p_sitio and dueno = (select auth.uid()) and principal is not null;
  if not found then
    raise exception 'Solo puedes borrar las páginas adicionales de tu cuenta';
  end if;
end $$;
revoke all on function public.eu_borrar_pagina(uuid) from public, anon;
grant execute on function public.eu_borrar_pagina(uuid) to authenticated, service_role;

/* ------------------------------------------------------------------ 6. Protecciones y cascadas */
create or replace function public.eu_sitios_guardia()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.eu_es_admin() then
    if new.id is distinct from old.id or new.slug is distinct from old.slug
       or new.plantilla is distinct from old.plantilla or new.estado is distinct from old.estado
       or new.dueno is distinct from old.dueno or new.creado is distinct from old.creado
       or new.dominio is distinct from old.dominio or new.principal is distinct from old.principal then
      raise exception 'Ese dato solo lo puede cambiar EUdigital' using errcode = '42501';
    end if;
  end if;
  new.actualizado := now();
  return new;
end $$;

-- Las páginas adicionales siguen a la principal: se suspenden con ella y, si el plan es Premium, se reactivan con ella.
create or replace function eu_priv.cascada_estado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.principal is null and new.estado is distinct from old.estado then
    if new.estado = 'suspendido' then
      update public.eu_sitios set estado = 'suspendido' where principal = new.id and estado <> 'suspendido';
    elsif exists (select 1 from public.eu_cuentas c where c.sitio_id = new.id and c.plan = 'premium') then
      update public.eu_sitios set estado = 'activo' where principal = new.id and estado <> 'activo';
    end if;
  end if;
  return null;
end $$;
revoke all on function eu_priv.cascada_estado() from public, anon, authenticated;
drop trigger if exists eu_sitios_cascada on public.eu_sitios;
create trigger eu_sitios_cascada after update of estado on public.eu_sitios
  for each row execute function eu_priv.cascada_estado();

-- Los pagos siempre van a la página principal de la cuenta, que es la que lleva la suscripción.
create or replace function eu_priv.limitar_pagos()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.sitio_id := coalesce((select s.principal from public.eu_sitios s where s.id = new.sitio_id), new.sitio_id);
  if new.ciclo = 'anual' then new.meses := 12; end if;
  if public.eu_es_admin() then return new; end if;
  new.avisado := null; -- un cliente no puede marcar su propio pago como ya avisado
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

/* ------------------------------------------------------------------ 7. Funciones del administrador */
drop function if exists public.eu_admin_aprobar_pago(uuid, integer);
create or replace function public.eu_admin_aprobar_pago(p_pago uuid, p_meses integer default null, p_plan text default null, p_ciclo text default null)
returns date language plpgsql set search_path = '' as $$
declare v_pago record; v_estado text; v_vence date; v_base date; v_meses int;
        v_plan_actual text; v_ciclo_actual text; v_plan text; v_ciclo text;
        v_hoy date := (now() at time zone 'America/Caracas')::date;
begin
  perform eu_priv.exigir_admin();
  select * into v_pago from public.eu_pagos where id = p_pago for update;
  if not found then raise exception 'Pago no encontrado' using errcode = 'P0002'; end if;
  if v_pago.estado <> 'pendiente' then raise exception 'Ese pago ya fue revisado' using errcode = '22023'; end if;
  v_meses := coalesce(p_meses, v_pago.meses);
  if v_meses < 1 or v_meses > 24 then raise exception 'Meses inválidos' using errcode = '22023'; end if;
  select s.estado, c.vence, c.plan, c.ciclo into v_estado, v_vence, v_plan_actual, v_ciclo_actual
    from public.eu_sitios s left join public.eu_cuentas c on c.sitio_id = s.id where s.id = v_pago.sitio_id;
  -- El plan que se paga; si el pago no lo dice, sigue el que tenía (y una prueba pasa a Básico).
  v_plan := coalesce(nullif(p_plan, ''), v_pago.plan, case when coalesce(v_plan_actual, 'prueba') = 'prueba' then 'basico' else v_plan_actual end);
  v_ciclo := coalesce(nullif(p_ciclo, ''), v_pago.ciclo, case when v_meses >= 12 then 'anual' else 'mensual' end);
  if v_plan not in ('basico', 'premium') or v_ciclo not in ('mensual', 'anual') then
    raise exception 'Plan inválido' using errcode = '22023';
  end if;
  -- Los meses se suman a la fecha de corte que tenía (una prueba que paga antes de terminar no pierde sus días).
  -- Si estaba suspendida y vencida, se cuentan desde hoy.
  v_base := case when v_vence is null or (v_estado = 'suspendido' and v_vence < v_hoy) then v_hoy else v_vence end;
  v_vence := (v_base + make_interval(months => v_meses))::date;
  update public.eu_pagos set estado = 'aprobado', meses = v_meses, plan = v_plan, ciclo = v_ciclo, revisado = now(), revisado_por = (select auth.uid())
   where id = p_pago;
  insert into public.eu_cuentas (sitio_id, vence, plan, ciclo, precio_mensual)
  values (v_pago.sitio_id, v_vence, v_plan, v_ciclo, eu_priv.ajuste_num(array['precios', v_plan, 'mensual'], case v_plan when 'premium' then 20 else 10 end))
  on conflict (sitio_id) do update set vence = excluded.vence, plan = excluded.plan, ciclo = excluded.ciclo,
    precio_mensual = case when public.eu_cuentas.plan is distinct from excluded.plan then excluded.precio_mensual else public.eu_cuentas.precio_mensual end;
  update public.eu_sitios set estado = 'activo' where id = v_pago.sitio_id and estado <> 'activo';
  -- Con Premium se reactivan las páginas adicionales; con Básico quedan guardadas pero suspendidas.
  if v_plan = 'premium' then
    update public.eu_sitios set estado = 'activo' where principal = v_pago.sitio_id and estado <> 'activo';
  else
    update public.eu_sitios set estado = 'suspendido' where principal = v_pago.sitio_id and estado <> 'suspendido';
  end if;
  return v_vence;
end $$;
revoke all on function public.eu_admin_aprobar_pago(uuid, integer, text, text) from public, anon;
grant execute on function public.eu_admin_aprobar_pago(uuid, integer, text, text) to authenticated, service_role;

drop function if exists public.eu_admin_registrar_pago(uuid, numeric, text, integer, text, text, text);
create or replace function public.eu_admin_registrar_pago(
  p_sitio uuid, p_monto numeric, p_metodo text, p_meses integer default 1,
  p_moneda text default 'USD', p_referencia text default null, p_nota text default null,
  p_plan text default null, p_ciclo text default null)
returns date language plpgsql set search_path = '' as $$
declare v_id uuid; v_meses int := coalesce(p_meses, 1);
begin
  perform eu_priv.exigir_admin();
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto debe ser mayor que cero' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_metodo, '')), '') is null then raise exception 'Falta la forma de pago' using errcode = '22023'; end if;
  if v_meses < 1 or v_meses > 24 then raise exception 'Meses inválidos' using errcode = '22023'; end if;
  insert into public.eu_pagos (sitio_id, monto, moneda, metodo, referencia, meses, nota, creado_por, plan, ciclo)
  values (p_sitio, round(p_monto, 2), coalesce(nullif(trim(p_moneda), ''), 'USD'), left(trim(p_metodo), 40),
          left(nullif(trim(coalesce(p_referencia, '')), ''), 80), v_meses,
          left(nullif(trim(coalesce(p_nota, '')), ''), 300), (select auth.uid()), nullif(p_plan, ''), nullif(p_ciclo, ''))
  returning id into v_id;
  return public.eu_admin_aprobar_pago(v_id, case when nullif(p_ciclo, '') = 'anual' then 12 else v_meses end);
end $$;
revoke all on function public.eu_admin_registrar_pago(uuid, numeric, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.eu_admin_registrar_pago(uuid, numeric, text, integer, text, text, text, text, text) to authenticated, service_role;

drop function if exists public.eu_admin_crear_cliente(text, text, text, text, jsonb, numeric, date, text, text);
create or replace function public.eu_admin_crear_cliente(
  p_slug text, p_nombre text, p_plantilla text, p_clave text, p_contenido jsonb,
  p_precio numeric default 10, p_vence date default null, p_contacto text default null, p_telefono text default null,
  p_plan text default 'basico', p_ciclo text default 'mensual')
returns uuid language plpgsql set search_path = '' as $$
declare v_uid uuid; v_sitio uuid; v_slug text := lower(trim(p_slug));
begin
  perform eu_priv.exigir_admin();
  if exists (select 1 from public.eu_sitios where slug = v_slug) then
    raise exception 'Ya existe una página con ese usuario' using errcode = '23505';
  end if;
  v_uid := eu_priv.crear_usuario(v_slug || '@clientes.eudigital.invalid', p_clave);
  insert into public.eu_sitios (slug, nombre, plantilla, contenido, dueno)
    values (v_slug, trim(p_nombre), p_plantilla, coalesce(p_contenido, '{}'::jsonb), v_uid)
    returning id into v_sitio;
  insert into public.eu_cuentas (sitio_id, precio_mensual, vence, contacto, telefono, plan, ciclo)
    values (v_sitio, coalesce(p_precio, 10), p_vence, nullif(trim(p_contacto), ''), nullif(trim(p_telefono), ''),
            coalesce(nullif(p_plan, ''), 'basico'), coalesce(nullif(p_ciclo, ''), 'mensual'));
  return v_sitio;
end $$;
revoke all on function public.eu_admin_crear_cliente(text, text, text, text, jsonb, numeric, date, text, text, text, text) from public, anon;
grant execute on function public.eu_admin_crear_cliente(text, text, text, text, jsonb, numeric, date, text, text, text, text) to authenticated, service_role;

-- Eliminar la página principal elimina la cuenta entera (sus páginas adicionales y su usuario).
-- Eliminar una página adicional solo borra esa página.
create or replace function public.eu_admin_eliminar_sitio(p_sitio uuid)
returns void language plpgsql set search_path = '' as $$
declare v_dueno uuid; v_principal uuid;
begin
  perform eu_priv.exigir_admin();
  select dueno, principal into v_dueno, v_principal from public.eu_sitios where id = p_sitio;
  if not found then return; end if;
  delete from public.eu_sitios where id = p_sitio;
  if v_principal is null and v_dueno is not null then
    delete from public.eu_sitios where dueno = v_dueno;
    perform eu_priv.borrar_usuario(v_dueno);
  end if;
end $$;

-- Cada noche: las pruebas gratis que terminaron se suspenden siempre; las pagadas vencidas, solo si
-- está encendido "suspender solas" y ya pasaron los días de gracia.
create or replace function eu_priv.suspender_vencidas()
returns integer language plpgsql security definer set search_path = '' as $$
declare n int; m int; v_hoy date := (now() at time zone 'America/Caracas')::date;
begin
  update public.eu_sitios s set estado = 'suspendido'
    from public.eu_cuentas c
   where c.sitio_id = s.id and s.estado = 'activo' and c.plan = 'prueba'
     and c.vence is not null and c.vence < v_hoy;
  get diagnostics n = row_count;
  update public.eu_sitios s set estado = 'suspendido'
    from public.eu_cuentas c, public.eu_ajustes a
   where c.sitio_id = s.id and a.id = 'eu' and s.estado = 'activo' and c.plan <> 'prueba'
     and coalesce((a.datos->>'autoSuspender')::boolean, false)
     and c.vence is not null
     and c.vence + coalesce((a.datos->>'diasGracia')::int, 3) < v_hoy;
  get diagnostics m = row_count;
  return n + m;
end $$;
revoke all on function eu_priv.suspender_vencidas() from public, anon, authenticated;
