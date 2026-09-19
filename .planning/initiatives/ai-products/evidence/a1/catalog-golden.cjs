// Run only on the designated remote test host. Creates and removes its own
// disposable Docker container; never connects to an existing service.
require('reflect-metadata');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Sequelize } = require('sequelize-typescript');
const { ModuleRegistry } = require('./dist/modules/cloud-admin/module-registry.model');
const { ModulesRegistryService } = require('./dist/modules/cloud-admin/modules-registry.service');

const engine = process.argv[2];
if (!['mysql', 'postgres'].includes(engine)) throw new Error('engine must be mysql or postgres');
const id = `krasterisk-a1-${engine}-${crypto.randomBytes(5).toString('hex')}`;
const password = crypto.randomBytes(18).toString('hex');
const image = engine === 'mysql' ? 'mysql:8.4.11' : 'postgres:17.11-bookworm';
const internalPort = engine === 'mysql' ? 3306 : 5432;
const run = (args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let started = false;
let db;

async function main() {
  const env = engine === 'mysql'
    ? ['-e', `MYSQL_ROOT_PASSWORD=${password}`, '-e', 'MYSQL_DATABASE=a1_fixture']
    : ['-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=a1_fixture'];
  run(['run', '-d', '--rm', '--label', 'org.testcontainers=true', '--name', id,
    ...env, '-p', `127.0.0.1::${internalPort}`, image]);
  started = true;
  const port = Number(run(['port', id, `${internalPort}/tcp`]).split(':').at(-1));
  db = new Sequelize('a1_fixture', engine === 'mysql' ? 'root' : 'postgres', password, {
    dialect: engine, host: '127.0.0.1', port, logging: false,
    models: [ModuleRegistry],
  });
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { await db.authenticate(); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 1000)); }
  }
  assert(ready, 'disposable database did not become ready');
  await db.sync({ force: true });
  const service = new ModulesRegistryService(ModuleRegistry, {}, {},
    { get: () => 'CLOUD' }, {}, {});
  await service.onApplicationBootstrap();
  const ai = await ModuleRegistry.findOne({ where: { code: 'ai_voice_robots' } });
  const analytics = await ModuleRegistry.findOne({ where: { code: 'speech_analytics' } });
  assert.equal(ai.is_published, false);
  assert.equal(analytics.is_published, false);
  const old = await ModuleRegistry.findOne({ where: { code: 'voice_robot' } });
  assert.equal(old.is_published, true);
  await old.update({ is_published: false });
  await ai.update({ is_published: true });
  await service.onApplicationBootstrap();
  await old.reload(); await ai.reload();
  assert.equal(old.is_published, false, 'operator unpublish survives reseed');
  assert.equal(ai.is_published, true, 'operator publish survives reseed');
  await assert.rejects(() => service.resolvePurchaseOffer('ai_voice_robots'),
    (error) => error.response?.code === 'OFFER_NOT_RELEASED');
  console.log(`PASS ${engine}: insert/reseed/publication/offer (${await ModuleRegistry.count()} rows)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (db) await db.close().catch(() => {});
  if (started) {
    try { run(['rm', '-f', id]); }
    catch (error) { console.error(`cleanup failed for ${id}: ${error.message}`); process.exitCode = 1; }
  }
});
