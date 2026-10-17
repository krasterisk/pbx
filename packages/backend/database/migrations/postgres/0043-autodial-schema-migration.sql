ALTER TABLE ac_base_fields ADD COLUMN format JSONB;
CREATE TABLE ac_field_archive (
  uid BIGSERIAL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  base_uid INTEGER NOT NULL,
  contact_uid INTEGER NOT NULL,
  field_uid INTEGER NOT NULL,
  base_revision INTEGER NOT NULL,
  actor_uid INTEGER,
  field_snapshot JSONB NOT NULL,
  archived_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_ac_archive_base ON ac_field_archive (vpbx_user_uid, base_uid, contact_uid);
