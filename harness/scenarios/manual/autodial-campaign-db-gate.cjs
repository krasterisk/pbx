/** Opt-in campaign -> task -> attempt gate on a disposable versioned DB only. */
const fs = require('node:fs');
const path = require('node:path');
const { createHmac } = require('node:crypto');
const mysql = require('mysql2/promise');

const NAME = 'krasterisk_ci_ac20260918z';
const TRUNK = 't_codex_ci_ac20260918_2';
const PREFIX = ['success-run', 'success-inspect', 'success-cleanup'].includes(process.argv[2])
  ? 'codex-ac-success-20260918'
  : 'codex-ac-db-20260918';
const action = process.argv[2];
if (process.env.AC_LIVE_GATE_ALLOWED !== '1' || !['check', 'inspect', 'success-inspect', 'run', 'success-run', 'create-draft', 'start-existing', 'cleanup', 'success-cleanup'].includes(action)) {
  throw new Error('Set AC_LIVE_GATE_ALLOWED=1 and use check, inspect, success-inspect, run, success-run, create-draft, start-existing, cleanup or success-cleanup');
}
for (const line of fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const now = Math.floor(Date.now() / 1000);
const jwtPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = [jwtPart({ alg: 'HS256', typ: 'JWT' }), jwtPart({
  sub: 2, login: 'ci-tenant-a', name: 'CI tenant A', level: 1, role: 0,
  vpbx_user_uid: 2, iat: now, exp: now + 3600,
})].join('.');
const token = `${unsigned}.${createHmac('sha256', process.env.JWT_SECRET).update(unsigned).digest('base64url')}`;

async function api(method, route, body) {
  const response = await fetch(`http://127.0.0.1:5010/api${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let value;
  try { value = raw ? JSON.parse(raw) : null; } catch { value = raw.slice(0, 200); }
  if (!response.ok) throw new Error(`${method} ${route}: HTTP ${response.status} ${JSON.stringify(value).slice(0, 350)}`);
  return value;
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: NAME,
  });
  try {
    const [marker] = await db.query('SELECT token FROM autodial_harness_marker WHERE id = 1');
    if (marker[0]?.token !== 'codex-autodial-20260918') throw new Error('Not the dedicated fixture DB');
    if (action === 'check') {
      const bases = await api('GET', '/autodial/bases');
      const campaigns = await api('GET', '/autodial/campaigns');
      const [tasks] = await db.query('SELECT COUNT(*) AS count FROM ac_tasks');
      const [attempts] = await db.query('SELECT COUNT(*) AS count FROM ac_attempts');
      const [trunks] = await db.query('SELECT COUNT(*) AS count FROM ps_endpoints WHERE id = ?', [TRUNK]);
      console.log(JSON.stringify({ action, bases: bases.length, campaigns: campaigns.length,
        tasks: tasks[0].count, attempts: attempts[0].count, fixtureTrunks: trunks[0].count }));
      return;
    }
    if (action === 'inspect' || action === 'success-inspect') {
      const [rows] = await db.query(
        `SELECT c.uid AS campaign_uid, c.status AS campaign_status,
                t.uid AS task_uid, t.status AS task_status, t.attempt_count,
                a.uid AS attempt_uid, a.disposition, a.caller_id, a.answered_at, a.ended_at
           FROM ac_campaigns c
           LEFT JOIN ac_tasks t ON t.campaign_uid = c.uid
           LEFT JOIN ac_attempts a ON a.task_uid = t.uid
          WHERE c.name LIKE ?
          ORDER BY c.uid, t.uid, a.uid`,
        [`${PREFIX}%`],
      );
      console.log(JSON.stringify({ action, rows }));
      return;
    }
    if (action === 'cleanup' || action === 'success-cleanup') {
      const campaigns = await api('GET', '/autodial/campaigns');
      for (const campaign of campaigns.filter((row) => row.name?.startsWith(PREFIX))) {
        if (campaign.status === 'running') await api('POST', `/autodial/campaigns/${campaign.uid}/stop`);
        await api('DELETE', `/autodial/campaigns/${campaign.uid}`);
      }
      const bases = await api('GET', '/autodial/bases');
      for (const base of bases.filter((row) => row.name?.startsWith(PREFIX))) {
        await api('DELETE', `/autodial/bases/${base.uid}`);
      }
      await db.query('DELETE FROM ps_endpoints WHERE id = ? AND tenantid = ?', [TRUNK, '2']);
      console.log(JSON.stringify({ action, removedPrefix: PREFIX }));
      return;
    }
    if (action === 'start-existing') {
      const campaigns = await api('GET', '/autodial/campaigns');
      const campaign = campaigns.find((row) => row.name === `${PREFIX}-campaign`);
      if (!campaign || campaign.status !== 'draft') throw new Error('Expected one draft fixture campaign');
      const started = await api('POST', `/autodial/campaigns/${campaign.uid}/start`, {});
      console.log(JSON.stringify({ action, campaignUid: campaign.uid, tasksCreated: started.tasks_created }));
      await waitForTerminal(db, campaign.uid);
      return;
    }
    const [existing] = await db.query('SELECT id FROM ps_endpoints WHERE id = ?', [TRUNK]);
    if (existing.length && action !== 'success-run') throw new Error('Refusing to replace existing fixture trunk');
    if (!existing.length) {
      await db.query(
        'INSERT INTO ps_endpoints (id, tenantid, aors, context, disallow, allow, direct_media) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [TRUNK, '2', TRUNK, 'codex-ac-db-20260918-2', 'all', 'ulaw', 'no'],
      );
    }
    const base = await api('POST', '/autodial/bases', {
      name: `${PREFIX}-base`,
      fields: [
        { key: 'name', label: 'Name', type: 'string', required: false },
        { key: 'phone', label: 'Phone', type: 'phone', required: true, is_phone: true },
      ],
    });
    const contact = await api('POST', `/autodial/bases/${base.uid}/contacts`, {
      values: { name: 'Fixture' }, phones: [{ raw: '74951112233', is_primary: true }],
    });
    const campaign = await api('POST', '/autodial/campaigns', {
      name: `${PREFIX}-campaign`, base_uid: base.uid, dial_mode: 'agentless',
      pacing: { providers: [{ type: 'static', max_channels: 1 }] },
      retry: { max_attempts: 1, default_interval_sec: 0 },
      trunk_pool: [{ trunk_id: TRUNK, caller_id: '74954445566' }],
      cid_policy: { mode: 'per_trunk' }, queue_names: [],
      // Keep the successful call alive beyond success_min_sec. This exercises
      // the generated scenario as well as the ARI handoff/finalizer.
      scenario_actions: [{ id: 'live-gate-read', type: 'collect_input', condition: {}, params: { digits: 1, timeout: 16 } }],
      amd: { enabled: false, on_machine: 'hangup' },
    });
    if (action === 'create-draft') {
      console.log(JSON.stringify({ action, baseUid: base.uid, contactUid: contact.uid, campaignUid: campaign.uid }));
      return;
    }
    const started = await api('POST', `/autodial/campaigns/${campaign.uid}/start`, {});
    console.log(JSON.stringify({ action, baseUid: base.uid, contactUid: contact.uid,
      campaignUid: campaign.uid, tasksCreated: started.tasks_created }));
    await waitForTerminal(db, campaign.uid);
  } finally {
    await db.end();
  }
}

async function waitForTerminal(db, campaignUid) {
  const deadline = Date.now() + (action === 'success-run' ? 30_000 : 15_000);
  while (Date.now() < deadline) {
    const [rows] = await db.query(
      'SELECT t.status AS task_status, t.attempt_count, p.normalized AS normalized_phone, a.disposition, a.caller_id FROM ac_tasks t JOIN ac_contact_phones p ON p.uid = t.phone_uid LEFT JOIN ac_attempts a ON a.task_uid = t.uid WHERE t.campaign_uid = ? ORDER BY a.uid DESC LIMIT 1',
      [campaignUid],
    );
    if (rows[0]?.disposition && rows[0].disposition !== 'dialing') {
      console.log(JSON.stringify({ phase: 'terminal', ...rows[0] }));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for a terminal attempt');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
