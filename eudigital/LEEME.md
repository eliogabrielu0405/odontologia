# Tiendo: plataforma de páginas de pedidos

Una sola web con todo adentro:

| Dirección | Qué es |
|---|---|
| `/` | Tu portada para vender: las 7 plantillas con su descripción, los planes y precios, cómo pagar, instalar la app y el botón de prueba gratis |
| `/registro/` | Donde un negocio crea su cuenta solo y prueba su página gratis |
| `/?n=usuario` | La página de un cliente (por ejemplo `/?n=pizzeria-luigi`) |
| `/panel/` | El panel de tus clientes: precios, fotos, tasa, agotados, colores, sus pedidos, su código QR, sus páginas y el pago de su plan. Se puede instalar como app |
| `/admin/` | Tu panel: clientes, pagos, planes, suspensiones y tus ajustes |
| `/t/pizzeria/`, `/t/arepera/`, `/t/burgers/`, `/t/delicias/`, `/t/sushi/`, `/t/boutique/`, `/t/licoreria/` | Las demos de cada plantilla (los pedidos de prueba llegan a tu WhatsApp) |

Los datos viven en Supabase (proyecto **eudigital**).

## Dónde está publicada

En Vercel: **https://eu-digital-solutions.vercel.app**. El código está en GitHub, en el repositorio `EU-digital-solution`. Cada cambio que se sube ahí se publica solo en uno o dos minutos.

## Entrar a tu panel

- Dirección: `/admin/`
- Usuario: `eudigital`
- Contraseña: la tuya. Si se te olvida, pídeme que te ponga una nueva.

La sesión del panel de administración se cierra sola al cerrar la pestaña.

## Planes y prueba gratis

| Plan | Precio | Qué incluye |
|---|---|---|
| Prueba gratis | 15 días, sin tarjeta | Una página con la plantilla que elija (también las Premium) |
| Básico | $10 al mes o $110 al año | Una página con la plantilla que elija, menos las Premium |
| Premium | $20 al mes o $200 al año | Hasta 5 páginas, cada una con su enlace y su plantilla (también las Premium), y cambia de plantilla cuando quiera |

- Los precios, los días de prueba, el tope de páginas de Premium y si el registro está abierto se cambian en **Ajustes > Planes y precios**. La portada, el registro y el panel de cada cliente toman esos valores solos.
- Cuando termina la prueba, esa noche la página se suspende sola si no ha pagado (las pruebas no tienen días de gracia). Todo lo que cargó queda guardado.
- El cliente elige plan y periodo en su panel (**Mi suscripción**), ve tus datos de cobro y reporta el pago. Tú lo apruebas en **Pagos**: el recibo dice el plan que dice pagar y lo puedes corregir antes de aprobar. Al aprobar, se le pone ese plan y se corre su fecha de corte (12 meses si pagó el año).
- Con Premium cada página nueva arranca con el contacto, la tasa y las formas de pago de la principal. Si cambia de plantilla, el menú de la anterior queda guardado: si vuelve a ella, lo recupera.
- Si una cuenta Premium pasa a Básico, sus páginas adicionales quedan en pausa (no se borran) y vuelven solas si paga Premium otra vez.
- **Plantillas Premium** (por ahora, Delicias): se pueden probar gratis, pero su página principal no puede quedar en Básico. En el panel del cliente el Básico sale bloqueado con la explicación y el reporte de pago solo ofrece Premium. La base de datos también lo frena: si apruebas un pago Básico, creas un cliente Básico o le pones Delicias a una cuenta Básico, sale el aviso y no se guarda. Para pasarlo a Básico, primero cámbiale la plantilla (tú, desde su ficha). La lista de plantillas Premium está en `eu_priv.plantilla_premium` (Supabase) y en `premium: true` del `datos.js` de cada plantilla. Ver `sql/2026-11-26_plantilla_delicias.sql`.

## Registro propio

Cualquiera puede crear su página desde la portada o desde `/registro/`: elige la plantilla, pone el nombre del negocio, su usuario, su WhatsApp y una contraseña, y entra directo a su panel con la página ya en línea (con el menú de muestra).

