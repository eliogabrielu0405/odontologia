-- Códigos de creadores (publicidad). Un negocio nuevo usa el código al registrarse (o antes de su primer pago)
-- y tiene un descuento en su primer pago (10% por defecto). Cuando apruebas ese primer pago, el creador gana
-- una comisión: $2 si pagó Básico y $2,50 si pagó Premium (por defecto; se cambian en Ajustes > Creadores).
create table if not exists public.eu_creadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 80),
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{3,20}$'),
  whatsapp text,
  nota text,
  activo boolean not null default true,
  creado timestamptz not null default now()
);
alter table public.eu_creadores enable row level security;
drop policy if exists eu_creadores_admin on public.eu_creadores;
create policy eu_creadores_admin on public.eu_creadores for all to authenticated
  using ((select public.eu_es_admin())) with check ((select public.eu_es_admin()));

create table if not exists public.eu_comisiones (
  id uuid primary key default gen_random_uuid(),
  creador_id uuid not null references public.eu_creadores(id) on delete cascade,
  sitio_id uuid not null unique references public.eu_sitios(id) on delete cascade,  -- una por cuenta
  pago_id uuid references public.eu_pagos(id) on delete set null,
  plan text not null,
  monto numeric(10,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  creado timestamptz not null default now(),
  pagada timestamptz
);
create index if not exists eu_comisiones_creador on public.eu_comisiones (creador_id);
alter table public.eu_comisiones enable row level security;
drop policy if exists eu_comisiones_admin on public.eu_comisiones;
create policy eu_comisiones_admin on public.eu_comisiones for all to authenticated
  using ((select public.eu_es_admin())) with check ((select public.eu_es_admin()));

alter table public.eu_cuentas add column if not exists creador_id uuid references public.eu_creadores(id) on delete set null;
alter table public.eu_cuentas add column if not exists creador_codigo text;
alter table public.eu_pagos add column if not exists descuento numeric(10,2) not null default 0;
alter table public.eu_pagos add column if not exists codigo text;

-- ¿Existe este código? (para el registro y el panel; no muestra datos del creador)
create or replace function public.eu_codigo_creador(p_codigo text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.eu_creadores where codigo = upper(trim(coalesce(p_codigo, ''))) and activo)
$$;
revoke all on function public.eu_codigo_creador(text) from public;
grant execute on function public.eu_codigo_creador(text) to anon, authenticated, service_role;

-- El dueño pone un código si todavía no tiene uno y no ha pagado nunca
create or replace function public.eu_poner_codigo(p_sitio uuid, p_codigo text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_c record; v_cod text := upper(trim(coalesce(p_codigo, '')));
begin
  if not exists (select 1 from public.eu_sitios s where s.id = p_sitio and s.dueno = (select auth.uid()) and s.principal is null) then
    raise exception 'No tienes permiso para hacer eso.' using errcode = '42501';
  end if;
  if exists (select 1 from public.eu_cuentas where sitio_id = p_sitio and creador_id is not null) then
    raise exception 'Tu cuenta ya tiene un código de creador.';
  end if;
  if exists (select 1 from public.eu_pagos where sitio_id = p_sitio and estado = 'aprobado') then
    raise exception 'El código solo se puede usar antes del primer pago.';
  end if;
  select id, codigo into v_c from public.eu_creadores where codigo = v_cod and activo;
  if not found then raise exception 'Ese código no existe o ya no está activo.'; end if;
  update public.eu_cuentas set creador_id = v_c.id, creador_codigo = v_c.codigo where sitio_id = p_sitio;
  return v_c.codigo;
end $$;
revoke all on function public.eu_poner_codigo(uuid, text) from public, anon;
grant execute on function public.eu_poner_codigo(uuid, text) to authenticated, service_role;

-- Registro con código de creador (reemplaza la versión de 6 datos)
drop function if exists public.eu_registrarse(text, text, text, text, text, text);
create or replace function public.eu_registrarse(
  p_usuario text, p_clave text, p_nombre text, p_plantilla text, p_whatsapp text, p_contacto text default null, p_codigo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_slug text := lower(trim(coalesce(p_usuario, '')));
  v_nombre text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_tel text := eu_priv.tel(p_whatsapp);
  v_dias int := greatest(1, least(90, eu_priv.ajuste_num('{diasPrueba}', 15)::int));
  v_hora int := greatest(10, least(1000, eu_priv.ajuste_num('{topeRegistrosHora}', 100)::int));
  v_dia int := greatest(20, least(5000, eu_priv.ajuste_num('{topeRegistrosDia}', 500)::int));
  v_conexion int := greatest(1, least(50, eu_priv.ajuste_num('{topeRegistrosConexion}', 6)::int));
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_cab jsonb; v_ip text; v_origen text; v_uid uuid; v_sitio uuid; v_creador record;
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
  -- Código de creador (opcional): si lo escribió, tiene que existir
  if nullif(trim(coalesce(p_codigo, '')), '') is not null then
    select id, codigo into v_creador from public.eu_creadores where codigo = upper(trim(p_codigo)) and activo;
    if not found then raise exception 'Ese código de creador no existe. Revísalo o déjalo vacío.'; end if;
  end if;
  -- Una prueba gratis por negocio: el WhatsApp no puede tener ya una cuenta.
  if exists (select 1 from public.eu_cuentas c where eu_priv.tel(c.telefono) = v_tel) then
    raise exception 'Ya hay una cuenta con ese WhatsApp. Entra a tu panel o escríbenos si olvidaste tu usuario.';
  end if;

  -- Frenos contra registros en masa: por conexión y en total (los topes salen de los ajustes).
  begin
    v_cab := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_cab := null;
  end;
  v_ip := nullif(trim(coalesce(v_cab->>'cf-connecting-ip', v_cab->>'x-real-ip', split_part(coalesce(v_cab->>'x-forwarded-for', ''), ',', 1))), '');
  if v_ip is not null then
    v_origen := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
    if (select count(*) from eu_priv.registros where origen = v_origen and creado > now() - interval '1 day') >= v_conexion then
      raise exception 'Hoy ya se crearon varias cuentas desde tu conexión. Prueba mañana o escríbenos por WhatsApp.';
    end if;
  end if;
  if (select count(*) from eu_priv.registros where creado > now() - interval '1 hour') >= v_hora
     or (select count(*) from eu_priv.registros where creado > now() - interval '1 day') >= v_dia then
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
  insert into public.eu_cuentas (sitio_id, precio_mensual, vence, contacto, telefono, plan, ciclo, origen, creador_id, creador_codigo)
  values (v_sitio, eu_priv.ajuste_num('{precios,basico,mensual}', 10), v_hoy + v_dias,
          nullif(left(trim(coalesce(p_contacto, '')), 80), ''), v_tel, 'prueba', 'mensual', 'registro', v_creador.id, v_creador.codigo);
  insert into eu_priv.registros (origen, slug) values (v_origen, v_slug);
  delete from eu_priv.registros where creado < now() - interval '30 days';
  return jsonb_build_object('sitio', v_sitio, 'usuario', v_slug, 'vence', v_hoy + v_dias, 'dias', v_dias);
end $$;
revoke all on function public.eu_registrarse(text, text, text, text, text, text, text) from public;
grant execute on function public.eu_registrarse(text, text, text, text, text, text, text) to anon, authenticated, service_role;

-- El descuento del código, para el registro y el panel
create or replace function public.eu_planes_publicos()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'diasPrueba', greatest(1, least(90, eu_priv.ajuste_num('{diasPrueba}', 15)::int)),
    'registroAbierto', coalesce((select case when datos->>'registroAbierto' in ('true', 'false') then (datos->>'registroAbierto')::boolean end
                                   from public.eu_ajustes where id = 'eu'), true),
    'maxPaginas', greatest(1, least(20, eu_priv.ajuste_num('{maxPaginasPremium}', 2)::int)),
    'metodos', coalesce((select jsonb_agg(left(m->>'metodo', 40)) from public.eu_ajustes a, jsonb_array_elements(case when jsonb_typeof(a.datos->'pagos') = 'array' then a.datos->'pagos' else '[]'::jsonb end) m
                          where a.id = 'eu' and coalesce(m->>'metodo', '') <> ''), '[]'::jsonb),
    'descuentoCreador', greatest(0, least(90, eu_priv.ajuste_num('{creadores,descuento}', 10))),
    'whatsapp', (select left(regexp_replace(coalesce(datos->>'whatsapp', ''), '\D', '', 'g'), 15) from public.eu_ajustes where id = 'eu'),
    'precios', jsonb_build_object(
      'basico', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,basico,mensual}', 10), 'anual', eu_priv.ajuste_num('{precios,basico,anual}', 110)),
      'premium', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,premium,mensual}', 20), 'anual', eu_priv.ajuste_num('{precios,premium,anual}', 200)),
      'extra', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,extra,mensual}', 10), 'anual', eu_priv.ajuste_num('{precios,extra,anual}', 110))))
$$;
revoke all on function public.eu_planes_publicos() from public;
grant execute on function public.eu_planes_publicos() to anon, authenticated, service_role;


-- Al aprobar el primer pago se genera la comisión del creador
create or replace function public.eu_admin_aprobar_pago(p_pago uuid, p_meses integer default null, p_plan text default null, p_ciclo text default null, p_extras integer default null)
returns date language plpgsql set search_path = '' as $$
declare v_pago record; v_estado text; v_vence date; v_base date; v_meses int; v_extras int;
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
  v_plan := coalesce(nullif(p_plan, ''), v_pago.plan, case when coalesce(v_plan_actual, 'prueba') = 'prueba' then 'basico' else v_plan_actual end);
  v_ciclo := coalesce(nullif(p_ciclo, ''), v_pago.ciclo, case when v_meses >= 12 then 'anual' else 'mensual' end);
  if v_plan not in ('basico', 'premium') or v_ciclo not in ('mensual', 'anual') then
    raise exception 'Plan inválido' using errcode = '22023';
  end if;
  -- Páginas adicionales pagadas (solo con Premium)
  v_extras := case when v_plan = 'premium' then greatest(0, least(20, coalesce(p_extras, v_pago.extras, 0))) else 0 end;
  v_base := case when v_vence is null or (v_estado = 'suspendido' and v_vence < v_hoy) then v_hoy else v_vence end;
  v_vence := (v_base + make_interval(months => v_meses))::date;
  update public.eu_pagos set estado = 'aprobado', meses = v_meses, plan = v_plan, ciclo = v_ciclo, extras = v_extras, revisado = now(), revisado_por = (select auth.uid())
   where id = p_pago;
  insert into public.eu_cuentas (sitio_id, vence, plan, ciclo, precio_mensual, paginas_extra)
  values (v_pago.sitio_id, v_vence, v_plan, v_ciclo, eu_priv.ajuste_num(array['precios', v_plan, 'mensual'], case v_plan when 'premium' then 20 else 10 end), v_extras)
  on conflict (sitio_id) do update set vence = excluded.vence, plan = excluded.plan, ciclo = excluded.ciclo, paginas_extra = excluded.paginas_extra,
    precio_mensual = case when public.eu_cuentas.plan is distinct from excluded.plan then excluded.precio_mensual else public.eu_cuentas.precio_mensual end;
  update public.eu_sitios set estado = 'activo' where id = v_pago.sitio_id and estado <> 'activo';
  if v_plan = 'premium' then
    update public.eu_sitios set estado = 'activo' where principal = v_pago.sitio_id and estado <> 'activo';
  else
    update public.eu_sitios set estado = 'suspendido' where principal = v_pago.sitio_id and estado <> 'suspendido';
  end if;
  -- Primer pago de una cuenta que llegó con código de creador: se genera su comisión (una sola vez)
  insert into public.eu_comisiones (creador_id, sitio_id, pago_id, plan, monto)
  select c.creador_id, c.sitio_id, p_pago, v_plan,
         case v_plan when 'premium' then eu_priv.ajuste_num('{creadores,premium}', 2.5) else eu_priv.ajuste_num('{creadores,basico}', 2) end
    from public.eu_cuentas c where c.sitio_id = v_pago.sitio_id and c.creador_id is not null
  on conflict (sitio_id) do nothing;
  return v_vence;
end $$;
revoke all on function public.eu_admin_aprobar_pago(uuid, integer, text, text, integer) from public, anon;
grant execute on function public.eu_admin_aprobar_pago(uuid, integer, text, text, integer) to authenticated, service_role;
