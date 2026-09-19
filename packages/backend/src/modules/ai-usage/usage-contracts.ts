/** D4 owns these tables. D1 must not create a second ledger. */
export const D4_USAGE_TABLES = [
  'ai_quota_counters',
  'ai_usage_reservations',
  'ai_usage_events',
  'ai_price_revisions',
  'ai_usage_ledger',
] as const;

export const D1_JOB_ASSET_TABLES = [
  'ai_provider_revisions',
  'ai_media_assets',
  'ai_uploads',
  'ai_jobs',
  'ai_job_stages',
  'ai_provider_operations',
  'ai_outbox',
  'ai_idempotency',
  'ai_job_events',
] as const;
