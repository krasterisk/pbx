'use strict';
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize-typescript');
const { Op } = require('sequelize');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { VoiceRobotCdr } = require('../../packages/backend/dist/modules/voice-robots/voice-robot-cdr.model.js');
const { VoiceRobotsService } = require('../../packages/backend/dist/modules/voice-robots/voice-robots.service.js');

async function main(input = process.env) {
  if (input.CI !== 'true' || !/^krasterisk_ci(?:_[a-z0-9]+)?$/.test(input.DB_NAME || '')) {
    throw new Error('Voice robot golden requires disposable CI database');
  }
  const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
  const sequelize = new Sequelize({ ...config, models: [VoiceRobotCdr], logging: false });
  const service = { cdrModel: VoiceRobotCdr };
  const cases = [
    [2, null], [2, []], [2, [null]], [2, ['old', 'Gold']],
    [2, ["quote'_%\\"]], [2, ['old', 'Привет']], [2, ['null']], [2, ['other', 'Gold']],
    [3, ['Secret']],
  ];
  try {
    for (const [index, [userUid, tags]] of cases.entries()) {
      await VoiceRobotCdr.create({
        robot_id: 1, user_uid: userUid, call_uniqueid: `db02-d3-${index}`,
        started_at: new Date(Date.UTC(2026, 8, 18, 10, 0, index)),
        tags, robot_name: 'DB02 robot',
      });
    }
    const find = options => VoiceRobotsService.prototype.findAllCdr.call(service, 2, options);
    const ids = result => result.rows.map(row => row.call_uniqueid);
    const gold = await find({ tag: 'Gold' });
    assert.equal(gold.count, 2);
    assert.deepEqual(ids(gold), ['db02-d3-7', 'db02-d3-3']);
    assert.equal((await find({ tag: 'old' })).count, 0);
    assert.equal((await find({ tag: "quote'_%\\" })).count, 1);
    assert.equal((await find({ tag: 'null' })).count, 1);
    assert.equal((await find({ tag: 'Привет' })).count, 1);
    assert.deepEqual(ids(await find({ tag: 'Gold', limit: 1, offset: 1 })), ['db02-d3-3']);
    assert.deepEqual(ids(await find({ search: '%' })), ['db02-d3-4']);
    assert.deepEqual(ids(await find({ search: '_' })), ['db02-d3-4']);
    assert.deepEqual(ids(await find({ search: "'" })), ['db02-d3-4']);
    const distinct = await VoiceRobotsService.prototype.getDistinctTags.call(service, 2);
    assert.deepEqual(distinct, ['Gold', 'null', "quote'_%\\", 'Привет']);
    assert.deepEqual(await VoiceRobotsService.prototype.getDistinctTags.call(service, 3), ['Secret']);
    return { dialect: config.dialect, gold: ids(gold), literalPercent: ids(await find({ search: '%' })), distinct };
  } finally {
    try {
      await VoiceRobotCdr.destroy({ where: { call_uniqueid: { [Op.like]: 'db02-d3-%' } } });
    } finally { await sequelize.close(); }
  }
}

if (require.main === module) main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
