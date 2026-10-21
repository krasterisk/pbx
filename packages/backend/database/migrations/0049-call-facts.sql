-- Extension of the existing dashboard logical-call projection, not a second call counter.
CREATE TABLE call_facts (
  call_key CHAR(64) NOT NULL PRIMARY KEY,
  tenant BIGINT NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  caller_number VARCHAR(128) NOT NULL,
  recipient_number VARCHAR(128) NOT NULL,
  company_number VARCHAR(128) NOT NULL,
  search_text TEXT NOT NULL,
  handling TEXT NOT NULL,
  departments TEXT NOT NULL,
  has_voicemail INTEGER NOT NULL DEFAULT 0,
  analytics_state VARCHAR(16) NOT NULL DEFAULT 'none',
  connected_sec INTEGER NULL,
  timing_source VARCHAR(8) NULL,
  payload MEDIUMTEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  CONSTRAINT fk_call_facts_call FOREIGN KEY (call_key) REFERENCES dashboard_calls(call_key) ON DELETE CASCADE
);
CREATE INDEX idx_call_facts_outcome ON call_facts (tenant, outcome, call_key);
CREATE INDEX idx_call_facts_caller ON call_facts (tenant, caller_number, call_key);
CREATE INDEX idx_call_facts_recipient ON call_facts (tenant, recipient_number, call_key);
