-- Sonrisas · sugerencias de las clínicas para mejorar la app.
-- Cualquier persona del equipo de una clínica envía ideas, mejoras o problemas;
-- el administrador de EU Digital Solutions las revisa, cambia su estado y responde.

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '' check (char_length(author_name) <= 130),
  author_role text not null default '' check (author_role in ('', 'titular', 'odontologo', 'recepcion')),
  kind text not null default 'idea' check (kind in ('idea', 'facilitar', 'problema', 'otro')),
  area text not null default '' check (char_length(area) <= 40),
  title text not null check (char_length(title) between 3 and 120),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'nueva' check (status in ('nueva', 'revisando', 'planeada', 'hecha', 'descartada')),
  admin_reply text not null default '' check (char_length(admin_reply) <= 1500),
  answered_at timestamptz, -- última vez que el administrador cambió el estado o la respuesta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suggestions_clinic_idx on public.suggestions (clinic_id, created_at desc);
create index suggestions_status_idx on public.suggestions (status, created_at desc);
create index suggestions_user_idx on public.suggestions (user_id, created_at desc);

-- Al enviar: el autor, su rol y su clínica salen de su perfil (no de lo que mande la página),
-- la sugerencia empieza como "nueva" y sin respuesta, y hay un tope de 10 por persona al día.
create or replace function public.suggestions_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles%rowtype;
  recent integer;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null then
    raise exception 'Solo el equipo de una clínica puede enviar sugerencias.' using errcode = '42501';
  end if;
  select count(*) into recent from public.suggestions
   where user_id = me.id and created_at > now() - interval '1 day';
  if recent >= 10 then
    raise exception 'Ya enviaste 10 sugerencias hoy. Puedes enviar más mañana.' using errcode = 'P0001';
  end if;
  new.id := gen_random_uuid();
  new.user_id := me.id;
  new.clinic_id := me.clinic_id;
  new.author_role := me.role;
  new.author_name := left(btrim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, '')), 130);
  new.title := btrim(coalesce(new.title, ''));
  new.details := btrim(coalesce(new.details, ''));
  new.area := btrim(coalesce(new.area, ''));
  new.status := 'nueva';
  new.admin_reply := '';
  new.answered_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;
create trigger suggestions_before_insert before insert on public.suggestions
  for each row execute function public.suggestions_before_insert();

-- Al editar (solo el administrador): lo que escribió la clínica no cambia; cambian estado y respuesta.
create or replace function public.suggestions_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.clinic_id := old.clinic_id;
  new.user_id := old.user_id;
  new.author_name := old.author_name;
  new.author_role := old.author_role;
  new.kind := old.kind;
  new.area := old.area;
  new.title := old.title;
  new.details := old.details;
  new.created_at := old.created_at;
  new.admin_reply := btrim(coalesce(new.admin_reply, ''));
  if new.status is distinct from old.status or new.admin_reply is distinct from old.admin_reply then
    new.answered_at := now();
  else
    new.answered_at := old.answered_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger suggestions_before_update before update on public.suggestions
  for each row execute function public.suggestions_before_update();

alter table public.suggestions enable row level security;
revoke all on public.suggestions from anon;

-- Ver: el equipo de la clínica ve las sugerencias de su clínica; el administrador ve todas.
create policy suggestions_read on public.suggestions for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) or (select public.is_platform_admin()));

-- Enviar: cualquier persona activa de una clínica (también si la suscripción está pausada).
create policy suggestions_insert on public.suggestions for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and user_id = (select auth.uid()));

-- Responder y cambiar el estado: solo el administrador.
create policy suggestions_admin_update on public.suggestions for update to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- Borrar: el autor mientras siga "nueva"; el administrador, siempre.
create policy suggestions_delete on public.suggestions for delete to authenticated
  using ((user_id = (select auth.uid()) and status = 'nueva') or (select public.is_platform_admin()));

-- Las funciones de los triggers no se llaman directamente desde la API.
revoke execute on function public.suggestions_before_insert(), public.suggestions_before_update() from public, anon, authenticated;
