-- Sonrisas · plan anual.
-- El administrador define el precio de 12 meses junto al mensual (en 0 no se ofrece).
-- Las clínicas lo reciben con el resto de los ajustes (my_context → settings) y, al reportar
-- un pago de 12 meses, el monto sugerido es este precio. Aprobar sigue sumando los meses del reporte.
alter table public.platform_settings
  add column annual_price numeric(12,2) not null default 0 check (annual_price >= 0);
