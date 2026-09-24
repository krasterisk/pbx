-- Existing provider rows, including cabinet-owned ones, join the superadmin catalog.
-- New cabinet connections created after this migration stay tenant-owned.

UPDATE cc_ai_providers
SET is_global = TRUE
WHERE is_global = FALSE;
