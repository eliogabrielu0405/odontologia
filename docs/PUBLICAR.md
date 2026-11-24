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

Aplicar en orden las migraciones de `supabase/migrations/` (`20261108000000_sonrisas.sql`, `20261108010000_endurecer_funciones.sql`, `20261109000000_fotos_pacientes.sql`, `20261109010000_sugerencias.sql`, `20261112000000_plan_anual.sql`, `20261113000000_precios_publicos.sql`, `20261124000000_metodos_pago_y_play.sql`). Crean:

| Tabla | Para qué sirve |
|-------|----------------|
| `platform_settings` | Precio mensual y del plan anual, moneda, días de prueba y de gracia, métodos de pago (`payment_methods`), ID de las suscripciones de Google Play, WhatsApp de soporte |
| `platform_admins` | Quién es administrador de EU Digital Solutions |
| `platform_secrets` | Código de un solo uso para crear al administrador (solo su hash) |
| `clinics` | Cada odontólogo que contrata: estado (activa, suspendida, bloqueada) y fecha hasta la que pagó |
| `profiles` | Personas de cada clínica: titular, odontólogos y recepción |
| `clinic_invites` | Códigos para que la recepción u otros odontólogos se unan |
| `records` | Datos clínicos de cada consultorio (pacientes, citas, presupuestos, cobros, odontogramas…) |
| `payment_reports` | Pagos reportados con foto del comprobante y su método (meses que cubren; 12 = plan anual). Los pagos de Google Play aparecen aquí ya aprobados |
| `play_purchases` | Compras de Google Play verificadas por la función del servidor (a qué clínica pertenece cada una y hasta cuándo vale) |
| `suggestions` | Sugerencias de las clínicas para mejorar la app y las respuestas del administrador |

Además crean los buckets privados `comprobantes` y `pacientes` (fotos de pacientes), todas las reglas de seguridad por filas y las funciones `my_context`, `approve_payment`, `reject_payment`, `update_my_clinic`, `update_my_profile` y `update_member`.

Después de aplicarla, revisar los avisos de seguridad del proyecto (`get_advisors`, tipo `security`).

## 3. Publicar la función del servidor

Desplegar `supabase/functions/sonrisas-api/index.ts` como la Edge Function **`sonrisas-api`** con **`verify_jwt = false`**
(el registro de odontólogos es público; las acciones protegidas validan la sesión por su cuenta).
Usa las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que Supabase ya trae en sus funciones.

La función crea las cuentas ya confirmadas, así que **no hace falta configurar correo (SMTP)** para registrarse.

Para cobrar en la app de Play Store, la función necesita dos secretos más (Edge Functions → Secrets): `PLAY_PACKAGE_NAME` y `PLAY_SERVICE_ACCOUNT`. Ver la sección *Google Play* más abajo. Sin ellos todo lo demás funciona igual; solo los pagos de Google Play responden “todavía no están configurados”.

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
| Dirección | **https://sonrisas.eliogabrielu04.workers.dev** (en el panel: Workers & Pages → `sonrisas`) |
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

En **Ajustes de cobro**: precio mensual, precio del plan anual (12 meses; en 0 no se ofrece), moneda, días de prueba, días de gracia, días de aviso y WhatsApp de soporte. Arriba, en **Métodos de pago**, agrega los que aceptas (Pago Móvil, transferencia, Zelle, PayPal, Binance Pay, Zinli u otro) con sus datos; se guardan al momento y las clínicas los ven en ese orden.

## 8. Recomendado en el panel de Supabase

- **Authentication → Sign In / Providers → Email → desactivar “Allow new users to sign up”.**
  Las cuentas se crean desde la función `sonrisas-api`; así nadie crea cuentas sueltas desde fuera de la app.
- **Database → Backups**: confirmar que los respaldos automáticos estén activos (en el plan gratuito son diarios y se guardan pocos días).

## Instalar la app en los teléfonos

Una vez publicada (con https), Sonrisas ya es instalable:

- **Android:** abrir el enlace en Chrome y tocar **Instalar la app**.
- **iPhone:** abrir el enlace en Safari → Compartir → **Agregar a pantalla de inicio**.

## Google Play (app de la tienda)

Sonrisas se publica en Play Store como *Trusted Web Activity*: el paquete abre esta misma página a pantalla completa, así que cada cambio publicado en Cloudflare llega solo a la app. **En la app de Play se paga con Google Play; en la web, con los métodos de Ajustes de cobro.** Dentro de la app de Play no aparecen los otros métodos de pago (Google no lo permite).

1. **Cuenta de Play Console** (personal o de empresa con D-U-N-S) y una **cuenta de comerciante** de Google Payments para recibir los cobros. Confirmar que acepten tu país y tu banco.
2. **Crear el paquete** en [PWABuilder](https://www.pwabuilder.com) con la dirección `https://sonrisas.eliogabrielu04.workers.dev/`:
   - *Start URL*: `/?origen=play`. Así la app sabe que se abrió desde Play.
   - Activar **Google Play Billing** (Digital Goods API).
   - Guardar bien la **clave de firma** que genera; sin ella no se pueden subir actualizaciones.
3. **Publicar `web/.well-known/assetlinks.json`** con el nombre del paquete y la huella SHA-256 de la clave (PWABuilder la entrega; la de *Play App Signing* está en Play Console → Configuración → Integridad de la app). Sin este archivo la app muestra la barra del navegador arriba.
4. **Crear las suscripciones** en Play Console → Monetizar → Productos → Suscripciones, con sus planes base (mensual y anual) y el precio. Los ID de producto van en Sonrisas → Ajustes de cobro → *App de Play Store* (por defecto `sonrisas_mensual` y `sonrisas_anual`).
5. **Cuenta de servicio** para que el servidor verifique las compras:
   - En Google Cloud, crear una cuenta de servicio y descargar su clave JSON.
   - En Play Console → Usuarios y permisos, invitar el correo de esa cuenta con permisos de **Ver datos financieros** y **Administrar pedidos y suscripciones**.
   - En Supabase → Edge Functions → Secrets: `PLAY_PACKAGE_NAME` = el nombre del paquete (ej. `app.sonrisas.twa`) y `PLAY_SERVICE_ACCOUNT` = el contenido completo del JSON.
6. Probar con **cuentas de prueba de licencia** (Play Console → Configuración → Pruebas de licencia) en una prueba interna antes de publicar.

Cómo funciona por dentro: al tocar un plan, Google cobra y entrega un *token* de compra; la función `sonrisas-api` (acción `play_verify`) lo verifica con la API de Google Play, lo confirma (si no se confirma en 3 días Google devuelve el dinero), lo asocia a la clínica y extiende `paid_until` hasta la fecha de vencimiento que da Google. Las renovaciones se registran cada vez que se abre la app (y con el botón *Ya pagué: actualizar mi plan*).

**App Store (iPhone):** requiere la cuenta de desarrollador de Apple (pago anual) y su revisión, y Apple exige su propio sistema de pagos para suscripciones dentro de la app. No está preparado todavía.

## Comprobación final

1. Crear la cuenta de administrador con el código.
2. Registrar un odontólogo de prueba desde “Soy odontólogo”.
3. Como odontólogo: invitar a una recepción y subir un comprobante en “Mi suscripción” (probar con dos métodos de pago distintos).
4. Como administrador: aprobar el pago, suspender y reactivar la clínica.
5. Borrar la clínica de prueba desde el panel.
