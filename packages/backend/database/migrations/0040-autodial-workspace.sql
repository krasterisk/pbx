-- Autodial UX U1: explicit tours and an append-only campaign journal.
ALTER TABLE ac_campaigns ADD COLUMN tour_no INT NOT NULL DEFAULT 0;
ALTER TABLE ac_tasks ADD COLUMN tour_no INT NOT NULL DEFAULT 1;
ALTER TABLE ac_attempts ADD COLUMN tour_no INT NOT NULL DEFAULT 1;
CREATE TABLE ac_campaign_events (
  uid BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vpbx_user_uid INT NOT NULL,
  campaign_uid INT NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  tour_no INT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 0,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ac_events_campaign (vpbx_user_uid, campaign_uid, uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
