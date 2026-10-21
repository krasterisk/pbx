-- Existing campaigns retain unknown/custom intent; never infer a past goal.
ALTER TABLE ac_campaigns ADD COLUMN business_goal VARCHAR(32) NOT NULL DEFAULT 'custom';
