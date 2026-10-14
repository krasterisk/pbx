'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
function request(server) {
  const method = verb => url => {
    const headers = {}; let body;
    const chain = {
      set(name, value) { headers[name] = value; return chain; },
      send(value) { body = JSON.stringify(value); headers['content-type'] = 'application/json'; return chain; },
      async expect(status) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method: verb, headers, body });
        const text = await response.text(); assert.equal(response.status, status, text);
        return { body: text ? JSON.parse(text) : null };
      },
    }; return chain;
  };
  return { get: method('GET'), put: method('PUT') };
}
const compiled = path.resolve(__dirname, '../../packages/backend/dist-voice-robots');
const { StandaloneRobotGuard } = require(path.join(compiled, 'standalone-voice-robots/access'));
const { StandaloneRobotsController } = require(path.join(compiled, 'standalone-voice-robots/robots.controller'));
const { VoiceRobotsService } = require(path.join(compiled, 'modules/voice-robots/voice-robots.service'));
const { StandaloneSpeechEngines, StandaloneEnginesController } = require(path.join(compiled, 'standalone-voice-robots/engines'));
const { ariHttpPrefix } = require(path.join(compiled, 'modules/ari/ari-http-prefix'));

test('HTTP authentication establishes tenant and rejects missing/forged ownership', async () => {
  const calls = [];
  const robots = { findAll: async uid => { calls.push(uid); return []; },
    updateKeyword: async (tenant, uid, data) => ({ tenant, uid, data }) };
  const engines = { list: async (kind, tenant) => [{ uid: 1, name: 'test', type: 'yandex', user_uid: tenant, settings: {}, auth_mode: 'none' }] };
  const module = await Test.createTestingModule({
    controllers: [StandaloneRobotsController, StandaloneEnginesController],
    providers: [StandaloneRobotGuard,
      { provide: ConfigService, useValue: new ConfigService({ VOICE_ROBOTS_PUBLIC_API_KEY: 'test-private-key' }) },
      { provide: VoiceRobotsService, useValue: robots }, { provide: StandaloneSpeechEngines, useValue: engines }],
  }).compile();
  const app = module.createNestApplication(); await app.listen(0, '127.0.0.1');
  try {
    const url = '/public/voice-robots';
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer()).get(url + '?api_key=test-private-key').set('x-vpbx-user-uid', '42').expect(401);
    for (const tenant of ['-1', '01', '1.1', '9007199254740992', '']) {
      await request(app.getHttpServer()).get(url).set('x-api-key', 'test-private-key').set('x-vpbx-user-uid', tenant).expect(401);
    }
    await request(app.getHttpServer()).get(url).set('x-api-key', 'test-private-key').set('x-vpbx-user-uid', '42').expect(200);
    await request(app.getHttpServer()).get(url).set('x-api-key', 'test-private-key').set('x-vpbx-user-uid', '0').expect(200);
    assert.deepEqual(calls, [42, 0]);
    const response = await request(app.getHttpServer()).put(url + '/keywords/3')
      .set('x-api-key', 'test-private-key').set('x-vpbx-user-uid', '42')
      .send({ uid: 20, user_uid: 99, group_id: 17, robot_id: 12, keywords: 'hello' }).expect(200);
    assert.deepEqual(response.body, { tenant: 42, uid: 3, data: { keywords: 'hello' } });
    const providers = await request(app.getHttpServer()).get('/public/ai-agents/providers/list?capability=stt')
      .set('x-api-key', 'test-private-key').set('x-vpbx-user-uid', '42').expect(200);
    assert.equal(providers.body[0].user_uid, 42);
  } finally { await app.close(); }
});

test('new table DDL matches runtime models and never alters legacy tables', () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const allowed = ['voice_robots', 'voice_robot_keyword_groups', 'voice_robot_keywords', 'voice_robot_logs', 'voice_robot_cdr', 'voice_robot_data_lists', 'stt_engines', 'tts_engines'];
  const statements = sql.split('\n').filter(line => line.trim() && !line.startsWith('--'));
  assert.equal(statements.length, 8);
  assert.deepEqual(statements.map(line => line.match(/^CREATE TABLE IF NOT EXISTS `([^`]+)`/)[1]), allowed);
  assert.doesNotMatch(sql, /\b(ALTER|DROP|UPDATE|DELETE|INSERT|TRUNCATE)\s+(TABLE|INTO|FROM)?\s*`?(users|queues|contexts|prompts|cdr)\b/i);
  const { Sequelize } = require('sequelize-typescript');
  const { STANDALONE_ROBOT_MODELS } = require(path.join(compiled, 'standalone-voice-robots/module'));
  const db = new Sequelize({ dialect: 'mysql', models: STANDALONE_ROBOT_MODELS, logging: false });
  for (const model of STANDALONE_ROBOT_MODELS) {
    const ddl = statements.find(line => line.startsWith('CREATE TABLE IF NOT EXISTS `' + model.tableName + '`'));
    for (const attr of Object.values(model.getAttributes())) {
      assert.ok(ddl.includes('`' + attr.field + '`'), model.tableName + '.' + attr.field);
    }
  }
  void db.close();
});

test('secret round-trip preserves omitted keys and masks all credentials', async () => {
  process.env.CC_AI_KEY_SECRET = 'local-integration-test-only-secret-long-enough';
  let row = { uid: 1, name: 'test', token: '', custom_headers: {}, user_uid: 42,
    toJSON() { return { uid: this.uid, name: this.name, token: this.token, custom_headers: this.custom_headers }; },
    async update(values) { Object.assign(this, values); return this; } };
  const model = { async findOne(query) { return query.where.user_uid === 42 ? row : null; } };
  const service = new StandaloneSpeechEngines(model, model);
  const saved = await service.save('stt-engines', 42, { token: 'private-value', custom_headers: { Authorization: 'secret-header' } }, 1);
  assert.equal(saved.token, ''); assert.deepEqual(saved.custom_headers, {});
  assert.ok(!row.token.includes('private-value'));
  await service.save('stt-engines', 42, { token: '' }, 1);
  const engine = await service.loadSpeechEngine(42, 1, 'stt');
  assert.equal(engine.token, 'private-value'); assert.equal(engine.custom_headers.Authorization, 'secret-header');
  await assert.rejects(service.loadSpeechEngine(99, 1, 'stt'));
});

test('HTTP prefix normalization prevents malformed paths', () => {
  assert.equal(ariHttpPrefix('/asterisk/'), '/asterisk');
  assert.equal(ariHttpPrefix(''), '');
  assert.throws(() => ariHttpPrefix('../asterisk?key=bad'));
});

test('isolated composition excludes PBX initialization and schema synchronization', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../packages/backend/src/standalone-voice-robots/module.ts'), 'utf8');
  assert.doesNotMatch(source, /import .*?(?:AppModule|AmiModule|AutodialModule|CloudAdminModule|ConferencesModule|SystemSettingsModule)/);
  assert.match(source, /synchronize: false/);
  const entry = fs.readFileSync(path.join(__dirname, '../../packages/backend/src/standalone-voice-robots/main.ts'), 'utf8');
  assert.match(entry, /'127\.0\.0\.1'/);
});
