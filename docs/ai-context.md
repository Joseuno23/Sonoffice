# AI Context — Sonoffice

Última actualización: 2026-10-06

Este archivo es el handoff oficial para trabajar `Sonoffice` desde más de una máquina
o con más de un agente. GitHub sincroniza código; este archivo sincroniza contexto.

## Contexto Engram portable

Antes de tocar código en una máquina nueva, leer y verificar `docs/engram.md`.
Ese archivo es el snapshot versionado de memorias Engram para compartir contexto
entre equipos cuando la SQLite local de Engram no está disponible o no coincide.

- Bucket canónico de Engram: `sonoffice` en minúscula.
- El bucket histórico `Sonoffice` ya fue migrado hacia `sonoffice` para el
  contexto inicial portable; no guardar memorias nuevas en `Sonoffice`.
- Si Engram local y `docs/engram.md` difieren, usar `docs/engram.md` como
  baseline de arranque y luego guardar nuevas memorias en `sonoffice`.

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

## Reglas irrompibles de migración ERP

- Todo menú nuevo, botón nuevo o acción nueva DEBE tener permisos administrables
  en el sistema nuevo (`app_menus`, `app_actions`, permisos de rol y validación
  backend). Solo se omite si el usuario lo indica explícitamente.
- Ocultar botones en frontend NO alcanza: cada endpoint que ejecute una acción
  debe validar el permiso correspondiente en backend.
- Para cada módulo legacy a migrar, si el usuario no indicó las fuentes, pedir
  primero controlador, modelo y vistas antes de implementar. No asumir rutas ni
  flujos desde nombres de menú.
- Las reglas de permisos son parte del alcance base de migración de cada módulo,
  no un follow-up opcional.
- Cada módulo migrado debe incluir sus SQL necesarios (`app_menus`, `app_actions`,
  permisos/datos base, etc.) y esos SQL deben agregarse al comando de aplicación
  de seeds correspondiente para que, después del deploy en VM, las novedades de
  base de datos puedan aplicarse de forma segura e idempotente.

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
- 2026-09-24: Presupuesto de producción externa ahora distingue impresión de
  presupuesto vs. `Imprimir Orden` con `?orden=1`. La orden reutiliza el
  imprimible migrado pero replica diferencias legacy: título `ORDEN DE EXTERNA`,
  copia desde `ordenes.num_impresiones`, observación/historial de orden, total sin
  SPA/IVA SPA, nota de facturación a Sonovista y firmas `Dpto de medios` /
  `Recibido Por`. El side effect de imprimir orden marca el presupuesto como
  impreso según regla legacy y además incrementa `ordenes.num_impresiones`. La UI
  de soporte de pauta no expone ni mantiene endpoint de eliminar adjuntos, igual
  que el legacy de soporte.
  - `apps/api/src/budgets/external-production/external-production-budgets.controller.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.service.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.repository.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.types.ts`
  - `apps/web/src/pages/ExternalProductionBudgetPrint.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetSupport.tsx`
  - `apps/web/src/services/api.ts`
- 2026-09-25: Limpieza del submenu obsoleto `Órdenes` dentro de cada tipo de
  presupuesto. Ese submenu pertenecía a pre-órdenes legacy y ya no se crea en el
  seed; si existía, el seed elimina sus filas y permisos. Se removieron las rutas
  frontend placeholder `/medios/presupuestos/:tipo/ordenes` y la página/listado
  global de órdenes de Producción Externa. Se mantiene intacto el flujo válido de
  Producción Externa: acciones de fila `Imprimir Orden` / `Add Orden`, impresión
  con `?orden=1`, endpoint `POST /budgets/external-production/:id/order` y
  consulta por presupuesto `GET /budgets/external-production/:id/orders`.
  - `database/sql/012_seed_media_budgets_menu.sql`
  - `apps/web/src/routes/AppRoutes.tsx`
  - `apps/web/src/pages/BudgetPlaceholder.tsx`
  - `apps/web/src/services/api.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.controller.ts`
