-- A channel may generate multiple CDR segments (for example, after a transfer).
-- uniqueid identifies the channel, not an individual CDR row.
CREATE SEQUENCE cdr_id_seq;
ALTER TABLE cdr ADD COLUMN id BIGINT NOT NULL DEFAULT nextval('cdr_id_seq');
ALTER SEQUENCE cdr_id_seq OWNED BY cdr.id;
ALTER TABLE cdr DROP CONSTRAINT cdr_pkey;
ALTER TABLE cdr ADD CONSTRAINT cdr_pkey PRIMARY KEY (id);
CREATE INDEX idx_cdr_uniqueid ON cdr (uniqueid);

-- CEL supplies the event-level history (including blind/attended transfers).
CREATE INDEX idx_cel_linkedid_eventtime ON cel (linkedid, eventtime, id);

-- sorcery.conf maps domain_alias to this realtime table. An empty table is valid.
CREATE TABLE ps_domain_aliases (
  id VARCHAR(80) PRIMARY KEY,
  domain VARCHAR(80) NOT NULL DEFAULT ''
);
