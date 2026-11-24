-- Sonrisas · varios métodos de pago para la mensualidad y pagos por Google Play.
--
-- 1) Métodos de pago (web): el administrador arma la lista que ven las clínicas (Pago Móvil, PayPal,
--    Binance, Zelle, Zinli, transferencia u otro), cada uno con sus datos. Se guarda como una lista JSON
--    en platform_settings.payment_methods y llega a la app con el resto de los ajustes (my_context).
--    Cada comprobante dice con qué método se pagó (payment_reports.method).
-- 2) Google Play (app de la tienda): la clínica paga con el sistema de pagos de Google. La función del
--    servidor verifica la compra con Google, la guarda en play_purchases y extiende la suscripción.
--    El pago aparece en el historial como un comprobante ya aprobado (method = 'Google Play').

-- ---------- Métodos de pago ----------
alter table public.platform_settings
  add column payment_methods jsonb not null default '[]'::jsonb
    check (jsonb_typeof(payment_methods) = 'array' and jsonb_array_length(payment_methods) <= 12),
  add column play_monthly_sku text not null default 'sonrisas_mensual' check (play_monthly_sku ~ '^[a-z0-9._]{0,60}$'),
  add column play_annual_sku text not null default 'sonrisas_anual' check (play_annual_sku ~ '^[a-z0-9._]{0,60}$');

-- Los datos de Pago Móvil que ya estaban cargados pasan a ser el primer método de la lista.
update public.platform_settings
   set payment_methods = jsonb_build_array(jsonb_build_object(
         'id', 'pago-movil',
         'type', 'pago_movil',
         'name', 'Pago Móvil',
         'fields', (
           select coalesce(jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.ord), '[]'::jsonb)
           from (values (1, 'Banco', pm_bank), (2, 'Teléfono', pm_phone), (3, 'Cédula / RIF', pm_id_doc), (4, 'Titular', pm_holder)) as f(ord, label, value)
           where trim(f.value) <> ''
         ),
         'link', '',
         'note', '', -- la nota general (payment_note) se sigue mostrando aparte
         'active', true))
 where id = 1
   and payment_methods = '[]'::jsonb
   and (trim(pm_bank) <> '' or trim(pm_phone) <> '' or trim(pm_id_doc) <> '' or trim(pm_holder) <> '');

alter table public.payment_reports
  add column method text not null default 'Pago Móvil' check (char_length(method) between 1 and 40),
  add column external_id text unique check (external_id is null or char_length(external_id) <= 120);

-- Las clínicas reportan con cualquier método menos 'Google Play', y nunca ponen external_id:
-- esos pagos solo los crea la función del servidor después de verificarlos con Google.
drop policy reports_insert on public.payment_reports;
create policy reports_insert on public.payment_reports for insert to authenticated
  with check (
    clinic_id = (select public.my_clinic_id())
    and user_id = (select auth.uid())
    and status = 'pendiente'
    and reviewed_at is null
    and reviewed_by is null
    and admin_note = ''
    and external_id is null
    and method <> 'Google Play'
    and (select public.my_role()) in ('titular', 'recepcion')
    and public.clinic_status(clinic_id) <> 'bloqueada'
  );

-- ---------- Compras de Google Play ----------
create table public.play_purchases (
  purchase_token text primary key check (char_length(purchase_token) between 10 and 4096),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  product_id text not null,
  order_id text not null default '',
  state text not null default '',
  expires_at timestamptz,
  auto_renewing boolean not null default false,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index play_purchases_clinic_idx on public.play_purchases (clinic_id, updated_at desc);

alter table public.play_purchases enable row level security;
-- La clínica ve sus compras y el administrador todas. Nadie escribe desde la app: solo la función del servidor.
create policy play_read on public.play_purchases for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) or (select public.is_platform_admin()));