- Te llega un aviso al teléfono ("Nuevo registro: …") y la cuenta aparece en **Resumen > Registros nuevos** y en **Clientes > En prueba**. Escríbele mientras prueba: el botón de WhatsApp de su ficha ya trae el mensaje.
- Para que no abusen: una prueba por número de WhatsApp, hasta 6 registros al día desde una misma conexión y hasta 40 por hora en total.
- Si un día prefieres crear tú las cuentas, apaga **Registro abierto** en Ajustes. La portada cambia sola: los botones pasan a escribirte por WhatsApp.

## "Mira cómo queda con tu negocio" (portada)

Justo debajo de la presentación, la portada tiene un recuadro donde la persona escribe el nombre de su negocio, elige una plantilla y toca **Ver mi página**: la demo aparece dentro de un teléfono con su nombre (en el encabezado, en la pared de la hamburguesa, en el título). Debajo salen **Crear [su negocio] gratis**, que abre el registro con la plantilla elegida y el nombre ya escrito (y el usuario sugerido), y **Abrirla completa**. Si el registro está cerrado, el botón abre WhatsApp con el nombre del negocio en el mensaje.

- Las demos aceptan `?prueba=Nombre` (por ejemplo `/t/sushi/?prueba=Sushi%20Koi`). Solo cambia el nombre de la demo, nunca una página de un cliente, y la tira de arriba dice "Así se vería la página de …" con el enlace al registro.
- Después de escribir el nombre, los botones "Ver demo" de las plantillas también lo llevan ("Ver con mi nombre").
- La demo solo se carga cuando la persona toca el botón; antes se muestra la foto de la plantilla, para que la portada siga cargando rápido.
- Archivos: la sección está en `index.html` (`#mira`) y su lógica en `core/portada.js` (`mira()`).

## Crear un cliente tú mismo

1. En tu panel, **Nuevo cliente**: nombre del negocio, usuario (sale solo), plantilla, WhatsApp donde recibe pedidos, con qué plan empieza (prueba gratis, Básico o Premium) y hasta cuándo está pagado.
2. Al crear, te sale la ficha con el enlace de su página, el enlace del panel, el usuario y la contraseña. Mándasela por WhatsApp con el botón.
3. El cliente entra a `/panel/`, cambia su menú, sus fotos y su tasa, y toca **Guardar**.

Desde la ficha de cada cliente puedes cambiarle la plantilla (también a las cuentas Básico), registrar un pago que te hicieron por fuera, cambiarle el plan o la fecha de corte a mano (por ejemplo, para regalarle días de prueba) y ver sus páginas adicionales.

Las cuentas se crean desde tu panel o desde el registro. El registro libre de Supabase sigue cerrado, así que **Add user** en el panel de Supabase no funciona: es a propósito.

## Pedidos y estadísticas

Cuando un cliente final toca **Enviar por WhatsApp** en una página, el pedido queda guardado: productos, total, tipo de entrega y forma de pago. No se guardan nombres, teléfonos ni direcciones.

- El dueño ve en su panel, en **Mis pedidos**, los pedidos de hoy, de la semana y del mes, un gráfico de los últimos 14 días, lo que más le piden y sus últimos pedidos. En **Hoy** le sale el resumen.
- Tú lo ves en la ficha de cada cliente. Sirve para mostrarle lo que le trae la página cuando le toca renovar.
- Si un cliente toca enviar dos veces con el mismo pedido, cuenta una. Las demos no cuentan.
- Los pedidos de más de 13 meses se borran solos.

## Quien compra: sus datos y "Repetir pedido"

En todas las plantillas, cuando alguien envía un pedido, su teléfono recuerda su nombre, su dirección, el tipo de entrega, la forma de pago y lo que pidió. La próxima vez que entra a esa página:

- El nombre y la dirección ya están escritos, con el aviso "Pusimos los datos de tu último pedido. **Borrarlos**" (por si el teléfono es compartido).
- Si su carrito está vacío, arriba le sale **"¿Lo mismo de la otra vez?"** con lo que pidió y el botón **Repetir pedido**. Al tocarlo, el pedido vuelve al carrito con los **precios de hoy**, sin lo que se haya agotado o ya no exista, y se abre para que lo revise y lo envíe.
- Todo queda **solo en el teléfono de quien compra** (no se guarda en la base de datos) y por separado para cada negocio.
- En la vista previa del panel no aparece nada de esto.
- Código: `EU.cliente` en `core/sitio.js` (guardar, rellenar y el aviso) y, en cada `t/<plantilla>/app.js`, cómo se guarda y se vuelve a armar su carrito. La pizzería recalcula el precio de las pizzas armadas por el cliente con los ingredientes de hoy.

