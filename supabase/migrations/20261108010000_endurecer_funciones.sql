-- Sonrisas · endurecer funciones internas (avisos del asesor de seguridad de Supabase).
-- 1) Las funciones que consultan el estado de una clínica solo responden sobre la clínica propia
--    (o para el administrador), para que nadie pueda sondear otras clínicas por su identificador.
-- 2) Quien no inició sesión no puede llamar a las funciones internas; solo public_settings() queda pública.

create or replace function public.clinic_has_access(p_clinic uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.clinics c
    cross join public.platform_settings s
    where c.id = p_clinic
      and (p_clinic = public.my_clinic_id() or public.is_platform_admin())
      and s.id = 1
      and c.status = 'activa'
      and public.today_ve() <= c.paid_until + s.grace_days
  );
$$;

create or replace function public.clinic_status(p_clinic uuid) returns text
language sql stable security definer set search_path = '' as $$
  select status from public.clinics
  where id = p_clinic and (p_clinic = public.my_clinic_id() or public.is_platform_admin());
$$;

revoke execute on function
  public.can_write_collection(text),
  public.clinic_has_access(uuid),
  public.clinic_status(uuid),
  public.is_platform_admin(),
  public.my_clinic_id(),
  public.my_role(),
  public.my_context()
from public, anon;

grant execute on function
  public.can_write_collection(text),
  public.clinic_has_access(uuid),
  public.clinic_status(uuid),
  public.is_platform_admin(),
  public.my_clinic_id(),
  public.my_role(),
  public.my_context()
to authenticated;
