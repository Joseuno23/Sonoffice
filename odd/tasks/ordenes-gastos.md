# Migración de Órdenes de gastos

## Objetivo

Migrar el módulo legacy de Órdenes de gastos desde CodeIgniter hacia la aplicación nueva, preservando comportamiento confirmado del legacy y agregando permisos administrables con validación backend.

## Problema

El módulo legacy `Managerbudget/O_Expense` administra cabecera, detalles, aprobación, impresión, anulación y recurrencia de órdenes de gastos sobre tablas legacy como `ord_gastos` y `det_ordgasto`. La migración no puede asumir reglas por nombre: debe replicar el comportamiento auditado.

## Alcance autorizado

- Auditar fuentes legacy de `Erp/application/controllers/Managerbudget/O_Expense/`, `models`, `views` y referencias relacionadas.
- Implementar backend NestJS compatible con tablas legacy existentes.
- Implementar frontend React consistente con módulos migrados.
- Agregar seeds idempotentes de menú/acciones/permisos administrables.
- Actualizar documentación y handoff relevante.
- No modificar `Erp/`.

## Restricciones

- No inventar reglas de negocio.
- Todo botón o acción debe tener permiso administrable y validación backend.
- La aprobación (`aprobada`) es independiente del estado operativo (`ordgas_estado`).
- La impresión tiene side effect legacy: estado `5` e incremento de `num_impresiones`.
- La anulación usa consecutivo `anulacion_og`; no hardcodear consecutivos.
- Verificar interacciones con documento equivalente (`docequi`) antes de alterar reglas relacionadas.

## Tareas

- [x] OG-001 — Auditar legacy `O_Expense` y referencias laterales.
  - Evidencia: controlador, modelo, vistas, rutas, core y referencias de documentos/radicado/reportes revisadas.
- [x] OG-002 — Mapear patrones migrados reutilizables para backend, frontend, permisos, rutas y seeds.
  - Checks: identificar módulo similar y convenciones existentes antes de escribir código de aplicación.
- [x] OG-003 — Implementar backend de Órdenes de gastos.
  - Incluye controller, service, repository, types/config, validaciones, permisos backend y side effects confirmados.
  - Evidencia: `apps/api/src/expense-orders/*`, registro en `AppModule`, validaciones por `app_actions` y side effects de impresión/anulación/aprobación/recurrencia.
- [x] OG-004 — Implementar frontend de listado, formulario, detalle, impresión y acciones.
  - Incluye permisos de UI, estados, modales/confirmaciones y experiencia consistente con módulos migrados.
  - Evidencia: `ExpenseOrdersList`, `ExpenseOrderForm`, `ExpenseOrderPrint`, rutas en `AppRoutes` y cliente API.
- [x] OG-005 — Agregar seeds SQL idempotentes y comando/script si aplica.
  - Incluye `app_menus`, `app_actions` y permisos administrables sin asignar roles indebidamente.
  - Evidencia: `database/sql/015_seed_expense_orders_menu_actions.sql`; runner de seeds actualizado con alias `db:apply-media-seeds`.
- [x] OG-006 — Verificar integración y documentar handoff.
  - Incluye `npm run typecheck`, actualización de `docs/ai-context.md` y memoria/handoff portable si corresponde.
  - Evidencia: `docs/ai-context.md` actualizado; verificación final registrada en entrega del agente.
- [x] OG-007 — Corregir creación de órdenes de gastos.
  - Incluye diagnosticar el error de guardado reportado en UI y ajustar persistencia backend sin tocar `Erp/`.
  - Evidencia: `apps/api/src/expense-orders/expense-orders.repository.ts` omite `tpsv_id` al crear cuando el formulario no envía servicio, igual que `V_Form_New.php`, y guarda `det_ordgasto.tpsrv_id = 0` para replicar el default implícito legacy en detalles. La reproducción local con INSERT rollback sigue bloqueada por el trigger DB `inserOrdgasto` definido como `adminop@%`, usuario inexistente en la base local.
- [x] OG-008 — Alinear imprimible de Órdenes de gastos con Órdenes de costo/presupuestos.
  - Incluye estructura visual, cabecera, secciones, tabla de detalle, totales, observación y firmas con el patrón migrado existente.
  - Evidencia: `ExpenseOrderPrint.tsx` fue reestructurado siguiendo el patrón de `CostOrderPrint.tsx`: `page`, `sheet`, `section`, `label`, `th`, `td`, `CompactRow`, toolbar, cabecera, secciones, tabla, totales, observación, nota y firmas; mantiene autoimpresión y título sugerido `OG_<id>_<proveedor>` saneado.
