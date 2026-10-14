-- Reconcile legacy CEL without changing existing columns or events.
ALTER TABLE cel ADD COLUMN IF NOT EXISTS extra VARCHAR(512) NULL;