- 2026-09-25: Defensa runtime para bases que ya tenían aplicado el seed viejo:
  la API de menús filtra códigos `media.budgets.%.orders` en menús visibles,
  menús activos y administración de menús. Esto oculta filas stale aunque sigan en
  `app_menus`, sin afectar órdenes de costo ni las acciones válidas por
  presupuesto externo (`Imprimir Orden`, `Add Orden`, endpoint per-budget e
  impresión con `?orden=1`). La limpieza física de DB sigue recomendada.
  - `apps/api/src/menus/menus.repository.ts`
- 2026-09-25: Migración inicial de Presupuesto Producción Interna como módulo
  separado (`internal-production-budgets`, tipo 7). Usa `presup_prodi` /
  `det_prodi`, proveedor fijo `SONOVISTA` (`pvcl_id_prov = 0`), servicio de
  cabecera `cod_ser`, total sin SPA/IVA SPA y NO crea ni usa `ordenes`.
  Acciones administrables: `create`, `edit`, `print`, `support`, `duplicate`,
  `replace`, `anule`, `view-anule`; no existen `print-order` ni `add-order`.
  La asociación de detalle desde OC queda bajo permiso `edit`, exige OC tipo `I`
  y aplica incremento interno desde `sys_data_billing.porcentaje_interna` con
  mínimo/fallback 20%, pero reversa OC usando el valor real asignado.
  - `apps/api/src/budgets/internal-production/`
  - `apps/api/src/config/internal-production-budget.config.ts`
  - `database/sql/014_seed_internal_production_budget_actions.sql`
  - `apps/web/src/pages/InternalProductionBudget*.tsx`
  - `apps/web/src/pages/ExternalProductionBudget*.tsx`
  - `apps/web/src/services/api.ts`
- 2026-09-25: Producción Externa migró runtime de botones desde legacy
  `sys_roles_button/sys_button` hacia `app_actions` con módulo
  `external-production-budgets`, siguiendo el patrón de Órdenes de costo. El seed
  `013_seed_external_production_budget_actions.sql` registra acciones administrables
  (`create`, `edit`, `print`, `print-order`, `support`, `duplicate`, `replace`,
  `add-order`, `anule`, `view-anule`) sin asignarlas a roles; root mantiene acceso
  implícito por `PermissionsService`. El listado devuelve `moduleActions` para el
  botón “Nuevo presupuesto” y acciones de fila filtradas por permisos + reglas de
  estado. La pantalla de permisos de rol ahora renderiza menús recursivamente para
  administrar rutas profundas como `media > budgets > produccion-externa > list`.
  - `database/sql/013_seed_external_production_budget_actions.sql`
  - `apps/api/src/budgets/external-production/external-production-budgets.module.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.controller.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.service.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.repository.ts`
  - `apps/web/src/pages/ExternalProductionBudgets.tsx`
  - `apps/web/src/pages/RolePermissions.tsx`
- 2026-09-25: Estabilización de Presupuesto Producción Interna: el frontend
  reutiliza las pantallas de Producción Externa detectando la ruta interna, pero
  filtra defensivamente `print-order` y `add-order` para Interna, oculta SPA/IVA
  SPA y usa copy de solo lectura sin jerga de implementación. Al asociar detalle
  desde OC interna, la API devuelve `valor` con incremento interno y
  `valorAsignadoOc` con el valor real asignado, preservando reversas de OC por el
  valor real.
  - `apps/api/src/budgets/internal-production/internal-production-budgets.service.ts`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.repository.ts`
  - `apps/web/src/pages/ExternalProductionBudgets.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
  - `apps/web/src/pages/ExternalProductionBudgetSupport.tsx`
