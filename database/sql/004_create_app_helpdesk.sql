-- 004_create_app_helpdesk.sql
-- Propósito: crear tablas propias para Mesa de ayuda sin modificar sys_tickets ni Erp.
-- IMPORTANTE: script no destructivo para MariaDB/MySQL. No ejecutar sin aprobación explícita.

CREATE TABLE IF NOT EXISTS app_helpdesk_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  creator_user_id INT NOT NULL,
  description TEXT NOT NULL,
  attachment_filename VARCHAR(255) NULL,
  attachment_original_name VARCHAR(255) NULL,
  attachment_mime VARCHAR(120) NULL,
  attachment_size BIGINT UNSIGNED NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  service_type VARCHAR(150) NULL,
  service_detail VARCHAR(255) NULL,
  admin_observations TEXT NULL,
  resolved_by INT NULL,
  resolved_at DATETIME NULL,
  rating TINYINT UNSIGNED NULL,
  rated_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_app_helpdesk_creator_status (creator_user_id, status),
  KEY idx_app_helpdesk_status (status),
  KEY idx_app_helpdesk_resolved_unrated (creator_user_id, status, rating),
  KEY idx_app_helpdesk_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