## Visitas

Cada página cuenta cuántas personas la abren: una visita por teléfono y por día (el teléfono lo recuerda). No se guarda nada de la persona, solo el número de visitas de cada día. El teléfono donde el dueño tiene abierto su panel no cuenta.

- En el panel del cliente, **Hoy** muestra "Visitas hoy" junto a los pedidos, y **Mis pedidos** tiene "Visitas a tu página" (hoy, 7 días, este mes), "Visitas por día" y, con 10 visitas o más, "de cada 100 personas que entraron, N te hicieron un pedido".
- Base de datos: tabla `eu_visitas` (cada dueño solo ve las suyas), función `eu_registrar_visita` (solo suma en páginas activas, con tope por día) y `eu_resumen_pedidos` trae `visitas`. Se borran solas después de 13 meses. Ver `sql/2026-11-25_visitas.sql`.
- Se cuentan desde el 25 de noviembre de 2026.

## Idiomas: español, inglés, portugués e italiano

Las páginas de los negocios se ven en el idioma del teléfono de quien las abre (si su teléfono tiene español entre sus idiomas, en español), y arriba hay una barra delgada **🌐 Español · English · Português · Italiano** para cambiarlo. La elección queda guardada en ese teléfono, y también se puede mandar un enlace con `?lang=en`, `pt` o `it`.

- **Se traducen solos** los botones, avisos, horario, formas de pago, delivery, cupones, "Repetir pedido", el mapa, etc. El diccionario está en `core/idiomas.js`: cada texto en español con sus tres traducciones, más unos patrones para textos con números o nombres ("Cerrado, abre mañana a las 5 pm"). Traduce también lo que aparece después (carrito, avisos), sin tocar el código de cada plantilla.
- **Lo que escribe el dueño** (productos, categorías, ingredientes) sale traducido si lo llenó en su panel: cada elemento tiene una parte plegable **"En otros idiomas (opcional)"** con nombre y descripción en inglés, portugués e italiano (se guarda en `i18n`). Lo que deje vacío sale en español.
- **El pedido le llega al negocio en español**, con una línea al final: "🌐 El cliente vio la página en inglés." Los productos que el dueño tradujo salen con el nombre que vio el cliente.
- En el panel, **Apariencia > Idiomas** permite ocultar la barra; la página igual sale en el idioma del teléfono. La vista previa del panel siempre está en español.
- Para agregar un texto nuevo a una plantilla: escríbelo en español como siempre y agrégalo al diccionario de `core/idiomas.js` con sus tres traducciones. Un texto que no esté en el diccionario sale en español.
- Los productos de las demos no están traducidos (son de ejemplo): en otro idioma, sus nombres salen en español.

## La plataforma en cuatro idiomas (portada, registro y panel)

La portada, el registro y el panel del dueño también se ven en español, inglés, portugués o italiano.

- **Portada:** selector 🌐 en el encabezado. Abre sola en el idioma del teléfono (si tiene español, en español).
- **Registro:** el campo **"El idioma de tu panel"** (y el selector de arriba). Al cambiarlo, la página se vuelve a abrir en ese idioma sin perder lo que ya escribió (menos la contraseña).
- **Panel:** el idioma se guarda en la cuenta (`eu_cuentas.idioma`). Recién registrado se guarda el que eligió; después el panel se abre en el idioma de la cuenta en cualquier teléfono. Se cambia en **Mi suscripción > Idioma del panel**, y también hay selector en la pantalla de entrada.
- **Tu panel de administración** queda en español y muestra el idioma de cada cliente: una etiqueta 🌐 en su ficha (si no es español) y "Idioma: …" al abrirlo.
- Los textos están en `core/idiomas-plataforma.js` (usa el mismo traductor de `core/idiomas.js`). Para un texto nuevo del panel o la portada, súmalo ahí con sus tres traducciones; si falta, sale en español.
- Base de datos: columna `idioma` en `eu_cuentas` y función `eu_poner_idioma` (cada dueño solo cambia el de su cuenta). Ver `sql/2026-11-26_idioma_cuenta.sql`.
- El menú de muestra con el que arranca cada página sigue en español: el dueño lo cambia por el suyo.

