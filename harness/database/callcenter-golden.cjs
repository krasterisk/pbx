'use strict';
// Real application-model parity test against an explicitly disposable database.
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize-typescript');
const { Op } = require('sequelize');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const dist = '../../packages/backend/dist/modules/callcenter';
const { CcQueueCall } = require(`${dist}/models/queue-call.model.js`);
const { CcDailyQueueStats } = require(`${dist}/models/daily-queue-stats.model.js`);
const { CcDailyAgentStats } = require(`${dist}/models/daily-agent-stats.model.js`);
const { RealtimeQueueLogReader } = require(`${dist}/queuelog/realtime-queue-log-reader.js`);
const { CallCenterQueueLogReconcilerService } = require(`${dist}/callcenter-queuelog-reconciler.service.js`);
const { CallCenterRollupService } = require(`${dist}/callcenter-rollup.service.js`);
const { CallCenterReportsService } = require(`${dist}/reports/callcenter-reports.service.js`);

function sqlDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function main(input = process.env) {
  if (input.CI !== 'true' || !/^krasterisk_ci(?:_[a-z0-9]+)?$/.test(input.DB_NAME || '')) {
    throw new Error('Call-center golden requires disposable CI database');
  }
  const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
  const sequelize = new Sequelize({ ...config, models: [CcQueueCall, CcDailyQueueStats, CcDailyAgentStats], logging: false });
  const reader = new RealtimeQueueLogReader(sequelize);
  const fixturePrefix = 'db02-d1-';
  let createdTable = false;
  const today = new Date();
  const day = sqlDate(today).slice(0, 10);
  try {
    assert.equal(await reader.isAvailable(), false, 'test requires no pre-existing queue_log');
    await sequelize.query('CREATE TABLE queue_log (time VARCHAR(32) NOT NULL, callid VARCHAR(64) NOT NULL, queuename VARCHAR(64) NOT NULL, agent VARCHAR(64), event VARCHAR(32) NOT NULL, data VARCHAR(64), data1 VARCHAR(64), data2 VARCHAR(64), data3 VARCHAR(64), data4 VARCHAR(64), data5 VARCHAR(64))');
    createdTable = true;
    assert.equal(await reader.isAvailable(), true);
    const stamp = new Date(today.getTime() - 10 * 60_000);
    stamp.setMilliseconds(0);
    const events = [
      [0, 'a', 'db02q_2', 'NONE', 'ENTERQUEUE', '1', '7001'],
      [1, 'a', 'db02q_2', 'SIP/e1_2', 'CONNECT', '4', ''],
      [2, 'a', 'db02q_2', 'SIP/e1_2', 'COMPLETEAGENT', '4', '35'],
      [3, 'b', 'db02q_2', 'NONE', 'ENTERQUEUE', '2', '7002'],
      [4, 'b', 'db02q_2', 'NONE', 'ABANDON', '2', '0', '8'],
      [5, 'c', 'db02q_3', 'NONE', 'ENTERQUEUE', '1', '7003'],
      [6, 'c', 'db02q_3', 'SIP/e2_3', 'COMPLETECALLER', '3', '20'],
    ];
    for (const [offset, id, queue, agent, event, p1, p2, p3] of events) {
      await sequelize.query('INSERT INTO queue_log (time, callid, queuename, agent, event, data1, data2, data3) VALUES (:time, :callid, :queue, :agent, :event, :p1, :p2, :p3)', {
        replacements: { time: sqlDate(new Date(stamp.getTime() + offset * 1000)), callid: `${fixturePrefix}${id}`, queue, agent, event, p1, p2, p3: p3 || null },
      });
    }
    const rollup = new CallCenterRollupService(CcQueueCall, CcDailyQueueStats, CcDailyAgentStats);
    const reconciler = new CallCenterQueueLogReconcilerService(reader, CcQueueCall, rollup);
    const from = new Date(stamp.getTime() - 1000);
    const until = new Date(stamp.getTime() + 10_000);
    assert.equal(await reconciler.reconcileRange(from, until), 3);
    assert.equal(await reconciler.reconcileRange(from, until), 0, 'replay must not insert calls');
    const report = new CallCenterReportsService(CcQueueCall, CcDailyQueueStats, CcDailyAgentStats, null, null, null, null, { findOne: async () => null }, rollup);
    const raw = await report.getQueueSummary(2, { dateFrom: day, dateTo: day });
    const rawOther = await report.getQueueSummary(3, { dateFrom: day, dateTo: day });
    assert.equal(raw.source, 'raw');
    assert.deepEqual(raw.rows.map(r => ({ queue: r.queueName, total: r.totalCalls, answered: r.answeredCalls, abandoned: r.abandonedCalls })),
      [{ queue: 'db02q_2', total: 2, answered: 1, abandoned: 1 }]);
    assert.deepEqual(rawOther.rows.map(r => ({ queue: r.queueName, total: r.totalCalls })), [{ queue: 'db02q_3', total: 1 }]);
    await rollup.recomputeDay(today, 2);
    await rollup.recomputeDay(today, 2);
    const daily = await CcDailyQueueStats.findAll({ where: { user_uid: 2, queue_name: 'db02q_2', stat_date: day } });
    assert.equal(daily.length, 1, 'recompute must not duplicate a daily row');
    assert.equal(daily[0].total_calls, 2);
    const longFrom = new Date(today.getTime() - 100 * 86400_000);
    const summary = await report.getQueueSummary(2, { dateFrom: sqlDate(longFrom).slice(0, 10), dateTo: day });
    assert.equal(summary.source, 'rollup');
    assert.equal(summary.rows.length, 1);
    assert.equal(summary.rows[0].totalCalls, 2);
    return { dialect: config.dialect, inserted: 3, replayInserted: 0, raw: raw.rows.map(r => ({ queue: r.queueName, total: r.totalCalls, answered: r.answeredCalls, abandoned: r.abandonedCalls })), rollup: summary.rows.map(r => ({ queue: r.queueName, total: r.totalCalls })) };
  } finally {
    try {
      await CcDailyAgentStats.destroy({ where: { user_uid: { [Op.in]: [2, 3] }, agent_interface: { [Op.like]: 'SIP/e%' }, stat_date: day } });
      await CcDailyQueueStats.destroy({ where: { user_uid: { [Op.in]: [2, 3] }, queue_name: { [Op.like]: 'db02q_%' }, stat_date: day } });
      await CcQueueCall.destroy({ where: { call_uniqueid: { [Op.like]: `${fixturePrefix}%` } } });
      if (createdTable) await sequelize.query('DROP TABLE queue_log');
    } finally { await sequelize.close(); }
  }
}

if (require.main === module) main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
