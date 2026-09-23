-- Billing sellers directory + required tenant binding

CREATE TABLE IF NOT EXISTS billing_sellers (
  id SERIAL PRIMARY KEY,
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
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_sellers_default ON billing_sellers (is_default);

INSERT INTO billing_sellers (
  name, inn, kpp, ogrn, address,
  bank_name, bank_bik, bank_account, corr_account,
  service_description, service_code, is_default, created_at, updated_at
)
SELECT
  COALESCE(NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.seller.name' LIMIT 1), ''), 'Поставщик по умолчанию'),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.seller.inn' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.seller.kpp' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.seller.ogrn' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.seller.address' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.bank.name' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.bank.bik' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.bank.account' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.bank.corr_account' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.service.description' LIMIT 1), ''),
  NULLIF((SELECT value FROM cloud_settings WHERE key = 'billing.service.code' LIMIT 1), ''),
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM billing_sellers LIMIT 1);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS seller_id INTEGER NULL;

UPDATE tenants t
SET seller_id = (SELECT id FROM billing_sellers WHERE is_default = TRUE ORDER BY id ASC LIMIT 1)
WHERE seller_id IS NULL;

ALTER TABLE tenants ALTER COLUMN seller_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenants_seller'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT fk_tenants_seller
      FOREIGN KEY (seller_id) REFERENCES billing_sellers (id);
  END IF;
END $$;

DELETE FROM cloud_settings
WHERE key IN (
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
