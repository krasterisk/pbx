/**
 * UAT live: two agentless campaigns (debt + appointment) over a local
 * PJSIP loopback. Isolated numbers 000301-000303 / 000401-000402 only.
 * Does not start campaign uid 1 (MCP-Live-20260921).
 */
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '../../..');
const API = process.env.HARNESS_API_URL || 'http://127.0.0.1:5010';
const EVIDENCE = path.join(ROOT, '.planning/evidence/autodial-uat-live-2026-09-21.json');
const SSH_KEY = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'krasterisk_ipbx_agent');
const PBX = 'root@ipbx.krasterisk.ru';
const TRUNK_ID = 't_uat_ac_loop_20260921';
const IDENTIFY_ID = `${TRUNK_ID}_ip`;
const LOOP_CONTEXT = 'uat-ac-loop-20260921';
/** Loopback INVITE source is always 127.0.0.1, even if the dest is 127.0.0.2. */
const LOOP_CONTACT = 'sip:127.0.0.1:5060';
const LOOP_MATCH = '127.0.0.1';
const DEBT_CAMPAIGN = 'UAT-Debt-20260921';
const APPT_CAMPAIGN = 'UAT-Appt-20260921';
const DEBT_BASE = 'UAT-Debt-Base-20260921';
const APPT_BASE = 'UAT-Appt-Base-20260921';
const SKIP_UID1 = 'MCP-Live-20260921';
const PHASE = process.argv[2] || 'all';

for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