- 2026-09-25: Se agregó comando manual para aplicar en VM los seeds de menús y
  acciones de presupuestos sin acoplarlo al deploy: `npm run
  db:apply-media-budget-seeds`. Lee `.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`,
  `DB_USER`, `DB_PASSWORD`), muestra destino/archivos, rechaza ejecución si faltan
  `DB_NAME` o `DB_USER`, ejecuta solo `012`, `013` y `014` en ese orden y reporta
  conteos de `app_menus`/`app_actions`. Para validar sin mutar DB: `node
  scripts/apply-media-budget-seeds.js --dry-run`.
  - `scripts/apply-media-budget-seeds.js`
  - `package.json`
- 2026-10-06: Producción Interna ahora también expone la acción de fila `Add Orden`
  en el listado cuando el rol tiene `internal-production-budgets.add-order` y el
  presupuesto está activo o impreso. El flujo reutiliza el modal compartido del
  listado, llama `POST /budgets/internal-production/:id/order`, valida el permiso
  en backend y actualiza `presup_prodi.psin_numorden`. No toca el flujo de
  asociación de detalles desde OC, que sigue siendo otro caso de uso. Para roles
  no-root, ejecutar el seed `014` y otorgar el permiso desde Roles/Permisos.
  - `apps/web/src/pages/ExternalProductionBudgets.tsx`
  - `apps/web/src/services/api.ts`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.controller.ts`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.service.ts`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.repository.ts`
  - `apps/api/src/permissions/permissions.service.ts`
  - `database/sql/014_seed_internal_production_budget_actions.sql`
- 2026-10-06: Los formularios migrados de Producción Externa e Interna ahora
  recuperan el campo legacy `Contrato De Consumo`. En legacy era un select
  obligatorio con opción `0 = No Aplica`, filtrado por cliente desde
  `sys_contratos` (`contra_parte = cliente`, `parte = 'CLIENTE'`, `old = 0`,
  `id_estado = 1`) y persistido en `presup_prode.contrato` /
  `presup_prodi.contrato`. No se muestra en listados ni print legacy, por eso la
  migración solo lo agrega al formulario y a los catálogos API.
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
  - `apps/api/src/budgets/external-production/external-production-budgets.service.ts`
  - `apps/api/src/budgets/external-production/external-production-budgets.repository.ts`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.service.ts`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.repository.ts`
- 2026-10-06: En Producción Interna, `Departamento` y `Municipio` quedan
  opcionales para respetar legacy. En las vistas legacy internas esos campos solo
  se renderizan para roles TeamBTL o root; al guardar con `FormData`, si no se
  renderizan no viajan en el payload. La migración mantiene los selects visibles,
  pero ya no bloquea guardar si están vacíos y la API persiste `NULL` en
  `presup_prodi.cod_dpto` / `presup_prodi.id_ciudad` cuando se omiten. Producción
  Externa no se relajó por este cambio.
  - `apps/web/src/pages/ExternalProductionBudgetForm.tsx`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.service.ts`
  - `apps/api/src/budgets/internal-production/internal-production-budgets.repository.ts`
- 2026-10-06: Se agregó el comando de proyecto `.opencode/commands/new-module.md`
  para guiar migraciones de nuevos módulos legacy. El comando obliga a leer
  `AGENTS.md` y este contexto, auditar legacy antes de implementar, identificar
  controlador/modelos/vistas/tablas/validaciones/permisos, planear backend,
  frontend, seeds y verificaciones, y documentar/memorizar el handoff.
  - `.opencode/commands/new-module.md`
- 2026-10-06: Se agregó el skill de proyecto `sonoffice-legacy-migration` para
  concentrar reglas reutilizables de migración: no inventar comportamiento,
  auditar legacy primero, no hardcodear valores de negocio, exigir permisos y
  seeds para menús/botones/acciones, validar permisos en backend, mantener diseño
  consistente y usar español neutro. `AGENTS.md` lo registra como obligatorio para
  migraciones o cambios funcionales de módulos.
  - `.opencode/skills/sonoffice-legacy-migration/SKILL.md`
  - `AGENTS.md`

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


Primer prompt recomendado al agente de Windows:

> Leé `docs/ai-context.md`, revisá `git status` y `git log --oneline -10`, y antes
> de tocar código explicame qué entendiste del estado actual del proyecto.
