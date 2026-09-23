/**
 * Isolated autodial campaign live gate via MCP tools + AI chat.
 * Does not start the campaign (no real outbound). Uses loopback/test trunks only.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '../../..');
const API = process.env.HARNESS_API_URL || 'http://127.0.0.1:5010';
const CAMPAIGN_NAME = 'MCP-Live-20260921';
const BASE_NAME = 'MCP-Live-Base-20260921';
const EVIDENCE = path.join(ROOT, '.planning/evidence/autodial-mcp-live-2026-09-21.json');

for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

function mint(user) {
  const secret = process.env.JWT_SECRET;
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
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function request(method, pathname, { token, body, headers } = {}) {
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
          ...headers,
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
          resolve({ status: res.statusCode, headers: res.headers, json, raw });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
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
  if (res.status >= 400) throw new Error(`MCP ${method} HTTP ${res.status}: ${res.raw.slice(0, 400)}`);
  if (res.json?.error) throw new Error(`MCP ${method}: ${JSON.stringify(res.json.error)}`);
  return res.json.result;
}

async function callTool(token, name, args) {
  const result = await mcp(token, 'tools/call', { name, arguments: args ?? {} });
  return extractProposal(result.content);
}

async function applyProposal(token, proposalId) {
  const res = await request('POST', `/api/ai-chat/proposals/${proposalId}/apply`, { token, body: {} });
  if (res.status >= 400) throw new Error(`apply ${proposalId} HTTP ${res.status}: ${res.raw.slice(0, 400)}`);
  return res.json;
}

function isLocalTrunk(row) {
  const id = String(row.id || row.trunkId || '');
  const host = String(row.host || row.matchIp || '');
  const context = String(row.context || '');
  return (
    /test|codex|loop|mcp.?live/i.test(id) ||
    host.includes('127.0.0.1') ||
    /loop|codex|test/i.test(context)
  );
}

async function main() {
  const log = [];
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
      'SELECT uniqueid, login, name, level, role, vpbx_user_uid FROM users WHERE level IN (0,1) ORDER BY uniqueid ASC',
    );
    const [loopTrunks] = await db.query(
      "SELECT id, tenantid, context FROM ps_endpoints WHERE id LIKE 't_%' AND (id LIKE '%test%' OR id LIKE '%codex%' OR id LIKE '%loop%' OR context LIKE '%loop%' OR context LIKE '%codex%')",
    );
    log.push({ users: users.map((u) => ({ uniqueid: u.uniqueid, login: u.login, level: u.level, vpbx: u.vpbx_user_uid })) });
    log.push({ loopTrunks });

    const admin = users.find((u) => Number(u.level) === 1) || users[0];
    if (!admin) throw new Error('No admin user in DB');
    const token = mint(admin);
    const identity = await request('GET', '/api/auth/me', { token }).catch(() => ({ status: 0 }));
    const campaignsProbe = await request('GET', '/api/autodial/campaigns', { token });
    log.push({ login: admin.login, vpbx: admin.vpbx_user_uid, me: identity.status, campaignsStatus: campaignsProbe.status });
    if (campaignsProbe.status >= 400) {
      console.log(JSON.stringify({ error: 'autodial forbidden', campaignsProbe, identity, log }, null, 2));
      return;
    }

    const tools = await mcp(token, 'tools/list', {});
    const autodialTools = (tools.tools || []).map((t) => t.name).filter((n) => n.includes('autodial'));
    log.push({ autodialTools });

    const trunksRes = await request('GET', '/api/trunks', { token });
    const trunks = Array.isArray(trunksRes.json) ? trunksRes.json : trunksRes.json?.items || [];
    const localTrunk = trunks.find(isLocalTrunk) || trunks.find((t) => String(t.id || '').startsWith('t_'));
    log.push({ trunkCount: trunks.length, localTrunk: localTrunk ? { id: localTrunk.id, context: localTrunk.context, host: localTrunk.host } : null });
    if (!localTrunk) throw new Error('No tenant trunk available for isolated campaign');

    const listedBases = await callTool(token, 'list_autodial_bases', {});
    let base = (listedBases.bases || []).find((b) => b.name === BASE_NAME);
    if (!base) {
      const created = await request('POST', '/api/autodial/bases', {
        token,
        body: {
          name: BASE_NAME,
          description: 'Isolated MCP live numbers only',
          dedup_policy: 'phone',
          phone_normalization: 'none',
          fields: [{ key: 'phone', label: 'Phone', type: 'phone', is_phone: true, required: true, position: 0 }],
        },
      });
      if (created.status >= 400) throw new Error(`create base ${created.status} ${created.raw.slice(0, 400)}`);
      base = created.json;
      for (const raw of ['000091', '000092']) {
        const contact = await request('POST', `/api/autodial/bases/${base.uid}/contacts`, {
          token,
          body: { values: {}, phones: [{ raw, is_primary: true, tz_offset_min: 420 }] },
        });
        if (contact.status >= 400) throw new Error(`create contact ${raw} ${contact.status} ${contact.raw.slice(0, 400)}`);
      }
    }
    log.push({ base: { uid: base.uid, name: base.name } });

    const listed = await callTool(token, 'list_autodial_campaigns', {});
    let campaign = (listed.campaigns || []).find((c) => c.name === CAMPAIGN_NAME);
    if (!campaign) {
      const proposed = await callTool(token, 'create_autodial_campaign', {
        name: CAMPAIGN_NAME,
        base_uid: base.uid,
        dial_mode: 'agentless',
        pacing: { providers: [{ type: 'static', max_channels: 1 }], power_ratio: 1 },
        retry: { max_attempts: 2, default_interval_sec: 600, intervals_sec: { no_answer: 300, busy: 120 } },
        trunk_pool: [{ trunk_id: localTrunk.id, caller_id: '000090', max_channels: 1, weight: 1 }],
        cid_policy: { mode: 'per_trunk' },
        scenario_actions: [
          { id: 'play', type: 'playback', params: { file: 'beep', mode: 'plain' }, condition: {} },
          { id: 'end', type: 'hangup', params: {}, condition: {} },
        ],
        amd: { enabled: false, on_machine: 'hangup', message_prompt: null },
        success_min_sec: 8,
        dial_timeout_sec: 15,
        schedules: [],
      });
      if (!proposed?.proposalId) throw new Error(`create proposal missing: ${JSON.stringify(proposed).slice(0, 500)}`);
      const applied = await applyProposal(token, proposed.proposalId);
      log.push({ createProposal: proposed.proposalId, createApply: applied });
      const afterCreate = await callTool(token, 'list_autodial_campaigns', {});
      campaign = (afterCreate.campaigns || []).find((c) => c.name === CAMPAIGN_NAME);
    }
    if (!campaign) throw new Error('Campaign was not created');
    log.push({ campaignUid: campaign.uid, status: campaign.status });

    const updates = [
      { label: 'timeout', args: { uid: campaign.uid, dial_timeout_sec: 25 } },
      { label: 'success', args: { uid: campaign.uid, success_min_sec: 12 } },
      { label: 'pacing', args: { uid: campaign.uid, pacing: { providers: [{ type: 'static', max_channels: 2 }, { type: 'trunk_channels' }], power_ratio: 1.5 } } },
      { label: 'retry', args: { uid: campaign.uid, retry: { max_attempts: 4, default_interval_sec: 900, intervals_sec: { no_answer: 180, busy: 60, congestion: 90, failed: 240 } } } },
      { label: 'amd-hangup', args: { uid: campaign.uid, amd: { enabled: true, on_machine: 'hangup', message_prompt: null } } },
      { label: 'amd-continue', args: { uid: campaign.uid, amd: { enabled: true, on_machine: 'continue', message_prompt: null } } },
      {
        label: 'schedule',
        args: {
          uid: campaign.uid,
          schedules: [
            {
              kind: 'weekly',
              weekday: 1,
              time_from: '00:00',
              time_to: '23:59',
              timezone: 'Asia/Krasnoyarsk',
              enabled: true,
            },
          ],
        },
      },
      { label: 'mode-power', args: { uid: campaign.uid, dial_mode: 'power' } },
      { label: 'mode-agentless', args: { uid: campaign.uid, dial_mode: 'agentless' } },
    ];

    const appliedUpdates = [];
    for (const step of updates) {
      const proposed = await callTool(token, 'update_autodial_campaign', step.args);
      if (proposed?.refused) {
        appliedUpdates.push({ label: step.label, refused: proposed.message });
        continue;
      }
      if (!proposed?.proposalId) {
        appliedUpdates.push({ label: step.label, error: proposed });
        continue;
      }
      const applied = await applyProposal(token, proposed.proposalId);
      appliedUpdates.push({ label: step.label, proposalId: proposed.proposalId, ok: applied?.ok !== false, status: applied?.proposal?.status || applied });
    }
    log.push({ appliedUpdates });

    const snapshot = await callTool(token, 'get_autodial_campaign', { uid: campaign.uid });
    log.push({ snapshot: snapshot.campaign });

    const thread = await request('POST', '/api/ai-chat/threads', { token, body: {} });
    const chat = await request('POST', '/api/ai-chat/message', {
      token,
      body: {
        threadUid: thread.json?.uid,
        locale: 'ru',
        message: `Для тестовой кампании «${CAMPAIGN_NAME}» (это изолированный loopback, не боевой обзвон) поставь dial_timeout_sec=18 и success_min_sec=10 через update_autodial_campaign. Не запускай кампанию.`,
      },
    });
    log.push({
      thread: thread.status,
      threadUid: thread.json?.uid,
      chatStatus: chat.status,
      chatHead: String(chat.raw || '').slice(0, 800),
    });

    const pending = await request('GET', '/api/ai-chat/proposals/pending', { token });
    const pendingRows = Array.isArray(pending.json) ? pending.json : [];
    const chatProposal = pendingRows.find((p) => p.entityLabel === CAMPAIGN_NAME || String(p.summary || '').includes(CAMPAIGN_NAME));
    if (chatProposal?.proposalId) {
      const appliedChat = await applyProposal(token, chatProposal.proposalId);
      log.push({ chatProposal: chatProposal.proposalId, appliedChat });
    } else {
      log.push({ pendingCount: pendingRows.length, pendingLabels: pendingRows.map((p) => p.entityLabel) });
    }

    const finalSnap = await callTool(token, 'get_autodial_campaign', { uid: campaign.uid });
    const evidence = {
      at: new Date().toISOString(),
      tenant: admin.vpbx_user_uid,
      login: admin.login,
      campaign: finalSnap.campaign,
      autodialTools,
      localTrunk: { id: localTrunk.id, context: localTrunk.context },
      appliedUpdates,
      chat: { threadUid: thread.json?.uid, status: chat.status },
      started: false,
    };
    fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ ok: true, evidence: EVIDENCE, uid: campaign.uid, timeout: finalSnap.campaign?.dial_timeout_sec, amd: finalSnap.campaign?.amd }, null, 2));
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
