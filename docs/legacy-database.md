# Base de datos legacy

La base legacy local identificada es `bd_medios`. Debe tratarse como fuente de datos existente y NO debe modificarse durante la documentación inicial ni durante una migración sin decisión explícita.

## Datos confirmados

| Tema | Valor |
|------|-------|
| Configuración legacy | `Erp/application/config/database.php` |
| DB local identificada | `bd_medios` |
| Motor local validado | MariaDB vía XAMPP |
| Usuario local validado | `root` |
| Password local validado | vacío |
| Backend nuevo | `apps/api` usa `mysql2` pool |
| Health check DB | `GET /api/health/db` |

## Configuración usada por la API nueva

El backend NestJS carga variables desde `.env` usando `@nestjs/config` y crea un pool en `apps/api/src/db/db.service.ts`.

Variables documentadas en `.env.example`:

| Variable | Valor local esperado |
|----------|----------------------|
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `bd_medios` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | vacío en XAMPP local |

## Tablas identificadas

| Tabla | Estado | Notas |
|-------|--------|-------|
| Pendiente | No identificada todavía | Falta inventario controlado por módulo |

## Campos importantes

| Módulo | Campos importantes | Estado |
|--------|--------------------|--------|
| Pendiente | Pendiente | Confirmar al analizar cada módulo |

## Relaciones confirmadas y no confirmadas

| Relación | Estado | Evidencia |
|----------|--------|-----------|
| Ninguna relación funcional documentada todavía | No confirmada | Pendiente de exploración por módulo |

## Riesgos

- El esquema legacy puede tener relaciones implícitas no declaradas.
- Cambios directos al esquema pueden romper el ERP actual.
- Nombres de tablas/campos pueden no expresar intención funcional.
- Consultas nuevas sin inventario pueden duplicar lógica legacy incorrectamente.

## Reglas de trabajo

- No alterar tablas, columnas, índices ni datos legacy sin aprobación explícita.
- Documentar evidencia antes de migrar un módulo.
- Confirmar relaciones con código legacy y datos reales antes de depender de ellas.
- Mantener `.env` local fuera del repositorio; usar `.env.example` como referencia.