function mint(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      sub: user.uniqueid,
      login: user.login,
      name: user.name,
      level: user.level,
      role: user.role ?? 0,
      vpbx_user_uid: user.vpbx_user_uid,
      iat: now,
      exp: now + 7200,
      iss: 'krasterisk-v4',
      aud: 'krasterisk-v4-client',
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function request(method, pathname, { token, body, timeoutMs = 30000 } = {}) {
  const url = new URL(pathname.startsWith('http') ? pathname : `${API}${pathname}`);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, json, raw });
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${pathname}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function streamMessage(token, body, timeoutMs = 180000) {
  const url = new URL(`${API}/api/ai-chat/message`);
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const events = [];
    let buffer = '';
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const name = (/^event: (.+)$/m.exec(part) || [])[1];
            const dataLine = (/^data: ([\s\S]+)$/m.exec(part) || [])[1];
            let data = dataLine;
            try {
              data = JSON.parse(dataLine);
            } catch {
              /* keep */
            }
            events.push({ name, data });
          }
        });
        res.on('end', () => resolve({ status: res.statusCode, events }));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('chat timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function ssh(remoteCmd) {
  const r = spawnSync(
    'ssh',
    ['-i', SSH_KEY, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', PBX, remoteCmd],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`ssh failed ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  }
  return (r.stdout || '').trim();
}

function scp(local, remote) {
  const r = spawnSync(
    'scp',
    ['-i', SSH_KEY, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', local, `${PBX}:${remote}`],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`scp failed ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  }
}

function extractProposal(content) {
  const text = Array.isArray(content) ? content[0]?.text : content?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function mcp(token, method, params, id = 1) {
  const res = await request('POST', '/api/mcp', {
    token,
    body: { jsonrpc: '2.0', id, method, params },
  });
  if (res.status >= 400) throw new Error(`MCP ${method} HTTP ${res.status}: ${String(res.raw).slice(0, 400)}`);
  if (res.json?.error) throw new Error(`MCP ${method}: ${JSON.stringify(res.json.error)}`);
  return res.json.result;
}

async function callTool(token, name, args) {
  const result = await mcp(token, 'tools/call', { name, arguments: args ?? {} });
  return extractProposal(result.content);
}

async function applyProposal(token, proposalId) {
  const res = await request('POST', `/api/ai-chat/proposals/${proposalId}/apply`, { token, body: {} });
  if (res.status >= 400) throw new Error(`apply ${proposalId} HTTP ${res.status}: ${String(res.raw).slice(0, 400)}`);
  return res.json;
}

async function applyWorkflow(token, workflowId) {
  const res = await request('POST', `/api/ai-chat/workflows/${workflowId}/apply`, { token, body: {} });
  if (res.status >= 400) throw new Error(`workflow ${workflowId} HTTP ${res.status}: ${String(res.raw).slice(0, 800)}`);
  return res.json;
}

function csvB64(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name)).toString('base64');
}

async function waitHealth(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const res = await request('GET', '/api/health');
      if (res.status && res.status < 500) return res;
      last = String(res.status);
    } catch (e) {
      last = e.message;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`backend not ready: ${last}`);
}

async function ensureLoopbackTrunk(db, tenantId) {
  const [[endpoint]] = await db.query('SELECT COUNT(*) AS count FROM ps_endpoints WHERE id = ?', [TRUNK_ID]);
  await db.beginTransaction();
  try {
    if (!endpoint.count) {
      await db.query('INSERT INTO ps_aors (id, contact, qualify_frequency, max_contacts) VALUES (?, ?, ?, ?)', [
        TRUNK_ID,
        LOOP_CONTACT,
        0,
        1,
      ]);
      await db.query(
        'INSERT INTO ps_endpoints (id, tenantid, aors, context, disallow, allow, direct_media, identify_by, send_pai, send_rpid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [TRUNK_ID, String(tenantId), TRUNK_ID, LOOP_CONTEXT, 'all', 'ulaw,alaw', 'no', 'ip', 'yes', 'yes'],
      );
      await db.query('INSERT INTO ps_endpoint_id_ips (id, endpoint, `match`, type) VALUES (?, ?, ?, ?)', [
        IDENTIFY_ID,
        TRUNK_ID,
        LOOP_MATCH,
        'identify',
      ]);
    } else {
      await db.query('UPDATE ps_aors SET contact = ?, qualify_frequency = 0, max_contacts = 1 WHERE id = ?', [
        LOOP_CONTACT,
        TRUNK_ID,
      ]);
      await db.query(
        "UPDATE ps_endpoints SET context = ?, disallow = 'all', allow = 'ulaw,alaw', direct_media = 'no', identify_by = 'ip' WHERE id = ?",
        [LOOP_CONTEXT, TRUNK_ID],
      );
      await db.query('UPDATE ps_endpoint_id_ips SET `match` = ?, endpoint = ? WHERE id = ?', [
        LOOP_MATCH,
        TRUNK_ID,
        IDENTIFY_ID,
      ]);
    }
    await db.commit();
  } catch (e) {
    await db.rollback();
    throw e;
  }
  const local = path.join(ROOT, 'harness/asterisk/uat-ac-loop-20260921.conf');
  scp(local, `/etc/asterisk/krasterisk/autodial/${LOOP_CONTEXT}.conf`);
  const reload = ssh(
    `asterisk -rx "dialplan reload"; asterisk -rx "module reload res_pjsip.so"; asterisk -rx "pjsip show endpoint ${TRUNK_ID}"`,
  );
  return { created: !endpoint.count, contact: LOOP_CONTACT, match: LOOP_MATCH, reload: reload.slice(0, 2500) };
}

async function ensureBase(token, { name, description, fields, filename, column_map }) {
  const listed = await request('GET', '/api/autodial/bases', { token });
  const rows = Array.isArray(listed.json) ? listed.json : listed.json?.items || [];
  let base = rows.find((b) => b.name === name);
  if (!base) {
    const created = await request('POST', '/api/autodial/bases', {
      token,
      body: {
        name,
        description,
        dedup_policy: 'phone',
        phone_normalization: 'none',
        fields,
      },
    });
    if (created.status >= 400) throw new Error(`create base ${name}: ${created.status} ${String(created.raw).slice(0, 400)}`);
    base = created.json;
  }
  const imported = await request('POST', `/api/autodial/bases/${base.uid}/import`, {
    token,
    body: {
      filename,
      source: 'csv',
      delimiter: ';',
      has_header: true,
      replace: true,
      expected_revision: base.revision,
      content_base64: csvB64(filename),
      column_map,
    },
  });
  if (imported.status === 409 && imported.json?.code === 'AC_BASE_IN_USE') {
    return { base, imported: { skipped: 'AC_BASE_IN_USE' } };
  }
  if (imported.status >= 400) {
    throw new Error(`import ${name}: ${imported.status} ${String(imported.raw).slice(0, 600)}`);
  }
  return { base, imported: imported.json };
}

function chatPrompt({ debtBase, apptBase, ttsEngineUid }) {
  const engineHint = ttsEngineUid
    ? `Для шага text2speech укажи engine=${ttsEngineUid}.`
    : 'Если TTS-движка нет, всё равно добавь text2speech — fallback озвучит сумму через SayNumber.';
  return [
    'Нужно подготовить ДВЕ тестовые кампании автообзвона. Это изолированный loopback на локальном тестовом транке, без живых абонентов. Кампанию MCP-Live-20260921 не трогай и не запускай.',
    `Тестовый транк: ${TRUNK_ID}, caller_id 000090, max_channels 2.`,
    `Клиентские базы уже загружены из CSV:`,
    `- «${DEBT_BASE}» uid=${debtBase.uid}: поля name→{AC_NAME}, debt→{AC_DEBT}, телефон. Номера 000301, 000302, 000303.`,
    `- «${APPT_BASE}» uid=${apptBase.uid}: поля name→{AC_NAME}, appt_at→{AC_APPT_AT}, телефон. Номера 000401, 000402.`,
    'Создай черновики через create_autodial_campaign:',
    `1) «${DEBT_CAMPAIGN}»: база ${debtBase.uid}, режим agentless, AMD выключен, dial_timeout_sec=20, success_min_sec=5, pacing static max_channels=2, retry max_attempts=1. Сценарий: playback file=beep; text2speech текст «Здравствуйте {AC_NAME}, ваша задолженность {AC_DEBT} рублей.»; collect_input digits=1 timeout=12; hangup.`,
    `2) «${APPT_CAMPAIGN}»: база ${apptBase.uid}, те же пейсинг/транк/таймауты. Сценарий: playback file=beep; text2speech текст «Здравствуйте {AC_NAME}, напоминаем о приёме {AC_APPT_AT}.»; collect_input digits=1 timeout=12; hangup.`,
    engineHint,
    'В тексте TTS обязательно плейсхолдеры в фигурных скобках как {AC_NAME}. Кампании не запускай.',
  ].join('\n');
}

async function applyPendingFor(token, names) {
  const pending = await request('GET', '/api/ai-chat/proposals/pending', { token });
  const rows = Array.isArray(pending.json) ? pending.json : [];
  const applied = [];
  for (const row of rows) {
    const label = String(row.entityLabel || row.summary || '');
    if (!names.some((n) => label.includes(n))) continue;
    applied.push({
      proposalId: row.proposalId,
      label,
      result: await applyProposal(token, row.proposalId),
    });
  }
  return { pendingCount: rows.length, applied };
}

function saveEvidence(data) {
  fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
  } catch {
    prev = {};
  }
  const next = { ...prev, ...data, at: new Date().toISOString() };
  fs.writeFileSync(EVIDENCE, JSON.stringify(next, null, 2));
  return next;
}

async function main() {
  const log = {};
  await waitHealth();
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 8000,
  });
  try {
    const [users] = await db.query(
      "SELECT uniqueid, login, name, level, role, vpbx_user_uid FROM users WHERE login = 'admin' ORDER BY uniqueid ASC LIMIT 1",
    );
    const admin = users[0];
    if (!admin) throw new Error('admin user missing');
    const token = mint(admin);
    const me = await request('GET', '/api/auth/me', { token });
    log.admin = { login: admin.login, vpbx: admin.vpbx_user_uid, me: me.status };

    if (PHASE === 'all' || PHASE === 'prep') {
      log.loopback = await ensureLoopbackTrunk(db, admin.vpbx_user_uid);
      const [tts] = await db.query(
        'SELECT uid, name, type FROM tts_engines WHERE user_uid = ? ORDER BY uid ASC',
        [admin.vpbx_user_uid],
      );
      log.ttsEngines = tts;
      log.debtBase = await ensureBase(token, {
        name: DEBT_BASE,
        description: 'UAT debt CSV 2026-09-21',
        fields: [
          { key: 'name', label: 'ФИО', type: 'string', required: true, position: 0 },
          { key: 'phone', label: 'Телефон', type: 'phone', is_phone: true, required: true, position: 1 },
          { key: 'debt', label: 'Сумма долга', type: 'money', required: true, position: 2 },
        ],
        filename: 'uat-debt-20260921.csv',
        column_map: [
          { column: 'name', field_key: 'name' },
          { column: 'phone', field_key: '__phone' },
          { column: 'debt', field_key: 'debt' },
        ],
      });
      log.apptBase = await ensureBase(token, {
        name: APPT_BASE,
        description: 'UAT appointment CSV 2026-09-21',
        fields: [
          { key: 'name', label: 'ФИО', type: 'string', required: true, position: 0 },
          { key: 'phone', label: 'Телефон', type: 'phone', is_phone: true, required: true, position: 1 },
          { key: 'appt_at', label: 'Дата и время приёма', type: 'string', required: true, position: 2 },
        ],
        filename: 'uat-appt-20260921.csv',
        column_map: [
          { column: 'name', field_key: 'name' },
          { column: 'phone', field_key: '__phone' },
          { column: 'appt_at', field_key: 'appt_at' },
        ],
      });
      saveEvidence({ prep: log });
      if (PHASE === 'prep') {
        console.log(JSON.stringify({ ok: true, phase: 'prep', log }, null, 2));
        return;
      }
    }

    if (PHASE === 'apply') {
      const threadView = await request('GET', '/api/ai-chat/threads/151', { token });
      const cards = threadView.json?.cards || {};
      for (const card of Object.values(cards)) {
        const wf = card?.workflow;
        if (wf?.workflowId && (wf.status === 'applying' || wf.status === 'failed')) {
          await db.query(
            "UPDATE ai_agent_workflows SET status = 'failed', error = NULL, updated_at = NOW() WHERE workflow_id = ? AND status IN ('applying','failed')",
            [wf.workflowId],
          );
          await db.query(
            "UPDATE ai_agent_workflow_steps s JOIN ai_agent_workflows w ON w.uid = s.workflow_uid SET s.status = 'pending', s.error = NULL, s.updated_at = NOW() WHERE w.workflow_id = ? AND s.status IN ('applying','failed','pending')",
            [wf.workflowId],
          );
        }
      }
      const appliedWorkflows = [];
      const seen = new Set();
      for (const card of Object.values(cards)) {
        const wf = card?.workflow;
        if (!wf?.workflowId || seen.has(wf.workflowId)) continue;
        if (!['pending', 'applying', 'failed'].includes(wf.status)) continue;
        seen.add(wf.workflowId);
        appliedWorkflows.push({ workflowId: wf.workflowId, result: await applyWorkflow(token, wf.workflowId) });
      }
      const listed = await callTool(token, 'list_autodial_campaigns', {});
      const created = (listed.campaigns || []).filter((c) => [DEBT_CAMPAIGN, APPT_CAMPAIGN].includes(c.name));
      const snaps = [];
      for (const campaign of created) {
        snaps.push(await callTool(token, 'get_autodial_campaign', { uid: campaign.uid }));
      }
      log.apply = { appliedWorkflows, created, snaps };
      saveEvidence({ apply: log.apply });
      console.log(JSON.stringify({ ok: true, phase: 'apply', log: log.apply }, null, 2));
      return;
    }

    if (PHASE === 'all' || PHASE === 'chat') {
      const bases = await request('GET', '/api/autodial/bases', { token });
      const baseRows = Array.isArray(bases.json) ? bases.json : bases.json?.items || [];
      const debtBase = baseRows.find((b) => b.name === DEBT_BASE);
      const apptBase = baseRows.find((b) => b.name === APPT_BASE);
      if (!debtBase || !apptBase) throw new Error('bases missing; run prep first');
      const [tts] = await db.query(
        'SELECT uid, name FROM tts_engines WHERE user_uid = ? ORDER BY uid ASC LIMIT 5',
        [admin.vpbx_user_uid],
      );
      await request('PUT', '/api/ai-chat/default-provider', { token, body: { providerUid: 59 } });
      const thread = await request('POST', '/api/ai-chat/threads', { token, body: {} });
      const chat = await streamMessage(token, {
        threadUid: thread.json?.uid,
        locale: 'ru',
        message: chatPrompt({
          debtBase,
          apptBase,
          ttsEngineUid: tts[0]?.uid ?? null,
        }),
      });
      const errors = chat.events.filter((e) => e.name === 'error').map((e) => e.data);
      const workflowIds = [];
      for (const event of chat.events) {
        const data = event.data;
        if (data && typeof data === 'object') {
          if (data.workflowId) workflowIds.push(data.workflowId);
          if (data.workflow?.workflowId) workflowIds.push(data.workflow.workflowId);
          if (data.card === 'workflow' && data.workflow?.workflowId) workflowIds.push(data.workflow.workflowId);
        }
      }
      const uniqueWorkflows = [...new Set(workflowIds)];
      const appliedWorkflows = [];
      for (const workflowId of uniqueWorkflows) {
        appliedWorkflows.push({ workflowId, result: await applyWorkflow(token, workflowId) });
      }
      const threadView = await request('GET', `/api/ai-chat/threads/${thread.json?.uid}`, { token });
      const cards = threadView.json?.cards || {};
      for (const card of Object.values(cards)) {
        const wf = card?.workflow;
        if (wf?.workflowId && wf.status === 'pending' && !uniqueWorkflows.includes(wf.workflowId)) {
          appliedWorkflows.push({ workflowId: wf.workflowId, result: await applyWorkflow(token, wf.workflowId) });
        }
      }
      const applied = await applyPendingFor(token, [DEBT_CAMPAIGN, APPT_CAMPAIGN]);
      const listed = await callTool(token, 'list_autodial_campaigns', {});
      const created = (listed.campaigns || []).filter((c) => [DEBT_CAMPAIGN, APPT_CAMPAIGN].includes(c.name));
      log.chat = {
        threadUid: thread.json?.uid,
        status: chat.status,
        eventNames: chat.events.map((e) => e.name).filter(Boolean),
        errors,
        uniqueWorkflows,
        appliedWorkflows,
        applied,
        created: created.map((c) => ({ uid: c.uid, name: c.name, status: c.status })),
      };
      saveEvidence({ chat: log.chat, tokenHint: { login: admin.login } });
      if (PHASE === 'chat') {
        console.log(JSON.stringify({ ok: true, phase: 'chat', log: log.chat }, null, 2));
        return;
      }
    }

    if (PHASE === 'all' || PHASE === 'start' || PHASE === 'status') {
      const listed = await callTool(token, 'list_autodial_campaigns', {});
      const targets = (listed.campaigns || []).filter((c) => [DEBT_CAMPAIGN, APPT_CAMPAIGN].includes(c.name));
      if (targets.some((c) => c.uid === 1) || targets.some((c) => c.name === SKIP_UID1)) {
        throw new Error('refusing to touch campaign uid 1');
      }
      if (PHASE !== 'status') {
        const started = [];
        for (const campaign of targets) {
          if (campaign.status === 'running') {
            started.push({ uid: campaign.uid, already: true });
            continue;
          }
          const res = await request('POST', `/api/autodial/campaigns/${campaign.uid}/start`, {
            token,
            body: { include_dispositions: ['failed', 'max_attempts'] },
          });
          started.push({ uid: campaign.uid, status: res.status, json: res.json });
          if (res.status >= 400) {
            throw new Error(`start ${campaign.name}: ${res.status} ${String(res.raw).slice(0, 500)}`);
          }
        }
        log.started = started;
      }
      const startedAtMs = Date.now();
      const deadline = Date.now() + (PHASE === 'status' ? 2000 : 120000);
      let snapshot = null;
      while (Date.now() < deadline) {
        const monitor = await request('GET', '/api/autodial/monitor', { token });
        const today = new Date().toISOString().slice(0, 10);
        const uids = targets.map((c) => c.uid).join(',');
        const detail = await request(
          'GET',
          `/api/autodial/reports/detail?from=${today}&to=${today}&campaigns=${uids}`,
          { token },
        );
        snapshot = { monitor: monitor.json, detail: detail.json };
        const rows = Array.isArray(detail.json) ? detail.json : detail.json?.items || [];
        const fresh = rows.filter((r) => {
          const t = r.started_at ? Date.parse(r.started_at) : 0;
          return t >= startedAtMs - 2000;
        });
        const terminal = fresh.filter((r) => r.disposition && r.disposition !== 'dialing');
        const answered = terminal.filter((r) => r.answered_at || r.billsec > 0);
        if (terminal.length >= 5 && answered.length >= 1) break;
        if (terminal.length >= 5 && Date.now() - startedAtMs > 25000) break;
        await new Promise((r) => setTimeout(r, 4000));
      }
      log.runtime = snapshot;
      const campaigns = await request('GET', '/api/autodial/campaigns', { token });
      log.campaigns = (Array.isArray(campaigns.json) ? campaigns.json : []).filter((c) =>
        [DEBT_CAMPAIGN, APPT_CAMPAIGN].includes(c.name),
      );
      saveEvidence({ start: log });
    }

    console.log(JSON.stringify({ ok: true, phase: PHASE, evidence: EVIDENCE, log }, null, 2));
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
