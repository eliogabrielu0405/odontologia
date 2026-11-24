# EU Digital · Plataforma de páginas de pedidos

Proyecto aparte de Sonrisas, guardado aquí tal como llegó en `eudigital-plataforma_pro.zip`.
Páginas de pedidos por WhatsApp para restaurantes y tiendas en Venezuela (precios en $ y Bs),
con un panel para cada cliente y un panel de administración para EU Digital Solutions.

Sitio estático (HTML, CSS y JavaScript sin compilación) sobre Supabase (proyecto `eudigital`).

| Carpeta | Qué es |
|---------|--------|
| `index.html` | Portada de EU Digital (presenta las plantillas y cómo funciona) |
| `core/` | Configuración (`config.js`), cliente mínimo de Supabase (`api.js`), motor de las páginas (`sitio.js`), editor de campos, catálogos y estilos |
| `t/<plantilla>/` | Plantillas: `pizzeria`, `burgers`, `arepera`, `sushi`, `boutique` (esta usa three.js desde jsDelivr) |
| `panel/` | Panel del cliente: edita su página, ve su suscripción y sube el comprobante de pago |
| `admin/` | Panel de EU Digital: clientes, pagos (aprobar/rechazar), plantillas y ajustes |
| `_headers` | Encabezados de seguridad y caché (Cloudflare/Netlify) |

- Base de datos: tablas `eu_sitios`, `eu_cuentas`, `eu_pagos`, `eu_notas`, `eu_ajustes` (y en el servidor
  `eu_admins`, `eu_pedidos`, `eu_avisos`), funciones `eu_es_admin` y `eu_admin_*`, buckets `eu-media` y `eu-pagos`.
  Las migraciones SQL **no** vienen en el zip.
- Cada cliente se identifica por `?n=<slug>` o por subdominio cuando se configure `dominioBase` en `core/config.js`.
- No se publica con Sonrisas: Cloudflare publica solo la carpeta `web/`.
