# Estado de módulos

Hay **un módulo funcional migrado** (Mesa de ayuda). El resto es infraestructura base, andamiaje o pantallas sin migración funcional confirmada.

> **Regla de clasificación.** No se marca un módulo como *Migrado* solo porque exista una pantalla o un endpoint. Migrado significa: backend + frontend + verificación funcional confirmada contra su fuente de verdad.

## Tabla de seguimiento

| Módulo | Estado | Backend | Frontend | Tests | Pendiente |
|--------|--------|---------|----------|-------|-----------|
| Infraestructura | Base disponible | NestJS con `/api`, `DbService`, `GET /api/health/db` | React/Vite/TS/Tailwind base | Health DB validado manualmente | Definir estrategia de tests |
| **Mesa de ayuda (Helpdesk)** | **Migrado funcional (con cambios vs legacy)** | `apps/api/src/helpdesk/` completo | `apps/web/src/pages/Helpdesk.tsx` | Sin tests automatizados | Ejecutar SQL `004`, definir tests. Ver `docs/helpdesk-changes-vs-legacy.md` |
| Autenticación / Login | Funcional | `apps/api/src/auth/` (login contra base legacy, recuperación con Brevo, guards) | `apps/web/src/pages/Login.tsx` | Validado manualmente | Confirmar estrategia final de autorización |
| Órdenes (Orders) | Andamiaje (datos mock) | `apps/api/src/orders/` con `data.ts` (generadores) | `OrdersList`, `OrderDetail`, `OrderForm` | No | No migrado: usa datos generados, falta inventario legacy |
| Sistema (Usuarios/Roles/Menús) | Pantallas/endpoints base | `system-users`, `roles`, `menus` | `SystemUsers`, `SystemRoles`, `SystemMenus` | No | Confirmar equivalencia funcional por submódulo |
| Menú/sidebar | Fundación SQL propuesta | Tablas `app_menus` / `app_role_menu_permissions` pendientes de ejecución | Pendiente | SQL no ejecutado | Aprobar y ejecutar script |
| Permisos de acciones | Fundación SQL propuesta | Tablas `app_actions` / `app_role_action_permissions` pendientes de ejecución | Pendiente | SQL no ejecutado | Aprobar y ejecutar script |
| SIG / Documentos (Políticas, Alcance, Código de ética, Reglamento) | Pantallas base | Pendiente | `SigPolicies`, `SigScope`, `CodeOfEthics`, `InternalRegulation` | No | Confirmar contenido y fuente de datos |
| Dashboard | Pantalla/endpoint base | `apps/api/src/dashboard/` | `apps/web/src/pages/Dashboard.tsx` | No | Confirmar KPIs reales vs legacy |
| Módulos funcionales restantes | No iniciados | Pendiente | Pendiente | Pendiente | Inventariar módulos legacy por fase |

## Reglas de actualización

- Agregar/actualizar una fila por módulo cuando cambie su estado real.
- No marcar un módulo como migrado solo porque exista una pantalla o endpoint.
- Registrar backend, frontend y verificación por separado.
- Mantener "Pendiente" cuando no haya evidencia confirmada.
- Si un módulo migrado se aparta del legacy, documentar los cambios en un archivo propio (ej. `docs/helpdesk-changes-vs-legacy.md`) y tratar ese archivo como su fuente de verdad.

## Estados sugeridos

| Estado | Significado |
|--------|-------------|
| No iniciado | No hay inventario ni implementación |
| Inventario | Se está revisando el legacy |
| Andamiaje | Existe estructura/UI pero con datos mock o sin migración funcional |
| En backend | Contratos/API en construcción |
| En frontend | UI nueva en construcción |
| En verificación | Comparación contra legacy |
| Migrado funcional | Backend + frontend + verificación confirmada |
| Retirado legacy | El módulo legacy dejó de usarse |