## Delivery por distancia y ubicación del cliente

En el panel del cliente, **Entregas y pagos > Cómo cobras el delivery**:

- **Precio fijo** (como antes): un solo costo, o 0 si cambia según la zona.
- **Según la distancia**: el dueño marca **dónde está su local** (con su ubicación estando en el local, marcándolo en el mapa o pegando un enlace largo de Google Maps) y arma su tabla de **precios por distancia** (de fábrica: hasta 10 km $1, hasta 20 km $2, hasta 30 km $3; se cambia, se agregan o se quitan tramos).

Quien compra, al elegir delivery, toca **📍 Usar mi ubicación** o **Marcarla en el mapa**. La página le dice "Estás a unos 7,1 km. Delivery: $1.00" y lo suma al total. Si está más lejos que el último tramo, le dice que está fuera de la zona y que el costo se le confirma por WhatsApp. Con precio fijo, la ubicación es opcional y sirve para el repartidor. En los dos casos el mensaje de WhatsApp lleva el enlace de Google Maps de la ubicación.

- Gratis, sin Google: la distancia es en línea recta multiplicada por 1,3 para acercarla a lo que se recorre por la calle. Es aproximada.
- El mapa usa Leaflet, guardado en `core/vendor/leaflet-1.9.4/` (licencia BSD), y los mapas gratuitos de OpenStreetMap. Solo se descarga cuando alguien abre el mapa.
- La ubicación de quien compra queda solo en su teléfono ("Borrarlos" también la quita).
- Código: `core/mapa.js` (`EU.geo`: distancia, GPS, enlaces y el mapa), `EU.envio` en `core/sitio.js` (precio, recuadro y líneas del mensaje) y el campo `ubicacion` en `core/campos.js`. La boutique no cobra delivery, así que no lo usa.

## Promociones y cupones

En el panel del cliente, **Promociones**:

- **Descuento para todos**: porcentaje o monto fijo, con compra mínima y último día opcionales. Se aplica solo y sale anunciado arriba de la página (si el dueño no puso su propio texto de promoción en Apariencia).
- **Cupones**: código, porcentaje o monto fijo, compra mínima, fecha de vencimiento y activo/inactivo. El cliente lo escribe en "¿Tienes un cupón de descuento?" dentro de su pedido. También se puede mandar el enlace con el cupón ya puesto: `…?n=negocio&cupon=CODIGO`.
- Si hay descuento para todos y cupón, se usa el que más le conviene al cliente (no se suman). El descuento sale en el pedido, en el total, en los datos de pago y en el mensaje de WhatsApp ("*Cupón AMIGO (20%):* -$2.00"), y el total que queda en "Mis pedidos" ya lo trae descontado.
- Los códigos se guardan con el resto del contenido de la página, que es público. Alguien con conocimientos técnicos podría verlos: no uses cupones de mucho valor. El dueño siempre ve el cupón en el mensaje antes de confirmar el pedido.
- Código: `EU.promos` en `core/sitio.js` (cálculo, casilla del cupón y anuncio) y la línea del descuento en cada `t/<plantilla>/app.js`. El campo de fecha nuevo está en `core/campos.js`.

## Compartir y código QR

En el panel del cliente, **Compartir** tiene:

- Su enlace, con botones para copiarlo y compartirlo.
- Cómo se ve el enlace en WhatsApp: una tarjeta con su nombre, su logo, una foto de su página y sus colores. Se crea sola cuando abre el panel y se actualiza cada vez que guarda.
- Su código QR: un cartel listo para imprimir (con su nombre y su logo) o solo el código.

La vista previa también funciona en Facebook, Instagram, Telegram y X, y el enlace de la portada y el de `/registro/` también tienen la suya. La portada y las demos usan `img/compartir.jpg` y `t/<plantilla>/compartir.jpg` (se hacen con `tools/tarjetas.html`).

## El panel como app

Tus clientes pueden instalar su panel en el teléfono o en la computadora, con su ícono, desde la portada (**Instalar la app**), desde el registro o desde su panel (**Mi suscripción > La app de tu panel**). En Android con Chrome se instala con un toque; en iPhone se hace desde Safari con **Compartir > Agregar a inicio** (la ventana explica los pasos). Tu panel de administración también se instala igual.

## Mascota bailarina

