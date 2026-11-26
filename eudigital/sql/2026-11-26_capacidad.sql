-- Capacidad para muchos clientes: los frenos del registro se ajustan desde el panel de administración
-- (Ajustes > Planes y precios) en lugar de estar fijos. Por defecto: 100 registros por hora, 500 por día
-- y 6 por conexión al día (para una charla o un evento donde varios se registran con el mismo wifi, súbelo).
create or replace function public.eu_registrarse(
  p_usuario text, p_clave text, p_nombre text, p_plantilla text, p_whatsapp text, p_contacto text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_slug text := lower(trim(coalesce(p_usuario, '')));
  v_nombre text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_tel text := eu_priv.tel(p_whatsapp);
  v_dias int := greatest(1, least(90, eu_priv.ajuste_num('{diasPrueba}', 15)::int));
  v_hora int := greatest(10, least(1000, eu_priv.ajuste_num('{topeRegistrosHora}', 100)::int));
  v_dia int := greatest(20, least(5000, eu_priv.ajuste_num('{topeRegistrosDia}', 500)::int));
  v_conexion int := greatest(1, least(50, eu_priv.ajuste_num('{topeRegistrosConexion}', 6)::int));
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_cab jsonb; v_ip text; v_origen text; v_uid uuid; v_sitio uuid;
begin
  if not coalesce((select case when datos->>'registroAbierto' in ('true', 'false') then (datos->>'registroAbierto')::boolean end
                     from public.eu_ajustes where id = 'eu'), true) then
    raise exception 'El registro está cerrado por ahora. Escríbenos por WhatsApp y te creamos tu página.';
  end if;
  if not eu_priv.usuario_valido(v_slug) then
    raise exception 'Elige un usuario de 3 a 40 letras minúsculas, números o guiones. Algunos nombres están reservados.';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de tu negocio';
  end if;
  if not eu_priv.plantilla_valida(p_plantilla) then
    raise exception 'Elige una plantilla';
  end if;
  if char_length(v_tel) < 10 or char_length(v_tel) > 15 then
    raise exception 'Escribe tu WhatsApp completo, por ejemplo 0414 123 4567';
  end if;
  if exists (select 1 from public.eu_sitios where slug = v_slug) then
    raise exception 'Ese usuario ya está en uso. Prueba con otro.';
  end if;
  -- Una prueba gratis por negocio: el WhatsApp no puede tener ya una cuenta.
  if exists (select 1 from public.eu_cuentas c where eu_priv.tel(c.telefono) = v_tel) then
    raise exception 'Ya hay una cuenta con ese WhatsApp. Entra a tu panel o escríbenos si olvidaste tu usuario.';
  end if;

  -- Frenos contra registros en masa: por conexión y en total (los topes salen de los ajustes).
  begin
    v_cab := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_cab := null;
  end;
  v_ip := nullif(trim(coalesce(v_cab->>'cf-connecting-ip', v_cab->>'x-real-ip', split_part(coalesce(v_cab->>'x-forwarded-for', ''), ',', 1))), '');
  if v_ip is not null then
    v_origen := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
    if (select count(*) from eu_priv.registros where origen = v_origen and creado > now() - interval '1 day') >= v_conexion then
      raise exception 'Hoy ya se crearon varias cuentas desde tu conexión. Prueba mañana o escríbenos por WhatsApp.';
    end if;
  end if;
  if (select count(*) from eu_priv.registros where creado > now() - interval '1 hour') >= v_hora
     or (select count(*) from eu_priv.registros where creado > now() - interval '1 day') >= v_dia then
    raise exception 'Estamos recibiendo muchos registros en este momento. Prueba en un rato.';
  end if;

  v_uid := eu_priv.alta_usuario(v_slug || '@clientes.eudigital.invalid', p_clave);
  -- La página arranca con el menú de muestra, pero sin la dirección ni las redes de la muestra.
  insert into public.eu_sitios (slug, nombre, plantilla, contenido, dueno)
  values (v_slug, v_nombre, p_plantilla,
          jsonb_build_object('negocio', jsonb_build_object('whatsapp', v_tel, 'direccion', '', 'referencia', '', 'ciudad', '', 'mapa', '',
                                                           'instagram', '', 'tiktok', '', 'facebook', '')),
          v_uid)
  returning id into v_sitio;
  insert into public.eu_cuentas (sitio_id, precio_mensual, vence, contacto, telefono, plan, ciclo, origen)
  values (v_sitio, eu_priv.ajuste_num('{precios,basico,mensual}', 10), v_hoy + v_dias,
          nullif(left(trim(coalesce(p_contacto, '')), 80), ''), v_tel, 'prueba', 'mensual', 'registro');
  insert into eu_priv.registros (origen, slug) values (v_origen, v_slug);
  delete from eu_priv.registros where creado < now() - interval '30 days';
  return jsonb_build_object('sitio', v_sitio, 'usuario', v_slug, 'vence', v_hoy + v_dias, 'dias', v_dias);
end $$;
revoke all on function public.eu_registrarse(text, text, text, text, text, text) from public;
grant execute on function public.eu_registrarse(text, text, text, text, text, text) to anon, authenticated, service_role;
