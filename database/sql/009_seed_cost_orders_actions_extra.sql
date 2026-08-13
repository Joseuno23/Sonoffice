-- 009_seed_cost_orders_actions_extra.sql
-- Propósito: agregar las acciones faltantes del módulo "Órdenes de costo":
--   - print (Imprimir): acción de fila.
--   - duplicate (Duplicar): acción de módulo (botón separado, permite duplicar órdenes en masa).
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - Idempotente (UNIQUE en code). No asigna permisos a roles.

INSERT INTO app_actions (module_code, action_code, code, label, description, is_active)
SELECT * FROM (
  SELECT 'cost-orders' AS module_code, 'print'     AS action_code, 'cost-orders.print'     AS code, 'Imprimir'  AS label, 'Permite imprimir/descargar el PDF de la orden de costo' AS description, 1 AS is_active UNION ALL
  SELECT 'cost-orders', 'duplicate', 'cost-orders.duplicate', 'Duplicar', 'Permite duplicar órdenes de costo existentes', 1
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM app_actions a WHERE a.code = seed.code
);
