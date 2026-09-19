'use strict';
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');

/** Grant CLOUD tenant_modules + ai_product_activation for a seeded CI tenant. */
async function entitleCloudProduct(config, { slug, product }) {
  if (!['speech_analytics', 'ai_voice_robots'].includes(product)) {
    throw new Error(`unknown AI product ${product}`);
  }
  const db = await connectAdapter(config);
  const postgres = config.dialect === 'postgres';
  try {
    const tenants = await db.query(
      postgres
        ? 'SELECT id, vpbx_user_uid FROM tenants WHERE slug = $1'
        : 'SELECT id, vpbx_user_uid FROM tenants WHERE slug = ?',
      [slug],
    );
    const tenant = tenants[0];
    if (!tenant) throw new Error(`CI tenant ${slug} is missing`);
    const grants = await db.query(
      postgres
        ? 'SELECT id FROM tenant_modules WHERE tenant_id = $1 AND module_code = $2'
        : 'SELECT id FROM tenant_modules WHERE tenant_id = ? AND module_code = ?',
      [tenant.id, product],
    );
    if (!grants.length) {
      await db.query(
        postgres
          ? `INSERT INTO tenant_modules (tenant_id, module_code, status, activated_at, billing_cycle)
             VALUES ($1, $2, 'active', NOW(), 'monthly')`
          : `INSERT INTO tenant_modules (tenant_id, module_code, status, activated_at, billing_cycle)
             VALUES (?, ?, 'active', NOW(), 'monthly')`,
        [tenant.id, product],
      );
    }
    const activations = await db.query(
      postgres
        ? 'SELECT enabled FROM ai_product_activation WHERE vpbx_user_uid = $1 AND product = $2'
        : 'SELECT enabled FROM ai_product_activation WHERE vpbx_user_uid = ? AND product = ?',
      [tenant.vpbx_user_uid, product],
    );
    const now = new Date();
    if (!activations.length) {
      await db.query(
        postgres
          ? `INSERT INTO ai_product_activation
             (vpbx_user_uid, product, enabled, revision, actor_user_id, updated_at)
             VALUES ($1, $2, TRUE, 1, $1, $3)`
          : `INSERT INTO ai_product_activation
             (vpbx_user_uid, product, enabled, revision, actor_user_id, updated_at)
             VALUES (?, ?, 1, 1, ?, ?)`,
        postgres
          ? [tenant.vpbx_user_uid, product, now]
          : [tenant.vpbx_user_uid, product, tenant.vpbx_user_uid, now],
      );
    } else {
      await db.query(
        postgres
          ? `UPDATE ai_product_activation SET enabled = TRUE, updated_at = $3
             WHERE vpbx_user_uid = $1 AND product = $2`
          : `UPDATE ai_product_activation SET enabled = 1, updated_at = ?
             WHERE vpbx_user_uid = ? AND product = ?`,
        postgres
          ? [tenant.vpbx_user_uid, product, now]
          : [now, tenant.vpbx_user_uid, product],
      );
    }
    return { tenantId: tenant.id, tenantUid: tenant.vpbx_user_uid, product };
  } finally {
    await db.close();
  }
}

module.exports = { entitleCloudProduct };
