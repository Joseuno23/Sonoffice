-- 016_seed_reports_expense_orders_menu.sql
-- Propósito: registrar Reportes > Órdenes de gasto > General.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy. Solo inserta filas en app_menus / app_role_menu_permissions.
-- - Idempotente: se puede ejecutar varias veces sin duplicar.

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'reports', NULL, 'Reportes', NULL, 'file', 50, 1
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = 'reports'
);

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'reports.expense-orders', parent.id, 'Órdenes de gasto', NULL, 'receipt', 20, 1
FROM app_menus AS parent
WHERE parent.code = 'reports'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'reports.expense-orders'
  );

UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'reports'
SET menu.parent_id = parent.id,
    menu.label = 'Órdenes de gasto',
    menu.route = NULL,
    menu.icon = 'receipt',
    menu.sort_order = 20,
    menu.is_active = 1
WHERE menu.code = 'reports.expense-orders';

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'reports.expense-orders.general', parent.id, 'General', '/reportes/ordenes-gasto/general', 'file', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'reports.expense-orders'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'reports.expense-orders.general'
  );

UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'reports.expense-orders'
SET menu.parent_id = parent.id,
    menu.label = 'General',
    menu.route = '/reportes/ordenes-gasto/general',
    menu.icon = 'file',
    menu.sort_order = 10,
    menu.is_active = 1
WHERE menu.code = 'reports.expense-orders.general';

-- Permisos de visibilidad para el rol 33, siguiendo el patrón de reportes de Órdenes de Costo.
-- El rol 1 (root) NO requiere filas: ve todos los menús activos de forma implícita.
INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
SELECT 33, menu.id, 1
FROM app_menus AS menu
WHERE menu.code IN ('reports', 'reports.expense-orders', 'reports.expense-orders.general')
  AND EXISTS (
    SELECT 1 FROM sys_roles WHERE id_roles = 33
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_role_menu_permissions AS permission
    WHERE permission.role_id = 33
      AND permission.menu_id = menu.id
  );
