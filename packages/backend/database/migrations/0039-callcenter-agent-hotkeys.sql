-- cc-ux U5.6: tenant-level agent workspace hotkeys. NULL = built-in default set. Additive only.
ALTER TABLE cc_settings ADD COLUMN agent_hotkeys JSON NULL;