En el panel del cliente, **Apariencia > Mascota bailarina**: elige entre 19 personajes (arepa, pizza, hamburguesa, perro caliente, papas, refresco, sushi, nigiri, taco, empanada, tequeño, dona, helado, cupcake, café, bolsa de compras, vestido, corazón y estrella) y 10 bailes. La mascota salta cuando el cliente final agrega algo al pedido o la toca.

- En la arepera y la pizzería viene encendida (arepa y pizza). En burgers, sushi y boutique viene apagada; cada cliente la enciende si quiere.
- Los personajes están en `core/mascotas.js` y los bailes en `core/mascotas.css`. Para verlos todos juntos: `tools/mascotas.html`.

## Plantilla Delicias (plan Premium)

Menú moderno de comida rápida, hecho a partir de la página de Son D'licias pero sin su marca (nombre, logo, fotos con su logo, ciudad, teléfono e Instagram). Está en el área de comida rápida, junto a Burgers.

- **Lo que ve quien compra:** cabecera con el estado del horario, portada con foto, logo, eslogan, horario de la semana, WhatsApp, su red social y la mascota (con un globito al tocarla), buscador, categorías fijas arriba, «Lo más pedido» en carrusel, una franja con foto por categoría, y una hoja para elegir la opción obligatoria (carne, pollo…), los adicionales (hasta triple porción) y la cantidad. El pedido va en dos pasos en el teléfono (productos y entrega) o en una columna fija en la computadora, con «Te puede gustar», cupones, delivery por distancia, formas de pago con sus datos, «¿Lo mismo de la última vez?» y el código del pedido en el mensaje de WhatsApp.
- **Lo que edita el dueño (panel, Menú):** categorías con nombre, nombre corto para el botón, emoji, foto de la franja, nota y el interruptor **Son adicionales** (sus productos se ofrecen al elegir cualquier otro); productos con foto, precio, descripción, **Opciones para elegir**, **Sale en «Lo más pedido»**, **Sugerirlo dentro del pedido** y agotado. En **Apariencia**: foto de la portada, buscador, títulos del carrusel y de las sugerencias, lo que dice la mascota, y los 4 temas (Brasa, Noche, Huerta y Cielo) o sus propios colores.
- Archivos: `t/delicias/` (`index.html`, `app.js`, `datos.js`, fotos en `img/`, letra Poppins en `vendor/`). Los textos fijos en inglés, portugués e italiano están al final de `t/delicias/app.js`.

## Plantilla Licorería (plan Premium)

Catálogo nocturno y elegante (negro y dorado, con 4 temas: Reserva, Clásico, Neón y Esmeralda) hecho sobre la base de Delicias, con todo lo mismo: buscador, «Lo más vendido», franjas con foto, carrito, sugerencias, cupones, delivery por distancia, pagos, «Repetir pedido» e idiomas.

- **Presentaciones con precio:** cada producto puede tener varias (Lata 355 ml $1,20, Six pack $6,50, Caja de 24 $24). El cliente elige una y la tarjeta muestra «desde» la más barata. En el panel se editan en **Presentaciones y precios** (nombre y precio). Si un producto tiene una sola, se agrega de un toque.
- **Aviso de mayoría de edad** al entrar, una vez por teléfono (se apaga o se cambia la edad en Apariencia). No sale en la vista previa del panel.
- **Combos** como categoría, **«No te olvides»** con hielo, refrescos y snacks en el pedido, y una pastilla dorada en la portada («Delivery hasta medianoche»).
- Ilustraciones propias de botellas, latas, hielo y combos (sin marcas) en `t/licoreria/img/`. Ver `sql/2026-11-28_plantilla_licoreria.sql`.

## Portada de la plantilla Burgers: nombre en la pared y foto propia

La hamburguesa que se abre al bajar tiene una pared al fondo. Ahí sale escrito el nombre del negocio, detrás de la hamburguesa: las capas pasan por delante de las letras. Las fotos de la animación ya no traen ningún nombre, así que la plantilla sirve para cualquier negocio.

