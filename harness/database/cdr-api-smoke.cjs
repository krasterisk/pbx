'use strict';
const assert = require('node:assert/strict');

async function main(input = process.env) {
  if (input.CI !== 'true' || !input.DB_CORE_TEST_PROFILE || !input.CI_SEED_PASSWORD) {
    throw new Error('CDR API smoke requires disposable core profile');
  }
  const base = input.CORE_API_URL || 'http://127.0.0.1:55001/api';
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: 'ci-tenant-a', password: input.CI_SEED_PASSWORD }),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(login.status, 200);
  const { accessToken } = await login.json();
  async function get(path) {
    const response = await fetch(`${base}/reports/cdr${path}`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) });
    const body = await response.json();
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(body)}`);
    return body;
  }
  const calls = await get('?limit=20');
  assert.equal(calls.count, 4);
  assert.equal(calls.rows.length, 4);
  const call = calls.rows.find(row => row.linkedid === 'db02-c-a');
  assert.ok(call);
  assert.equal(call.uniqueid, 'db02-c-a1');
  assert.equal(call.clid, 'Звонок 😀');
  assert.equal(call.dst, '202');
  assert.equal(call.disposition, 'ANSWERED');
  assert.equal(call.legCount, 3);
  assert.equal(call.duration, 60);
  assert.equal(call.billsec, 22);
  assert.equal(calls.rows.some(row => row.linkedid === 'db02-c-b' || row.linkedid === 'db02-c-zero'), false);
  const first = await get('?limit=1&offset=0');
  const second = await get('?limit=1&offset=1');
  assert.equal(first.count, 4);
  assert.equal(second.count, 4);
  assert.notEqual(first.rows[0].linkedid, second.rows[0].linkedid);
  const legs = await get('/db02-c-a/legs');
  assert.deepEqual(legs.map(row => row.uniqueid), ['db02-c-a1', 'db02-c-a2', 'db02-c-a3']);
  const stats = await get('/stats');
  assert.equal(stats.totalCalls, 4);
  assert.equal(stats.byDisposition.ANSWERED, 1);
  const hour = await get('/charts/by-hour');
  assert.deepEqual(hour.map(row => row.hour), [10, 11]);
  const day = await get('/charts/by-day');
  assert.equal(day.length, 1);
  assert.equal(day[0].calls, 2);
  assert.equal(day[0].asr, 50);
  const heatmap = await get('/charts/heatmap');
  assert.equal(heatmap.reduce((sum, row) => sum + row.calls, 0), 2);
  const extension = await get('/charts/by-extension');
  assert.ok(extension.some(row => row.extension === '101'));
  const trunk = await get('/charts/by-trunk');
  assert.deepEqual(trunk, [{ trunk: 'trunk-a', calls: 1, totalBillsec: 0 }]);
  const disposition = await get('/charts/by-disposition');
  assert.ok(disposition.some(row => row.disposition === 'ANSWERED' && row.count === 1));
  const bucket = await get('?bucket=disposition&bucketValue=ANSWERED');
  assert.equal(bucket.count, 1);
  assert.equal(bucket.rows[0].linkedid, 'db02-c-a');
  assert.equal((await get('?bucket=hour&bucketValue=10')).count, 1);
  assert.equal((await get('?bucket=day&bucketValue=2026-09-18')).count, 2);
  assert.equal((await get('?search=101')).count, 1);
  const filtered = await get('?dateFrom=2026-09-18&dateTo=2026-09-18');
  assert.equal(filtered.count, 2);
  const byId = await get('/by-uniqueid/db02-c-a1');
  assert.equal(byId.uniqueid, 'db02-c-a1');
  const csv = await fetch(`${base}/reports/cdr/export?dateFrom=2026-09-18&dateTo=2026-09-18`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(csv.status, 200);
  const exported = await csv.text();
  assert.match(exported, /"101";"202"/);
  assert.doesNotMatch(exported, /Other tenant|Box tenant/);
  return { calls: calls.count, selected: call.uniqueid, legs: legs.length, hour, day, heatmap, dispositions: stats.byDisposition };
}

if (require.main === module) {
  main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { main };
