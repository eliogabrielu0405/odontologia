-- EU Digital: avisos al teléfono del administrador cuando un cliente reporta un pago.

-- Dispositivos donde el administrador activó los avisos (uno por navegador o teléfono).
create table if not exists public.eu_avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 40),
  dispositivo text check (char_length(dispositivo) <= 120),
  creado timestamptz not null default now()
);
create index if not exists eu_avisos_user on public.eu_avisos (user_id);
alter table public.eu_avisos enable row level security;
revoke all on public.eu_avisos from anon, authenticated;
grant select, insert, update, delete on public.eu_avisos to authenticated;
grant all on public.eu_avisos to service_role;

drop policy if exists eu_avisos_admin on public.eu_avisos;
create policy eu_avisos_admin on public.eu_avisos for all to authenticated
  using ((select public.eu_es_admin()) and user_id = (select auth.uid()))
  with check ((select public.eu_es_admin()) and user_id = (select auth.uid()));

-- Clave con la que se firman los avisos. La crea la función eu-avisos la primera vez;
-- solo ella (con la llave de servicio) puede leerla: ni los clientes ni el panel tienen permiso.
create table if not exists public.eu_avisos_clave (
  id int primary key check (id = 1),
  jwk jsonb not null,
  publica text not null,
  creado timestamptz not null default now()
);
alter table public.eu_avisos_clave enable row level security;
revoke all on public.eu_avisos_clave from anon, authenticated;
grant select, insert on public.eu_avisos_clave to service_role;

-- Marca de que ya se avisó de un pago, para avisar una sola vez.
alter table public.eu_pagos add column if not exists avisado timestamptz;

create or replace function eu_priv.limitar_pagos()
returns trigger language plpgsql set search_path = '' as $$
begin
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