- En el panel del cliente, **Apariencia**: encender o apagar el nombre, escribir otro texto (si queda vacío sale el nombre del negocio) y elegir el color de las letras.
- **Tu foto de portada** (también en Apariencia): si el cliente sube una foto suya, sale en ese mismo recuadro en lugar de la hamburguesa animada. Si la quita, vuelve la hamburguesa.
- **Carga por partes:** la página no espera las 63 fotos (1,4 MB). Primero baja solo la que se ve arriba; cuando la página terminó de cargar, o apenas la persona empieza a bajar, llegan una de cada cuatro, después las del medio y al final el resto, de a tres a la vez. Mientras falta alguna se dibuja la más cercana. Con internet lento (4G de 1,6 Mbps) la página pasó de cargar en 10,5 a 1,4 segundos. Con "ahorro de datos" activado en el teléfono solo baja una de cada cuatro, y con "reducir movimiento" solo la última.
- Archivos: las 63 fotos limpias en `t/burgers/img/hamburguesa/f01.webp` a `f63.webp`, y `pared.webp`, que es la franja de pared sin nada delante. Al dibujar cada foto, `t/burgers/app.js` compara esa franja con la pared y escribe el letrero solo donde se ve la pared.

## Avisos al teléfono

Te llega una notificación al teléfono o a la computadora, aunque tengas el panel cerrado:

- Cuando un cliente reporta un pago ("Pago reportado: Pizzería Luigi, $20.00 por Zelle, Plan Premium, 1 año"). Al tocarla se abre tu panel en **Pagos**. Al cliente, además, le sale el botón **Avisar por WhatsApp** con los datos del pago ya escritos.
- Cuando alguien se registra solo ("Nuevo registro: …"). Al tocarla se abre **Clientes > En prueba**.

Para recibirlas, entra a tu panel desde cada dispositivo donde las quieras y toca **Activar avisos** (está en **Resumen** y en **Ajustes > Avisos de pagos**). Ahí mismo puedes mandarte un aviso de prueba y desactivarlos. En el teléfono usa Chrome; en iPhone hay que agregar primero el panel a la pantalla de inicio.

Cómo está hecho: la función `eu-avisos` de Supabase (`supabase/functions/eu-avisos/`) manda las notificaciones; los dispositivos se guardan en la tabla `eu_avisos`. Se encienden con `avisos: true` en `core/config.js` (ya están encendidos).

## Pagos y suspensiones

- Cuando un cliente reporta un pago en su panel, te aparece en **Pagos** con la referencia, la captura y el plan que paga. **Aprobar** le pone ese plan, corre su fecha de corte y, si estaba suspendida, la reactiva.
- Si te pagan por fuera (efectivo, transferencia), ábrelo en **Clientes** y usa **Registrar un pago**: eliges plan y periodo, el monto sale solo y queda aprobado de una vez.
- Un cliente puede tener hasta 5 pagos esperando revisión y reportar hasta 8 en un día; así no se te llena la lista con reportes repetidos.
- **Suspender** oculta la página al instante (en una cuenta Premium, también sus páginas adicionales); **Reactivar** la vuelve a mostrar.
- En **Ajustes** puedes encender **Suspender solas las páginas vencidas**: cada noche a las 12:30 am se suspenden las que pasaron los días de gracia sin pagar. Las pruebas gratis vencidas se suspenden siempre.
- **Eliminar** borra la página, sus fotos, sus pagos, sus pedidos y su usuario; en una cuenta con varias páginas, la cuenta entera. Te pide escribir el usuario para confirmar. Una página adicional se puede eliminar sola desde la ficha de la cuenta.

En **Ajustes** pon también tus datos de cobro (Pago Móvil, Zelle, Binance): tus clientes los ven en su panel con botón para copiar. En la portada solo se ven los nombres de las formas de pago, no los datos.

## Publicar sin romper las páginas abiertas

Al publicar, nadie debe quedar con una mezcla de código nuevo y viejo (eso dejaba el menú vacío durante unos minutos):

- Los archivos de `core/` se revisan en cada visita (`max-age=0, must-revalidate` en `vercel.json` y `_headers`). Si no cambiaron, el servidor contesta "sigue igual" y no se vuelven a bajar, así que casi no cuesta velocidad.
- Cada plantilla revisa que las funciones comunes nuevas existan antes de usarlas (`memoria` para `EU.cliente` y `ofertas` para `EU.promos` al principio de cada `t/<plantilla>/app.js`). Si faltan, la página funciona igual, solo sin esa función.
- Al agregar una función común nueva que usen las plantillas, sigue la misma idea: que la plantilla no se caiga si todavía no está.

