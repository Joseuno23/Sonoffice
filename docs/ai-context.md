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

## Ajustes posteriores al handoff

- 2026-09-18: Usuarios del módulo de OC pidieron mejorar la captura de
  descripciones largas. Se cambió solo el campo `detalle` de líneas de órdenes
  de costo y de presupuestos de producción externa de `input` a `textarea`,
  conservando los iconos y tooltips existentes. El `textarea` debe iniciar con
  apariencia de input normal (`rows=1`) y permitir agrandarlo manualmente con el
  mouse si el usuario necesita más espacio.
  - `apps/web/src/pages/CostOrderForm.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
- 2026-09-18: Mejora UX solicitada para selects con buscador: al escribir en el
  buscador, el usuario puede navegar resultados con flecha abajo/arriba,
  seleccionar con Enter y cerrar con Escape. El resultado resaltado hace scroll
  dentro de la lista. Aplica a los `SearchSelect` de OC y presupuestos externos.
  - `apps/web/src/pages/CostOrderForm.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
- 2026-09-18: Ajuste de legibilidad en valores monetarios: se reemplazó la
  tipografía mono en valores por Inter/system con `font-variant-numeric:
  tabular-nums` para evitar que el `0` parezca `8`, conservando alineación de
  cifras. No aplica a IDs/códigos, solo valores visibles.
  - `apps/web/src/pages/CostOrderForm.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
- 2026-09-18: Ajuste de cabecera en imprimible de OC: se retiraron `Tipo`,
  `Servicio`, `Producto`, `Copia`, `Estado` y `N° orden` de la cabecera compacta.
  El número de orden ya se muestra en el encabezado superior.
  - `apps/web/src/pages/CostOrderPrint.tsx`
- 2026-09-18: Ajuste de búsqueda en listados: el buscador de órdenes de costo
  ahora incluye el usuario creador (`sys_users.name`) y el buscador de
  presupuestos de producción externa incluye el usuario creador legacy
  (`usuarios.usr_nombre` + `usr_apellido`). También se actualizaron los
  placeholders para indicar búsqueda por usuario.
  - `apps/api/src/cost-orders/cost-orders.repository.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.repository.ts`
  - `apps/web/src/pages/CostOrdersList.tsx`
  - `apps/web/src/pages/ExternalProductionBudgets.tsx`
- 2026-09-18: Ajuste de creación solo cabecera: las órdenes de costo pueden
  crearse sin líneas de detalle ni detalle de presupuesto, siempre que la
  cabecera obligatoria esté completa. Presupuesto de producción externa ya
  guardaba cabecera por separado; se verificó que no exige detalles para crear.
  - `apps/api/src/cost-orders/cost-orders.service.ts`
  - `apps/web/src/pages/CostOrderForm.tsx`
- 2026-09-18: Corrección de edición de OC con borrados locales + agregado desde
  presupuesto: al asociar un detalle de presupuesto ya no se refresca toda la OC
  desde backend, porque eso revivía líneas manuales borradas en pantalla pero aún
  no guardadas. El backend devuelve el `idDetalle` creado y el frontend inserta
  esa línea en el estado local actual para preservar la transacción de edición.
  - `apps/api/src/cost-orders/cost-orders.repository.ts`
  - `apps/api/src/cost-orders/cost-orders.service.ts`
  - `apps/web/src/pages/CostOrderForm.tsx`
- 2026-09-18: Se revisó el flujo equivalente en presupuesto de producción
  externa. Borrar detalles ahí persiste inmediatamente, pero al agregar detalle
  desde OC se eliminó el `loadBudget(id)` para no pisar estado local de cabecera
  o detalles; el backend devuelve el detalle creado y el frontend lo agrega al
  estado actual. También se aplicó la fuente legible de valores (`Inter` +
  `tabular-nums`) a los valores monetarios de listados de OC y presupuestos.
  - `apps/api/src/budgets/external-production/external-production-budgets.repository.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.service.ts`
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
  - `apps/web/src/pages/CostOrdersList.tsx`
  - `apps/web/src/pages/ExternalProductionBudgets.tsx`
- 2026-09-18: Nombres sugeridos para guardar PDF desde imprimibles: el título del
  documento se ajusta antes de imprimir para que el navegador sugiera nombres de
  archivo legibles. OC usa `OC_<numero>_<proveedor>`; presupuesto externo usa
  `Produccion-Externa_<numero>_<cliente>`. Los nombres se sanitizan para quitar
  acentos y caracteres no seguros.
  - `apps/web/src/pages/CostOrderPrint.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetPrint.tsx`
- 2026-09-19: El imprimible de OC muestra ambas observaciones en la sección
  Observación sin subtítulos internos: la observación de cabecera
  (`sys_orden_costos.observacion`) y la observación agregada desde el listado
  (`sys_orden_costos.obs_final`), una debajo de la otra cuando ambas existen.
  - `apps/api/src/cost-orders/cost-orders.repository.ts`
  - `apps/api/src/cost-orders/cost-orders.service.ts`
  - `apps/api/src/cost-orders/cost-orders.types.ts`
  - `apps/web/src/pages/CostOrderPrint.tsx`

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
