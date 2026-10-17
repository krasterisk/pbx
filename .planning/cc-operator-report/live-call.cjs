'use strict';
// One live answered call through a temporary auto-answer member, then the operator report must show it.
const path = require('node:path');
require(path.resolve(__dirname, '../../node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../.env') });
const jwt = require(path.resolve(__dirname, '../../node_modules/jsonwebtoken'));
const { connect } = require('../cc-analytics/live-ami.cjs');

const QUEUE = 'q07465455_0';
const MEMBER = 'Local/oprpt@oprpt-livetest';
const token = jwt.sign(
  { sub: 58, login: 'admin', name: 'admin', level: 1, role: 0, vpbx_user_uid: 0 },
  process.env.JWT_SECRET,
  { expiresIn: '20m' },
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const note = (name, ok, detail) => console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail));

(async () => {
  const ami = await connect();
  const cmd = async (command) => (await ami.action({ Action: 'Command', Command: command })).map((m) => m.Output || '').join('\n');
  const dialplan = [
    'dialplan add extension oprpt,1,Answer() into oprpt-livetest',
    'dialplan add extension oprpt,2,Wait(4) into oprpt-livetest',
    'dialplan add extension oprpt,3,Hangup() into oprpt-livetest',
    `dialplan add extension call,1,Answer() into oprpt-livetest`,
    `dialplan add extension call,2,Queue(${QUEUE},,,,20) into oprpt-livetest`,
    'dialplan add extension call,3,Hangup() into oprpt-livetest',
  ];
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await ami.action({ Action: 'QueueRemove', Queue: QUEUE, Interface: MEMBER }).catch(() => {});
    await cmd('dialplan remove context oprpt-livetest').catch(() => {});
  };
  try {
    for (const line of dialplan) await cmd(line);
    const add = await ami.action({ Action: 'QueueAdd', Queue: QUEUE, Interface: MEMBER, MemberName: 'Oprpt', Penalty: 0, Paused: 'false' });
    note('test member added', add[0] && add[0].Response === 'Success', add[0] && add[0].Message);
    await sleep(1500);
    const before = await fetch(`http://localhost:5010/api/callcenter/reports/operator-stats?dateFrom=${new Date().toISOString().slice(0, 10)}&dateTo=${new Date().toISOString().slice(0, 10)}`, {
      headers: { Authorization: 'Bearer ' + token },
    }).then((r) => r.json());
    const beforeRow = (before.rows || []).find((row) => String(row.agentInterface).includes('oprpt'));
    const originated = await ami.action({
      Action: 'Originate', Channel: 'Local/call@oprpt-livetest', Application: 'Wait', Data: '12',
      CallerID: 'Oprpt Live <5550291>', Timeout: 20000, Async: 'true',
    });
    note('originate accepted', originated[0] && originated[0].Response === 'Success');
    await sleep(14000);
    const after = await fetch(`http://localhost:5010/api/callcenter/reports/operator-stats?dateFrom=${new Date().toISOString().slice(0, 10)}&dateTo=${new Date().toISOString().slice(0, 10)}`, {
      headers: { Authorization: 'Bearer ' + token },
    }).then((r) => r.json());
    const row = (after.rows || []).find((item) => String(item.agentInterface).includes('oprpt'));
    const handled = (row ? row.callsHandled : 0) - (beforeRow ? beforeRow.callsHandled : 0);
    note('the live answer is one handled call on the temporary member', handled === 1 && row.totalTalkSec - (beforeRow ? beforeRow.totalTalkSec : 0) >= 3, row && { calls: row.callsHandled, talk: row.totalTalkSec, aht: row.ahtSec });
  } finally {
    await cleanup();
    const left = await cmd('dialplan show oprpt-livetest');
    note('temporary dialplan removed', /no existence/i.test(left));
    ami.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
