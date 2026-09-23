/**
 * Bounded import-preview timing for 1k/10k CSV rows.
 * Preview only: does not execute import and does not start campaigns.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHmac } = require('node:crypto');

const root = path.resolve(__dirname, '../../..');
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const api = process.env.HARNESS_API_URL || 'http://localhost:5010';

function mintAdminToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    sub: 58,
    login: 'admin',
    name: 'admin',
    level: 1,
    role: 0,
    vpbx_user_uid: 0,
    iat: now,
    exp: now + 3600,
    iss: 'krasterisk-v4',
    aud: 'krasterisk-v4-client',
  })).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function csv(rows) {
  const header = 'phone,name';
  const body = Array.from({ length: rows }, (_, i) =>
    `7900${String(1000000 + i).slice(-7)},c${i}`,
  ).join('\n');
  return `${header}\n${body}\n`;
}

async function loginToken() {
  return mintAdminToken();
}

async function preview(token, baseUid, rows) {
  const started = process.hrtime.bigint();
  const res = await fetch(`${api}/api/autodial/bases/${baseUid}/import-preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'csv',
      filename: `load-${rows}.csv`,
      delimiter: ',',
      has_header: true,
      content_base64: Buffer.from(csv(rows)).toString('base64'),
    }),
  });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 200) }; }
  return { http: res.status, ms: Math.round(ms), total_rows: parsed.total_rows ?? null, sample: parsed.sample_rows?.length ?? null };
}

async function main() {
  const token = await loginToken();
  const basesRes = await fetch(`${api}/api/autodial/bases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!basesRes.ok) throw new Error(`bases HTTP ${basesRes.status}`);
  const bases = await basesRes.json();
  const list = Array.isArray(bases) ? bases : bases.items || [];
  const baseUid = list[0]?.uid;
  if (!baseUid) throw new Error('no autodial base for preview');
  const sizes = [1000, 10000];
  const results = [];
  for (const rows of sizes) {
    const once = await preview(token, baseUid, rows);
    results.push({ rows, ...once });
  }
  const out = {
    at: new Date().toISOString(),
    api,
    base_uid: baseUid,
    note: 'import-preview only; no execute/import, no campaign start',
    results,
  };
  const dest = path.join(root, '.planning/evidence/autodial-load-preview-2026-09-21.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
