'use strict';
// Live check of operator-stats against the running backend and the stand database.
// Loads the repo .env. Does not print secrets. Writes live-check-report.json.
const path = require('node:path');
const fs = require('node:fs');
require(path.resolve(__dirname, '../../node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../.env') });
const jwt = require(path.resolve(__dirname, '../../node_modules/jsonwebtoken'));

const base = 'http://localhost:5010/api';
const token = jwt.sign(
  { sub: 58, login: 'admin', name: 'admin', level: 1, role: 0, vpbx_user_uid: 0 },
  process.env.JWT_SECRET,
  { expiresIn: '20m' },
);
const report = { startedAt: new Date().toISOString(), checks: [] };
const note = (name, ok, detail) => {
  report.checks.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail));
};

async function api(p) {
  const res = await fetch(base + p, { headers: { Authorization: 'Bearer ' + token } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, body };
}

(async () => {
  const health = await api('/health').catch((err) => ({ status: 0, body: err.message }));
  note('backend health', health.status === 200, health.status);

  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const stats = await api(`/callcenter/reports/operator-stats?dateFrom=${from}&dateTo=${today}`);
  note('operator-stats responds', stats.status === 200, stats.status);
  const body = stats.body || {};
  const keys = (body.columns || []).map((col) => col.key);
  note('scorecard columns', ['occupancyPct', 'rnaCount', 'answerRatePct', 'callsHandled', 'ahtSec'].every((key) => keys.includes(key)), keys.slice(0, 12));
  const rows = body.rows || [];
  note('rows are people', rows.every((row) => row.agentUserUid == null || typeof row.agentUserUid === 'number'), rows.length);
  const time = rows.filter((row) => (row.loggedInSec || 0) > 0);
  note('journal time balances when someone was on shift', time.every((row) => {
    const parts = (row.readySec || 0) + (row.busySec || 0) + (row.pausePaidSec || 0) + (row.pauseUnpaidSec || 0) + (row.pauseUnknownSec || 0);
    return Math.abs(parts - row.loggedInSec) <= 2;
  }), time.slice(0, 3).map((row) => ({ who: row.agentName || row.agentInterface, logged: row.loggedInSec, ready: row.readySec, busy: row.busySec, pause: row.totalPauseSec })));

  const queues = await api('/queues');
  const queueName = Array.isArray(queues.body) ? (queues.body.find((q) => q && q.name) || {}).name : '';
  if (queueName) {
    const filtered = await api(`/callcenter/reports/operator-stats?dateFrom=${from}&dateTo=${today}&queueName=${encodeURIComponent(queueName)}`);
    const filteredKeys = ((filtered.body && filtered.body.columns) || []).map((col) => col.key);
    note('queue filter hides calls per hour and marks shift time', filtered.status === 200 && !filteredKeys.includes('callsPerHour') && (filtered.body.columns || []).some((col) => col.key === 'loggedInSec' && col.scope === 'operator'), { queueName, status: filtered.status });
  } else {
    note('queue filter', false, 'no queues');
  }

  const outsider = await api(`/callcenter/reports/operator-stats?dateFrom=${from}&dateTo=${today}&agentUserUid=999999`);
  note('unknown operator filter is an empty report, not an error', outsider.status === 200 && Array.isArray(outsider.body.rows) && outsider.body.rows.length === 0, outsider.status);

  fs.writeFileSync(path.join(__dirname, 'live-check-report.json'), JSON.stringify(report, null, 2));
  console.log(report.checks.every((check) => check.ok) ? 'ALL_LIVE_CHECKS_PASSED' : 'SOME_LIVE_CHECKS_FAILED');
  process.exit(report.checks.every((check) => check.ok) ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
