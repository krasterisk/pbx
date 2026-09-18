// Opt-in integration check against the development PBX. Never run automatically in CI.
// Bootstraps dependency injection WITHOUT application lifecycle hooks/background jobs.
const assert = require('node:assert/strict');
const path = require('node:path');
const { NestFactory } = require('@nestjs/core');
const dist = path.resolve(__dirname, '../dist');
const load = (file, name) => require(path.join(dist, file))[name];
const { randomUUID } = require('node:crypto');

async function main() {
  if (process.env.ALLOW_LIVE_PBX_CHECK !== '1') throw new Error('Set ALLOW_LIVE_PBX_CHECK=1 for an authorized development PBX');
  console.log('Starting isolated dependency injection (no lifecycle hooks)');
  const app = await NestFactory.create(load('app.module', 'AppModule'), { logger: ['error', 'warn', 'log'], abortOnError: false });
  console.log('Dependency injection ready');
  const get = (file, name) => app.get(load(file, name));
  const ami = get('modules/ami/ami.service', 'AmiService');
  const contexts = get('modules/contexts/contexts.service', 'ContextsService');
  const routes = get('modules/routes/routes.service', 'RoutesService');
  const registry = get('modules/ai-platform/ai-adapter-registry.service', 'AiAdapterRegistryService');
  const diff = get('modules/ai-chat/pbx-agent-diff.service', 'PbxAgentDiffService');
  const reload = get('modules/routes/route-apply.service', 'RouteApplyService');
  const User = load('modules/users/user.model', 'User');
  const Proposal = load('modules/ai-chat/models/agent-proposal.model', 'AgentProposal');
  const admin = await User.findOne({ where: { login: process.env.LIVE_PBX_USER || 'admin' } });
  assert(admin && admin.level === 1, 'A real tenant admin is required');
  const ctx = { vpbxUserUid: admin.vpbx_user_uid, userUid: admin.uniqueid, role: admin.level };
  const ids = [];
  let context;
  try {
    get('modules/routes/routes-ai.adapter', 'RoutesAiAdapter').onModuleInit();
    ami.onModuleInit();
    for (let i = 0; i < 100 && !ami.isConnected(); i++) await new Promise(r => setTimeout(r, 100));
    assert(ami.isConnected(), 'AMI must be connected');
    context = await contexts.create({ name: `codexcheck${randomUUID().slice(0, 8)}`, comment: 'Temporary proposal safety check' }, ctx.vpbxUserUid);
    const tool = registry.getMutationTool('create_route');
    // Adapters construct fresh definitions on lookup. Keep this test's instrumented
    // executor stable so concurrency assertions observe the actual confirm path.
    const lookup = registry.getMutationTool.bind(registry);
    registry.getMutationTool = name => name === 'create_route' ? tool : lookup(name);
    const propose = async (number) => {
      const raw = await tool.handler({ context_uid: context.uid, pattern: number,
        name: `Safety check ${number}`, actions: [{ type: 'playback', params: { file: 'beep' } }, { type: 'hangup', params: {} }] }, ctx.vpbxUserUid);
      const view = await diff.createProposal(raw, ctx); ids.push(view.proposalId); return view;
    };
    const first = await propose('9876501');
    assert.equal((await routes.findAllByContext(context.uid, ctx.vpbxUserUid)).length, 0, 'proposal must not write');
    assert.equal((await diff.apply(first.proposalId, { ...ctx, vpbxUserUid: -1 })).ok, false, 'foreign tenant');
    let release, entered;
    const started = new Promise(r => { entered = r; });
    const gate = new Promise(r => { release = r; });
    const originalApply = tool.mutation.apply;
    let writes = 0;
    tool.mutation.apply = async (...args) => { writes++; entered(); await gate; return originalApply(...args); };
    const winner = diff.apply(first.proposalId, ctx);
    await started;
    const duplicate = await diff.apply(first.proposalId, ctx);
    const rejectDuringWrite = await diff.reject(first.proposalId, ctx);
    release();
    assert.equal(duplicate.ok, false);
    assert.equal(rejectDuringWrite.ok, false);
    assert.equal((await winner).ok, true);
    assert.equal((await diff.apply(first.proposalId, ctx)).ok, true);
    assert.equal(writes, 1);
    console.log('PASS real MySQL: proposal-only, tenant isolation, concurrent confirm/reject, idempotent replay');
    tool.mutation.apply = async (...args) => { writes++; return originalApply(...args); };
    const second = await propose('9876502');
    const originalReload = reload.applyContext.bind(reload);
    reload.applyContext = async () => { throw new Error('Injected reload transport failure'); };
    try { assert.equal((await diff.apply(second.proposalId, ctx)).reason, 'switch_failed'); }
    finally { reload.applyContext = originalReload; }
    assert.equal((await diff.reject(second.proposalId, ctx)).ok, false);
    assert.equal((await diff.apply(second.proposalId, ctx)).ok, true);
    assert.equal(writes, 2, 'retry must reload without another write');
    assert.equal((await routes.findAllByContext(context.uid, ctx.vpbxUserUid)).length, 2);
    console.log('PASS real MySQL + AMI: reload recovery without duplicate route');
    const dialContext = context.name.endsWith(String(ctx.vpbxUserUid)) ? context.name : `${context.name}${ctx.vpbxUserUid}`;
    const result = await ami.action({ Action: 'Originate', Channel: `Local/9876502@${dialContext}/n`, Application: 'Wait', Data: '1', Timeout: 10000, Async: 'false' });
    assert.equal(String(result.response).toLowerCase(), 'success');
    console.log('PASS live Asterisk: Local originate answered through the proposed Playback(beep) route');
    await new Promise(r => setTimeout(r, 1500));
  } finally {
    if (context) {
      for (const route of await routes.findAllByContext(context.uid, ctx.vpbxUserUid)) await routes.remove(route.uid, ctx.vpbxUserUid);
      await reload.applyContext(context.uid, ctx.vpbxUserUid, true);
      await contexts.remove(context.uid, ctx.vpbxUserUid);
    }
    if (ids.length) await Proposal.destroy({ where: { proposal_id: ids, vpbx_user_uid: ctx.vpbxUserUid, user_uid: ctx.userUid } });
    ami.onModuleDestroy();
    await app.close();
    console.log('Temporary database objects removed; empty test dialplan context retained for inspection.');
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
