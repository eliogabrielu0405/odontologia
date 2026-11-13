-- Sonrisas · la página de descarga (/descargar) muestra los precios sin iniciar sesión.
-- Al resumen público se suma el precio del plan anual.
create or replace function public.public_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('trial_days', trial_days, 'support_whatsapp', support_whatsapp,
    'monthly_price', monthly_price, 'annual_price', annual_price, 'currency', currency)
  from public.platform_settings where id = 1;
$$;
