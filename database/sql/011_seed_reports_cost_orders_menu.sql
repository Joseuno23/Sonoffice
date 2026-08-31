-- 011_seed_reports_cost_orders_menu.sql
-- Propósito: registrar el menú raíz "Reportes", el contenedor "Órdenes de Costo"
-- y los reportes "General" y "Compensación".
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy. Solo inserta filas en app_menus / app_role_menu_permissions.
-- - Idempotente: se puede ejecutar varias veces sin duplicar.

-- Menú raíz: Reportes (contenedor, sin ruta propia).
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'reports', NULL, 'Reportes', NULL, 'file', 50, 1
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = 'reports'
);

-- Contenedor: Órdenes de Costo (sin ruta propia).
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'reports.cost-orders', parent.id, 'Órdenes de Costo', NULL, 'receipt', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'reports'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'reports.cost-orders'
  );

-- Compatibilidad/idempotencia: si el seed anterior ya creó Órdenes de Costo como
-- ítem navegable, convertirlo en contenedor y asegurar su padre correcto.
UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'reports'
SET menu.parent_id = parent.id,
    menu.label = 'Órdenes de Costo',
    menu.route = NULL,
    menu.icon = 'receipt',
    menu.sort_order = 10,
    menu.is_active = 1
WHERE menu.code = 'reports.cost-orders';

-- Reporte: General dentro de Órdenes de Costo.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'reports.cost-orders.general', parent.id, 'General', '/reportes/ordenes-costo/general', 'file', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'reports.cost-orders'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'reports.cost-orders.general'
  );

-- Compatibilidad/idempotencia: asegurar que General apunte siempre a la ruta nueva.
UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'reports.cost-orders'
SET menu.parent_id = parent.id,
    menu.label = 'General',
    menu.route = '/reportes/ordenes-costo/general',
    menu.icon = 'file',
    menu.sort_order = 10,
    menu.is_active = 1
WHERE menu.code = 'reports.cost-orders.general';

-- Reporte: Compensación dentro de Órdenes de Costo.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'reports.cost-orders.compensation', parent.id, 'Compensación', '/reportes/ordenes-costo/compensacion', 'file', 20, 1
FROM app_menus AS parent
WHERE parent.code = 'reports.cost-orders'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'reports.cost-orders.compensation'
  );

-- Compatibilidad/idempotencia: asegurar que Compensación quede bajo el contenedor correcto.
UPDATE app_menus AS menu
JOIN app_menus AS parent ON parent.code = 'reports.cost-orders'
SET menu.parent_id = parent.id,
    menu.label = 'Compensación',
    menu.route = '/reportes/ordenes-costo/compensacion',
    menu.icon = 'file',
    menu.sort_order = 20,
    menu.is_active = 1
WHERE menu.code = 'reports.cost-orders.compensation';

-- Permisos de visibilidad para el rol 33 (mismo criterio de los módulos operativos existentes).
-- El rol 1 (root) NO requiere filas: ve todos los menús activos de forma implícita.
INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
SELECT 33, menu.id, 1
FROM app_menus AS menu
WHERE menu.code IN ('reports', 'reports.cost-orders', 'reports.cost-orders.general', 'reports.cost-orders.compensation')
  AND EXISTS (
    SELECT 1 FROM sys_roles WHERE id_roles = 33
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_role_menu_permissions AS permission
    WHERE permission.role_id = 33
      AND permission.menu_id = menu.id
  );
