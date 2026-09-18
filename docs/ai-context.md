# AI Context — Sonoffice

Última actualización: 2026-09-18

Este archivo es el handoff oficial para trabajar `Sonoffice` desde más de una máquina
o con más de un agente. GitHub sincroniza código; este archivo sincroniza contexto.

## Regla irrompible

Cada vez que se haga algo importante en el proyecto, este archivo DEBE actualizarse
en el mismo commit o en un commit inmediatamente posterior.

Se considera “importante” cualquier cambio que afecte:

- arquitectura o patrones de implementación;
- módulos nuevos o cambios de flujo funcional;
- decisiones de producto o permisos;
- scripts SQL, seeds, migraciones o datos base;
- comandos de instalación, build, test o despliegue;
- bugs complejos, gotchas o deuda técnica descubierta;
- coordinación Mac/Windows o handoff entre agentes.

Si un agente empieza a trabajar en Windows, debe leer este archivo ANTES de tocar código.

## Flujo multi-equipo

- El código se sincroniza con Git: `commit` + `push` antes de cambiar de equipo,
  `pull --rebase` al empezar en el otro equipo.
- No confiar en `git stash` para pasar trabajo entre máquinas: el stash es local.
- No confiar en cambios sin commit: quedan atrapados en esa máquina.
- Los `.env` no se commitean. Cada equipo debe tener su `.env` local.
- Engram puede tener memorias bajo nombres distintos (`Sonoffice` y `sonoffice`),
  por eso este archivo es la fuente versionada de contexto operativo.

## Estado actual del repo

Rama local actual al crear este archivo: `main`.

Últimos commits relevantes antes de este handoff:

- `84c01f0 feat(cost-orders): support budget lines during order creation`
- `222258d feat(reports): add cost order export reports`
- `ee62c42 docs(erp): estimate legacy module migration scope`
- `cc774b5 feat(system-users): confirm password reset with shared dialog`
- `70761f3 feat(cost-orders): complete lifecycle actions and compensation`

## Trabajo pendiente incluido en el handoff inicial

El estado actual incluye cambios grandes relacionados principalmente con presupuestos
de producción externa y ajustes alrededor de órdenes de costo.

Áreas tocadas:

- Backend de presupuestos:
  - `apps/api/src/budgets/`
  - `apps/api/src/config/external-production-budget.config.ts`
  - `apps/api/src/financial-parameters/`
  - `apps/api/src/app.module.ts`
- Ajustes de órdenes de costo:
  - `apps/api/src/cost-orders/cost-orders.repository.ts`
  - `apps/api/src/cost-orders/cost-orders.service.ts`
  - `apps/api/src/cost-orders/cost-orders.types.ts`
  - `apps/web/src/pages/CostOrderForm.tsx`
  - `apps/web/src/pages/CostOrderPrint.tsx`
  - `apps/web/src/pages/CostOrdersList.tsx`
- Frontend de presupuestos de producción externa:
  - `apps/web/src/pages/ExternalProductionBudgets.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetPrint.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetOrders.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetSupport.tsx`
  - `apps/web/src/pages/BudgetPlaceholder.tsx`
  - `apps/web/src/components/ToastMessage.tsx`
  - `apps/web/src/routes/AppRoutes.tsx`
  - `apps/web/src/services/api.ts`
- Seed de menú:
  - `database/sql/012_seed_media_budgets_menu.sql`
- Documentación:
  - `README.md`
  - `docs/manual-administracion-vm.md`
  - `docs/manual-administracion-vm.pdf`

## Auditoría previa al commit

Se hizo una revisión fresca antes del commit inicial de handoff.

Resultado:

- No se detectaron secretos en los cambios pendientes.
- `git diff --check` estaba limpio.
- Se detectó que `.env` local contiene una API key real, pero `.env` NO estaba
  pendiente para commit.
- La auditoría marcó como riesgo que `docs/manual-administracion-vm.md` y
  `docs/manual-administracion-vm.pdf` parecen un work unit distinto del módulo de
  presupuestos. El usuario pidió subir todo igualmente para preparar Windows.

## Convenciones de trabajo para agentes

Antes de empezar:

1. Ejecutar `git status`.
2. Ejecutar `git pull --rebase` si no hay cambios locales.
3. Leer este archivo completo.
4. Revisar últimos commits con `git log --oneline -10`.

Durante el trabajo:

- Mantener commits por unidad funcional, no por tipo de archivo.
- Incluir tests/docs con el cambio que verifican o explican.
- Si se toca un módulo diferente desde Windows, documentar acá qué módulo quedó
  reservado para Windows para evitar pisadas.

Antes de cerrar o cambiar de máquina:

1. Actualizar este archivo si hubo cambios importantes.
2. Ejecutar verificaciones disponibles razonables.
3. `git add` + `git commit` + `git push`.
4. Dejar una nota breve en este archivo si queda trabajo incompleto.

## Próximo arranque en Windows

Después de clonar:

```bash
git clone git@github-joseuno23:Joseuno23/Sonoffice.git
cd Sonoffice
git checkout main
git pull --rebase
```

Luego configurar `.env` local y dependencias según `README.md`.

Primer prompt recomendado al agente de Windows:

> Leé `docs/ai-context.md`, revisá `git status` y `git log --oneline -10`, y antes
> de tocar código explicame qué entendiste del estado actual del proyecto.
