-- Platform prices: period billing on modules_registry + tenant snapshot.
-- price_monthly stays as a compatibility alias for month-period list prices.

ALTER TABLE modules_registry
  ADD COLUMN IF NOT EXISTS price_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_period VARCHAR(16) NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS billing_interval_count INTEGER NOT NULL DEFAULT 1;

UPDATE modules_registry
SET price_amount = price_monthly
WHERE price_amount = 0 AND price_monthly IS NOT NULL;

ALTER TABLE tenant_modules
  ADD COLUMN IF NOT EXISTS billing_period VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS billing_interval_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS list_price_amount DECIMAL(10,2) NULL;

UPDATE tenant_modules
SET billing_period = CASE billing_cycle::text
  WHEN 'yearly' THEN 'year'
  WHEN 'lifetime' THEN 'lifetime'
  ELSE 'month'
END
WHERE billing_period IS NULL;

UPDATE tenant_modules tm
SET
  list_price_amount = COALESCE(tm.list_price_amount, mr.price_amount),
  last_billed_at = COALESCE(tm.last_billed_at, tm.activated_at)
FROM modules_registry mr
WHERE mr.code = tm.module_code
  AND tm.status IN ('active', 'trial');

ALTER TABLE modules_registry
  ADD CONSTRAINT chk_modules_registry_period
    CHECK (billing_period IN ('hour','day','week','month','year','custom')),
  ADD CONSTRAINT chk_modules_registry_interval
    CHECK (billing_interval_count >= 1);

ALTER TABLE tenant_modules
  ADD CONSTRAINT chk_tenant_modules_period
    CHECK (billing_period IS NULL OR billing_period IN ('hour','day','week','month','year','custom','lifetime')),
  ADD CONSTRAINT chk_tenant_modules_interval
    CHECK (billing_interval_count >= 1);
