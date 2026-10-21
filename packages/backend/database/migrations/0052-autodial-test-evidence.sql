-- Immutable admission context and bounded lifecycle for internal test calls.
ALTER TABLE ac_test_calls
  ADD COLUMN snapshot_json JSON NULL,
  ADD COLUMN result_json JSON NULL,
  ADD COLUMN deadline_at DATETIME NULL;
CREATE INDEX idx_ac_test_deadline ON ac_test_calls (cleanup_done, deadline_at);
