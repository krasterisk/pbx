'use strict';
// Explicit opt-in, isolated tenant, real HTTP controllers + DB + remote AMI.
// Does not boot workers, create trunks, or place any PSTN/SIP-provider call.
if (!process.argv.includes('--run-live')) throw new Error('Use --run-live for the authorized Asterisk lab');
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { Sequelize } = require('sequelize-typescript');
const { Op } = require('sequelize');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, Logger } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { getModelToken } = require('@nestjs/sequelize');
const dist = path.resolve(__dirname, '../../../packages/backend/dist');
const load = (file) => require(path.join(dist, file));
const { resolveDatabaseConfig } = load('database/database-config.cjs');
const { PBX_CORE_MODELS } = load('compositions/pbx-core.composition.js');
const { COMMERCIAL_AI_MODELS } = load('compositions/commercial-ai.composition.js');
const { Context } = load('modules/contexts/context.model.js');
const { Route } = load('modules/routes/route.model.js');
const { ContextInclude } = load('modules/routes/context-include.model.js');
const { TenantSetting } = load('modules/tenant-settings/tenant-setting.model.js');
const { ContextsService } = load('modules/contexts/contexts.service.js');
const { ContextIncludesService } = load('modules/routes/context-includes.service.js');
const { TenantSettingsService } = load('modules/tenant-settings/tenant-settings.service.js');
const { RoutesService } = load('modules/routes/routes.service.js');
const { RouteApplyService } = load('modules/routes/route-apply.service.js');
const { DialplanApplyService } = load('modules/ami/dialplan-apply.service.js');
const { ContextsController } = load('modules/contexts/contexts.controller.js');
const { RoutesController } = load('modules/routes/routes.controller.js');
const { ContextIncludesController } = load('modules/routes/context-includes.controller.js');
const { JwtStrategy } = load('modules/auth/jwt.strategy.js');
const { AuthService } = load('modules/auth/auth.service.js');

const config = resolveDatabaseConfig(process.env);
assert.equal(config.host, 'ipbx.krasterisk.ru', 'Unexpected database host');
assert.equal(process.env.AMI_HOST, 'ipbx.krasterisk.ru', 'Unexpected AMI host');
const run = `cidaudit_${crypto.randomBytes(5).toString('hex')}`;
const tenant = 800000000 + crypto.randomInt(10000000);
const s = new Sequelize({ ...config, logging: false, models: [...PBX_CORE_MODELS, ...COMMERCIAL_AI_MODELS] });
let app;
let manager;
const files = new Set();
const events = [];
const originateResponses = [];
const checks = [];
let fixtureOwned = false;
let probeSequence = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evidence = { run, tenant, target: config.host, checks, cleanup: false };
Logger.overrideLogger(['error']);