## Cuando compres el dominio

1. En Vercel, abre el proyecto **eu-digital-solutions** y ve a **Settings > Domains**. Agrega `tudominio.com`.
2. Para que cada cliente tenga su subdominio (`pizzeria-luigi.tudominio.com`), agrega también `*.tudominio.com`. Vercel te pide usar sus servidores de nombres (nameservers) para eso; te dice cuáles poner donde compraste el dominio.
3. En `core/config.js` cambia `dominioBase: ""` por `dominioBase: "tudominio.com"` y súbelo.

Si un cliente compra su propio dominio, agrégalo también en **Settings > Domains** y escríbelo en su ficha (**Datos de la cuenta > Dominio propio**).

## Capacidad: cuántos clientes aguanta

Revisado para 100 negocios (26 nov 2026). La velocidad no es problema: cargar una página tarda 0,013 ms en la base de datos y 100 negocios con mucho movimiento son 1 o 2 visitas por segundo en la hora pico. Lo que se acaba son las cuotas de los planes gratis:

- **Supabase gratis:** 5 GB + 5 GB de transferencia al mes, 500 MB de base de datos, 1 GB de archivos y sin copias de seguridad. Si se pasa, Supabase puede bloquear todas las consultas y **se caen todas las páginas a la vez**. **Supabase Pro** (US$25 al mes): 250 + 250 GB, 8 GB de base, 100 GB de archivos y copias diarias. Conviene pasarse antes de unos 20 o 30 clientes.
- **Vercel gratis (Hobby):** pocas solicitudes y transferencia al mes y es para uso personal, no comercial. **Vercel Pro** (US$20 al mes) para cobrar suscripciones.
- Cada visita nueva baja de 0,5 a 1,6 MB (Burgers es la más pesada por la animación); quien vuelve casi no baja nada. Cada pedido ocupa unos 470 bytes y se borra a los 400 días.

Lo que ya hace la plataforma para gastar menos:

- **Fotos en dos tamaños:** cada foto que sube un dueño se guarda grande (`…-g.webp`) y en una versión de 400 px (`…-p.webp`). Las tarjetas del menú, los íconos, el carrito y el logo usan la chica (unas 4 o 5 veces menos transferencia); la grande solo sale donde la foto se ve grande. Si la chica faltara, la página pide la grande sola. Las fotos subidas antes de este cambio no tienen versión chica y se siguen usando grandes. Al limpiar fotos sin usar, el panel no borra una chica mientras su grande esté en uso.
- **Comprobantes de pago:** al abrir tu panel (una vez al día) se borran las capturas de los pagos ya revisados con más de 6 meses. El pago queda en el historial, sin la captura.
- **Topes del registro:** en **Ajustes > Planes y precios** cambias cuántas cuentas se pueden crear por hora (100), por día (500) y desde una misma conexión al día (6). Si haces una campaña grande o una charla con muchos en el mismo wifi, súbelos ese día. Ver `sql/2026-11-26_capacidad.sql`.

## Supabase

El plan gratis pausa el proyecto si pasa una semana sin visitas y no guarda copias de seguridad. Con clientes usando sus páginas no se pausa, pero si un día ves todo caído, entra a Supabase y toca **Restore**. Cuando tengas varios clientes pagando, conviene el plan Pro.

## Qué hay en cada carpeta

- `core/`: lo que comparten todas las páginas (conexión con Supabase, temas, animaciones, el editor de los paneles, el QR, la tarjeta para compartir, los planes, instalar la app y la portada).
- `t/<plantilla>/`: cada plantilla con sus fotos, y su `datos.js`, que dice qué puede cambiar el cliente y trae su descripción.
- `panel/`, `admin/`: los dos paneles, cada uno con lo necesario para instalarse como app.
- `registro/`: la página de registro con prueba gratis.
- `middleware.js`: arma la vista previa cuando se comparte un enlace.
- `img/`: el ícono de Tiendo y la tarjeta de la portada.
- `sql/`: los cambios de la base de datos (ya están aplicados).
- `supabase/functions/`: las funciones que corren en Supabase (ya están instaladas allá); no se publican en Vercel.
- `t/boutique/vendor/`: el motor de la vista 360 (three.js 0.169, licencia MIT), guardado en la propia página para no depender de otro servicio.
- `tools/`: herramientas internas; no se publican.
