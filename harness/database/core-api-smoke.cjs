'use strict';
// Run only against the disposable DB-02 core profile after migration and seed.
const assert = require('node:assert/strict');

async function main(input = process.env) {
  if (input.CI !== 'true' || input.DB_CORE_TEST_PROFILE !== 'true' || !input.CI_SEED_PASSWORD) {
    throw new Error('Core API smoke requires CI=true, DB_CORE_TEST_PROFILE=true and CI_SEED_PASSWORD');
  }
  const base = input.CORE_API_URL || 'http://127.0.0.1:55001/api';
  async function request(path, method = 'GET', token, body) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    return { status: response.status, data };
  }
  const login = async name => {
    const response = await request('/auth/login', 'POST', undefined, { login: name, password: input.CI_SEED_PASSWORD });
    assert.equal(response.status, 200, `${name}: ${JSON.stringify(response.data)}`);
    assert.ok(response.data.accessToken && response.data.refreshToken);
    return response.data;
  };
  const [admin, tenantA, tenantB] = await Promise.all(['admin', 'ci-tenant-a', 'ci-tenant-b'].map(login));
  assert.equal(admin.user.vpbx_user_uid, 0);
  assert.notEqual(tenantA.user.vpbx_user_uid, tenantB.user.vpbx_user_uid);
  const foldedLogin = await request('/auth/login', 'POST', undefined, {
    login: 'CI-TENANT-A', password: input.CI_SEED_PASSWORD,
  });
  assert.equal(foldedLogin.status, 200, JSON.stringify(foldedLogin.data));
  assert.equal(foldedLogin.data.user.vpbx_user_uid, tenantA.user.vpbx_user_uid);
  const refresh = await request('/auth/refresh', 'POST', undefined, { refreshToken: tenantA.refreshToken });
  assert.equal(refresh.status, 200, JSON.stringify(refresh.data));
  assert.equal(refresh.data.user.vpbx_user_uid, tenantA.user.vpbx_user_uid);

  const tenants = await request('/cloud-admin/tenants', 'GET', admin.accessToken);
  assert.equal(tenants.status, 200, JSON.stringify(tenants.data));
  assert.ok(tenants.data.count >= 2);
  assert.equal((await request('/cloud-admin/tenants', 'GET', tenantA.accessToken)).status, 403);
  const seller = await request('/cloud-admin/settings/seller', 'GET', admin.accessToken);
  assert.equal(seller.status, 200, JSON.stringify(seller.data));
  const catalog = await request('/marketplace', 'GET', tenantA.accessToken);
  assert.equal(catalog.status, 200, JSON.stringify(catalog.data));
  assert.ok(catalog.data.length >= 2);
  const tenantId = tenants.data.rows.find(row => Number(row.vpbx_user_uid) === tenantA.user.vpbx_user_uid)?.id;
  assert.ok(tenantId);
  const grants = await request(`/cloud-admin/tenants/${tenantId}/modules`, 'GET', admin.accessToken);
  assert.equal(grants.status, 200, JSON.stringify(grants.data));

  const aProviders = await request('/ai-agents/providers/list', 'GET', tenantA.accessToken);
  const bProviders = await request('/ai-agents/providers/list', 'GET', tenantB.accessToken);
  assert.equal(aProviders.status, 200, JSON.stringify(aProviders.data));
  assert.equal(bProviders.status, 200, JSON.stringify(bProviders.data));
  assert.equal(aProviders.data.length, 1);
  assert.equal(bProviders.data.length, 1);
  const created = await request('/ai-agents/providers', 'POST', tenantA.accessToken, {
    name: 'CI created provider', kind: 'local', vendor: 'ci', endpoint: 'http://127.0.0.1:1',
    auth_type: 'none', capabilities: ['llm'], pricing: {}, enabled: false,
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const providerId = created.data.uid;
  assert.ok(providerId);
  assert.equal((await request('/ai-agents/providers/list', 'GET', tenantB.accessToken)).data.length, 1);
  const updated = await request(`/ai-agents/providers/${providerId}`, 'PUT', tenantA.accessToken, { name: 'CI updated provider' });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.equal((await request(`/ai-agents/providers/${providerId}`, 'DELETE', tenantA.accessToken)).status, 200);
  assert.equal((await request('/ai-agents/providers/list', 'GET', tenantA.accessToken)).data.length, 1);

  const provision = await request('/cloud-admin/tenants', 'POST', admin.accessToken, {
    name: 'CI Created Tenant', slug: `ci-created-${Date.now()}`,
    email: `ci-created-${Date.now()}@example.invalid`, password: input.CI_SEED_PASSWORD,
  });
  assert.equal(provision.status, 201, JSON.stringify(provision.data));
  const createdTenantId = provision.data.tenant?.id;
  assert.ok(createdTenantId);
  const changed = await request(`/cloud-admin/tenants/${createdTenantId}`, 'PUT', admin.accessToken, { name: 'CI Updated Tenant' });
  assert.equal(changed.status, 200, JSON.stringify(changed.data));
  const fetched = await request(`/cloud-admin/tenants/${createdTenantId}`, 'GET', admin.accessToken);
  assert.equal(fetched.status, 200, JSON.stringify(fetched.data));
  assert.equal(fetched.data.name, 'CI Updated Tenant');

  return { login: 3, caseFoldedLogin: true, refresh: true, tenantCrud: true, tenantIsolation: true, registry: true, entitlements: true, providerCrud: true, sellerSettings: true };
}

if (require.main === module) {
  main().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { main };
