-- 013_seed_external_production_budget_actions.sql
-- Propósito: registrar las acciones del módulo "Presupuesto Producción Externa" en app_actions,
-- para administrarlas desde Sistema > Roles/Permisos igual que Órdenes de costo.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - Idempotente (UNIQUE en code). No asigna permisos a roles.
-- - El rol 1 (root) tiene acceso implícito completo desde la aplicación.

INSERT INTO app_actions (module_code, action_code, code, label, description, is_active)
SELECT * FROM (
  SELECT 'external-production-budgets' AS module_code, 'create' AS action_code, 'external-production-budgets.create' AS code, 'Nuevo presupuesto' AS label, 'Permite crear presupuestos de producción externa' AS description, 1 AS is_active UNION ALL
  SELECT 'external-production-budgets', 'edit', 'external-production-budgets.edit', 'Editar', 'Permite editar cabecera y detalles de presupuestos de producción externa', 1 UNION ALL
  SELECT 'external-production-budgets', 'print', 'external-production-budgets.print', 'Imprimir', 'Permite imprimir presupuestos de producción externa', 1 UNION ALL
  SELECT 'external-production-budgets', 'print-order', 'external-production-budgets.print-order', 'Imprimir Orden', 'Permite imprimir la orden asociada al presupuesto de producción externa', 1 UNION ALL
  SELECT 'external-production-budgets', 'support', 'external-production-budgets.support', 'Soporte de pauta', 'Permite consultar, cargar y descargar soportes de pauta', 1 UNION ALL
  SELECT 'external-production-budgets', 'duplicate', 'external-production-budgets.duplicate', 'Duplicar', 'Permite duplicar presupuestos de producción externa', 1 UNION ALL
  SELECT 'external-production-budgets', 'replace', 'external-production-budgets.replace', 'Reemplazar', 'Permite crear presupuestos de reemplazo desde Nota Crédito', 1 UNION ALL
  SELECT 'external-production-budgets', 'add-order', 'external-production-budgets.add-order', 'Add Orden', 'Permite asociar/agregar orden al presupuesto', 1 UNION ALL
  SELECT 'external-production-budgets', 'anule', 'external-production-budgets.anule', 'Anular', 'Permite anular presupuestos de producción externa', 1 UNION ALL
  SELECT 'external-production-budgets', 'view-anule', 'external-production-budgets.view-anule', 'Ver Anulación', 'Permite consultar presupuestos anulados desde acciones de fila', 1
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM app_actions a WHERE a.code = seed.code
);
