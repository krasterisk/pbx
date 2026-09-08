/**
 * End-to-end IVR setup via the live agent API.
 * Usage: node .tmp-ivr-e2e.js
 */
require('dotenv').config({ path: require('path').resolve('../../.env') });

const API = process.env.API_URL || 'http://127.0.0.1:5010/api';
const LOGIN = process.env.PW_USER || 'admin';
const PASSWORD = process.env.PW_PASS || 'admin';

const OPENAI_MSG =
  'Создай IVR - Продажи, текст: "Вы позвонили в компанию Рога и Копыта. Нажмите 1, чтобы связаться с продажами, 2 - технической поддержкой, 3 - бухгалтерией, или оставайтесь на линии" Пункты: 1 - Абонент 101 2 - 102 3 - 103 ничего не нажали - группа 101-103';

const AIPBX_MSG =
  'Создай IVR - Сервис, текст: "Здравствуйте, вы позвонили в службу сервиса. Нажмите 1 для консультации, 2 для ремонта, 3 для гарантии, или оставайтесь на линии" Пункты: 1 - Абонент 201 2 - 202 3 - 203 ничего не нажали - группа 201-203';

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function mintToken() {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'krasterisk-v4-secret';
  return jwt.sign(
    {
      sub: 58,
      login: LOGIN,
      name: 'admin',
      level: 1,
      role: 0,
      vpbx_user_uid: 0,
    },
    secret,
    { expiresIn: '2h' },
  );
}

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function setProvider(token, providerUid) {
  const res = await fetch(`${API}/ai-chat/default-provider`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ providerUid }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`setProvider ${res.status}: ${JSON.stringify(body)}`);
  log('provider set', body);
}

