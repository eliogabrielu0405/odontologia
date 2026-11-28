-- Plantilla Licorería (plan Premium): se suma a las plantillas válidas, a la restricción de la tabla,
-- a los usuarios reservados y a las plantillas Premium (que no se pueden usar con el plan Básico).
create or replace function eu_priv.plantilla_valida(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p = any (array['pizzeria', 'arepera', 'burgers', 'delicias', 'sushi', 'boutique', 'licoreria']), false)
$$;
create or replace function eu_priv.plantilla_premium(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p = any (array['delicias', 'licoreria']), false)
$$;
create or replace function eu_priv.usuario_valido(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$', false)
     and p <> all (array['admin', 'panel', 'registro', 'planes', 'www', 'app', 'api', 'core', 'img', 'sql', 'tools', 'eudigital',
                         'eu-digital', 'soporte', 'ayuda', 'demo', 'prueba', 'test', 'login', 'entrar', 'pizzeria', 'arepera',
                         'burgers', 'delicias', 'sushi', 'boutique', 'licoreria', 'tiendo'])
$$;
revoke all on function eu_priv.plantilla_valida(text), eu_priv.plantilla_premium(text), eu_priv.usuario_valido(text) from public, anon, authenticated;
alter table public.eu_sitios drop constraint if exists eu_sitios_plantilla_check;
alter table public.eu_sitios add constraint eu_sitios_plantilla_check
  check (plantilla = any (array['pizzeria', 'arepera', 'burgers', 'delicias', 'sushi', 'boutique', 'licoreria']));
-- Mensajes sin nombrar una sola plantilla
create or replace function eu_priv.guardia_plan_cuenta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.plan = 'basico' and exists (select 1 from public.eu_sitios s where s.id = new.sitio_id and eu_priv.plantilla_premium(s.plantilla)) then
    raise exception 'Esta página usa una plantilla del plan Premium. Ponle el plan Premium o cámbiale la plantilla antes de pasarla a Básico.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function eu_priv.guardia_plan_cuenta() from public, anon, authenticated;
