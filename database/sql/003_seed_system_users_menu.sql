-- 003_seed_system_users_menu.sql
-- Propósito: agregar el submenú Usuarios dentro de Sistema para la nueva aplicación.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy ni modifica permisos; el rol root conserva acceso implícito desde la aplicación.

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'system.users', parent.id, 'Usuarios', '/system/users', 'users', 30, 1
FROM app_menus AS parent
WHERE parent.code = 'system'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'system.users'
  );