- [x] OG-009 — Validar uso de `cat_estados` para estados del módulo.
  - Incluye confirmar consultas/listados/filtros de estados y documentar la evidencia.
  - Evidencia: `ExpenseOrdersRepository` usa `LEFT JOIN cat_estados e ON o.ordgas_estado = e.est_id` para listado/detalle y `findStatuses()` consulta `ord_gastos INNER JOIN cat_estados`; legacy `M_Expense.php` usa la misma tabla en `GetPptoCompleteInfo()` y `GetOrder()`.
- [x] OG-010 — Reparar definers inválidos en triggers de Órdenes de gastos.
  - Incluye comando idempotente para detectar triggers de `ord_gastos`/`det_ordgasto` cuyo `DEFINER` no existe en `mysql.user`, recrearlos sin `DEFINER` explícito y evitar DDL dentro de transacciones.
  - Evidencia: `scripts/repair-expense-order-triggers.js` y script npm `db:repair-expense-order-triggers`; dry-run inicial detectó `ord_gastos.inserOrdgasto` con definer `adminop@%` inexistente, ejecución real lo recreó bajo el usuario conectado y dry-run posterior confirmó `root@localhost` existente sin cambios pendientes.
- [x] OG-011 — Bloquear edición de órdenes aprobadas o impresas.
  - Incluye mantener acceso de lectura por número de orden y bloquear cambios cuando `aprobada = 1` o `num_impresiones <> -1`.
  - Evidencia: `resolvePermittedActions()` ya no expone `edit` para OG aprobadas/impresas, `normalizeDetail()` devuelve `editable: false` en esos casos y `updateOrder()` bloquea en backend con `Solo se pueden editar órdenes activas sin aprobar ni imprimir`.
- [x] OG-012 — Migrar submenu `Aprobar orden` con carga Excel.
  - Incluye página/formulario de carga, ruta/menu administrable, endpoint con permiso `approve-bulk`, parser de Excel compatible con legacy y actualización batch de `ord_gastos.aprobada`.
  - Evidencia: `POST /expense-orders/approve-bulk` recibe `files`, valida menú + acción `expense-orders.approve-bulk`, parsea Excel con `xlsx` desde primera hoja/fila 2 hasta `A` vacío, toma `B` como orden y `O` exacto `OK`, y actualiza `aprobada = 1` omitiendo anuladas; frontend agrega `/medios/ordenes-gastos/aprobacion-masiva` con carga `.xls,.xlsx` y conteos parseadas/aprobadas/omitidas; seed `015` agrega submenu `Aprobar orden`.
- [x] OG-013 — Migrar reporte general de Órdenes de gasto.
  - Incluye menú `Reportes > Órdenes de gasto > General`, generador siguiendo el patrón de `Órdenes de costo > General`, backend con validación de menú, exportación con estructura legacy y seed idempotente.
  - Evidencia: `GET /reports/expense-orders/options` y `GET /reports/expense-orders/export` validan menú `reports.expense-orders.general` / `reports.expense-orders`; el CSV usa BOM y separador `;`, nombre `reporte-ordenes-gasto-${fechaIni}_a_${fechaFin}.csv`, columnas legacy exactas, `Descuento`/`IVA` con sufijo ` %` y filtros fecha/proveedor; frontend agrega `/reportes/ordenes-gasto/general`; seed `016` agrega menú y visibilidad rol 33 sin asignar root.

## Verificación prevista

- `npm run typecheck`
- Verificación específica de API/web si el monorepo exige comandos separados.
- Revisión de seeds en modo seguro o dry-run si existe comando aplicable.

## Progreso

