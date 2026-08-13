-- 007_seed_cost_orders_actions.sql
-- Propósito: registrar las acciones (botones) del módulo "Órdenes de costo" en app_actions,
-- para poder asignarlas por rol desde la pantalla de permisos de acciones.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy. Solo inserta filas en app_actions.
-- - Idempotente: se puede ejecutar varias veces sin duplicar (UNIQUE en code).
-- - NO asigna permisos a ningún rol aquí; eso se hace desde la UI de asignación.
--   El rol 1 (root) tiene acceso implícito completo desde la aplicación.

INSERT INTO app_actions (module_code, action_code, code, label, description, is_active)
SELECT * FROM (
  SELECT 'cost-orders' AS module_code, 'create'   AS action_code, 'cost-orders.create'   AS code, 'Nueva orden'         AS label, 'Permite crear órdenes de costo' AS description, 1 AS is_active UNION ALL
  SELECT 'cost-orders', 'edit',     'cost-orders.edit',     'Editar orden',        'Permite editar una orden de costo', 1 UNION ALL
  SELECT 'cost-orders', 'anule',    'cost-orders.anule',    'Anular orden',        'Permite anular una orden de costo', 1 UNION ALL
  SELECT 'cost-orders', 'replace',  'cost-orders.replace',  'Reemplazar orden',    'Permite reemplazar una orden de costo', 1 UNION ALL
  SELECT 'cost-orders', 'add-obs',  'cost-orders.add-obs',  'Agregar observación', 'Permite agregar una observación final a la orden', 1 UNION ALL
  SELECT 'cost-orders', 'download', 'cost-orders.download', 'Descargar',           'Permite descargar la orden de costo', 1
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM app_actions a WHERE a.code = seed.code
);
