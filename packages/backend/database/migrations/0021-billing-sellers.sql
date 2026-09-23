-- Billing sellers directory + required tenant binding

CREATE TABLE IF NOT EXISTS billing_sellers (
  id INTEGER NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  inn VARCHAR(32) NULL,
  kpp VARCHAR(32) NULL,
  ogrn VARCHAR(32) NULL,
  address VARCHAR(512) NULL,
  bank_name VARCHAR(255) NULL,
  bank_bik VARCHAR(32) NULL,
  bank_account VARCHAR(64) NULL,
  corr_account VARCHAR(64) NULL,
  service_description VARCHAR(512) NULL,
  service_code VARCHAR(32) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_billing_sellers_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed one default seller from legacy cloud_settings keys (or a placeholder).
INSERT INTO billing_sellers (
  name, inn, kpp, ogrn, address,
  bank_name, bank_bik, bank_account, corr_account,
  service_description, service_code, is_default, created_at, updated_at
)
SELECT
  COALESCE(NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.seller.name' LIMIT 1), ''), 'Поставщик по умолчанию'),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.seller.inn' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.seller.kpp' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.seller.ogrn' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.seller.address' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.bank.name' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.bank.bik' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.bank.account' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.bank.corr_account' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.service.description' LIMIT 1), ''),
  NULLIF((SELECT `value` FROM cloud_settings WHERE `key` = 'billing.service.code' LIMIT 1), ''),
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM billing_sellers LIMIT 1);

ALTER TABLE tenants
  ADD COLUMN seller_id INTEGER NULL AFTER company_inn;

UPDATE tenants t
SET t.seller_id = (SELECT id FROM billing_sellers WHERE is_default = 1 ORDER BY id ASC LIMIT 1)
WHERE t.seller_id IS NULL;

ALTER TABLE tenants
  MODIFY COLUMN seller_id INTEGER NOT NULL,
  ADD CONSTRAINT fk_tenants_seller
    FOREIGN KEY (seller_id) REFERENCES billing_sellers (id);

DELETE FROM cloud_settings
WHERE `key` IN (
  'billing.seller.name',
  'billing.seller.inn',
  'billing.seller.kpp',
  'billing.seller.ogrn',
  'billing.seller.address',
  'billing.bank.name',
  'billing.bank.bik',
  'billing.bank.account',
  'billing.bank.corr_account',
  'billing.service.description',
  'billing.service.code'
);
