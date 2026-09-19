/** Opt-in PBX ARI/AMD probe. Only a dedicated, pre-created Local dialplan context. */
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');

if (process.env.AC_LIVE_GATE_ALLOWED !== '1' ||
    !/^(?:codex-ac-gate|codex-cid-loop)-[a-z0-9-]+$/.test(process.env.AC_LIVE_GATE_CONTEXT || '')) {
  throw new Error('Set AC_LIVE_GATE_ALLOWED=1 and a dedicated AC_LIVE_GATE_CONTEXT');
}

for (const line of fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const base = `${process.env.ARI_PROTOCOL}://${process.env.ARI_HOST}:${process.env.ARI_PORT}/ari`;
const authorization = `Basic ${Buffer.from(`${process.env.ARI_USER}:${process.env.ARI_PASSWORD}`).toString('base64')}`;
const app = `codex_ac_gate_${process.pid}`;
const context = process.env.AC_LIVE_GATE_CONTEXT;
const events = [];
const channels = new Set();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(method, resource, params, body) {
  const url = new URL(`${base}${resource}`);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    method,
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${resource}: HTTP ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : undefined;
}

async function waitUntil(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function probe(kind) {
  const id = `codex-gate-${kind}-${Date.now()}`;
  const callerId = kind === 'human' ? '74951112233' : kind === 'machine' ? '74957778899' : '74954445566';
  channels.add(id);
  await request('POST', '/channels/create', {
    endpoint: `Local/${kind}@${context}/n`, app, appArgs: `autodial-gate,${kind}`, channelId: id,
  }, { variables: { 'CALLERID(num)': callerId } });
  await request('POST', `/channels/${id}/dial`, { timeout: 15 });
  const up = await waitUntil(() => events.find((event) => event.channel?.id === id &&
    ((event.type === 'ChannelStateChange' && event.channel?.state === 'Up') ||
      (event.type === 'StasisStart' && event.channel?.state === 'Up'))), 15000, `${kind} Up`);
  console.log(JSON.stringify({ kind, phase: 'Up', ariCallerId: up.channel?.caller?.number || null }));
  await request('POST', `/channels/${id}/continue`, { context, extension: 'run', priority: 1 });

  const status = await waitUntil(async () => {
    try {
      return (await request('GET', `/channels/${id}/variable`, { variable: 'AMDSTATUS' }))?.value || null;
    } catch (error) {
      if (error.message.includes('HTTP 404')) return null;
      throw error;
    }
  }, 12000, `${kind} AMDSTATUS`).catch((error) => {
    console.log(JSON.stringify({
      kind, phase: 'AMD timeout',
      eventSequence: events.filter((event) => event.channel?.id === id)
        .map((event) => `${event.type}:${event.channel?.state || ''}`),
    }));
    throw error;
  });
  const related = events.filter((event) => event.channel?.id === id);
  console.log(JSON.stringify({
    kind, callerId, ariCallerId: up.channel?.caller?.number || null, amdStatus: status,
    eventSequence: related.map((event) => `${event.type}:${event.channel?.state || ''}`),
  }));
  if (up.channel?.caller?.number !== callerId) throw new Error(`${kind} CallerID mismatch in ARI`);
  if (!['HUMAN', 'MACHINE', 'NOTSURE'].includes(status)) throw new Error(`${kind} AMD result ${status}`);
  if (kind === 'machine' && status !== 'MACHINE') throw new Error(`machine greeting classified as ${status}`);
}

async function probeSipLoopback() {
  if (process.env.AC_LIVE_GATE_SIP_LOOPBACK !== '1') throw new Error('SIP loopback probe needs explicit opt-in');
  const id = `codex-gate-sip-${Date.now()}`;
  const callerId = '74956660011';
  channels.add(id);
  await request('POST', '/channels/create', {
    endpoint: 'PJSIP/t_test_trunk_0/sip:000000@127.0.0.1:59999',
    app, appArgs: 'autodial-gate,sip', channelId: id,
  }, { variables: { 'CALLERID(num)': callerId } });
  await request('POST', `/channels/${id}/dial`, { timeout: 3 });
  await sleep(3000);
  console.log(JSON.stringify({
    kind: 'sip', callerId,
    eventSequence: events.filter((event) => event.channel?.id === id)
      .map((event) => `${event.type}:${event.channel?.state || ''}`),
  }));
}

async function probeSelfTrunk(number, callerId) {
  if (process.env.AC_LIVE_GATE_SIP_LOOPBACK !== '1') throw new Error('SIP loopback probe needs explicit opt-in');
  const trunk = 't_codex_cid_loop_20260918_0';
  const id = `codex-gate-self-${number}-${Date.now()}`;
  channels.add(id);
  const identityMode = process.env.AC_LIVE_GATE_IDENTITY_MODE || 'baseline';
  if (!['baseline', 'allowed', 'originate'].includes(identityMode)) throw new Error('Unknown identity mode');
  await request('POST', identityMode === 'originate' ? '/channels' : '/channels/create', {
    endpoint: `PJSIP/${number}@${trunk}`,
    app, appArgs: 'autodial-gate,self', channelId: id,
    ...(identityMode === 'originate' ? { callerId, timeout: 5 } : {}),
  }, { variables: {
    'CALLERID(num)': callerId,
    ...(identityMode === 'allowed' ? {
      'CALLERID(num-pres)': 'allowed_not_screened',
      'CALLERID(name-pres)': 'allowed_not_screened',
    } : {}),
  } });
  const identity = {};
  for (const variable of ['CALLERID(num)', 'CALLERID(num-pres)', 'CALLERID(name-pres)', 'CALLERID(all)']) {
    try { identity[variable] = (await request('GET', `/channels/${id}/variable`, { variable }))?.value ?? null; }
    catch (error) { identity[variable] = error.message.match(/HTTP (\d+)/)?.[1] || 'unavailable'; }
  }
  console.log(JSON.stringify({ kind: 'self', number, phase: 'before dial', identityMode, identity }));
  if (identityMode !== 'originate') await request('POST', `/channels/${id}/dial`, { timeout: 5 });
  const up = await waitUntil(() => events.find((event) => event.channel?.id === id &&
    event.type === 'ChannelStateChange' && event.channel?.state === 'Up'), 8000, `${number} self-trunk Up`);
  await sleep(2500);
  console.log(JSON.stringify({
    kind: 'self', number, callerId, ariCallerId: up.channel?.caller?.number || null,
    eventSequence: events.filter((event) => event.channel?.id === id)
      .map((event) => `${event.type}:${event.channel?.state || ''}`),
  }));
  if (up.channel?.caller?.number !== callerId) throw new Error(`${number} CallerID mismatch in ARI`);
}

async function probeSelfFailure() {
  if (process.env.AC_LIVE_GATE_SIP_LOOPBACK !== '1') throw new Error('SIP loopback probe needs explicit opt-in');
  const id = `codex-gate-self-fail-${Date.now()}`;
  channels.add(id);
  await request('POST', '/channels', {
    endpoint: 'PJSIP/000099@t_codex_cid_loop_20260918_0',
    app, appArgs: 'autodial-gate,self-fail', channelId: id,
    callerId: '74951112233', timeout: 3,
  });
  await waitUntil(() => events.find((event) => event.channel?.id === id &&
    event.type === 'ChannelDestroyed'), 6000, 'self-fail destroyed');
  console.log(JSON.stringify({
    kind: 'self-fail',
    eventSequence: events.filter((event) => event.channel?.id === id)
      .map((event) => `${event.type}:${event.channel?.state || ''}`),
  }));
}

async function main() {
  const eventsUrl = new URL(`${base.replace(/^http/, 'ws')}/events`);
  eventsUrl.searchParams.set('app', app);
  const ws = new WebSocket(eventsUrl, { headers: { Authorization: authorization } });
  ws.on('message', (data) => {
    try { events.push(JSON.parse(String(data))); } catch { /* ignore malformed event */ }
  });
  try {
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    const cases = process.env.AC_LIVE_GATE_CASES?.split(',') || ['human', 'silent', 'machine'];
    for (const kind of cases) {
      if (kind === 'sip') await probeSipLoopback();
      else if (kind === 'self') {
        await probeSelfTrunk('000001', '74951112233');
        await probeSelfTrunk('000002', '74954445566');
      }
      else if (kind === 'self-fail') await probeSelfFailure();
      else if (['human', 'silent', 'machine'].includes(kind)) await probe(kind);
      else throw new Error(`Unknown case ${kind}`);
    }
  } finally {
    for (const id of channels) {
      try { await request('DELETE', `/channels/${id}`); } catch { /* already ended */ }
    }
    ws.close();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
