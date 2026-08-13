-- 001_create_app_menus.sql
-- Propósito: preparar tablas propias de la nueva aplicación para administrar menús
-- jerárquicos y permisos por rol legacy, sin modificar las tablas legacy existentes.
--
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No elimina ni altera tablas legacy como sys_menu o sys_roles.
-- - Se omiten llaves foráneas por ahora para reducir riesgo sobre la base legacy.
--   La integridad se apoya inicialmente en índices y validaciones de aplicación.

CREATE TABLE IF NOT EXISTS app_menus (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  label VARCHAR(150) NOT NULL,
  route VARCHAR(255) NULL,
  icon VARCHAR(100) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_menus_code (code),
  KEY idx_app_menus_parent_id (parent_id),
  KEY idx_app_menus_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_role_menu_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id INT NOT NULL,
  menu_id BIGINT UNSIGNED NOT NULL,
  can_view TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_role_menu_permissions_role_menu (role_id, menu_id),
  KEY idx_app_role_menu_permissions_role_id (role_id),
  KEY idx_app_role_menu_permissions_menu_id (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Menú inicial: contenedor principal del módulo de sistema.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'system', NULL, 'Sistema', NULL, 'settings', 100, 1
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = 'system'
);

-- Menú inicial: ruta para administrar menús dentro de Sistema.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'system.menus', parent.id, 'Menús', '/system/menus', 'menu', 10, 1
FROM app_menus AS parent
WHERE parent.code = 'system'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'system.menus'
  );

-- Permiso inicial seguro para rol 1 solo si existe en la tabla legacy sys_roles.
-- No se asume que todos los ambientes tengan este rol.
INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
SELECT 1, menu.id, 1
FROM app_menus AS menu
WHERE menu.code IN ('system', 'system.menus')
  AND EXISTS (
    SELECT 1 FROM sys_roles WHERE id_roles = 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_role_menu_permissions AS permission
    WHERE permission.role_id = 1
      AND permission.menu_id = menu.id
  );
