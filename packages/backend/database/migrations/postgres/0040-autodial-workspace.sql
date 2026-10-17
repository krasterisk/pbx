ALTER TABLE ac_campaigns ADD COLUMN tour_no INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ac_tasks ADD COLUMN tour_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ac_attempts ADD COLUMN tour_no INTEGER NOT NULL DEFAULT 1;
CREATE TABLE ac_campaign_events (
  uid BIGSERIAL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  campaign_uid INTEGER NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  tour_no INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0,
  payload JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ac_events_campaign ON ac_campaign_events (vpbx_user_uid, campaign_uid, uid);
