-- Visitas a las páginas de los clientes.
-- Se cuenta una visita por teléfono, por página y por día: la página llama a eu_registrar_visita
-- una sola vez al día (lo recuerda en el teléfono). No se guarda nada de la persona: solo cuántas
-- visitas tuvo cada página cada día. El dueño ve las suyas en "Mis pedidos", junto a sus pedidos.

create table if not exists public.eu_visitas (
  sitio_id uuid not null references public.eu_sitios(id) on delete cascade,
  dia date not null,
  visitas integer not null default 0 check (visitas >= 0),
  primary key (sitio_id, dia)
);
alter table public.eu_visitas enable row level security;
revoke all on public.eu_visitas from public, anon, authenticated;
grant select on public.eu_visitas to authenticated;
grant all on public.eu_visitas to service_role;

drop policy if exists eu_visitas_ver on public.eu_visitas;
create policy eu_visitas_ver on public.eu_visitas for select to authenticated
  using ((select public.eu_es_admin()) or exists (
    select 1 from public.eu_sitios s where s.id = eu_visitas.sitio_id and s.dueno = (select auth.uid())));

-- La llama la página del negocio (sin sesión). Solo suma en páginas activas, con un tope por día
-- para que nadie pueda inflar el número sin límite.
create or replace function public.eu_registrar_visita(p_sitio uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hoy date := (now() at time zone 'America/Caracas')::date;
begin
  if p_sitio is null then return; end if;
  if not exists (select 1 from public.eu_sitios where id = p_sitio and estado = 'activo') then return; end if;
  insert into public.eu_visitas (sitio_id, dia, visitas) values (p_sitio, v_hoy, 1)
  on conflict (sitio_id, dia) do update set visitas = least(public.eu_visitas.visitas + 1, 50000);
end $$;
revoke all on function public.eu_registrar_visita(uuid) from public;
grant execute on function public.eu_registrar_visita(uuid) to anon, authenticated, service_role;

-- El resumen de "Mis pedidos" ahora trae también las visitas (hoy, 7 días, este mes y las dos
-- últimas semanas día por día). Lo demás queda igual.
create or replace function public.eu_resumen_pedidos(p_sitio uuid)
returns jsonb language sql stable set search_path = '' as $$
  with h as (select (now() at time zone 'America/Caracas')::date as hoy),
  base as (
    select p.creado, (p.creado at time zone 'America/Caracas') as hora, p.total, p.tipo, p.items
      from public.eu_pedidos p
     where p.sitio_id = p_sitio and p.creado > now() - interval '75 days'),
  dias as (select generate_series(h.hoy - 13, h.hoy, interval '1 day')::date as dia from h),
  por_dia as (select hora::date as dia, count(*) as n, sum(total) as t from base group by 1),
  vis as (select v.dia, v.visitas from public.eu_visitas v, h where v.sitio_id = p_sitio and v.dia > h.hoy - 75)
  select jsonb_build_object(
    'hoy', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h where base.hora::date = h.hoy),
    'semana', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h where base.hora::date > h.hoy - 7),
    'mes', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h
             where date_trunc('month', base.hora) = date_trunc('month', h.hoy::timestamp)),
    'mesPasado', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(total), 0)) from base, h
             where date_trunc('month', base.hora) = date_trunc('month', h.hoy::timestamp) - interval '1 month'),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(d.dia, 'YYYY-MM-DD'), 'n', coalesce(x.n, 0), 'total', coalesce(x.t, 0),
                                                          'visitas', coalesce((select vis.visitas from vis where vis.dia = d.dia), 0)) order by d.dia), '[]'::jsonb)
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
    'historico', (select count(*) from public.eu_pedidos p where p.sitio_id = p_sitio),
    'visitas', (select jsonb_build_object(
                  'hoy', coalesce((select sum(visitas) from vis, h where vis.dia = h.hoy), 0),
                  'semana', coalesce((select sum(visitas) from vis, h where vis.dia > h.hoy - 7), 0),
                  'mes', coalesce((select sum(visitas) from vis, h where date_trunc('month', vis.dia) = date_trunc('month', h.hoy)), 0),
                  'historico', coalesce((select sum(v.visitas) from public.eu_visitas v where v.sitio_id = p_sitio), 0)))
  );
$$;
revoke all on function public.eu_resumen_pedidos(uuid) from public, anon;
grant execute on function public.eu_resumen_pedidos(uuid) to authenticated, service_role;

-- Las visitas de más de 13 meses se borran solas el día 1 de cada mes.
select cron.unschedule('eu-limpiar-visitas') where exists (select 1 from cron.job where jobname = 'eu-limpiar-visitas');
select cron.schedule('eu-limpiar-visitas', '50 4 1 * *', $$delete from public.eu_visitas where dia < (now() at time zone 'America/Caracas')::date - 400$$);
