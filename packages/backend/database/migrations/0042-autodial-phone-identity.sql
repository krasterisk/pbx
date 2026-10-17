ALTER TABLE ac_contact_phones ADD COLUMN canonical_phone VARCHAR(64) NOT NULL DEFAULT '';
UPDATE ac_contact_phones SET canonical_phone = REGEXP_REPLACE(normalized, '[^0-9]', '');
UPDATE ac_contact_phones SET canonical_phone = CONCAT('7', SUBSTRING(canonical_phone, 2))
  WHERE CHAR_LENGTH(canonical_phone) = 11 AND LEFT(canonical_phone, 1) = '8';
CREATE INDEX idx_ac_phone_identity ON ac_contact_phones (canonical_phone, uid);
