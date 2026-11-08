# DentaGest · CRM Odontológico

Sistema web de gestión para clínicas dentales: pacientes, odontograma digital, agenda, presupuestos, pagos y reportes.

Está hecho con HTML, CSS y JavaScript, sin dependencias ni compilación. Funciona de dos maneras:

| Modo | Dónde se guardan los datos | Cómo se abre |
|------|----------------------------|--------------|
| **Navegador** | En el `localStorage` de ese navegador, con datos de ejemplo al empezar | Abriendo `index.html` |
| **Artefacto de Claude** | En la base de datos compartida del artefacto, con cambios en vivo entre personas | Publicando la página que genera `tools/build-artifact.mjs` |

La misma base de código detecta en qué modo está (`js/db.js`).

## Cómo usarlo en el navegador

Abrí `index.html`, o serví la carpeta:

```bash
npx serve .        # o: python3 -m http.server 3000
```

También se puede publicar tal cual en Netlify, Vercel o GitHub Pages.

### Usuarios de demostración

| Rol            | Email                        | Contraseña |
|----------------|------------------------------|------------|
| Administrador  | admin@dentagest.com          | admin123   |
| Odontólogo/a   | crodriguez@dentagest.com     | demo123    |
| Recepción      | recepcion@dentagest.com      | demo123    |

La pantalla de inicio de sesión muestra estas cuentas con un botón **Usar** mientras haya datos de ejemplo. Cuando empezás con tu clínica (**Configuración → Borrar datos**), las cuentas de demostración desaparecen y elegís tu propio email y contraseña.

## Cómo publicarlo como artefacto de Claude

```bash
node tools/build-artifact.mjs dist/dentagest.html   # página única con CSS y JS incluidos (sin js/seed.js)
node tools/export-seed.mjs dist/seed                # datos de ejemplo como documentos JSON (contraseñas cifradas)
```

- Se publica `dist/dentagest.html` declarando las capacidades `db` (regla raíz con lectura y escritura a partir de `interact`, es decir Colaborador), `user` y `downloads`.
- Los datos de ejemplo se cargan después de publicar, con lotes de `ArtifactData` que referencian los archivos de `dist/seed` (`dist/seed/batches.json` trae los lotes armados).
- Si la base está vacía, la app muestra una pantalla para configurar la clínica y crear la cuenta de administrador.
- Quien tenga acceso de solo vista no lee los datos de pacientes; ve un aviso para pedir acceso.
- Dentro de Claude no hay diálogo de impresión: los presupuestos y recibos se ven en pantalla y se descargan como `.html`. Los CSV y respaldos se descargan con la confirmación de Claude.

## Módulos

- **Dashboard**: pacientes, citas del día, presupuestos pendientes, ingresos del mes, asistencia, aceptación de presupuestos y rendimiento por profesional.
- **Pacientes**: alta, edición y baja (con todo lo asociado), búsqueda, filtro por cobertura, exportación a CSV y saldo de cada paciente.
- **Ficha del paciente** con pestañas:
  - Información personal y médica, con alertas de alergias y antecedentes.
  - **Odontograma digital interactivo**: numeración FDI, marcado por pieza o por cara (caries, obturación, fractura, corona, endodoncia, extracción, implante, prótesis, ausente).
  - Historia clínica (evoluciones).
  - Consentimientos informados.
  - Cuenta corriente (debe, haber y saldo).
  - Citas y pagos del paciente, con presupuestos y recibos en pantalla.
- **Agenda**: vista por día o semana, filtro por profesional, clic en un horario libre para agendar y control de superposición de turnos.
- **Tratamientos**: catálogo con categorías, precios y duraciones.
- **Presupuestos**: varios tratamientos por presupuesto, pieza dental, descuento, estados y exportación a CSV.
- **Pagos**: registro asociado a un presupuesto, filtros por fecha y método, recibos numerados y exportación a CSV.
- **Reportes**: ingresos por mes y por método, citas y ausentismo, tratamientos más presupuestados y deudores.
- **Usuarios**: roles (administrador, odontólogo/a, recepción), especialidad y color en la agenda.
- **Registro de actividad**: auditoría de las últimas 300 acciones.
- **Configuración**: datos de la clínica, horarios, copia de seguridad (JSON), restauración y borrado para empezar con tu clínica.

La interfaz se adapta al celular y respeta el modo claro u oscuro del dispositivo.

### Navegación

Cada pantalla tiene su dirección: `#inicio`, `#pacientes`, `#paciente-p8`, `#paciente-p8-odontograma`, `#agenda`, `#tratamientos`, `#presupuestos`, `#pagos`, `#reportes`, `#usuarios`, `#actividad` y `#configuracion`.

### Permisos por rol

| Acción                              | Admin | Odontólogo/a | Recepción |
|-------------------------------------|:-----:|:------------:|:---------:|
| Pacientes, agenda, presupuestos, pagos | ✅ | ✅ | ✅ |
| Editar odontograma e historia clínica | ✅ | ✅ | ❌ (solo lectura) |
| Editar catálogo de tratamientos     | ✅ | ✅ | ❌ |
| Reportes                            | ✅ | ✅ | ❌ |
| Eliminar registros                  | ✅ | ❌ | ❌ |
| Usuarios, actividad y configuración | ✅ | ❌ | ❌ |

## Estructura

```
index.html               Versión para el navegador
css/styles.css           Estilos (tokens de color para modo claro y oscuro, adaptado a celulares)
js/utils.js              Íconos, formato, almacenamiento seguro, SHA-256, modales, descargas
js/seed.js               Datos de ejemplo (solo versión navegador y exportación)
js/db.js                 Datos: base compartida del artefacto o localStorage, sesión y auditoría
js/odontogram.js         Odontograma interactivo
js/views.js              Pantallas
js/app.js                Arranque, inicio de sesión, menú, permisos y rutas
tools/build-artifact.mjs Genera la página única del artefacto
tools/export-seed.mjs    Exporta los datos de ejemplo para la base del artefacto
```

## Seguridad y datos reales

- Las contraseñas se guardan como SHA-256 con sal, nunca en texto plano.
- El inicio de sesión de la app organiza roles dentro del equipo, pero **no es una barrera de seguridad**: todo corre en el navegador. En el artefacto, lo que protege los datos es con quién lo compartís y con qué nivel (Colaborador o Editor para trabajar; Viewer no lee los datos).
- En modo navegador los datos quedan solo en ese equipo. Descargá respaldos seguido.
- Para una clínica con varios consultorios o requisitos legales sobre historias clínicas, conviene un backend con base de datos propia (por ejemplo Supabase o PostgreSQL), autenticación real y HTTPS.
