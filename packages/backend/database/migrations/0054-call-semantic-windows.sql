-- Derived vectors only. Source text and permissions remain in CDR/speech analytics.
CREATE TABLE call_semantic_windows (
  id CHAR(64) NOT NULL PRIMARY KEY,
  tenant INTEGER NOT NULL,
  call_key CHAR(64) NOT NULL,
  run_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  transcript_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  segment_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  content_hash CHAR(64) NOT NULL,
  profile VARCHAR(96) NOT NULL,
  dimension INTEGER NOT NULL,
  vector_ref TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT fk_call_semantic_call FOREIGN KEY (call_key) REFERENCES call_facts(call_key) ON DELETE CASCADE,
  CONSTRAINT fk_call_semantic_run FOREIGN KEY (tenant,run_id) REFERENCES sa_analysis_runs(vpbx_user_uid,id) ON DELETE CASCADE,
  CONSTRAINT fk_call_semantic_transcript FOREIGN KEY (tenant,transcript_id) REFERENCES sa_transcripts(vpbx_user_uid,id) ON DELETE CASCADE,
  CONSTRAINT fk_call_semantic_segment FOREIGN KEY (tenant,segment_id) REFERENCES sa_transcript_segments(vpbx_user_uid,id) ON DELETE CASCADE,
  CONSTRAINT chk_call_semantic_dimension CHECK (dimension > 0 AND dimension <= 4096)
);
CREATE INDEX idx_call_semantic_revision ON call_semantic_windows (tenant,call_key,run_id,profile,dimension);
