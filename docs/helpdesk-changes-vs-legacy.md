# Helpdesk (Mesa de ayuda) — Cambios funcionales vs legacy

> **Propósito de este documento.** El módulo Mesa de ayuda es el **primer módulo funcional migrado** del ERP legacy (CodeIgniter) a la nueva plataforma (NestJS + React). A diferencia de la regla general de la migración —donde el legacy es la fuente de verdad—, este módulo se implementó con **cambios funcionales deliberados**. Por lo tanto, **para este módulo la fuente de verdad es este documento, NO el legacy `Erp/`**. Una verificación contra el legacy encontrará diferencias intencionales; no deben tratarse como bugs.

## Estado

| Aspecto | Valor |
|---------|-------|
| Estado | Migrado funcional (con cambios vs legacy) |
| Backend | `apps/api/src/helpdesk/` (controller, service, repository, module, types, email) |
| Frontend | `apps/web/src/pages/Helpdesk.tsx` |
| SQL | `database/sql/004_create_app_helpdesk.sql` (**pendiente de ejecución/aprobación**) |
| Tabla nueva | `app_helpdesk_tickets` |
| Tablas legacy reutilizadas (solo lectura) | `sys_users`, `sys_opcion_ticket` |
| Ruta web | `/helpdesk` |
| Endpoints | bajo `/api/helpdesk` |

## Resumen de la decisión

Se decidió **mejorar el flujo** aprovechando la migración, en lugar de replicar el legacy 1:1. El objetivo funcional del módulo se mantiene (los usuarios solicitan soporte interno; un administrador resuelve), pero se agregaron reglas de negocio, un flujo de calificación y un modelo de datos propio.

## Modelo de datos

### Tabla nueva: `app_helpdesk_tickets`

Se crea una tabla **propia de la aplicación** en vez de usar la tabla legacy de tickets. El script SQL es explícito: *"crear tablas propias para Mesa de ayuda sin modificar `sys_tickets` ni `Erp`"*.

Campos relevantes: `creator_user_id`, `description`, adjunto (`attachment_filename`, `attachment_original_name`, `attachment_mime`, `attachment_size`), `status`, `service_type`, `service_detail`, `admin_observations`, `resolved_by`, `resolved_at`, `rating`, `rated_at`, `created_at`, `updated_at`.

> **Regla de aislamiento.** La tabla nueva usa prefijo `app_`, no tiene llaves foráneas hacia el esquema legacy (índices sin FK por seguridad inicial) y **no modifica** `sys_tickets` ni ninguna tabla legacy.

### Tablas legacy reutilizadas (solo lectura)

- `sys_users` — para resolver nombres y emails de solicitante y de quien resuelve (JOIN por `id_users`), y para elegir destinatarios de notificación por rol.
- `sys_opcion_ticket` — catálogo de tipos (`servicio`) y detalles (`descripcion`) de servicio usados al resolver.

## Cambios funcionales vs legacy

| # | Cambio | Comportamiento nuevo |
|---|--------|----------------------|
| 1 | **Tabla propia** | Se usa `app_helpdesk_tickets` en lugar de la tabla legacy `sys_tickets`. El legacy queda intacto. |
| 2 | **Estados simplificados** | Solo dos estados: `open` (Pendiente) y `resolved` (Resuelto). |
| 3 | **Calificación del servicio** | El solicitante califica el ticket resuelto de **1 a 5 estrellas** (`rating`, `rated_at`). Es un flujo nuevo que no existía en el legacy. |
| 4 | **Bloqueo por calificación pendiente** | Un usuario **no puede crear un ticket nuevo** si tiene tickets resueltos sin calificar. La API responde `HELPDESK_PENDING_RATING`; el frontend deshabilita "Nuevo ticket" y muestra un aviso. |
| 5 | **Resolución estructurada** | Al resolver, el administrador debe indicar `serviceType`, `serviceDetail` y `adminObservations` (todos obligatorios). `serviceType`/`serviceDetail` se validan contra el catálogo `sys_opcion_ticket`. |
| 6 | **Adjunto controlado** | Un archivo opcional por ticket, máximo **5 MB**, con whitelist de MIME: JPEG, PNG, WebP, GIF, PDF, Word y Excel. Se guarda en `uploads/helpdesk/`. |
| 7 | **Autorización por rol** | `AuthGuard` protege todo el módulo. Resolver requiere `AdminRoleGuard`. El rol `1` (ROOT) ve **todos** los tickets; un usuario normal ve solo los suyos. |
| 8 | **Notificaciones por email (Brevo)** | Al **crear**: se notifica a los usuarios activos con rol `1` o `15`. Al **resolver**: se notifica al creador. Se usa Brevo (email transaccional), **no** EmBlue. Un fallo de email **no** interrumpe la operación (se captura y se registra). |
| 9 | **Contrato de respuesta consistente** | Todas las respuestas siguen `{ success, data, message, errorCode? }` con `HelpdeskErrorCode` tipado. |

