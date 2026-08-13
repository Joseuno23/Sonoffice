# Estado de módulos

No hay módulos funcionales migrados todavía. La única fila activa es infraestructura: monorepo, frontend base, backend base y conexión DB.

## Tabla de seguimiento

| Módulo | Estado | Branch | Backend | Frontend | Tests | Pendiente |
|--------|--------|--------|---------|----------|-------|-----------|
| Infraestructura | Base inicial disponible | Pendiente de confirmar | NestJS con `/api`, `DbService` y `GET /api/health/db` | React/Vite/TS/Tailwind base | Health DB validado manualmente | Definir estrategia de tests y primer módulo |
| Módulos funcionales | No iniciados | No aplica | Pendiente | Pendiente | Pendiente | Inventariar módulos legacy |

## Reglas de actualización

- Agregar una fila por módulo cuando empiece el inventario funcional.
- No marcar un módulo como migrado solo porque exista una pantalla o endpoint.
- Registrar backend, frontend y verificación por separado.
- Mantener “Pendiente” cuando no haya evidencia confirmada.

## Estados sugeridos

| Estado | Significado |
|--------|-------------|
| No iniciado | No hay inventario ni implementación |
| Inventario | Se está revisando el legacy |
| En backend | Contratos/API en construcción |
| En frontend | UI nueva en construcción |
| En verificación | Comparación contra legacy |
| Migrado | Listo para operación nueva |
| Retirado legacy | El módulo legacy dejó de usarse |
