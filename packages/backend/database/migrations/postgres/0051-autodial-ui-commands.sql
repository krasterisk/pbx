-- Durable identities for browser create commands, atomically committed with their resource.
CREATE TABLE ac_ui_commands (
  vpbx_user_uid INT NOT NULL,
  actor_uid INT NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  operation VARCHAR(32) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  resource_uid INT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  PRIMARY KEY (vpbx_user_uid, actor_uid, request_id)
);
