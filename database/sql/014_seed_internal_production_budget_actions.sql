-- 014_seed_internal_production_budget_actions.sql
-- Propósito: registrar las acciones del módulo "Presupuesto Producción Interna" en app_actions.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - Idempotente (UNIQUE en code). No asigna permisos a roles.
-- - El rol 1 (root) tiene acceso implícito completo desde la aplicación.

INSERT INTO app_actions (module_code, action_code, code, label, description, is_active)
SELECT * FROM (
  SELECT 'internal-production-budgets' AS module_code, 'create' AS action_code, 'internal-production-budgets.create' AS code, 'Nuevo presupuesto' AS label, 'Permite crear presupuestos de producción interna' AS description, 1 AS is_active UNION ALL
  SELECT 'internal-production-budgets', 'edit', 'internal-production-budgets.edit', 'Editar', 'Permite editar cabecera, detalles y asociaciones de OC de presupuestos de producción interna', 1 UNION ALL
  SELECT 'internal-production-budgets', 'print', 'internal-production-budgets.print', 'Imprimir', 'Permite imprimir presupuestos de producción interna', 1 UNION ALL
  SELECT 'internal-production-budgets', 'support', 'internal-production-budgets.support', 'Soporte de pauta', 'Permite consultar, cargar y descargar soportes de pauta', 1 UNION ALL
  SELECT 'internal-production-budgets', 'duplicate', 'internal-production-budgets.duplicate', 'Duplicar', 'Permite duplicar presupuestos de producción interna', 1 UNION ALL
  SELECT 'internal-production-budgets', 'replace', 'internal-production-budgets.replace', 'Reemplazar', 'Permite crear presupuestos de reemplazo desde Nota Crédito', 1 UNION ALL
  SELECT 'internal-production-budgets', 'add-order', 'internal-production-budgets.add-order', 'Add Orden', 'Permite asociar o agregar una orden al presupuesto de producción interna', 1 UNION ALL
  SELECT 'internal-production-budgets', 'anule', 'internal-production-budgets.anule', 'Anular', 'Permite anular presupuestos de producción interna', 1 UNION ALL
  SELECT 'internal-production-budgets', 'view-anule', 'internal-production-budgets.view-anule', 'Ver Anulación', 'Permite consultar presupuestos anulados desde acciones de fila', 1
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM app_actions a WHERE a.code = seed.code
);