async function createThread(token) {
  const res = await fetch(`${API}/ai-chat/threads`, { method: 'POST', headers: headers(token) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`thread ${res.status}: ${JSON.stringify(body)}`);
  return body.uid || body.thread?.uid || body.id;
}

async function sendMessage(token, threadUid, message) {
  const res = await fetch(`${API}/ai-chat/message`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ threadUid, message, locale: 'ru' }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`message ${res.status}: ${text.slice(0, 400)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const block of parts) {
      const ev = parseSse(block);
      if (ev) events.push(ev);
    }
  }
  if (buf.trim()) {
    const ev = parseSse(buf);
    if (ev) events.push(ev);
  }
  return events;
}

function parseSse(block) {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

async function applyProposal(token, proposalId) {
  const res = await fetch(`${API}/ai-chat/proposals/${proposalId}/apply`, {
    method: 'POST',
    headers: headers(token),
  });
  const body = await res.json().catch(() => ({}));
  log('apply', proposalId, res.status, body.status || body.error || body.message || body);
  return { ok: res.ok, body };
}

async function pending(token) {
  const res = await fetch(`${API}/ai-chat/proposals/pending`, { headers: headers(token) });
  return res.ok ? res.json() : [];
}

function proposalIds(events) {
  const ids = new Set();
  for (const ev of events) {
    const d = ev.data;
    if (!d || typeof d !== 'object') continue;
    if (typeof d.proposalId === 'string') ids.add(d.proposalId);
    if (typeof d.proposal_id === 'string') ids.add(d.proposal_id);
  }
  return [...ids];
}

function summarize(events) {
  return events.map((ev) => {
    if (ev.event === 'text') return `text:${String(ev.data).slice(0, 160)}`;
    if (ev.event === 'error') return `error:${JSON.stringify(ev.data).slice(0, 240)}`;
    if (ev.event === 'tool_call') return `tool:${ev.data?.name}`;
    if (ev.event === 'proposal') return `proposal:${ev.data?.entityLabel || ev.data?.proposalId}`;
    return ev.event;
  });
}

async function snapshot() {
  const { Sequelize } = require('sequelize');
  const s = new Sequelize({
    dialect: process.env.DB_DIALECT || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: false,
  });
  const [groups] = await s.query(`SELECT uid, name, exten, strategy FROM call_groups`);
  const [ivrs] = await s.query(`SELECT uid, name, LEFT(CAST(prompts AS CHAR), 180) prompts, LEFT(CAST(menu_items AS CHAR), 400) menu_items FROM ivrs ORDER BY uid DESC LIMIT 8`);
  let endpoints = [];
  try {
    const [rows] = await s.query(`SELECT id, callerid, context FROM ps_endpoints WHERE id REGEXP 'e(101|102|103|201|202|203)_' ORDER BY id`);
    endpoints = rows;
  } catch {
    endpoints = [];
  }
  await s.close();
  return { groups, ivrs, endpoints };
}

function openaiReady(snap) {
  const group = snap.groups.find((g) => String(g.exten) === '9010' || /101-103|продаж/i.test(String(g.name)));
  const ivr = snap.ivrs.find((row) => /продаж/i.test(String(row.name)));
  const ext = new Set((snap.endpoints || []).map((e) => String(e.id)));
  const has101 = [...ext].some((id) => id.includes('101'));
  const has102 = [...ext].some((id) => id.includes('102'));
  const has103 = [...ext].some((id) => id.includes('103'));
  return { ok: !!(group && ivr && has101 && has102 && has103), group, ivr, has101, has102, has103 };
}

function aipbxReady(snap) {
  const group = snap.groups.find((g) => String(g.exten) === '9020' || /201-203|сервис/i.test(String(g.name)));
  const ivr = snap.ivrs.find((row) => /сервис/i.test(String(row.name)));
  const ext = new Set((snap.endpoints || []).map((e) => String(e.id)));
  const has201 = [...ext].some((id) => id.includes('201'));
  const has202 = [...ext].some((id) => id.includes('202'));
  const has203 = [...ext].some((id) => id.includes('203'));
  return { ok: !!(group && ivr && has201 && has202 && has203), group, ivr, has201, has202, has203 };
}

function nextAction(label, ready) {
  if (label === 'openai') {
    if (!ready.has102) return 'Абонент 101 уже есть. Вызови только create_endpoint для 102. Не трогай 101 и не вызывай create_ivr, пока нет 102 и 103.';
    if (!ready.has103) return 'Абоненты 101 и 102 уже есть. Вызови только create_endpoint для 103. Не повторяй 101/102 и не вызывай create_ivr.';
    if (!ready.group) {
      return 'Абоненты 101, 102, 103 уже есть. Не создавай абонентов. Вызови только create_call_group: name="Группа 9010", exten="9010", strategy="ringall", members=[{member_type:"internal",value:"101"},{value:"102"},{value:"103"}].';
    }
    return (
      'Абоненты 101/102/103 и группа 9010 уже существуют. Не создавай их снова. ' +
      'Сразу вызови create_ivr ОДНИМ объектом: ' +
      '{"name":"Продажи","prompts":[{"kind":"tts","engine_uid":1,"text":"Вы позвонили в компанию Рога и Копыта. Нажмите 1, чтобы связаться с продажами, 2 - технической поддержкой, 3 - бухгалтерией, или оставайтесь на линии"}],' +
      '"menu_items":[{"digit":"1","destination":{"kind":"extension","target":"101"}},{"digit":"2","destination":{"kind":"extension","target":"102"}},{"digit":"3","destination":{"kind":"extension","target":"103"}},{"digit":"t","destination":{"kind":"group","target":"9010"}}]}'
    );
  }
  if (!ready.has201) return 'Вызови create_endpoint только для 201. Потом остановись.';
  if (!ready.has202) return 'Абонент 201 уже есть. Вызови только create_endpoint для 202.';
  if (!ready.has203) return 'Абоненты 201 и 202 уже есть. Вызови только create_endpoint для 203.';
  const groupExten = ready.group ? String(ready.group.exten) : '9020';
  if (!ready.group) {
    return 'Абоненты 201, 202, 203 уже есть. Не создавай абонентов. Вызови только create_call_group: name="Группа 9020", exten="9020", strategy="ringall", members=[{member_type:"internal",value:"201"},{value:"202"},{value:"203"}].';
  }
  return (
    `Абоненты 201/202/203 и группа ${groupExten} уже существуют. Не создавай их снова. ` +
    'Сразу вызови create_ivr ОДНИМ объектом: ' +
    `{"name":"Сервис","prompts":[{"kind":"tts","engine_uid":1,"text":"Здравствуйте, вы позвонили в службу сервиса. Нажмите 1 для консультации, 2 для ремонта, 3 для гарантии, или оставайтесь на линии"}],` +
    `"menu_items":[{"digit":"1","destination":{"kind":"extension","target":"201"}},{"digit":"2","destination":{"kind":"extension","target":"202"}},{"digit":"3","destination":{"kind":"extension","target":"203"}},{"digit":"t","destination":{"kind":"group","target":"${groupExten}"}}]}`
  );
}

async function runScenario(token, label, firstMessage, readyFn) {
  const threadUid = await createThread(token);
  log(label, 'thread', threadUid);
  let message = firstMessage;
  for (let i = 0; i < 16; i += 1) {
    log(label, `turn ${i + 1}:`, message.slice(0, 180));
    const events = await sendMessage(token, threadUid, message);
    log(label, 'events', summarize(events).join(' | '));
    const ids = proposalIds(events);
    if (!ids.length) {
      const extra = await pending(token);
      const fresh = (Array.isArray(extra) ? extra : extra?.items || [])
        .filter((row) => {
          const created = new Date(row.created_at || row.createdAt || 0).getTime();
          return Date.now() - created < 10 * 60 * 1000;
        })
        .map((row) => row.proposalId || row.proposal_id)
        .filter(Boolean);
      ids.push(...fresh);
    }
    for (const id of new Set(ids)) {
      await applyProposal(token, id);
    }
    const snap = await snapshot();
    const ready = readyFn(snap);
    log(label, 'ready', ready);
    if (ready.ok) return { threadUid, ready, snap };
    message = nextAction(label, ready);
  }
  throw new Error(`${label} did not complete after retries`);
}

async function setAipbxModel() {
  const { Sequelize } = require('sequelize');
  const s = new Sequelize({
    dialect: process.env.DB_DIALECT || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: false,
  });
  await s.query(
    `UPDATE cc_ai_providers SET capabilities = JSON_ARRAY('llm','tools'), defaults = JSON_OBJECT('model','qwen3.5:8b') WHERE uid = 15`,
  );
  await s.close();
  log('aipbx defaults set to qwen3.5:8b + tools');
}

(async () => {
  const token = mintToken();
  log('minted JWT for', LOGIN);
  await setProvider(token, 16);
  const openaiFirst = `${OPENAI_MSG}

Абоненты 101, 102, 103 и группа 9010 уже существуют — не создавай их снова. Сразу вызови только create_ivr одним объектом (name, prompts TTS Яндекс, menu_items 1→101 2→102 3→103 t→group 9010).`;
  const openai = await runScenario(token, 'openai', openaiFirst, openaiReady);
  log('OPENAI DONE', openai.ready);

  await setAipbxModel();
  await setProvider(token, 15);
  const aipbx = await runScenario(token, 'aipbx', AIPBX_MSG, aipbxReady);
  log('AIPBX DONE', aipbx.ready);
  log('ALL DONE');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
