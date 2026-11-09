-- Sonrisas · fotos de pacientes.
-- Archivos en el almacenamiento privado "pacientes", con la ruta <clínica>/<paciente>/<archivo>:
--   perfil-*.jpg  foto de perfil (la puede cambiar cualquiera del equipo, también la recepción)
--   foto-*.jpg    fotos clínicas: caries, fracturas, antes y después… (solo odontólogos)
-- Los datos de cada foto clínica (categoría, pieza, nota, fecha) van en records, colección "photos".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pacientes', 'pacientes', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Nueva colección "photos" en records.
alter table public.records drop constraint records_collection_check;
alter table public.records add constraint records_collection_check check (collection in (
  'patients', 'appointments', 'treatments', 'budgets', 'payments', 'history', 'consents', 'photos', 'activity', 'odontograms', 'config'
));

-- Las fotos clínicas se registran como historia clínica: solo titular y odontólogos.
create or replace function public.can_write_collection(p_collection text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_collection in ('patients', 'appointments', 'budgets', 'payments', 'consents', 'activity') then public.my_role() is not null
    when p_collection in ('history', 'odontograms', 'treatments', 'photos') then public.my_role() in ('titular', 'odontologo')
    when p_collection = 'config' then public.my_role() = 'titular'
    else false
  end;
$$;

-- Ver: personas de la misma clínica, con la suscripción al día (igual que los datos clínicos).
create policy patient_photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'pacientes'
    and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
    and (select public.clinic_has_access(public.my_clinic_id()))
  );

-- Subir: perfil cualquiera del equipo; fotos clínicas solo titular y odontólogos.
create policy patient_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pacientes'
    and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
    and (select public.clinic_has_access(public.my_clinic_id()))
    and (
      storage.filename(name) like 'perfil-%'
      or (select public.my_role()) in ('titular', 'odontologo')
    )
  );

-- Borrar: mismas reglas que subir.
create policy patient_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'pacientes'
    and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
    and (select public.clinic_has_access(public.my_clinic_id()))
    and (
      storage.filename(name) like 'perfil-%'
      or (select public.my_role()) in ('titular', 'odontologo')
    )
  );
