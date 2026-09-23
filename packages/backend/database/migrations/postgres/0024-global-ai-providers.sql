-- Global model catalog shares cc_ai_providers with tenant connections.
ALTER TABLE cc_ai_providers
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;
