'use strict';
// Reviewed model drift since immutable 0001: autodial runtime provisioning;
// migrations 0021/0022 billing, 0024/0027 providers, 0028 tenant models,
// 0029 insights cache, 0030 Hub layout, 0031 CDR identity.
module.exports = {
  modelMetadataSha256: '459c9cbd1fd2723747ed8a9615b827ab9e7c539629b581e081f352bc665985ec',
  extraTables: ['ac_channel_reservations', 'billing_sellers', 'sa_insights_cache', 'sa_insights_requests', 'tenant_hub_layout'],
  extraColumns: ['ac_campaigns.applied_revision', 'ac_campaigns.apply_error', 'ac_campaigns.pacer_heartbeat_at', 'ac_campaigns.pacer_owner', 'cc_ai_providers.is_global', 'cdr.id', 'modules_registry.billing_interval_count', 'modules_registry.billing_period', 'modules_registry.price_amount', 'tenant_modules.billing_interval_count', 'tenant_modules.billing_period', 'tenant_modules.list_price_amount', 'tenants.sa_llm_provider_uid', 'tenants.sa_own_models', 'tenants.sa_project_model_override', 'tenants.sa_stt_provider_uid', 'tenants.seller_id'],
  removedColumns: ['cc_ai_providers.pricing'],
  typeDifferences: ["hub_modules.kind: model=ENUM('base','market','off') baseline=ENUM('base','market')"],
};
