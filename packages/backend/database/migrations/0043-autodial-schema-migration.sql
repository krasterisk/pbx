ALTER TABLE ac_base_fields ADD COLUMN format JSON NULL;
CREATE TABLE ac_field_archive (
  uid BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vpbx_user_uid INT NOT NULL,
  base_uid INT NOT NULL,
  contact_uid INT NOT NULL,
  field_uid INT NOT NULL,
  base_revision INT NOT NULL,
  actor_uid INT NULL,
  field_snapshot JSON NOT NULL,
  archived_value JSON NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_ac_archive_base (vpbx_user_uid, base_uid, contact_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
