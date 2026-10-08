---
name: sonoffice-legacy-migration
description: "Trigger: migrar módulo, legacy, permisos, menús, acciones, presupuestos. Aplica reglas Sonoffice para migraciones ERP."
license: Apache-2.0
metadata:
  author: jose-narvaez
  version: "1.0"
---

# Sonoffice Legacy Migration

## Activation Contract

Usa este skill en cualquier migración o cambio funcional de módulos Sonoffice, especialmente cuando haya legacy CodeIgniter, menús, permisos, acciones, formularios, listados, impresiones o seeds.

## Hard Rules

- No inventes comportamiento. Revisa legacy primero y replica salvo que el usuario apruebe una diferencia.
- Si faltan controlador, modelo o vistas legacy, detente y pídelos antes de implementar.
- No modifiques `Erp/` salvo solicitud explícita.
- No hardcodees valores de negocio: IVA, SPA, porcentajes, estados, consecutivos, proveedores, tipos, tarifas o parámetros deben venir de base de datos, configuración existente o evidencia legacy.
- Todo menú debe existir en base de datos para administrar permisos.
- Todo botón o acción debe existir en `app_actions` o estructura equivalente, tener seed idempotente y validación backend por rol.
- Ocultar en frontend no es seguridad: cada endpoint que ejecute una acción debe validar permisos.
- Usa español neutro en UI y documentación. Evita tono argentino.
- Evita textos explicativos en pantallas; usa solo etiquetas claras, mensajes de validación, disclaimers o alertas necesarias.
- Mantén diseño, tablas, botones, filtros, modales y estructura visual consistentes con los módulos ya migrados.
- Si creamos tablas nuevas, o alguna modificacion en base de datos, creacion de registros claves crea un archivo en /docs/sql con el script SQL idempotente para yo ejecutarlo manualmente.

## Decision Gates

| Situación | Acción |
|---|---|
| Falta fuente legacy | Pregunta por controlador, modelo y vistas; no implementes. |
| Regla de negocio dudosa | Busca evidencia en legacy o memoria; si no existe, pregunta. |
| Nuevo menú/botón/acción | Agrega seed, permiso administrable y validación backend. |
| Valor parece constante | Verifica DB/config legacy antes de hardcodear. |
| Cambio visible | Actualiza `docs/ai-context.md`; refresca `docs/engram.md` si debe viajar. |

## Execution Steps

1. Lee `AGENTS.md` y `docs/ai-context.md`.
2. Revisa `git status`.
3. Audita legacy: controlador, modelo, vistas, tablas, validaciones, permisos, estados y efectos secundarios.
4. Resume hallazgos confirmados e incertidumbres antes de implementar.
5. Implementa backend, frontend, seeds y permisos como una unidad revisable.
6. Ejecuta verificación relevante, normalmente `npm run typecheck`.
7. Guarda descubrimientos o decisiones en Engram proyecto `sonoffice`.

## Output Contract

Entrega siempre:

- fuentes legacy revisadas;
- comportamiento replicado;
- archivos modificados;
- permisos/seeds agregados;
- verificación ejecutada y resultado;
- caveats para roles, VM o datos.

## References

- `AGENTS.md`
- `docs/ai-context.md`
- `docs/engram.md`
- `.opencode/commands/new-module.md`
