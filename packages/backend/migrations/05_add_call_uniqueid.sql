ALTER TABLE voice_robot_logs ADD COLUMN call_uniqueid VARCHAR(128) DEFAULT NULL AFTER robot_id;
