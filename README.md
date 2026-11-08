# DentaGest · CRM Odontológico

Sistema web de gestión para clínicas dentales: pacientes, odontograma digital, agenda, presupuestos, pagos y reportes.

Funciona **100 % en el navegador** (HTML + CSS + JavaScript, sin dependencias ni compilación). Los datos se guardan en el `localStorage` del navegador.

## Cómo usarlo

Abrí `index.html` en el navegador, o serví la carpeta:

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

## Módulos

- **Dashboard**: pacientes, citas del día, presupuestos pendientes, ingresos del mes, asistencia, aceptación de presupuestos y rendimiento por profesional.
- **Pacientes**: alta, edición y baja, búsqueda, filtro por cobertura, exportación a CSV y saldo de cada paciente.
- **Ficha del paciente** con pestañas:
  - Información personal y médica (alertas de alergias y antecedentes).
  - **Odontograma digital interactivo** (numeración FDI, por pieza o por cara: caries, obturación, fractura, corona, endodoncia, extracción, implante, prótesis, ausente).
  - Historia clínica (evoluciones).
  - Consentimientos informados.
  - Cuenta corriente (debe, haber y saldo).
  - Citas y pagos del paciente.
- **Agenda**: vista por día o semana, filtro por profesional, clic en un horario libre para agendar y control de superposición de turnos.
- **Tratamientos**: catálogo con categorías, precios y duraciones.
- **Presupuestos**: varios tratamientos por presupuesto, pieza dental, descuento, estados, impresión y exportación a CSV.
- **Pagos**: registro asociado a un presupuesto, filtros por fecha y método, recibo imprimible y exportación a CSV.
- **Reportes**: ingresos por mes y por método, citas y ausentismo, tratamientos más presupuestados y deudores.
- **Usuarios**: roles (administrador, odontólogo/a, recepción), especialidad y color en la agenda.
- **Registro de actividad**: auditoría de cada acción.
- **Configuración**: datos de la clínica, horarios, copia de seguridad (JSON), restauración y reinicio para una nueva clínica.

### Permisos por rol

| Acción                              | Admin | Odontólogo/a | Recepción |
|-------------------------------------|:-----:|:------------:|:---------:|
| Pacientes, agenda, presupuestos, pagos | ✅ | ✅ | ✅ |
| Editar odontograma                  | ✅ | ✅ | ❌ (solo lectura) |
| Editar catálogo de tratamientos     | ✅ | ✅ | ❌ |
| Reportes                            | ✅ | ✅ | ❌ |
| Eliminar registros                  | ✅ | ❌ | ❌ |
| Usuarios, actividad y configuración | ✅ | ❌ | ❌ |

## Estructura

```
index.html          Punto de entrada
css/styles.css      Estilos (responsive, adaptado a celulares)
js/utils.js         Íconos, formato, modales, CSV
js/db.js            Datos, sesión, auditoría y datos de ejemplo
js/odontogram.js    Odontograma interactivo
js/views.js         Pantallas
js/app.js           Login, menú, permisos y rutas
```

## Importante antes de usarlo con pacientes reales

Esta versión guarda los datos **solo en el navegador del equipo** y las contraseñas sin cifrar. Sirve como demo o para un solo consultorio con respaldos frecuentes. Para usarlo en varios equipos o con datos sensibles hay que conectarlo a un backend con base de datos (por ejemplo Supabase o PostgreSQL), autenticación segura y HTTPS.
