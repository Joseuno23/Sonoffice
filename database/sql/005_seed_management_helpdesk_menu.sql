-- 005_seed_management_helpdesk_menu.sql
-- Propósito: registrar en la BD el menú raíz "Gestión" y su submenú "Mesa de ayuda",
-- para que dejen de estar quemados en el frontend y puedan administrarse desde /system/menus.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy. Solo inserta filas en app_menus / app_role_menu_permissions.
-- - Idempotente: se puede ejecutar varias veces sin duplicar.

-- Menú raíz: Gestión (contenedor, sin ruta propia).
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'management', NULL, 'Gestión', NULL, 'shield', 50, 1
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = 'management'
);

-- Submenú: Mesa de ayuda dentro de Gestión.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'management.helpdesk', parent.id, 'Mesa de ayuda', '/helpdesk', 'mail', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'management'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'management.helpdesk'
  );

-- Permisos de visibilidad para el rol 33 (mismo criterio que ya tiene sobre Sistema).
-- El rol 1 (root) NO requiere filas: ve todos los menús activos de forma implícita.
INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
SELECT 33, menu.id, 1
FROM app_menus AS menu
WHERE menu.code IN ('management', 'management.helpdesk')
  AND EXISTS (
    SELECT 1 FROM sys_roles WHERE id_roles = 33
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_role_menu_permissions AS permission
    WHERE permission.role_id = 33
      AND permission.menu_id = menu.id
  );
