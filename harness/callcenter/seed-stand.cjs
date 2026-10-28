'use strict';
// Explicit isolated database and private output are mandatory; never bootstrap Nest.
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize-typescript');
const root = process.env.APP_ROOT || '/app';
const dist = path.join(root, 'packages/backend/dist');
const load = (file, name) => require(path.join(dist, file))[name];
const User = load('modules/users/user.model', 'User');
const Tenant = load('modules/cloud-admin/tenant.model', 'Tenant');
const BillingSeller = load('modules/cloud-admin/billing-seller.model', 'BillingSeller');
const Context = load('modules/contexts/context.model', 'Context');
const Queue = load('modules/queues/queue.model', 'Queue');
const PsEndpoint = load('modules/endpoints/ps-endpoint.model', 'PsEndpoint');
const CcAgentSession = load('modules/callcenter/models/agent-session.model', 'CcAgentSession');
const CcAgentQueue = load('modules/callcenter/models/agent-queue.model', 'CcAgentQueue');
const CcQueueCall = load('modules/callcenter/models/queue-call.model', 'CcQueueCall');
const CcMissedCall = load('modules/callcenter/models/missed-call.model', 'CcMissedCall');
const CcSettings = load('modules/callcenter/models/cc-settings.model', 'CcSettings');
const CcOperatorSettings = load('modules/callcenter/models/operator-settings.model', 'CcOperatorSettings');
const { TenantIdentityService } = require(path.join(dist, 'modules/tenant-identity/tenant-identity.service'));
const { resolveDatabaseConfig } = require(path.join(dist, 'database/database-config.cjs'));

