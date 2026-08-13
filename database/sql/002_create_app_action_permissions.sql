-- 002_create_app_action_permissions.sql
-- Propósito: preparar tablas propias de la nueva aplicación para administrar
-- permisos de acciones/botones por rol, sin modificar las tablas legacy existentes.
--
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No elimina ni altera tablas legacy como sys_button o sys_roles_button.
-- - No inserta acciones del módulo Sistema: por ahora solo root administra Sistema
--   y el rol 1 conserva acceso completo implícito desde la aplicación.
-- - Se omiten llaves foráneas por ahora para reducir riesgo sobre la base legacy,
--   consistente con app_menus. La integridad se apoya inicialmente en índices y
--   validaciones de aplicación.

CREATE TABLE IF NOT EXISTS app_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_code VARCHAR(100) NOT NULL,
  action_code VARCHAR(100) NOT NULL,
  code VARCHAR(220) NOT NULL,
  label VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_actions_code (code),
  UNIQUE KEY uq_app_actions_module_action (module_code, action_code),
  KEY idx_app_actions_module_code (module_code),
  KEY idx_app_actions_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_role_action_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id INT NOT NULL,
  action_id BIGINT UNSIGNED NOT NULL,
  can_execute TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_role_action_permissions_role_action (role_id, action_id),
  KEY idx_app_role_action_permissions_role_id (role_id),
  KEY idx_app_role_action_permissions_action_id (action_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ejemplo futuro, no ejecutar como seed real:
-- INSERT INTO app_actions (module_code, action_code, code, label, description)
-- SELECT 'ventas', 'crear', 'ventas.crear', 'Crear venta', 'Permite crear ventas'
-- WHERE NOT EXISTS (SELECT 1 FROM app_actions WHERE code = 'ventas.crear');
