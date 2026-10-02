-- MySQL equivalent of the Hub layout schema.
ALTER TABLE hub_modules
  MODIFY COLUMN kind ENUM('base', 'market', 'off') NOT NULL DEFAULT 'base';

CREATE TABLE IF NOT EXISTS tenant_hub_layout (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  hub_code VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_tenant_hub_layout (tenant_id, hub_code),
  CONSTRAINT fk_tenant_hub_layout_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_tenant_hub_layout_hub FOREIGN KEY (hub_code) REFERENCES hub_modules(code)
);

INSERT IGNORE INTO hub_modules (code, name, kind, sort_order, requires_cloud) VALUES
  ('overview', 'Overview', 'base', 0, 0),
  ('core', 'Core', 'base', 10, 0),
  ('apps', 'Apps', 'base', 20, 0),
  ('system', 'System', 'base', 30, 0),
  ('callcenter', 'Call Center', 'market', 40, 0),
  ('analytics', 'Analytics', 'market', 50, 0),
  ('ai', 'AI', 'market', 60, 0),
  ('autodial', 'Autodial', 'market', 70, 0),
  ('speech_analytics', 'Speech analytics', 'market', 80, 0),
  ('ai_voice_robots', 'AI robots', 'market', 90, 0);

INSERT IGNORE INTO hub_module_pages (hub_code, page_code, path, sort_order) VALUES
  ('overview', 'dashboard', '/', 0),
  ('core', 'endpoints', '/endpoints', 10),
  ('core', 'contexts', '/contexts', 20),
  ('core', 'trunks', '/trunks', 30),
  ('core', 'routes', '/routes', 40),
  ('core', 'time_groups', '/time-groups', 50),
  ('core', 'directories', '/directories', 60),
  ('core', 'provision', '/provision-templates', 70),
  ('apps', 'ivr', '/ivrs', 10),
  ('apps', 'queues', '/queues', 20),
  ('apps', 'prompts', '/prompts', 30),
  ('apps', 'moh', '/moh', 40),
  ('apps', 'voice_robot', '/voice-robots', 50),
  ('apps', 'call_groups', '/call-groups', 60),
  ('apps', 'conferences', '/conferences', 65),
  ('apps', 'integrations', '/integrations', 70),
  ('system', 'users_roles', '/users', 10),
  ('system', 'roles', '/roles', 20),
  ('system', 'numbers', '/numbers', 30),
  ('system', 'settings', '/settings', 40),
  ('system', 'tts_engines', '/settings/tts-engines', 50),
  ('system', 'stt_engines', '/settings/stt-engines', 60),
  ('system', 'audit_log', '/audit-log', 70),
  ('system', 'tenant_modules', '/my-modules', 80),
  ('system', 'ai_providers', '/ai-providers', 90),
  ('callcenter', 'cc_agent', '/callcenter/agent', 20),
  ('callcenter', 'cc_supervisor', '/callcenter/supervisor', 30),
  ('callcenter', 'cc_reports', '/callcenter/reports', 40),
  ('callcenter', 'cc_settings', '/callcenter/settings', 50),
  ('autodial', 'autodial_campaigns', '/autodial', 10),
  ('autodial', 'autodial_bases', '/autodial/bases', 20),
  ('autodial', 'autodial_monitor', '/autodial/monitor', 30),
  ('autodial', 'autodial_reports', '/autodial/reports', 40),
  ('analytics', 'reports', '/reports', 10),
  ('analytics', 'cdr', '/reports/cdr', 20),
  ('analytics', 'voice_robot_cdr', '/reports/voice-robot-cdr', 30),
  ('ai', 'ai_agents', '/ai-agents', 20),
  ('speech_analytics', 'speech_analytics_conversations', '/speech-analytics/conversations', 10),
  ('speech_analytics', 'speech_analytics_projects', '/speech-analytics/projects', 15),
  ('speech_analytics', 'speech_analytics_dashboard', '/speech-analytics/dashboard', 16),
  ('speech_analytics', 'speech_analytics_connections', '/speech-analytics/connections', 20),
  ('ai_voice_robots', 'ai_voice_robots_landing', '/ai-robots', 10),
  ('ai_voice_robots', 'ai_voice_robots_studio', '/ai-robots/studio', 12),
  ('ai_voice_robots', 'ai_voice_robots_sessions', '/ai-robots/sessions', 14),
  ('ai_voice_robots', 'ai_voice_robots_preview', '/ai-robots/preview', 16),
  ('ai_voice_robots', 'ai_voice_robots_sip', '/ai-robots/sip', 17),
  ('ai_voice_robots', 'ai_voice_robots_tools', '/ai-robots/tools', 18),
  ('ai_voice_robots', 'ai_voice_robots_knowledge', '/ai-robots/knowledge', 19),
  ('ai_voice_robots', 'ai_voice_robots_connections', '/ai-robots/connections', 20);

INSERT IGNORE INTO hub_module_pages (hub_code, page_code, path, sort_order)
VALUES ('core', 'route_templates', '/route-templates', 45);
