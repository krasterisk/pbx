-- Indexed historical dimensions belonging to the existing logical-call projection.
CREATE TABLE call_dimensions (
  call_key CHAR(64) NOT NULL,
  tenant BIGINT NOT NULL,
  kind VARCHAR(16) NOT NULL,
  value VARCHAR(128) NOT NULL,
  label VARCHAR(255) NOT NULL,
  search_label VARCHAR(255) NOT NULL,
  PRIMARY KEY (call_key,kind,value),
  CONSTRAINT fk_call_dimensions_call FOREIGN KEY (call_key) REFERENCES call_facts(call_key) ON DELETE CASCADE
);
CREATE INDEX idx_call_dimensions_filter ON call_dimensions (tenant,kind,value,call_key);
