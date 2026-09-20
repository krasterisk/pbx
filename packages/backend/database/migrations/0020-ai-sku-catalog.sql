CREATE TABLE ai_trial_policy_snapshots (
  id VARCHAR(36) NOT NULL,
  digest CHAR(64) NOT NULL,
  concurrent_jobs BIGINT NOT NULL,
  concurrent_sessions BIGINT NOT NULL,
  storage_bytes BIGINT NOT NULL,
  audio_ms BIGINT NOT NULL,
  provider_tokens BIGINT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_trial_policy_digest (digest),
  CONSTRAINT chk_ai_trial_policy_nonneg CHECK (
    concurrent_jobs >= 0 AND concurrent_sessions >= 0 AND storage_bytes >= 0
    AND audio_ms >= 0 AND provider_tokens >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_sku_revisions (
  id VARCHAR(36) NOT NULL,
  owner_tenant_uid INT NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  revision INT NOT NULL,
  product VARCHAR(64) NOT NULL,
  money_policy VARCHAR(32) NOT NULL,
  price_monthly_minor BIGINT NOT NULL,
  currency VARCHAR(8) NULL,
  trial_days INT NOT NULL,
  policy_snapshot_id VARCHAR(36) NOT NULL,
  usage_price_revision_id VARCHAR(36) NULL,
  config_digest CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_sku_rev_tenant (owner_tenant_uid, id),
  UNIQUE KEY uq_ai_sku_rev_no (owner_tenant_uid, sku_code, revision),
  CONSTRAINT chk_ai_sku_rev_product CHECK (product IN ('speech_analytics','ai_voice_robots')),
  CONSTRAINT chk_ai_sku_rev_policy CHECK (money_policy IN ('shadow','local_byok','cloud_wallet')),
  CONSTRAINT chk_ai_sku_rev_price CHECK (price_monthly_minor >= 0 AND trial_days >= 0 AND revision >= 1),
  CONSTRAINT fk_ai_sku_rev_policy FOREIGN KEY (policy_snapshot_id)
    REFERENCES ai_trial_policy_snapshots (id),
  CONSTRAINT fk_ai_sku_rev_usage_price FOREIGN KEY (usage_price_revision_id)
    REFERENCES ai_price_revisions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_sku_offers (
  owner_tenant_uid INT NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  product VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  current_revision_id VARCHAR(36) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (owner_tenant_uid, sku_code),
  CONSTRAINT chk_ai_sku_offer_status CHECK (status IN ('draft','published','revoked')),
  CONSTRAINT chk_ai_sku_offer_product CHECK (product IN ('speech_analytics','ai_voice_robots')),
  CONSTRAINT fk_ai_sku_offer_rev FOREIGN KEY (current_revision_id)
    REFERENCES ai_sku_revisions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_sku_entitlements (
  vpbx_user_uid INT NOT NULL,
  product VARCHAR(64) NOT NULL,
  sku_revision_id VARCHAR(36) NOT NULL,
  status VARCHAR(16) NOT NULL,
  trial_ends_at DATETIME(3) NULL,
  policy_digest CHAR(64) NOT NULL,
  purchased_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, product),
  UNIQUE KEY uq_ai_sku_entitlement_rev (vpbx_user_uid, sku_revision_id),
  CONSTRAINT chk_ai_sku_entitlement_status CHECK (status IN ('trial','active','expired')),
  CONSTRAINT chk_ai_sku_entitlement_product CHECK (product IN ('speech_analytics','ai_voice_robots')),
  CONSTRAINT fk_ai_sku_entitlement_rev FOREIGN KEY (sku_revision_id)
    REFERENCES ai_sku_revisions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
