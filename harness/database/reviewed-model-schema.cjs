'use strict';
// Reviewed drift since immutable 0001; SQL ownership through 0055 (business_goal 0053, phone_sessions 0055).
// 0036-0039 own call-center offers, interval stats, hotkeys and daily metric columns.
// 0040-0043 own autodial tour numbers, phone identity and field format.
// Context VIRTUAL metadata remains fingerprinted but requires no DDL.
module.exports = {
  "modelMetadataSha256": "29d62d84cf348a759e76594cd71d8635c0ccc272096c86bfbfe89f259049bb95",
  "extraTables": [
    "ac_channel_reservations",
    "billing_sellers",
    "cc_agent_offers",
    "cc_interval_queue_stats",
    "phone_sessions",
    "sa_insights_cache",
    "sa_insights_requests",
    "support_plans",
    "tenant_hub_layout"
  ],
  "extraColumns": [
    "ac_attempts.tour_no",
    "ac_base_fields.format",
    "ac_campaigns.applied_revision",
    "ac_campaigns.apply_error",
    "ac_campaigns.business_goal",
    "ac_campaigns.pacer_heartbeat_at",
    "ac_campaigns.pacer_owner",
    "ac_campaigns.tour_no",
    "ac_contact_phones.canonical_phone",
    "ac_tasks.tour_no",
    "cc_ai_providers.is_global",
    "cc_daily_queue_stats.rollup_version",
    "cc_daily_queue_stats.short_abandoned_calls",
    "cc_daily_queue_stats.sla_threshold_sec",
    "cc_daily_queue_stats.total_hold_sec",
    "cc_daily_queue_stats.total_wait_sec",
    "cc_daily_queue_stats.total_wrapup_sec",
    "cc_daily_queue_stats.transferred_calls",
    "cc_settings.agent_hotkeys",
    "cc_settings.short_abandon_sec",
    "cdr.id",
    "modules_registry.billing_interval_count",
    "modules_registry.billing_period",
    "modules_registry.price_amount",
    "tenant_modules.billing_interval_count",
    "tenant_modules.billing_period",
    "tenant_modules.list_price_amount",
    "tenants.max_concurrent_calls",
    "tenants.plan_expires_at",
    "tenants.plan_name",
    "tenants.sa_llm_provider_uid",
    "tenants.sa_own_models",
    "tenants.sa_project_model_override",
    "tenants.sa_stt_provider_uid",
    "tenants.seller_id",
    "tenants.timezone"
  ],
  "removedColumns": [
    "cc_ai_providers.pricing"
  ],
  "typeDifferences": [
    "hub_modules.kind: model=ENUM('base','market','off') baseline=ENUM('base','market')"
  ]
};
