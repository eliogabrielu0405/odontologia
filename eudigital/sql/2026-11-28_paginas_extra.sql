-- Premium incluye 2 páginas (ajustable en Ajustes > Planes y precios). Cada página adicional se paga aparte:
-- $10 al mes o $110 al año por defecto (Ajustes: precios.extra). El cliente las pide en su reporte de pago
-- y, al aprobarlo, la cuenta queda con esas páginas adicionales (eu_cuentas.paginas_extra).
alter table public.eu_cuentas add column if not exists paginas_extra int not null default 0;
alter table public.eu_cuentas drop constraint if exists eu_cuentas_paginas_extra_ok;
alter table public.eu_cuentas add constraint eu_cuentas_paginas_extra_ok check (paginas_extra between 0 and 20);
alter table public.eu_pagos add column if not exists extras int not null default 0;
alter table public.eu_pagos drop constraint if exists eu_pagos_extras_ok;
alter table public.eu_pagos add constraint eu_pagos_extras_ok check (extras between 0 and 20);

create or replace function public.eu_planes_publicos()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'diasPrueba', greatest(1, least(90, eu_priv.ajuste_num('{diasPrueba}', 15)::int)),
    'registroAbierto', coalesce((select case when datos->>'registroAbierto' in ('true', 'false') then (datos->>'registroAbierto')::boolean end
                                   from public.eu_ajustes where id = 'eu'), true),
    'maxPaginas', greatest(1, least(20, eu_priv.ajuste_num('{maxPaginasPremium}', 2)::int)),
    'metodos', coalesce((select jsonb_agg(left(m->>'metodo', 40)) from public.eu_ajustes a, jsonb_array_elements(case when jsonb_typeof(a.datos->'pagos') = 'array' then a.datos->'pagos' else '[]'::jsonb end) m
                          where a.id = 'eu' and coalesce(m->>'metodo', '') <> ''), '[]'::jsonb),
    'whatsapp', (select left(regexp_replace(coalesce(datos->>'whatsapp', ''), '\D', '', 'g'), 15) from public.eu_ajustes where id = 'eu'),
    'precios', jsonb_build_object(
      'basico', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,basico,mensual}', 10), 'anual', eu_priv.ajuste_num('{precios,basico,anual}', 110)),
      'premium', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,premium,mensual}', 20), 'anual', eu_priv.ajuste_num('{precios,premium,anual}', 200)),
      'extra', jsonb_build_object('mensual', eu_priv.ajuste_num('{precios,extra,mensual}', 10), 'anual', eu_priv.ajuste_num('{precios,extra,anual}', 110))))
$$;
revoke all on function public.eu_planes_publicos() from public;
grant execute on function public.eu_planes_publicos() to anon, authenticated, service_role;

create or replace function public.eu_crear_pagina(p_usuario text, p_nombre text, p_plantilla text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_slug text := lower(trim(coalesce(p_usuario, '')));
  v_nombre text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_incluidas int := greatest(1, least(20, eu_priv.ajuste_num('{maxPaginasPremium}', 2)::int));
  v_max int;
  v_p record; v_id uuid;
begin
  if v_uid is null then raise exception 'Entra a tu panel primero'; end if;
  select s.id, s.estado, s.contenido, c.plan, coalesce(c.paginas_extra, 0) as extra into v_p
    from public.eu_sitios s join public.eu_cuentas c on c.sitio_id = s.id
   where s.dueno = v_uid and s.principal is null order by s.creado limit 1;
  if not found then raise exception 'No encontramos tu cuenta'; end if;
  if v_p.plan <> 'premium' then raise exception 'Tener varias páginas es parte del plan Premium'; end if;
  if v_p.estado <> 'activo' then raise exception 'Tu cuenta está suspendida. Ponte al día para crear más páginas.'; end if;
  v_max := v_incluidas + v_p.extra;
  if (select count(*) from public.eu_sitios where dueno = v_uid) >= v_max then
    raise exception 'Ya tienes las % páginas de tu plan. Para otra, paga una página adicional en Mi suscripción.', v_max;
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

drop function if exists public.eu_admin_aprobar_pago(uuid, integer, text, text);
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
  return v_vence;
end $$;
revoke all on function public.eu_admin_aprobar_pago(uuid, integer, text, text, integer) from public, anon;
grant execute on function public.eu_admin_aprobar_pago(uuid, integer, text, text, integer) to authenticated, service_role;
