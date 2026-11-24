# EU Digital Solutions: plataforma de páginas de pedidos

Una sola web con todo adentro:

| Dirección | Qué es |
|---|---|
| `/` | Tu portada para vender: las 5 plantillas con su descripción, los planes y precios, cómo pagar, instalar la app y el botón de prueba gratis |
| `/registro/` | Donde un negocio crea su cuenta solo y prueba su página gratis |
| `/?n=usuario` | La página de un cliente (por ejemplo `/?n=pizzeria-luigi`) |
| `/panel/` | El panel de tus clientes: precios, fotos, tasa, agotados, colores, sus pedidos, su código QR, sus páginas y el pago de su plan. Se puede instalar como app |
| `/admin/` | Tu panel: clientes, pagos, planes, suspensiones y tus ajustes |
| `/t/pizzeria/`, `/t/arepera/`, `/t/burgers/`, `/t/sushi/`, `/t/boutique/` | Las demos de cada plantilla (los pedidos de prueba llegan a tu WhatsApp) |

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
| Prueba gratis | 15 días, sin tarjeta | Una página con la plantilla que elija |
| Básico | $10 al mes o $110 al año | Una página con la plantilla que elija |
| Premium | $20 al mes o $200 al año | Hasta 5 páginas, cada una con su enlace y su plantilla, y cambia de plantilla cuando quiera |

- Los precios, los días de prueba, el tope de páginas de Premium y si el registro está abierto se cambian en **Ajustes > Planes y precios**. La portada, el registro y el panel de cada cliente toman esos valores solos.
- Cuando termina la prueba, esa noche la página se suspende sola si no ha pagado (las pruebas no tienen días de gracia). Todo lo que cargó queda guardado.
- El cliente elige plan y periodo en su panel (**Mi suscripción**), ve tus datos de cobro y reporta el pago. Tú lo apruebas en **Pagos**: el recibo dice el plan que dice pagar y lo puedes corregir antes de aprobar. Al aprobar, se le pone ese plan y se corre su fecha de corte (12 meses si pagó el año).
- Con Premium cada página nueva arranca con el contacto, la tasa y las formas de pago de la principal. Si cambia de plantilla, el menú de la anterior queda guardado: si vuelve a ella, lo recupera.
- Si una cuenta Premium pasa a Básico, sus páginas adicionales quedan en pausa (no se borran) y vuelven solas si paga Premium otra vez.

## Registro propio

Cualquiera puede crear su página desde la portada o desde `/registro/`: elige la plantilla, pone el nombre del negocio, su usuario, su WhatsApp y una contraseña, y entra directo a su panel con la página ya en línea (con el menú de muestra).

- Te llega un aviso al teléfono ("Nuevo registro: …") y la cuenta aparece en **Resumen > Registros nuevos** y en **Clientes > En prueba**. Escríbele mientras prueba: el botón de WhatsApp de su ficha ya trae el mensaje.
- Para que no abusen: una prueba por número de WhatsApp, hasta 6 registros al día desde una misma conexión y hasta 40 por hora en total.
- Si un día prefieres crear tú las cuentas, apaga **Registro abierto** en Ajustes. La portada cambia sola: los botones pasan a escribirte por WhatsApp.

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

## Cuando compres el dominio

1. En Vercel, abre el proyecto **eu-digital-solutions** y ve a **Settings > Domains**. Agrega `tudominio.com`.
2. Para que cada cliente tenga su subdominio (`pizzeria-luigi.tudominio.com`), agrega también `*.tudominio.com`. Vercel te pide usar sus servidores de nombres (nameservers) para eso; te dice cuáles poner donde compraste el dominio.
3. En `core/config.js` cambia `dominioBase: ""` por `dominioBase: "tudominio.com"` y súbelo.

Si un cliente compra su propio dominio, agrégalo también en **Settings > Domains** y escríbelo en su ficha (**Datos de la cuenta > Dominio propio**).

## Supabase

El plan gratis pausa el proyecto si pasa una semana sin visitas y no guarda copias de seguridad. Con clientes usando sus páginas no se pausa, pero si un día ves todo caído, entra a Supabase y toca **Restore**. Cuando tengas varios clientes pagando, conviene el plan Pro.

## Qué hay en cada carpeta

- `core/`: lo que comparten todas las páginas (conexión con Supabase, temas, animaciones, el editor de los paneles, el QR, la tarjeta para compartir, los planes, instalar la app y la portada).
- `t/<plantilla>/`: cada plantilla con sus fotos, y su `datos.js`, que dice qué puede cambiar el cliente y trae su descripción.
- `panel/`, `admin/`: los dos paneles, cada uno con lo necesario para instalarse como app.
- `registro/`: la página de registro con prueba gratis.
- `middleware.js`: arma la vista previa cuando se comparte un enlace.
- `img/`: el ícono de EU Digital y la tarjeta de la portada.
- `sql/`: los cambios de la base de datos (ya están aplicados).
- `supabase/functions/`: las funciones que corren en Supabase (ya están instaladas allá); no se publican en Vercel.
- `t/boutique/vendor/`: el motor de la vista 360 (three.js 0.169, licencia MIT), guardado en la propia página para no depender de otro servicio.
- `tools/`: herramientas internas; no se publican.
