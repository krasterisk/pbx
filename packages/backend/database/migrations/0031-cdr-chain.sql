-- uniqueid identifies a channel; transfers may create several CDR records for it.
ALTER TABLE cdr
  DROP PRIMARY KEY,
  ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
  ADD KEY idx_cdr_uniqueid (uniqueid);

CREATE INDEX idx_cel_linkedid_eventtime ON cel (linkedid, eventtime, id);

CREATE TABLE ps_domain_aliases (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  domain VARCHAR(80) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
