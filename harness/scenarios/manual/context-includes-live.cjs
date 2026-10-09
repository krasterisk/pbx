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
const run = `ctxaudit_${crypto.randomBytes(5).toString('hex')}`;
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
    if (event.userevent === 'ContextIncludeAudit' && event.run === run) events.push(event);
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
  const a = await create('a');
  const b = await create('b');
  const entry = await create('entry', [a.uid, b.uid]);
  const foreign = await Context.create({ name: run + '_foreign', user_uid: tenant + 1, comment: '' });
  await request('PUT', `/contexts/${entry.uid}`, { include_uids: [foreign.uid] }, 400);
  await request('PUT', `/contexts/${entry.uid}`, { include_uids: [a.uid, a.uid] }, 400);
  await request('PUT', `/contexts/${a.uid}`, { include_uids: [entry.uid] }, 400);
  const unchanged = await request('GET', `/contexts/${entry.uid}`);
  assert.deepEqual(unchanged.include_uids, [a.uid, b.uid]);
  checks.push({ case: 'ownership_duplicates_cycle_and_atomic_rollback', pass: true });
  const commands = (marker) => [
    { id: 'answer', type: 'cmd', params: { command: 'Answer()' }, condition: {} },
    { id: 'mark', type: 'cmd', params: { command: `UserEvent(ContextIncludeAudit,Run:${run},Marker:${marker},CallId:\${UNIQUEID})` }, condition: {} },
  ];
  const createRoute = (context, marker, exten = '555') => request('POST', '/routes', { context_uid: context.uid, name: run + '_' + marker, extensions: [exten], actions: commands(marker), options: {} }, 201);
  const ra = await createRoute(a, 'A');
  await createRoute(b, 'B');
  const probe = async (context, extension, expectedMarker) => {
    const start = events.length;
    const actionid = `${run}_${++probeSequence}`;
    let rejected = false;
    await action({ action: 'Originate', actionid, channel: `Local/${extension}@${context.name}${tenant}/n`, application: 'Wait', data: '1', async: 'true', timeout: 3000 }).catch(() => { rejected = true; });
    await sleep(1500);
    const markers = events.slice(start).map((event) => event.marker);
    assert.deepEqual(markers, expectedMarker ? [expectedMarker] : [], 'Unexpected live dialplan marker');
    if (!expectedMarker) assert.ok(rejected || originateResponses.some((response) => response.actionid === actionid && response.response === 'Failure'), 'No explicit rejection of unreachable extension');
    return markers;
  };
  await probe(entry, '555', 'A');
  checks.push({ case: 'first_include', pass: true });
  const swapped = await request('PUT', `/contexts/${entry.uid}`, { include_uids: [b.uid, a.uid] });
  assert.equal(swapped.dialplan_applied, true);
  await probe(entry, '555', 'B');
  checks.push({ case: 'reorder_changes_selected_route', pass: true });
  const own = await createRoute(entry, 'OWN');
  await probe(entry, '555', 'OWN');
  checks.push({ case: 'own_context_precedence_and_no_priority_leak', pass: true });
  await request('DELETE', `/routes/${own.uid}`);
  const nested = await create('nested', [entry.uid]);
  await probe(nested, '555', 'B');
  checks.push({ case: 'transitive_include', pass: true });
  const denied = await create('denied');
  await probe(denied, '555', null);
  checks.push({ case: 'unreachable_extension', pass: true });
  const preview = await request('GET', `/routes/preview/${a.uid}`);
  assert.match(preview.dialplan, /same => n,Hangup\(\)/);
  assert.ok(ra.uid);
  const c = await create('c');
  const d = await create('d');
  const concurrent = await Promise.all([
    request('PUT', `/contexts/${c.uid}`, { include_uids: [d.uid] }).then(() => 'saved').catch(() => 'rejected'),
    request('PUT', `/contexts/${d.uid}`, { include_uids: [c.uid] }).then(() => 'saved').catch(() => 'rejected'),
  ]);
  assert.deepEqual(concurrent.sort(), ['rejected', 'saved']);
  checks.push({ case: 'concurrent_cycle_prevented', pass: true });
  const orphanSource = await create('orphan_source', [c.uid]);
  await request('PUT', `/contexts/${c.uid}`, { include_uids: [b.uid] });
  await probe(orphanSource, '555', 'B');
  await request('DELETE', `/contexts/${c.uid}`);
  assert.deepEqual((await request('GET', `/contexts/${orphanSource.uid}`)).include_uids, []);
  await probe(orphanSource, '555', null);
  checks.push({ case: 'deleted_context_reference_cleanup', pass: true });
  console.log(JSON.stringify({ run, checks }));
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
    const callIds = events.map((event) => event.callid).filter(Boolean);
    if (callIds.length) {
      const cdrColumns = await s.getQueryInterface().describeTable('cdr');
      const idColumn = cdrColumns.uniqueid ? 'uniqueid' : cdrColumns.unique_id ? 'unique_id' : null;
      if (idColumn) await s.query(`DELETE FROM cdr WHERE ${idColumn} IN (:ids)`, { replacements: { ids: callIds } });
    }
    await s.close();
  } else await s.close();
  if (files.size) {
    const exactPaths = [...files].map((name) => {
      assert.match(name, /^extensions_ctxaudit_[a-f0-9]+_[a-z_]+\d+\.conf$/);
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
    const output = path.resolve(__dirname, '../../../.planning/artifacts/context-includes-live.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ pass: evidence.pass, cleanup: evidence.cleanup, output }));
  }
})();
