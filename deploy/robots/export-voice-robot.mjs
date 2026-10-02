#!/usr/bin/env node
/**
 * Export one scripted voice robot and its STT/TTS engines from MySQL.
 * Tokens stay in the output file. The script prints counts only.
 *
 *   node export-voice-robot.mjs --env /var/www/pbx/.env.production --out bundle.json --uid 4
 */
import { createRequire } from 'node:module';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const envPath = arg('--env');
const outPath = arg('--out');
const uid = Number(arg('--uid', '4'));
if (!envPath || !outPath || !Number.isInteger(uid)) {
  process.stderr.write('usage: export-voice-robot.mjs --env FILE --out FILE [--uid 4]\n');
  process.exit(1);
}

const env = loadEnv(envPath);
const conn = await mysql.createConnection({
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  dateStrings: true,
});

try {
  const [robots] = await conn.query('SELECT * FROM voice_robots WHERE uid = ?', [uid]);
  if (!robots.length) throw new Error(`voice robot uid ${uid} not found`);
  const robot = robots[0];
  const [groups] = await conn.query(
    'SELECT * FROM voice_robot_keyword_groups WHERE robot_id = ? ORDER BY uid',
    [uid],
  );
  const groupIds = groups.map((row) => row.uid);
  const [keywords] = groupIds.length
    ? await conn.query(
      `SELECT * FROM voice_robot_keywords WHERE group_id IN (${groupIds.map(() => '?').join(',')}) ORDER BY uid`,
      groupIds,
    )
    : [[]];
  const [stt] = await conn.query('SELECT * FROM stt_engines ORDER BY uid');
  const [tts] = await conn.query('SELECT * FROM tts_engines ORDER BY uid');
  const bundle = {
    exportedAt: new Date().toISOString(),
    robot,
    groups,
    keywords,
    stt_engines: stt,
    tts_engines: tts,
  };
  writeFileSync(outPath, JSON.stringify(bundle));
  chmodSync(outPath, 0o600);
  process.stdout.write(
    `exported robot ${robot.uid} "${robot.name}" groups=${groups.length} keywords=${keywords.length} stt=${stt.length} tts=${tts.length}\n`,
  );
} finally {
  await conn.end();
}
