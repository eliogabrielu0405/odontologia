# Publicar Sonrisas

Pasos para poner Sonrisas en línea con Supabase (base de datos, cuentas y fotos) y Cloudflare (la página web).
Están escritos para hacerlos con Claude en una sesión que tenga conectada la cuenta de Supabase correcta.

## 0. Antes de empezar

- En **https://claude.ai/customize/connectors**, conecta Supabase con la cuenta donde quieres crear Sonrisas.
- La página se publica sola desde GitHub con Cloudflare (paso 6). Conectar el repositorio se hace una sola vez, desde el panel de Cloudflare.
- Abre una sesión nueva sobre el repositorio `odontologia`, rama `ccr-ebf5c4db-f0w0qu`, y pide: *“Publica Sonrisas siguiendo docs/PUBLICAR.md”*.

## 1. Crear el proyecto en Supabase

- Nombre: `sonrisas`. Región: `us-east-1` (la más cercana a Venezuela).
- Esperar a que el proyecto quede `ACTIVE_HEALTHY`.

## 2. Crear la base de datos

Aplicar en orden las migraciones de `supabase/migrations/` (`20261108000000_sonrisas.sql`, `20261108010000_endurecer_funciones.sql`, `20261109000000_fotos_pacientes.sql`). Crean:

| Tabla | Para qué sirve |
|-------|----------------|
| `platform_settings` | Precio mensual, moneda, días de prueba y de gracia, datos de Pago Móvil, WhatsApp de soporte |
| `platform_admins` | Quién es administrador de EU Digital Solutions |
| `platform_secrets` | Código de un solo uso para crear al administrador (solo su hash) |
| `clinics` | Cada odontólogo que contrata: estado (activa, suspendida, bloqueada) y fecha hasta la que pagó |
| `profiles` | Personas de cada clínica: titular, odontólogos y recepción |
| `clinic_invites` | Códigos para que la recepción u otros odontólogos se unan |
| `records` | Datos clínicos de cada consultorio (pacientes, citas, presupuestos, cobros, odontogramas…) |
| `payment_reports` | Pagos de la mensualidad reportados con foto del comprobante |

Además crean los buckets privados `comprobantes` y `pacientes` (fotos de pacientes), todas las reglas de seguridad por filas y las funciones `my_context`, `approve_payment`, `reject_payment`, `update_my_clinic`, `update_my_profile` y `update_member`.

Después de aplicarla, revisar los avisos de seguridad del proyecto (`get_advisors`, tipo `security`).

## 3. Publicar la función del servidor

Desplegar `supabase/functions/sonrisas-api/index.ts` como la Edge Function **`sonrisas-api`** con **`verify_jwt = false`**
(el registro de odontólogos es público; las acciones protegidas validan la sesión por su cuenta).
Usa las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que Supabase ya trae en sus funciones.

La función crea las cuentas ya confirmadas, así que **no hace falta configurar correo (SMTP)** para registrarse.

## 4. Conectar la página con Supabase

Completar `web/js/config.js` con la URL del proyecto y la clave pública (`anon` o `sb_publishable_…`):

```js
window.SONRISAS_CONFIG = {
  supabaseUrl: 'https://<proyecto>.supabase.co',
  supabaseKey: '<clave pública>',
  company: 'EU Digital Solutions',
};
```

Nunca poner aquí la `service_role` key.

## 5. Código para crear tu cuenta de administrador

Generar un código largo al azar, guardar solo su hash y entregarte el código en el chat:

```sql
update public.platform_secrets
   set admin_claim_hash = encode(extensions.digest('<CODIGO>', 'sha256'), 'hex')
 where id = 1;
```

Con ese código entras a `https://<tu-sitio>/#crear-admin` y creas tu cuenta con tu correo y contraseña. El código sirve una sola vez.

## 6. Publicar en Cloudflare

Sonrisas se publica como un **Worker de Cloudflare que solo sirve archivos** (la carpeta `web`, sin código de servidor),
conectado al repositorio de GitHub: cada cambio que llega a la rama principal (`ccr-ebf5c4db-f0w0qu`) se publica solo.

