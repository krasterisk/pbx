CREATE UNIQUE INDEX uq_cc_queue_call_tenant_id ON cc_queue_calls (vpbx_user_uid, call_uniqueid);
CREATE UNIQUE INDEX uq_cc_daily_queue_tenant_day_name ON cc_daily_queue_stats (vpbx_user_uid, stat_date, queue_name);
CREATE UNIQUE INDEX uq_cc_daily_agent_tenant_day_iface ON cc_daily_agent_stats (vpbx_user_uid, stat_date, agent_interface);
