const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../packages/backend/src/skills');
const meta = {
  ivrs: {
    domains: ['ivrs'],
    intents: ['configure_ivr', 'create_ivr'],
    aliases: ['ivr', 'голосовое меню', 'меню'],
    related: ['endpoints', 'call-groups', 'routes'],
    risk: 'medium',
  },
  endpoints: {
    domains: ['endpoints'],
    intents: ['configure_endpoints', 'create_endpoints'],
    aliases: ['абонент', 'endpoint', 'внутренние'],
    related: ['call-groups', 'ivrs'],
    risk: 'medium',
  },
  'call-groups': {
    domains: ['call-groups'],
    intents: ['configure_call_group', 'create_call_group'],
    aliases: ['группа', 'call group', 'групп'],
    related: ['endpoints', 'ivrs', 'queues'],
    risk: 'medium',
  },
  queues: {
    domains: ['queues'],
    intents: ['configure_queue'],
    aliases: ['очередь', 'queue'],
    related: ['endpoints', 'moh'],
    risk: 'medium',
  },
  routes: {
    domains: ['routes'],
    intents: ['configure_route', 'inbound_did'],
    aliases: ['маршрут', 'route', 'did'],
    related: ['contexts', 'ivrs', 'trunks'],
    risk: 'high',
  },
  trunks: {
    domains: ['trunks'],
    intents: ['configure_trunk'],
    aliases: ['транк', 'trunk', 'провайдер'],
    related: ['routes', 'contexts'],
    risk: 'high',
  },
  contexts: {
    domains: ['contexts'],
    intents: ['configure_context'],
    aliases: ['контекст', 'context'],
    related: ['routes'],
    risk: 'high',
  },
  directories: {
    domains: ['directories'],
    intents: ['configure_directory'],
    aliases: ['справочник', 'directory'],
    related: [],
    risk: 'low',
  },
  moh: {
    domains: ['moh'],
    intents: ['configure_moh'],
    aliases: ['музыка', 'moh'],
    related: ['queues', 'routes'],
    risk: 'low',
  },
  diagnostics: {
    domains: ['diagnostics'],
    intents: ['diagnose'],
    aliases: ['диагност', 'status'],
    related: [],
    risk: 'low',
  },
  reports: {
    domains: ['reports'],
    intents: ['report'],
    aliases: ['отчет', 'cdr'],
    related: ['diagnostics'],
    risk: 'low',
  },
  'time-groups': {
    domains: ['time-groups'],
    intents: ['configure_time_group'],
    aliases: ['расписание', 'time group'],
    related: ['routes'],
    risk: 'medium',
  },
  voicemail: {
    domains: ['voicemail'],
    intents: ['configure_voicemail'],
    aliases: ['голосовая почта', 'voicemail'],
    related: ['endpoints'],
    risk: 'medium',
  },
  callcenter: {
    domains: ['callcenter'],
    intents: ['configure_callcenter'],
    aliases: ['колл-центр', 'callcenter'],
    related: ['queues'],
    risk: 'high',
  },
  messaging: {
    domains: ['messaging'],
    intents: ['configure_messaging'],
    aliases: ['чат', 'messaging'],
    related: [],
    risk: 'medium',
  },
  'speech-engines': {
    domains: ['speech-engines'],
    intents: ['configure_speech'],
    aliases: ['tts', 'speech'],
    related: ['ivrs', 'voice-robots'],
    risk: 'medium',
  },
  'voice-robots': {
    domains: ['voice-robots'],
    intents: ['configure_robot'],
    aliases: ['робот', 'voice robot'],
    related: ['speech-engines'],
    risk: 'high',
  },
  numbers: {
    domains: ['numbers'],
    intents: ['configure_numbers'],
    aliases: ['номера', 'access list'],
    related: [],
    risk: 'medium',
  },
  settings: {
    domains: ['settings'],
    intents: ['configure_settings'],
    aliases: ['настройки', 'settings'],
    related: [],
    risk: 'high',
  },
  users: {
    domains: ['users'],
    intents: ['configure_users'],
    aliases: ['пользователи', 'users'],
    related: [],
    risk: 'high',
  },
  operations: {
    domains: ['operations'],
    intents: ['operate'],
    aliases: ['операции', 'reload'],
    related: ['diagnostics'],
    risk: 'high',
  },
  'developer-convention': {
    domains: ['developer-convention'],
    intents: ['developer'],
    aliases: ['конвенция'],
    related: [],
    risk: 'low',
  },
};

function fmt(arr) {
  return `[${arr.map((x) => JSON.stringify(x)).join(', ')}]`;
}

for (const dir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const file = path.join(root, dir, 'SKILL.md');
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) continue;
  const name = (/^name:\s*(.+)$/m.exec(m[1]) || [])[1]?.trim().replace(/^['"]|['"]$/g, '') || dir;
  const desc = (/^description:\s*(.+)$/m.exec(m[1]) || [])[1]?.trim() || '';
  const metaRow = meta[name] || meta[dir] || {
    domains: [name],
    intents: [],
    aliases: [],
    related: [],
    risk: 'medium',
  };
  const head = [
    '---',
    `name: ${name}`,
    `description: ${desc}`,
    `domains: ${fmt(metaRow.domains)}`,
    `intents: ${fmt(metaRow.intents)}`,
    `aliases: ${fmt(metaRow.aliases)}`,
    `related: ${fmt(metaRow.related)}`,
    `risk: ${metaRow.risk}`,
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(file, head + m[2].replace(/^\r?\n/, ''));
  console.log('updated', name);
}