| Qué | Dónde |
|-----|-------|
| Nombre del Worker y carpeta a publicar | `wrangler.jsonc` (el `name` tiene que ser igual al del panel: `sonrisas`) |
| Encabezados de seguridad y caché | `web/_headers` |
| Dirección | `https://sonrisas.<tu-subdominio>.workers.dev` (en el panel: Workers & Pages → `sonrisas`) |
| Estado de cada publicación | Panel → `sonrisas` → **Deployments**, o el check de Cloudflare en cada commit de GitHub |

Para crearlo desde cero: **https://dash.cloudflare.com** → **Workers & Pages** → **Create application** → importar el repositorio `odontologia` →
nombre del Worker `sonrisas` y el comando de publicación por defecto (`npx wrangler deploy`) → **Deploy**.

Plan gratuito: sin insignia, y las visitas a archivos estáticos no tienen límite ni costo.
Para probar localmente como lo sirve Cloudflare: `npx wrangler dev` en la raíz del repositorio.

### Antes estaba en Netlify

La primera versión se publicó en **https://sonrisas-o958.netlify.app** (equipo `eliogabrielu0405`, que comparte créditos con otros dos sitios).
Se cambió por dos motivos del plan gratuito de Netlify:

- **Créditos al mes, compartidos por todos los sitios del equipo.** Cada publicación y las visitas gastan créditos.
  Cuando se acaban, Netlify deja de publicar cambios (*Skipped due to account credit usage exceeded*) y,
  si el equipo agota el límite, pausa todos sus sitios hasta el siguiente ciclo o hasta pasar a un plan de pago.
- **Insignia “Powered by Netlify”** abajo a la derecha, que en el plan gratuito no se puede ocultar.
  Sonrisas le deja libre esa franja (clase `has-host-badge` y variable `--host-badge` en `styles.css`) para que no tape botones;
  donde no hay insignia, ese espacio no aparece.

`netlify.toml` sigue en el repositorio por si algún día se vuelve a Netlify.

## 7. Primeros ajustes (en la app, como administrador)

En **Ajustes de cobro**: precio mensual, moneda, días de prueba, días de gracia, días de aviso, datos de Pago Móvil (banco, teléfono, cédula/RIF, titular) y WhatsApp de soporte.

## 8. Recomendado en el panel de Supabase

- **Authentication → Sign In / Providers → Email → desactivar “Allow new users to sign up”.**
  Las cuentas se crean desde la función `sonrisas-api`; así nadie crea cuentas sueltas desde fuera de la app.
- **Database → Backups**: confirmar que los respaldos automáticos estén activos (en el plan gratuito son diarios y se guardan pocos días).

## Instalar la app en los teléfonos

Una vez publicada (con https), Sonrisas ya es instalable:

- **Android:** abrir el enlace en Chrome y tocar **Instalar la app**.
- **iPhone:** abrir el enlace en Safari → Compartir → **Agregar a pantalla de inicio**.

### Si más adelante la quieres en las tiendas

- **Google Play:** se puede empaquetar esta misma app como *Trusted Web Activity* (con PWABuilder o Bubblewrap). Requiere una cuenta de desarrollador de Google Play (pago único) y publicar el archivo `.well-known/assetlinks.json` en el sitio.
- **App Store (iPhone):** requiere la cuenta de desarrollador de Apple (pago anual) y su revisión. Ojo: Apple y Google suelen exigir que las suscripciones digitales se cobren con su propio sistema de pagos, con comisión, y pueden rechazar una app que pida pagar por Pago Móvil desde adentro. Antes de publicar en tiendas hay que revisar sus reglas vigentes.

## Comprobación final

1. Crear la cuenta de administrador con el código.
2. Registrar un odontólogo de prueba desde “Soy odontólogo”.
3. Como odontólogo: invitar a una recepción y subir un comprobante en “Mi suscripción”.
4. Como administrador: aprobar el pago, suspender y reactivar la clínica.
5. Borrar la clínica de prueba desde el panel.