## Contrato de API

Base: `/api/helpdesk` — todos los endpoints requieren autenticación (`AuthGuard`).

| Método | Ruta | Guard extra | Descripción |
|--------|------|-------------|-------------|
| GET | `/api/helpdesk` | — | Lista tickets + métricas + calificaciones pendientes + `canCreate` + `isAdmin` |
| GET | `/api/helpdesk/metrics` | — | Métricas (`open`, `resolved`, `total`) |
| POST | `/api/helpdesk` | — | Crea ticket (multipart: `description` + `attachment` opcional) |
| GET | `/api/helpdesk/service-types` | — | Catálogo de tipos de servicio |
| GET | `/api/helpdesk/service-details?serviceType=` | — | Detalles de servicio para un tipo |
| PATCH | `/api/helpdesk/:id/resolve` | `AdminRoleGuard` | Resuelve ticket (`serviceType`, `serviceDetail`, `adminObservations`) |
| POST | `/api/helpdesk/:id/rating` | — | Califica ticket resuelto (`rating` 1–5) |

### Códigos de error

`HELPDESK_DESCRIPTION_REQUIRED`, `HELPDESK_DESCRIPTION_TOO_LONG`, `HELPDESK_PENDING_RATING`, `HELPDESK_ATTACHMENT_INVALID`, `HELPDESK_TICKET_NOT_FOUND`, `HELPDESK_TICKET_ALREADY_RESOLVED`, `HELPDESK_TICKET_NOT_RESOLVED`, `HELPDESK_TICKET_ALREADY_RATED`, `HELPDESK_RATING_INVALID`, `HELPDESK_RESOLVE_FIELDS_REQUIRED`, `HELPDESK_SERVICE_TYPE_NOT_FOUND`, `HELPDESK_SERVICE_DETAIL_NOT_FOUND`, `HELPDESK_SERVER_ERROR`.

## Reglas de negocio (fuente de verdad)

1. La descripción es obligatoria y no puede superar **3000 caracteres**.
2. No se puede crear un ticket si existen tickets resueltos sin calificar del mismo usuario.
3. Resolver exige tipo + detalle de servicio (validados contra catálogo) + observaciones (máx. 3000 caracteres).
4. Un ticket ya resuelto no puede volver a resolverse.
5. Solo el creador puede calificar, solo tickets resueltos, y solo una vez. Rango de calificación: 1 a 5.
6. El adjunto es opcional; si se envía, debe cumplir tamaño y tipo permitidos.

## Límites y constantes

| Constante | Valor |
|-----------|-------|
| Máx. longitud descripción | 3000 |
| Máx. longitud observaciones | 3000 |
| Máx. tamaño adjunto | 5 MB |
| Roles notificados al crear | `1`, `15` |
| Rol con acceso total (ROOT) | `1` |

## Pendientes

- [ ] Ejecutar/aprobar `database/sql/004_create_app_helpdesk.sql` en los ambientes correspondientes.
- [ ] Definir estrategia de tests para el módulo (hoy no hay pruebas automatizadas).