- 2026-10-06: Auditoría legacy completada. Pendiente implementar sobre la base auditada.
- 2026-10-07: Alcance confirmado por el usuario: permisos/menús/acciones deben seguir el patrón ya migrado de Órdenes de costo; `Expense/Report` queda fuera del módulo y se trabajará después dentro de Reportes.
- 2026-10-07: Implementación inicial completada sin tocar `Erp/`. Quedan fuera `Expense/Report`, aprobación masiva Excel y ejecución automática de recurrencias.
- 2026-10-07: Corrección de paridad legacy del formulario: Órdenes de gastos no muestra `Servicio` ni `Cantidad`; el payload omite `idServicio`, usa `cantidad: 1` para detalles por compatibilidad interna y backend preserva `tpsv_id` existente en edición cuando el campo no viene en el payload.
- 2026-10-07: Corrección de blockers de migración: consecutivo `anulacion_og` usa `current + 1` y persiste el mismo `next`; anulación bloquea estado `39`; lectura `list`/`get` valida menú; acciones mutativas/print/recurrencia validan menú antes de `app_actions`; preview de no aprobadas usa acción administrable `print-preview`; listado diferencia `Imprimir`/`Vista previa` y ya no muestra columna `Servicio`.
- 2026-10-07: Corrección de renombre técnico: módulo, rutas API/frontend, menús, acciones administrables, helpers, seed y archivos vuelven a usar `expense-orders`; se mantienen textos visibles en español.
- 2026-10-07: Se retomó el módulo por reporte de error al crear orden, ajuste visual del imprimible y validación explícita de que los estados se consulten desde `cat_estados`.
- 2026-10-07: Se corrigió la persistencia de creación para acercarla al legacy: `ord_gastos.tpsv_id` ya no se fuerza a `NULL` cuando el formulario no envía servicio, y los detalles se insertan con `det_ordgasto.tpsrv_id = 0` para evitar dependencia del default implícito de MySQL no estricto. La reproducción local de cabecera sigue fallando por infraestructura de DB: trigger `inserOrdgasto` con definer `adminop@%` inexistente.
- 2026-10-07: Imprimible de Órdenes de gastos alineado visualmente con Órdenes de costo y presupuestos migrados; conserva side effect de impresión y nombre de documento `OG_<id>_<proveedor>`.
- 2026-10-07: Estados validados: el módulo nuevo y legacy consultan `cat_estados` para `ordgas_estado`; no se agregó fuente alternativa de estados.
- 2026-10-07: Reparación operativa de DB agregada y ejecutada localmente: `npm run db:repair-expense-order-triggers` revisa triggers de `ord_gastos`/`det_ordgasto`, valida `DEFINER` contra `mysql.user` y recrea solo los inválidos sin `DEFINER` explícito. En `bd_medios`, `inserOrdgasto` quedó con definer válido `root@localhost`; un dry-run posterior no encontró cambios pendientes.
- 2026-10-07: OG aprobadas o impresas quedan solo lectura en la migración: se pueden abrir desde el número de orden, pero la UI no muestra Guardar y el backend rechaza `PUT` aunque el cliente fuerce la llamada.
- 2026-10-07: Se retoma el submenu legacy `Aprobar orden`: `ApproveSpendingOrder` carga `V_Panel_Approve.php`, recibe Excel `.xls/.xlsx`, lee primera hoja desde fila 2, usa columna `B` como `ordgas_id` y columna `O` con valor exacto `OK` para aprobar en batch (`ord_gastos.aprobada = 1`).
- 2026-10-07: OG-012 completada. La migración agrega endpoint batch con permiso backend `approve-bulk`, parser Excel compatible con la estructura legacy y protección adicional contra órdenes anuladas; la UI muestra conteos de parseadas, aprobadas y omitidas.
- 2026-10-07: Se retoma el reporte legacy `Expense/Report` para migrarlo a `Reportes > Órdenes de gasto > General`. Legacy usa `Managerbudget/C_Report/Report/Og`, filtro obligatorio de fecha, proveedor opcional, plantilla `og.xlsx` y columnas: Fecha, Orden, Proveedor, Documento, SAP, Detalle, Valor, Descuento %, IVA %, Total, Servicio, CEBE, Usuario, Estado.
- 2026-10-07: OG-013 completada. El reporte migrado usa CSV como `Órdenes de costo > General`, conserva columnas/orden legacy, exporta `Descuento` e `IVA` con sufijo ` %` y fuerza ausencia de filtro cliente. Diferencia deliberada: `sys_tipo_servicio` queda en `LEFT JOIN` para no excluir OG migradas sin servicio. El runner `npm run db:apply-media-seeds` ahora incluye el seed `016` de reportes OG y reporta conteos `reports.*`; no se aplicó automáticamente.
- 2026-10-07: Seed `016` aplicado localmente con `npm run db:apply-media-seeds`; la salida confirmó `reports.expense-orders` y `reports.expense-orders.general` creados/actualizados en DB local.

## Nota de recuperación

Mantener espejo Engram `odd/ordenes-gastos/tasks` sincronizado con este archivo cuando haya cambios relevantes.
