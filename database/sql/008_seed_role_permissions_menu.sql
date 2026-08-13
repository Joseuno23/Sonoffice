-- 008_seed_role_permissions_menu.sql
-- Propósito: registrar el submenú "Permisos" dentro de Sistema para acceder a la
-- pantalla unificada de asignación de permisos (vistas + acciones) por rol.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy. Idempotente.

INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'system.permissions', parent.id, 'Permisos', '/system/roles/permissions', 'shield', 5, 1
FROM app_menus AS parent
WHERE parent.code = 'system'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'system.permissions'
  );
