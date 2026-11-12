# Sonrisas · EU Digital Solutions

Sistema en la nube para consultorios odontológicos que se cobra como **suscripción mensual**.
Cada odontólogo crea su cuenta, invita a su recepción y paga la mensualidad por **Pago Móvil** subiendo la foto del comprobante.
EU Digital Solutions administra todas las cuentas desde su propio panel.

Hecho para Venezuela: cédula, RIF, teléfonos 04xx, montos en dólares o bolívares y métodos de pago locales.

## Quién usa qué

| Persona | Qué puede hacer |
|---------|-----------------|
| **Administrador (EU Digital Solutions)** | Ver todas las clínicas con el correo y teléfono del doctor; revisar comprobantes y aprobar o rechazar pagos; suspender, bloquear, reactivar, extender o eliminar clínicas; enviar recordatorios de pago por WhatsApp; restablecer contraseñas; configurar precio, días de prueba y de gracia, datos de Pago Móvil y WhatsApp de soporte; leer y responder las **sugerencias** de las clínicas. |
| **Odontólogo titular** | Se registra con su correo y contraseña (con días de prueba gratis). Usa todo el sistema, invita a su equipo con un código, ve **Mi suscripción** y sube el comprobante. Envía **sugerencias** para mejorar la app y ve las respuestas. |
| **Recepción** | Se une con el código que le da el titular. Agenda, pacientes, presupuestos y cobros; también ve **Mi suscripción** y puede subir el comprobante. No edita la historia clínica ni el odontograma. |
| **Otros odontólogos** | Se unen con código. Agenda, pacientes, historia clínica, odontograma, presupuestos y reportes. |

## Suscripción

- **Período de prueba**: días gratis al registrarse (se configura).
- **Por vencer**: aviso unos días antes del vencimiento, con botón “Pagar ahora”.
- **Vencida**: aviso en rojo durante los días de gracia.
- **Sin acceso / suspendida**: solo se ve “Mi suscripción” para reportar el pago. Los datos quedan guardados.
- **Bloqueada**: nadie de esa clínica entra; se muestra el WhatsApp de soporte.
- Al **aprobar un pago**, la suscripción se extiende los meses pagados y la clínica se reactiva sola.

## Sugerencias

Cualquier persona de una clínica (también si la suscripción está pausada) puede enviar ideas, mejoras o problemas desde **Sugerencias**: tipo, parte de la app, una frase y detalles.
El administrador las ve en su panel con la clínica y el autor, cambia el estado (*nueva, en revisión, planeada, hecha, descartada*), responde y puede escribirle por WhatsApp.
La clínica ve el estado y la respuesta, con un aviso en el menú. Hay un tope de 10 sugerencias por persona al día.

## Se instala como aplicación

Sonrisas es una **aplicación web instalable (PWA)**: la misma página se instala en el celular o la computadora con su ícono, abre a pantalla completa y carga aunque falle la conexión. Las actualizaciones llegan solas a todos los clientes, sin pasar por tiendas.

- **Android (Chrome):** botón **Instalar la app** en la pantalla de entrada o en el menú lateral.
- **iPhone (Safari):** el mismo botón explica los pasos: Compartir → *Agregar a pantalla de inicio*.
- **Computadora (Chrome o Edge):** botón **Instalar la app** o el ícono de instalar en la barra de direcciones.

Archivos: `web/manifest.webmanifest`, `web/sw.js`, `web/js/pwa.js` y `web/icons/`. Los íconos salen del logo en vector que está en `docs/marca/` (completo y solo el diente).

## Módulos de la clínica

Inicio con “Primeros pasos”, agenda por día o semana con recordatorios por WhatsApp, pacientes, ficha del paciente (información, **foto de perfil**, **odontograma** interactivo (cada hallazgo trae su tratamiento y precio del catálogo, se suman y pasan a un presupuesto con un botón), historia clínica, **fotos clínicas** de caries, fracturas o del antes y después con pieza dental y nota, consentimientos, cuenta corriente, citas y cobros), presupuestos y recibos con impresión, **tratamientos automáticos** (el catálogo con los más comunes se carga solo la primera vez, sin precio, y los precios se ponen todos en una pantalla o escribiéndolos en el odontograma), reportes, equipo, actividad, configuración y respaldo.

La interfaz se adapta al celular y al modo claro u oscuro del dispositivo.

## Cómo está hecho

| Parte | Tecnología | Dónde |
|-------|-----------|-------|
| Página web | HTML, CSS y JavaScript sin compilación | `web/` |
| Base de datos, cuentas y fotos | Supabase (Postgres con seguridad por filas, Auth, Storage, Realtime) | `supabase/migrations/` |
| Acciones de servidor | Supabase Edge Function `sonrisas-api` | `supabase/functions/` |
| Publicación | Cloudflare Workers (solo archivos): publica la carpeta `web` sola desde GitHub | `wrangler.jsonc`, `web/_headers` |

```
web/index.html          Página
web/css/styles.css      Estilos (modo claro y oscuro, celular)
web/js/config.js        URL y clave pública de Supabase
web/js/utils.js         Formato (Venezuela), modales, avisos, WhatsApp, fotos
web/js/logo.js          Logo de Sonrisas en vector (en modo oscuro las letras van en blanco)
web/js/data.js          Datos de la clínica: carga, guardado en segundo plano y tiempo real
web/js/account.js       Sesión, registro, invitaciones, perfil, equipo y Mi suscripción
web/js/photos.js        Fotos de pacientes: subir, mostrar con enlaces temporales y borrar
web/js/suggestions.js   Sugerencias de las clínicas y respuestas del administrador
web/js/views.js         Pantallas de la clínica
web/js/odontogram.js    Odontograma
web/js/admin.js         Panel de EU Digital Solutions
web/js/app.js           Arranque, acceso, menú, permisos y avisos
web/vendor/             supabase-js 2.118.0
```

### Seguridad

- Cada clínica solo puede leer y escribir **sus** datos; lo garantiza la base de datos con reglas por filas, no la página.
- Una clínica suspendida, vencida o bloqueada no puede leer ni escribir datos clínicos.
- Recepción no puede modificar historia clínica, odontogramas ni el catálogo; solo el titular puede borrar registros.
- Nadie de una clínica puede cambiar su propia fecha de pago ni aprobar sus pagos.
- Los comprobantes están en un almacenamiento privado: cada clínica ve los suyos y el administrador ve todos.
- Las fotos de pacientes también son privadas y solo las ve el equipo de su clínica. La recepción puede cambiar la foto de perfil, pero solo los odontólogos suben fotos clínicas y solo el titular las borra.
- Las contraseñas las maneja Supabase Auth.

## Publicarlo

En línea: **https://sonrisas.eliogabrielu04.workers.dev** (Cloudflare, se publica sola desde GitHub).

Ver **[docs/PUBLICAR.md](docs/PUBLICAR.md)**.
