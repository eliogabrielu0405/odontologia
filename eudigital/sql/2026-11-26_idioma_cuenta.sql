-- Idioma de cada cuenta: el que eligió el dueño al registrarse (o después, en su panel).
-- Sirve para abrir su panel en ese idioma desde cualquier teléfono y para que EU Digital vea en
-- su panel de administración qué idioma habla cada cliente.

alter table public.eu_cuentas add column if not exists idioma text not null default 'es';
alter table public.eu_cuentas drop constraint if exists eu_cuentas_idioma_valido;
alter table public.eu_cuentas add constraint eu_cuentas_idioma_valido check (idioma in ('es', 'en', 'pt', 'it'));

-- El dueño no puede editar su fila de cuenta (solo el admin). Esta función le deja cambiar solo
-- el idioma, y solo de una cuenta cuya página sea suya.
create or replace function public.eu_poner_idioma(p_sitio uuid, p_idioma text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_idioma not in ('es', 'en', 'pt', 'it') then raise exception 'idioma no válido' using errcode = '22023'; end if;
  if not exists (select 1 from public.eu_sitios s where s.id = p_sitio and s.dueno = (select auth.uid())) then
    raise exception 'No tienes permiso para hacer eso.' using errcode = '42501';
  end if;
  update public.eu_cuentas set idioma = p_idioma where sitio_id = p_sitio;
end $$;
revoke all on function public.eu_poner_idioma(uuid, text) from public, anon;
grant execute on function public.eu_poner_idioma(uuid, text) to authenticated, service_role;