async function main() {
  if (process.env.DB_NAME !== 'krasterisk_ci_chatr29_a13' || process.env.NODE_ENV !== 'test') {
    throw new Error('This seed is restricted to the explicitly owned test database');
  }
  const output = process.env.SEED_OUTPUT_PATH;
  if (!output || !path.isAbsolute(output) || fs.existsSync(output)) throw new Error('Fresh private seed output required');
  const models = [User, Tenant, BillingSeller, Context, Queue, PsEndpoint, CcAgentSession,
    CcAgentQueue, CcQueueCall, CcMissedCall, CcSettings, CcOperatorSettings];
  const db = new Sequelize({ ...resolveDatabaseConfig(process.env, { requireExplicitConnection: true }), models, logging: false });
  try {
    const login = 'pulse_load_a13';
    if (await User.findOne({ where: { login } })) throw new Error('Owned cabinet already exists; inspect its receipt before continuing');
    const password = crypto.randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 12);
    const identity = new TenantIdentityService(db, User, Tenant, BillingSeller);
    const { user } = await identity.create({ login, name: 'Пульс · нагрузочный стенд',
      passwordHash, activateImmediately: true, trialDays: 365,
      companyName: 'Пульс · 150 внутренних соединений', limits: { extensions: 250, trunks: 0, queues: 20 } }, 'pbx',
    async (transaction, owner) => {
      await Context.create({ name: `internal_${owner.uniqueid}`, comment: 'Owned A13 internal fixture', user_uid: owner.uniqueid }, { transaction });
    });
    const tenant = user.uniqueid;
    const queueNames = Array.from({ length: 12 }, (_, i) => `q${8600 + i}_${tenant}`);
    const agents = [];
    await db.transaction(async (transaction) => {
      await Queue.bulkCreate(queueNames.map((name, i) => ({ name, display_name: `Пульс · Тест ${i + 1}`,
        user_uid: tenant, strategy: 'rrmemory', timeout: 20, retry: 1, wrapuptime: 0,
        servicelevel: 20, joinempty: 'yes', leavewhenempty: 'no', autofill: 'yes', ringinuse: false })), { transaction });
      for (let i = 0; i < 200; i++) {
        const extension = String(8700 + i), endpoint = `e${extension}_${tenant}`, iface = `PJSIP/${endpoint}`;
        const agent = await User.create({ login: `pulse_a13_${extension}_${tenant}`, name: `Тест · Оператор ${String(i + 1).padStart(3, '0')}`,
          passwd: '', level: 2, role: 0, exten: extension, vpbx_user_uid: tenant, isActivated: true }, { transaction });
        await PsEndpoint.create({ id: endpoint, context: `internal_${tenant}`, aors: endpoint, disallow: 'all', allow: 'ulaw',
          direct_media: 'no', webrtc: 'no', callerid: `Тест ${extension} <${extension}>` }, { transaction });
        const queues = [queueNames[i % queueNames.length]];
        await CcAgentQueue.create({ user_id: agent.uniqueid, agent_interface: iface,
          queue_name: queues[0], user_uid: tenant, penalty: 0 }, { transaction });
        await CcAgentSession.create({ user_id: agent.uniqueid, agent_interface: iface,
          user_uid: tenant, login_time: new Date(), last_status: 'READY', last_status_at: new Date(),
          last_status_origin: 'login', queues_snapshot: queues, softphone_mode: 'sip', panel_seen_at: new Date() }, { transaction });
        agents.push({ userId: agent.uniqueid, extension, endpoint, interface: iface, queues });
      }
      const supervisor = await User.create({ login: 'pulse_supervisor_a13', name: 'Пульс · Супервизор', passwd: passwordHash,
        level: 3, role: 0, vpbx_user_uid: tenant, isActivated: true }, { transaction });
      await CcOperatorSettings.create({ operator_user_id: supervisor.uniqueid, user_uid: tenant,
        supervised_agent_extens: agents.map(a => a.extension) }, { transaction });
      await CcSettings.create({ user_uid: tenant, shift_policy: { idle_timeout_min: 0, max_duration_min: 0,
        close_at_eod: false, eod_time: '00:00', idle_requires_unregistered: true, free_exten_on_close: true } }, { transaction });
      const history = [];
      const now = Date.now();
      for (let i = 0; i < 12000; i++) {
        const agent = agents[i % agents.length], answered = i % 7 !== 0;
        const enter = now - 600000 - (i % 2880) * 30000, wait = 3 + i % 40, talk = answered ? 30 + i % 240 : 0;
        history.push({ call_uniqueid: `a13-seed-${tenant}-${i}`, queue_name: queueNames[i % 12],
          agent_interface: answered ? agent.interface : '', agent_user_uid: answered ? agent.userId : null,
          caller_id_num: String(880000 + i % 9000), caller_id_name: `Тестовая история ${i + 1}`,
          enter_time: new Date(enter), answer_time: answered ? new Date(enter + wait * 1000) : null,
          end_time: new Date(enter + (wait + talk) * 1000), wait_time: wait, talk_time: talk,
          disposition: answered ? 'answered' : 'abandoned', direction: i % 5 === 0 ? 'outbound' : 'inbound',
          call_type: 'a13-seeded-history', user_uid: tenant, created_at: new Date(enter) });
      }
      for (let offset = 0; offset < history.length; offset += 500) await CcQueueCall.bulkCreate(history.slice(offset, offset + 500), { transaction });
      await CcMissedCall.bulkCreate(history.filter(h => h.disposition === 'abandoned').slice(0, 120).map((h, i) => ({
        call_uniqueid: h.call_uniqueid, queue_name: h.queue_name, caller_id_num: h.caller_id_num,
        caller_id_name: h.caller_id_name, hold_time: h.wait_time, position: i % 8 + 1,
        called_back: i % 4 === 0, client_called_back: i % 4 === 1,
        note: 'Синтетическая история A13; реальные нагрузочные вызовы учитываются отдельно',
        created_at: h.created_at, user_uid: tenant })), { transaction });
      fs.writeFileSync(output, JSON.stringify({ tenant, owner: { login, password },
        supervisor: { login: supervisor.login, password, userId: supervisor.uniqueid }, agents, queues: queueNames,
        seededHistoryRows: history.length, note: 'History is synthetic; live SIP/RTP calls require separate evidence' }, null, 2), { mode: 0o600, flag: 'wx' });
    });
    console.log(JSON.stringify({ tenant, operators: agents.length, queues: queueNames.length, syntheticHistory: 12000, privateReceipt: output }));
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(JSON.stringify({ error: error.name, message: error.message, code: error.parent?.code })); process.exitCode = 1; });
