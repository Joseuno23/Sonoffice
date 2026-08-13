-- 006_seed_media_cost_orders_menu.sql
-- Propósito: registrar el menú raíz "Medios" con el submódulo "Órdenes de costo"
-- y su opción "Listar" (tabla), para iniciar la migración del módulo Órdenes de costo.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy. Solo inserta filas en app_menus / app_role_menu_permissions.
-- - Idempotente: se puede ejecutar varias veces sin duplicar.

-- Menú raíz: Medios (contenedor, sin ruta propia).
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media', NULL, 'Medios', NULL, 'image', 40, 1
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = 'media'
);

-- Submódulo: Órdenes de costo dentro de Medios (contenedor, sin ruta propia; agrupa opciones).
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media.cost-orders', parent.id, 'Órdenes de costo', NULL, 'receipt', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'media'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'media.cost-orders'
  );

-- Opción: Listar (tabla de órdenes de costo).
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media.cost-orders.list', parent.id, 'Listar', '/medios/ordenes-costo/listar', 'file', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'media.cost-orders'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'media.cost-orders.list'
  );

-- Permisos de visibilidad para el rol 33 (mismo criterio que ya tiene sobre Sistema/Gestión).
-- El rol 1 (root) NO requiere filas: ve todos los menús activos de forma implícita.
INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
SELECT 33, menu.id, 1
FROM app_menus AS menu
WHERE menu.code IN ('media', 'media.cost-orders', 'media.cost-orders.list')
  AND EXISTS (
    SELECT 1 FROM sys_roles WHERE id_roles = 33
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_role_menu_permissions AS permission
    WHERE permission.role_id = 33
      AND permission.menu_id = menu.id
  );
