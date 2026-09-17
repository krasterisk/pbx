/**
 * Seed room + meetings + CDR + local WAV copy for 16.2 UAT Tests 2–3.
 * No secrets printed.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadEnv,
  dbConn,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

const SSH_KEY = process.env.UAT_SSH_KEY || path.join(os.homedir(), '.ssh', 'krasterisk_ipbx_agent');
const SSH_HOST = process.env.UAT_SSH_HOST || 'root@ipbx.krasterisk.ru';
const REMOTE_WAV = '/usr/records/348/conferences/8/900162002.wav';
const UNIQUEID = process.env.UAT162_UNIQUEID || `uat162play.${Date.now()}`;
const ROOM_NUMBER = '16921';

function sshArgs(extra) {
  return [
    '-i',
    SSH_KEY,
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=15',
    ...extra,
  ];
}

(async () => {
  const env = loadEnv();
  const conn = await dbConn(env);

  const [settings] = await conn.query(
    "SELECT `key`, value FROM system_settings WHERE `key` = 'records_base_path'",
  );
  const envBase = env.RECORDS_BASE_PATH || '';
  const dbBase = settings[0]?.value || '';
  const base = dbBase || envBase || '/usr/records';
  console.log('records_base_path', { db: dbBase || null, env: envBase || null, used: base });

  const [user58] = await conn.query(
    'SELECT uniqueid, login, level, role, vpbx_user_uid FROM users WHERE uniqueid = 58',
  );
  console.log('user58', user58[0] || null);
  const tenant = Number(user58[0]?.vpbx_user_uid ?? 0);

  const [cols] = await conn.query('SHOW COLUMNS FROM cdr');
  console.log(
    'cdr_cols',
    cols.map((c) => `${c.Field}:${c.Null}:${c.Default ?? ''}`).join('|'),
  );

  await conn.query(
    'DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number = ?',
    [tenant, ROOM_NUMBER],
  );

  const [roomIns] = await conn.query(
    `INSERT INTO conference_rooms
      (vpbx_user_uid, number, name, kind, entry_strictness, record_mode, notify_recording,
       invite_external_scope, announce_join_leave)
     VALUES (?, ?, 'UAT 16.2 play', 'permanent', 'token_name', 'auto', 1, 'owner', 0)`,
    [tenant, ROOM_NUMBER],
  );
  const roomUid = Number(roomIns.insertId);
  const rel = `${tenant}/conferences/${roomUid}/900162002.wav`;

  const started = new Date(Date.now() - 120000);
  const ended = new Date(Date.now() - 60000);
  const [meetIns] = await conn.query(
    `INSERT INTO conference_meetings
      (room_uid, started_at, ended_at, has_recording, recording_file_rel)
     VALUES (?, ?, ?, 1, ?)`,
    [roomUid, started, ended, rel],
  );
  const meetingUid = Number(meetIns.insertId);

  await conn.query(
    `INSERT INTO conference_meetings
      (room_uid, started_at, ended_at, has_recording, recording_file_rel)
     VALUES (?, ?, NULL, 0, NULL)`,
    [roomUid, new Date()],
  );

  await conn.query(
    `INSERT INTO conference_meeting_participants
      (meeting_uid, display_name, role, is_guest, joined_at, left_at, caller_id_num, uniqueid)
     VALUES (?, 'UAT 16.2', 'participant', 0, ?, ?, '16001', ?)`,
    [meetingUid, started, ended, UNIQUEID],
  );

  const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.query('DELETE FROM cdr WHERE uniqueid = ? OR linkedid = ?', [UNIQUEID, UNIQUEID]);

  const colNames = new Set(cols.map((c) => c.Field));
  const row = {
    calldate: nowSql,
    clid: '"uat162" <16001>',
    src: '16001',
    usrc: '16001',
    dst: ROOM_NUMBER,
    dcontext: `krsk-conf-${roomUid}`,
    channel: `Local/s@krsk-conf-${roomUid}-0000uat;2`,
    dstchannel: '',
    lastapp: 'ConfBridge',
    lastdata: `conf${ROOM_NUMBER}_${tenant}`,
    duration: 12,
    billsec: 12,
    disposition: 'ANSWERED',
    uniqueid: UNIQUEID,
    linkedid: UNIQUEID,
    userfield: 'uat162',
    vpbx_user_uid: tenant,
    useruid: Number(user58[0]?.uniqueid || 0),
  };
  if (colNames.has('amaflags')) row.amaflags = 3;
  if (colNames.has('sequence')) row.sequence = 0;
  const fields = Object.keys(row).filter((k) => colNames.has(k));
  const placeholders = fields.map(() => '?').join(',');
  await conn.query(
    `INSERT INTO cdr (${fields.join(',')}) VALUES (${placeholders})`,
    fields.map((k) => row[k]),
  );

  const localDir = path.join(base.replace(/\//g, path.sep), String(tenant), 'conferences', String(roomUid));
  const posixLocal = `${base.replace(/\\/g, '/')}/${tenant}/conferences/${roomUid}`;
  fs.mkdirSync(localDir, { recursive: true });
  const dest = path.join(localDir, '900162002.wav');
  const scp = spawnSync(
    'scp',
    [...sshArgs([`${SSH_HOST}:${REMOTE_WAV}`, dest])],
    { encoding: 'utf8' },
  );
  if (scp.status !== 0) {
    throw new Error(`scp failed: ${(scp.stderr || scp.stdout || '').trim()}`);
  }
  const stat = fs.statSync(dest);
  console.log(
    JSON.stringify(
      {
        tenant,
        roomUid,
        meetingUid,
        uniqueid: UNIQUEID,
        rel,
        dest,
        posixLocal,
        bytes: stat.size,
        login: user58[0]?.login || null,
      },
      null,
      2,
    ),
  );
  await conn.end();
})().catch((e) => {
  console.error('SEEDERR', e.message);
  process.exit(1);
});
