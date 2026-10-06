---
description: Guía la migración de un nuevo módulo legacy de Sonoffice hacia la arquitectura React/NestJS.
---

# Migración de nuevo módulo Sonoffice

Vas a guiar la migración de un módulo legacy de Sonoffice. Solicitud del usuario:

```text
$ARGUMENTS
```

## Reglas obligatorias antes de empezar

1. Lee `AGENTS.md`.
2. Lee `docs/ai-context.md`.
3. Aplica el skill de proyecto `sonoffice-legacy-migration`.
4. Usa Engram proyecto `sonoffice`; si falta contexto local, consulta `docs/engram.md`.
5. Ejecuta `git status` antes de editar.
6. No modifiques `Erp/` salvo que el usuario lo pida explícitamente.

## Principio central

No migres por intuición. Primero entiende el legacy, después implementa.

Si el usuario no dio controlador, modelo y vistas legacy, detente y pídelos antes de implementar. No asumas rutas ni comportamiento por el nombre del menú.

Pregunta mínima obligatoria cuando falte contexto:

```text
Para migrar este módulo necesito que me indiques las fuentes legacy a revisar:

- controlador(es) CodeIgniter;
- modelo(s);
- vista(s), si aplica: listado, formulario, detalle, impresión, soporte o acciones.

Con eso primero audito el comportamiento legacy y recién después propongo la migración.
```

Si el usuario solo conoce una parte, trabaja únicamente en modo exploración con esa evidencia y marca lo que falte como incierto. No implementes hasta tener evidencia suficiente del flujo legacy.

## Fase 1 — Auditoría legacy obligatoria

Investiga el módulo legacy y responde primero con un resumen breve antes de escribir código:

- controlador(es) involucrado(s);
- modelo(s) involucrado(s);
- vista(s) de listado, creación, edición, detalle, impresión, soporte o acciones;
- tablas leídas/escritas;
- campos obligatorios, opcionales y condicionales;
- validaciones frontend y backend;
- estados legacy y transiciones;
- permisos, botones, menús y acciones legacy;
- archivos adjuntos, impresiones, consecutivos, anulaciones o duplicados;
- efectos secundarios en otras tablas;
- diferencias entre crear, editar, imprimir, anular, duplicar, reemplazar o cerrar.

Marca explícitamente lo que está confirmado por código y lo que sigue incierto.

## Fase 2 — Plan de migración

Antes de implementar, define:

- backend NestJS necesario: módulo, controller, service, repository, types/config;
- frontend React necesario: rutas, páginas, formularios, listados, impresión y soporte;
- SQL/seeds necesarios para `app_menus`, `app_actions`, permisos y datos base;
- endpoints y validaciones de permisos backend;
- compatibilidad con tablas legacy existentes;
- verificaciones que vas a ejecutar.

Todo menú, botón o acción debe tener permiso administrable y validación backend. Ocultar en UI no alcanza.

## Fase 3 — Implementación

Implementa por unidades revisables:

1. backend y reglas de negocio;
2. frontend y experiencia de usuario;
3. seeds SQL idempotentes;
4. integración de scripts de seeds si aplica;
5. documentación/handoff.

Mantén el comportamiento legacy salvo que el usuario apruebe explícitamente una diferencia.

## Fase 4 — Verificación

Ejecuta la verificación correspondiente. Para cambios de aplicación, normalmente:

```bash
npm run typecheck
```

Si falla, reporta errores relevantes y distingue fallas propias del cambio vs. fallas preexistentes.

## Fase 5 — Documentación y memoria

Cuando el cambio sea relevante:

- actualiza `docs/ai-context.md` con comportamiento, permisos, seeds, gotchas y pasos de handoff;
- actualiza `docs/engram.md` si el contexto debe viajar a otra máquina;
- guarda descubrimientos, decisiones y bugfixes en Engram bajo proyecto `sonoffice`.

## Entrega esperada

Responde con:

- qué legacy se revisó;
- qué se implementó;
- archivos modificados;
- permisos/seeds agregados;
- verificación ejecutada y resultado;
- pendientes o caveats para deploy/VM;
- si hubo commit/push, incluye hash y rama.
