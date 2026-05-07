-- =============================================================
-- Migration: 20_cloud_admin_tenants.sql
-- Description: Cloud Admin module — tenants table
-- =============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id              INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uid             VARCHAR(36)    NOT NULL UNIQUE COMMENT 'UUID кабинета',
  name            VARCHAR(255)   NOT NULL COMMENT 'Название организации',
  slug            VARCHAR(128)   DEFAULT NULL UNIQUE COMMENT 'Короткий идентификатор (subdomain)',

  -- Root-пользователь кабинета
  owner_user_id   INT            NOT NULL COMMENT 'FK → users.uniqueid (Tenant Admin)',

  -- Ключевое поле совместимости со всеми существующими модулями
  vpbx_user_uid   INT            NOT NULL UNIQUE COMMENT '= owner_user_id (совместимость с существующими модулями)',

  -- Статус и тарифный план
  status          ENUM('trial', 'active', 'suspended', 'cancelled') NOT NULL DEFAULT 'trial',
  trial_ends_at   DATETIME       DEFAULT NULL,

  -- Контакты
  email           VARCHAR(255)   DEFAULT NULL,
  phone           VARCHAR(32)    DEFAULT NULL,
  company_inn     VARCHAR(32)    DEFAULT NULL COMMENT 'ИНН организации',

  -- Лимиты ресурсов
  max_extensions  INT            NOT NULL DEFAULT 10,
  max_trunks      INT            NOT NULL DEFAULT 2,
  max_queues      INT            NOT NULL DEFAULT 3,

  -- Мета
  created_by      INT            DEFAULT NULL COMMENT 'FK → users.uniqueid (SuperAdmin, who created)',
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_tenants_status (status),
  INDEX idx_tenants_owner (owner_user_id),
  INDEX idx_tenants_vpbx (vpbx_user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
