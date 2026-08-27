-- 010_seed_cost_orders_compensate.sql
-- Propósito: registrar el submódulo "Compensar costos" y su permiso de acción.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - Idempotente. No asigna permisos a roles: el administrador principal ve todo por acceso implícito
--   y los demás roles se configuran desde Sistema > Roles/Permisos.

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media.cost-orders.compensate', parent.id, 'Compensar costos', '/medios/ordenes-costo/compensar', 'shuffle', 20, 1
FROM app_menus AS parent
WHERE parent.code = 'media.cost-orders'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'media.cost-orders.compensate'
  );

INSERT INTO app_actions (module_code, action_code, code, label, description, is_active)
SELECT 'cost-orders', 'compensate', 'cost-orders.compensate', 'Compensar costos', 'Permite asociar detalles existentes de órdenes de costo contra presupuestos', 1
WHERE NOT EXISTS (
  SELECT 1 FROM app_actions WHERE code = 'cost-orders.compensate'
);
