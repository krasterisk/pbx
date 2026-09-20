'use strict';

const assert = require('node:assert/strict');

const PROFILES = new Set(['full-pbx', 'analytics-api', 'robot-api']);
const DIALECTS = new Set(['mysql', 'postgres']);

function evaluateCommercialPreflight(env = process.env) {
  const missing = [];
  const dialect = env.DB_DIALECT;
  const profile = env.DB_SCHEMA_PROFILE;
  if (!DIALECTS.has(dialect)) missing.push('DB_DIALECT');
  if (!PROFILES.has(profile)) missing.push('DB_SCHEMA_PROFILE');
  if (!env.CC_AI_KEY_SECRET && env.NODE_ENV !== 'development') missing.push('CC_AI_KEY_SECRET');
  const commercial = profile === 'analytics-api' || profile === 'robot-api' || profile === 'full-pbx';
  if (commercial && env.AI_WORKERS_CONFIGURED !== '1' && !env.AI_PROCESS_ROLES) {
    missing.push('AI_WORKERS_CONFIGURED');
  }
  if (env.AI_LICENSE_PROFILE === 'offline' && env.AI_LICENSE_HEARTBEAT === '1') {
    missing.push('offline_heartbeat_forbidden');
  }
  if (env.AI_PUBLISHER_PRIVATE_KEY) {
    missing.push('publisher_private_key_must_not_be_in_customer_install');
  }
  return {
    ok: missing.length === 0,
    dialect: DIALECTS.has(dialect) ? dialect : null,
    profile: PROFILES.has(profile) ? profile : null,
    missing,
  };
}

if (require.main === module) {
  const result = evaluateCommercialPreflight(process.env);
  if (!result.ok) {
    console.error(JSON.stringify(result));
    process.exit(1);
  }
  console.log(JSON.stringify(result));
}

module.exports = { evaluateCommercialPreflight };
