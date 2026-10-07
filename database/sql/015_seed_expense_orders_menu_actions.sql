-- 015_seed_expense_orders_menu_actions.sql
-- Propósito: registrar menú y acciones administrables para Órdenes de gastos.
-- Script idempotente para MariaDB/MySQL. No altera tablas legacy.

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media', NULL, 'Medios', NULL, 'image', 40, 1
WHERE NOT EXISTS (SELECT 1 FROM app_menus WHERE code = 'media');

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media.expense-orders', parent.id, 'Órdenes de gastos', NULL, 'receipt', 15, 1
FROM app_menus AS parent
WHERE parent.code = 'media'
  AND NOT EXISTS (SELECT 1 FROM app_menus WHERE code = 'media.expense-orders');

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media.expense-orders.list', parent.id, 'Listar', '/medios/ordenes-gastos/listar', 'file', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'media.expense-orders'
  AND NOT EXISTS (SELECT 1 FROM app_menus WHERE code = 'media.expense-orders.list');

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media.expense-orders.approve-bulk', parent.id, 'Aprobar orden', '/medios/ordenes-gastos/aprobacion-masiva', 'upload', 20, 1
FROM app_menus AS parent
WHERE parent.code = 'media.expense-orders'
  AND NOT EXISTS (SELECT 1 FROM app_menus WHERE code = 'media.expense-orders.approve-bulk');

UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'media'
SET menu.parent_id = parent.id,
    menu.label = 'Órdenes de gastos',
    menu.route = NULL,
    menu.icon = 'receipt',
    menu.sort_order = 15,
    menu.is_active = 1
WHERE menu.code = 'media.expense-orders';

UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'media.expense-orders'
SET menu.parent_id = parent.id,
    menu.label = 'Listar',
    menu.route = '/medios/ordenes-gastos/listar',
    menu.icon = 'file',
    menu.sort_order = 10,
    menu.is_active = 1
WHERE menu.code = 'media.expense-orders.list';

UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'media.expense-orders'
SET menu.parent_id = parent.id,
    menu.label = 'Aprobar orden',
    menu.route = '/medios/ordenes-gastos/aprobacion-masiva',
    menu.icon = 'upload',
    menu.sort_order = 20,
    menu.is_active = 1
WHERE menu.code = 'media.expense-orders.approve-bulk';

INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
SELECT 33, menu.id, 1
FROM app_menus AS menu
WHERE menu.code IN ('media', 'media.expense-orders', 'media.expense-orders.list', 'media.expense-orders.approve-bulk')
  AND EXISTS (SELECT 1 FROM sys_roles WHERE id_roles = 33)
  AND NOT EXISTS (
    SELECT 1 FROM app_role_menu_permissions AS permission
    WHERE permission.role_id = 33 AND permission.menu_id = menu.id
  );

INSERT IGNORE INTO app_actions (module_code, action_code, code, label, description, is_active)
SELECT 'expense-orders', 'create', 'expense-orders.create', 'Nueva orden', 'Permite crear órdenes de gastos', 1 UNION ALL
SELECT 'expense-orders', 'edit', 'expense-orders.edit', 'Editar / ver anulación', 'Permite editar órdenes activas y ver órdenes anuladas', 1 UNION ALL
SELECT 'expense-orders', 'print', 'expense-orders.print', 'Imprimir', 'Permite imprimir órdenes de gastos', 1 UNION ALL
SELECT 'expense-orders', 'print-preview', 'expense-orders.print-preview', 'Vista previa', 'Permite previsualizar órdenes de gastos no aprobadas', 1 UNION ALL
SELECT 'expense-orders', 'approve', 'expense-orders.approve', 'Aprobar', 'Permite aprobar órdenes de gastos', 1 UNION ALL
SELECT 'expense-orders', 'anule', 'expense-orders.anule', 'Anular', 'Permite anular órdenes de gastos', 1 UNION ALL
SELECT 'expense-orders', 'recurrence', 'expense-orders.recurrence', 'Recurrencia', 'Permite agregar o quitar recurrencia en órdenes de gastos', 1 UNION ALL
SELECT 'expense-orders', 'approve-bulk', 'expense-orders.approve-bulk', 'Aprobación masiva', 'Reserva permiso para aprobación masiva por Excel', 1;

UPDATE app_actions
SET code = CONCAT('expense-orders.', action_code),
    label = CASE action_code
      WHEN 'create' THEN 'Nueva orden'
      WHEN 'edit' THEN 'Editar / ver anulación'
      WHEN 'print' THEN 'Imprimir'
      WHEN 'print-preview' THEN 'Vista previa'
      WHEN 'approve' THEN 'Aprobar'
      WHEN 'anule' THEN 'Anular'
      WHEN 'recurrence' THEN 'Recurrencia'
      WHEN 'approve-bulk' THEN 'Aprobación masiva'
      ELSE label
    END,
    description = CASE action_code
      WHEN 'create' THEN 'Permite crear órdenes de gastos'
      WHEN 'edit' THEN 'Permite editar órdenes activas y ver órdenes anuladas'
      WHEN 'print' THEN 'Permite imprimir órdenes de gastos'
      WHEN 'print-preview' THEN 'Permite previsualizar órdenes de gastos no aprobadas'
      WHEN 'approve' THEN 'Permite aprobar órdenes de gastos'
      WHEN 'anule' THEN 'Permite anular órdenes de gastos'
      WHEN 'recurrence' THEN 'Permite agregar o quitar recurrencia en órdenes de gastos'
      WHEN 'approve-bulk' THEN 'Reserva permiso para aprobación masiva por Excel'
      ELSE description
    END,
    is_active = 1
WHERE module_code = 'expense-orders'
  AND action_code IN ('create', 'edit', 'print', 'print-preview', 'approve', 'anule', 'recurrence', 'approve-bulk');
