-- Existing provider rows, including cabinet-owned ones, join the superadmin catalog.
-- New cabinet connections created after this migration stay tenant-owned.

UPDATE cc_ai_providers
SET is_global = 1
WHERE is_global = 0;
