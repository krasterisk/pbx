-- Immutable admission context and bounded lifecycle for internal test calls.
ALTER TABLE ac_test_calls
  ADD COLUMN snapshot_json JSONB,
  ADD COLUMN result_json JSONB,
  ADD COLUMN deadline_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX idx_ac_test_deadline ON ac_test_calls (cleanup_done, deadline_at);