async function main() {
  await s.authenticate();
  assert.equal(await Context.count({ where: { user_uid: [tenant, tenant + 1] } }), 0, 'Disposable tenant already exists');
  assert.equal(await s.model('User').count({ where: { uniqueid: [tenant, tenant + 1] } }), 0, 'Test ID belongs to a real tenant');
  assert.equal(await TenantSetting.count({ where: { vpbxUserUid: [tenant, tenant + 1] } }), 0, 'Test tenant settings already exist');
  fixtureOwned = true;
  const Manager = require('asterisk-manager');
  manager = new Manager(Number(process.env.AMI_PORT || 5038), process.env.AMI_HOST, process.env.AMI_LOGIN, process.env.AMI_SECRET, true);
  const action = (params) => new Promise((resolve, reject) => manager.action(params, (error, result) => {
    // Match AmiService: asterisk-manager may put a success response in err.
    const response = result || error;
    if (response?.response === 'Success' || (!error && response?.response !== 'Error')) resolve(response);
    else reject(new Error(response?.message || 'AMI action failed'));
  }));
  manager.on('managerevent', (event) => {
    if (event.userevent === 'CallerIdRoutingAudit' && event.run === run) events.push(event);
    if (event.event === 'OriginateResponse' && event.actionid?.startsWith(run)) originateResponses.push(event);
  });
  await action({ action: 'Ping' });
  const includes = new ContextIncludesService(ContextInclude, Context, s);
  const settings = new TenantSettingsService(TenantSetting);
  const contexts = new ContextsService(Context, {}, settings, s, includes);
  const directoryModule = load('modules/directories/directory.model.js');
  const fieldModule = load('modules/directories/directory-field.model.js');
  const bindingModule = load('modules/directories/route-directory-binding.model.js');
  const routes = new RoutesService(Route, bindingModule.RouteDirectoryBinding, directoryModule.Directory, fieldModule.DirectoryField, { findAll: async () => [] });
  const apply = new RouteApplyService(routes, includes, new DialplanApplyService({ action, command: (command) => action({ action: 'Command', command }) }), Context);
  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [ContextsController, RoutesController, ContextIncludesController],
    providers: [
      { provide: ConfigService, useValue: new ConfigService(process.env) },
      { provide: AuthService, useValue: { validateJwtPayload: AuthService.prototype.validateJwtPayload } },
      JwtStrategy,
      { provide: ContextsService, useValue: contexts },
      { provide: ContextIncludesService, useValue: includes },
      { provide: RoutesService, useValue: routes },
      { provide: RouteApplyService, useValue: apply },
      { provide: getModelToken(Context), useValue: Context },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: tenant, level: 1, role: 1, login: run, vpbx_user_uid: tenant }, { expiresIn: '10m' });
  const request = async (method, url, data, expected = 200) => {
    const response = await fetch(base + '/api' + url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(body)}`);
    return body;
  };
  const create = async (name, include_uids = []) => {
    // Track the exact future filename before HTTP creation, including apply failure.
    files.add(`extensions_${run}_${name}${tenant}.conf`);
    const row = await request('POST', '/contexts', { name: `${run}_${name}`, include_uids }, 201);
    if (!row.dialplan_applied) await apply.applyContext(row.uid, tenant, true);
    assert.equal(row.dialplan_applied, true, 'Context was saved but not applied');
    return row;
  };
  const primary = await create('primary');
  const included = await create('included');
  const entry = await create('entry', [included.uid]);
  const commands = (marker, changeCaller = false) => [
    { id: 'answer', type: 'cmd', params: { command: 'Answer()' }, condition: {} },
    ...(changeCaller ? [{ id: 'change', type: 'cmd', params: { command: 'Set(CALLERID(num)=999)' }, condition: {} }] : []),
    { id: 'mark', type: 'cmd', params: { command: 'UserEvent(CallerIdRoutingAudit,Run:' + run + ',Marker:' + marker + ',CallId:$' + '{UNIQUEID},Caller:$' + '{CALLERID(num)},Destination:$' + '{EXTEN})' }, condition: {} },
  ];
  const route = (context, marker, extensions, changeCaller = false) => request('POST', '/routes', { context_uid: context.uid, name: run + '_' + marker, extensions, actions: commands(marker, changeCaller), options: {} }, 201);
  const probe = async (context, extension, caller, expectedMarker) => {
    const start = events.length;
    const actionid = run + '_' + ++probeSequence;
    let rejected = false;
    await action({ action: 'Originate', actionid, channel: 'Local/' + extension + '@' + context.name + tenant + '/n', callerid: caller ? 'Audit <' + caller + '>' : '', application: 'Wait', data: '1', async: 'true', timeout: 3000 }).catch(() => { rejected = true; });
    await sleep(1800);
    const actual = events.slice(start);
    assert.deepEqual(actual.map(event => event.marker), expectedMarker ? [expectedMarker] : [], 'Unexpected marker for ' + extension + '/' + caller);
    if (!expectedMarker) assert.ok(rejected || originateResponses.some(response => response.actionid === actionid && response.response === 'Failure'), 'No explicit rejection');
    if (expectedMarker) assert.equal(actual[0].destination, extension, 'Execution must preserve EXTEN');
    return actual;
  };
  await route(primary, 'FALLBACK', ['700']);
  const exact = await route(primary, 'EXACT', ['700/201'], true);
  const marked = await probe(primary,'700','201','EXACT');
  assert.equal(marked[0].caller,'999','Caller ID change must execute and still retain the selected chain');
  await probe(primary,'700','202','FALLBACK');
  checks.push({case:'exact_cid_and_mid_chain_change_no_leak',pass:true});
  const mask = await route(primary,'MASK',['701/_2XX']);
  await route(primary,'MASK_FALLBACK',['701']);
  await probe(primary,'701','245','MASK');
  await probe(primary,'701','345','MASK_FALLBACK');
  checks.push({case:'cid_mask_and_generic_fallback',pass:true});
  await route(primary,'PAIR',['702/203','703/204']);
  await probe(primary,'702','203','PAIR');
  await probe(primary,'703','204','PAIR');
  await probe(primary,'702','204',null);
  checks.push({case:'multiple_pairs_and_nonmatching_rejection',pass:true});
  await route(primary,'ANONYMOUS',['704/']);
  await probe(primary,'704','','ANONYMOUS');
  await probe(primary,'704','201',null);
  checks.push({case:'anonymous_distinct_from_any',pass:true});
  const destMask = await route(primary,'DEST_MASK',['_8XX/_3XX']);
  await probe(primary,'812','301','DEST_MASK');
  await probe(primary,'812','201',null);
  checks.push({case:'destination_and_caller_masks',pass:true});
  await route(included,'INCLUDED',['705/201']);
  await probe(entry,'705','201','INCLUDED');
  await route(entry,'OWN',['705']);
  await probe(entry,'705','201','OWN');
  checks.push({case:'included_cid_and_own_context_precedence',pass:true});
  await request('POST','/routes',{context_uid:primary.uid,name:run+'_bad',extensions:['700/201'],actions:commands('BAD')},400);
  await request('POST','/routes',{context_uid:primary.uid,name:run+'_bad',extensions:['706/201\n'],actions:commands('BAD')},400);
  const concurrent = await Promise.all([0,1].map(index=>request('POST','/routes',{context_uid:primary.uid,name:run+'_concurrent'+index,extensions:['707/201'],actions:commands('CONCURRENT')},201).then(()=> 'saved').catch(()=> 'rejected')));
  assert.deepEqual(concurrent.sort(),['rejected','saved']);
  checks.push({case:'validation_duplicate_and_concurrent_pair',pass:true});
  await request('PUT','/routes/'+mask.uid,{extensions:['701/_4XX']});
  await probe(primary,'701','245','MASK_FALLBACK');
  await probe(primary,'701','445','MASK');
  await request('PUT','/routes/'+mask.uid,{active:0});
  await probe(primary,'701','445','MASK_FALLBACK');
  checks.push({case:'update_and_disable_revoke_match',pass:true});
  await request('DELETE','/routes/'+exact.uid);
  await probe(primary,'700','201','FALLBACK');
  const config = await action({action:'GetConfig',filename:'krasterisk/routes/extensions_'+primary.name+tenant+'.conf'});
  assert.ok(!Object.values(config).includes('__krs_route_'+exact.uid+'_'+tenant),'Removed execution category must not remain');
  const preview = await request('GET','/routes/preview/'+primary.uid);
  assert.match(preview.dialplan,/exten => 700,1,NoOp/);
  assert.ok(!preview.dialplan.includes('__krs_route_'+exact.uid+'_'+tenant));
  checks.push({case:'delete_private_category_and_plain_route_compatibility',pass:true});
  const raw = await request('POST','/routes',{context_uid:primary.uid,name:run+'_raw',extensions:['708'],raw_dialplan:'exten => 708,1,Hangup()',actions:commands('RAW_CLEARED'),options:{dialplan_source:'raw'}},201);
  await request('PUT','/routes/'+raw.uid,{extensions:['708/201'],raw_dialplan:null,options:{}});
  await probe(primary,'708','201','RAW_CLEARED');
  await probe(primary,'708','202',null);
  checks.push({case:'explicit_raw_override_clear_to_cid_rule',pass:true});
  await request('DELETE','/contexts/'+primary.uid);
  const afterDelete = await action({action:'GetConfig',filename:'krasterisk/routes/extensions_'+primary.name+tenant+'.conf'});
  assert.ok(!Object.values(afterDelete).some(value=>String(value).startsWith('__krs_route_')),'Context deletion must revoke all private categories');
  checks.push({case:'context_delete_revokes_private_categories',pass:true});
  console.log(JSON.stringify({run,checks}));
}

async function cleanup() {
  await sleep(1500);
  if (app) await app.close();
  if (manager) manager.disconnect();
  if (fixtureOwned) {
    await ContextInclude.destroy({ where: { user_uid: [tenant, tenant + 1] } });
    await Route.destroy({ where: { user_uid: tenant } });
    await TenantSetting.destroy({ where: { vpbxUserUid: tenant } });
    await Context.destroy({ where: { user_uid: [tenant, tenant + 1], name: { [Op.like]: run + '%' } } });
    const callIds = [...events.map((event) => event.callid), ...originateResponses.map((event) => event.uniqueid)].filter(Boolean);
    if (callIds.length) {
      const cdrColumns = await s.getQueryInterface().describeTable('cdr');
      const idColumn = cdrColumns.uniqueid ? 'uniqueid' : cdrColumns.unique_id ? 'unique_id' : null;
      if (idColumn) await s.query(`DELETE FROM cdr WHERE ${idColumn} IN (:ids)`, { replacements: { ids: callIds } });
    }
    // Rejected Local calls have no UserEvent marker. Their channels still contain
    // the unique owned run namespace, so also clean both Local channel halves.
    const cdrColumns = await s.getQueryInterface().describeTable('cdr');
    const channelColumns = ['channel', 'dstchannel'].filter(column => cdrColumns[column]);
    if (channelColumns.length) {
      const namespace = run.replace(/[!%_]/g, character => '!' + character);
      const pattern = 'Local/%@' + namespace + '!_%';
      await s.query("DELETE FROM cdr WHERE " + channelColumns.map(column => column + " LIKE :pattern ESCAPE '!' ").join(' OR '), { replacements: { pattern } });
    }
    await s.close();
  } else await s.close();
  if (files.size) {
    const exactPaths = [...files].map((name) => {
      assert.match(name, /^extensions_cidaudit_[a-f0-9]+_[a-z_]+\d+\.conf$/);
      return '/etc/asterisk/krasterisk/routes/' + name;
    });
    execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', 'C:/Users/Professional/.ssh/aipbx_ollama_audit', 'root@ipbx.krasterisk.ru', 'rm -f -- ' + exactPaths.join(' ') + '; asterisk -rx "dialplan reload"'], { stdio: 'pipe', timeout: 20000 });
  }
  evidence.cleanup = true;
}

(async () => {
  try { await main(); evidence.pass = true; }
  catch (error) { evidence.pass = false; evidence.error = error.message; console.error(error.message); process.exitCode = 1; }
  finally {
    try { await cleanup(); } catch (error) { evidence.cleanupError = error.message; process.exitCode = 1; }
    const output = path.resolve(__dirname, '../../../.planning/artifacts/route-caller-id-live.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ pass: evidence.pass, cleanup: evidence.cleanup, output }));
  }
})();
