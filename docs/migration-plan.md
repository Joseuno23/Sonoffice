# Plan de migración gradual

La migración de Sonoffice debe ser incremental, módulo por módulo. No hay big bang: el ERP legacy sigue activo hasta que cada módulo nuevo demuestre equivalencia funcional y operativa.

## Estrategia

| Principio | Decisión |
|-----------|----------|
| Migración | Gradual por módulo |
| Riesgo | Evitar big bang |
| Legacy | Se mantiene como referencia funcional |
| DB | No se altera el esquema legacy sin aprobación |
| API | Nuevos contratos bajo `/api` |
| Estado actual | Infraestructura base creada; módulos funcionales pendientes |

## Fases por módulo

Cada módulo debe pasar por estas fases antes de considerarse migrado.

| Fase | Resultado esperado |
|------|--------------------|
| 1. Inventario | Pantallas, flujos, permisos, tablas y reglas legacy identificadas |
| 2. Contrato | Endpoints `/api`, formas de respuesta y errores definidos |
| 3. Backend | Lecturas/escrituras implementadas sin romper legacy |
| 4. Frontend | Vistas nuevas conectadas a la API |
| 5. Verificación | Casos críticos comparados contra el legacy |
| 6. Corte controlado | Usuarios pueden operar el módulo nuevo |
| 7. Retiro legacy | Módulo legacy queda deshabilitado o fuera de uso |

## Criterios para retirar un módulo legacy

Un módulo legacy solo puede retirarse cuando:

- [ ] Está documentado el flujo funcional actual.
- [ ] Están identificadas tablas, campos y relaciones usados.
- [ ] La API nueva cubre los casos necesarios.
- [ ] El frontend nuevo cubre los flujos de usuario aprobados.
- [ ] Los errores y estados vacíos están definidos.
- [ ] Hay validación funcional contra el comportamiento legacy.
- [ ] Hay acuerdo explícito para dejar de usar la versión legacy.

## Estado actual

| Área | Estado |
|------|--------|
| Monorepo | Creado con workspaces npm |
| Web nueva | Base React/Vite/TS/Tailwind disponible |
| API nueva | Base NestJS disponible |
| DB | Conexión MariaDB validada localmente |
| Health DB | `GET /api/health/db` validado |
| Módulos funcionales | Ninguno iniciado |

## Próximo paso recomendado

Elegir un primer módulo pequeño y hacer inventario antes de crear endpoints funcionales. La prioridad es entender el comportamiento real, no copiar pantallas a ciegas.
