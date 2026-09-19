/** Opt-in test-only trunk lifecycle through the normal backend API. */
const fs = require('node:fs');
const path = require('node:path');
const { createHmac } = require('node:crypto');

if (process.env.AC_LIVE_GATE_ALLOWED !== '1') throw new Error('Set AC_LIVE_GATE_ALLOWED=1');
const action = process.argv[2];
if (!['check', 'create', 'delete'].includes(action)) throw new Error('Use check, create or delete');

for (const line of fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const NAME = 'codex_cid_loop_20260918';
const ID = `t_${NAME}_0`;
const CONTEXT = 'codex-cid-loop-20260918-0';
const now = Math.floor(Date.now() / 1000);
const jwtPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = [jwtPart({ alg: 'HS256', typ: 'JWT' }), jwtPart({
  sub: 58, login: 'admin', name: 'admin', level: 1, role: 0,
  vpbx_user_uid: 0, iat: now, exp: now + 3600,
})].join('.');
const token = `${unsigned}.${createHmac('sha256', process.env.JWT_SECRET).update(unsigned).digest('base64url')}`;

async function api(method, route, body) {
  const response = await fetch(`http://127.0.0.1:5010/api${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const value = text ? JSON.parse(text) : null;
  if (!response.ok && response.status !== 404) throw new Error(`${method} ${route}: HTTP ${response.status} ${text.slice(0, 200)}`);
  return { status: response.status, value };
}

async function main() {
  const existing = await api('GET', `/trunks/${ID}`);
  if (action === 'check') {
    console.log(JSON.stringify({ id: ID, exists: existing.status === 200 }));
    return;
  }
  if (action === 'create') {
    if (existing.status !== 404) throw new Error(`Refusing to replace existing trunk ${ID}`);
    const created = await api('POST', '/trunks', {
      name: NAME,
      trunkType: 'ip',
      host: '127.0.0.1',
      port: 5060,
      context: CONTEXT,
      matchIp: '127.0.0.1',
      fromDomain: '127.0.0.1',
      qualifyFrequency: 0,
      advanced: { identify_by: 'ip,username', send_pai: 'yes', send_rpid: 'yes' },
    });
    console.log(JSON.stringify({ action, status: created.status, id: created.value?.id }));
    if (created.value?.id !== ID) throw new Error('Unexpected created trunk ID');
    return;
  }
  if (existing.status === 404) {
    console.log(JSON.stringify({ action, id: ID, alreadyDeleted: true }));
    return;
  }
  if (existing.value?.id !== ID) throw new Error('Unexpected trunk identity; refusing deletion');
  const deleted = await api('DELETE', `/trunks/${ID}`);
  console.log(JSON.stringify({ action, status: deleted.status, id: ID }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
