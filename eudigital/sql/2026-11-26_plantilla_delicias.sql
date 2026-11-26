-- Plantilla Delicias: menú moderno de comida rápida, solo para el plan Premium.
-- Se puede probar en la prueba gratis. Con el plan Básico no se puede usar en la página principal
-- (la única que queda en línea con ese plan): ni al pagar o cambiar el plan, ni al cambiar la plantilla.

create or replace function eu_priv.plantilla_valida(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p = any (array['pizzeria', 'arepera', 'burgers', 'delicias', 'sushi', 'boutique']), false)
$$;

-- Plantillas que solo incluye el plan Premium
create or replace function eu_priv.plantilla_premium(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p = any (array['delicias']), false)
$$;

create or replace function eu_priv.usuario_valido(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$', false)
     and p <> all (array['admin', 'panel', 'registro', 'planes', 'www', 'app', 'api', 'core', 'img', 'sql', 'tools', 'eudigital',
                         'eu-digital', 'soporte', 'ayuda', 'demo', 'prueba', 'test', 'login', 'entrar', 'pizzeria', 'arepera',
                         'burgers', 'delicias', 'sushi', 'boutique'])
$$;

revoke all on function eu_priv.plantilla_valida(text), eu_priv.plantilla_premium(text), eu_priv.usuario_valido(text) from public, anon, authenticated;

-- Una cuenta no puede quedar en Básico si su página principal usa una plantilla Premium
create or replace function eu_priv.guardia_plan_cuenta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.plan = 'basico' and exists (select 1 from public.eu_sitios s where s.id = new.sitio_id and eu_priv.plantilla_premium(s.plantilla)) then
    raise exception 'Esta página usa una plantilla del plan Premium (Delicias). Ponle el plan Premium o cámbiale la plantilla antes de pasarla a Básico.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function eu_priv.guardia_plan_cuenta() from public, anon, authenticated;
drop trigger if exists eu_cuentas_plan_plantilla on public.eu_cuentas;
create trigger eu_cuentas_plan_plantilla before insert or update of plan on public.eu_cuentas
  for each row execute function eu_priv.guardia_plan_cuenta();

-- Ni se le puede poner una plantilla Premium a la página principal de una cuenta Básico
create or replace function eu_priv.guardia_plantilla_premium()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.principal is null and eu_priv.plantilla_premium(new.plantilla)
     and (tg_op = 'INSERT' or new.plantilla is distinct from old.plantilla)
     and exists (select 1 from public.eu_cuentas c where c.sitio_id = new.id and c.plan = 'basico') then
    raise exception 'Esa plantilla es del plan Premium. Esta cuenta tiene el plan Básico.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function eu_priv.guardia_plantilla_premium() from public, anon, authenticated;
drop trigger if exists eu_sitios_plantilla_premium on public.eu_sitios;
create trigger eu_sitios_plantilla_premium before insert or update of plantilla on public.eu_sitios
  for each row execute function eu_priv.guardia_plantilla_premium();

-- La tabla de páginas también lista las plantillas permitidas: se suma Delicias.
alter table public.eu_sitios drop constraint if exists eu_sitios_plantilla_check;
alter table public.eu_sitios add constraint eu_sitios_plantilla_check
  check (plantilla = any (array['pizzeria', 'arepera', 'burgers', 'delicias', 'sushi', 'boutique']));
