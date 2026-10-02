#!/usr/bin/env node
/**
 * Import a voice-robot bundle into PostgreSQL.
 * Rebinds missing engine ids to the imported Yandex rows and rewrites
 * transfer targets 614@sip-out -> 614@sip-out0.
 * Prints the new robot uid only.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

function rewriteTransfer(value) {
  if (typeof value === 'string') return value.replace(/@sip-out(?!0\b)/g, '@sip-out0');
  if (Array.isArray(value)) return value.map(rewriteTransfer);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = rewriteTransfer(item);
    return out;
  }
  return value;
}

function jsonOrNull(value) {
  if (value == null) return null;
  return JSON.stringify(rewriteTransfer(value));
}

const bundlePath = process.argv[2];
if (!bundlePath) {
  process.stderr.write('usage: import-voice-robot.mjs BUNDLE.json\n');
  process.exit(1);
}

const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function pickEngine(rows, wantedId) {
  return rows.find((row) => Number(row.uid) === Number(wantedId))
    || rows.find((row) => row.type === 'yandex')
    || rows[0]
    || null;
}

async function insertEngine(table, row) {
  const result = await client.query(
    `INSERT INTO ${table}
      (name, type, token, settings, custom_url, auth_mode, custom_headers, user_uid)
     VALUES ($1,$2,$3,$4::json,$5,$6,$7::json,$8)
     RETURNING uid`,
    [
      row.name,
      row.type,
      row.token ?? null,
      jsonOrNull(row.settings),
      row.custom_url ?? null,
      row.auth_mode ?? 'none',
      jsonOrNull(row.custom_headers),
      row.user_uid ?? 0,
    ],
  );
  return result.rows[0].uid;
}

async function ensureEngine(table, row) {
  if (!row) return null;
  const existing = await client.query(
    `SELECT uid FROM ${table} WHERE name = $1 AND type = $2 ORDER BY uid LIMIT 1`,
    [row.name, row.type],
  );
  if (existing.rows[0]) return existing.rows[0].uid;
  return insertEngine(table, row);
}

await client.connect();
try {
  await client.query('BEGIN');
  const robot = bundle.robot;
  const sttRow = pickEngine(bundle.stt_engines || [], robot.stt_engine_id);
  const ttsRow = pickEngine(bundle.tts_engines || [], robot.tts_engine_id);
  const sttId = await ensureEngine('stt_engines', sttRow);
  const ttsId = await ensureEngine('tts_engines', ttsRow);

  const found = await client.query('SELECT uid FROM voice_robots WHERE name = $1 ORDER BY uid LIMIT 1', [robot.name]);
  let robotUid = found.rows[0]?.uid;
  if (!robotUid) {
    const inserted = await client.query(
      `INSERT INTO voice_robots (
        name, description, active, language, stt_engine_id, tts_engine_id,
        greeting_prompts, greeting_tts_text, initial_group_id, vad_config,
        fallback_action, fallback_bot_action, max_retries_action, max_retries_bot_action,
        max_conversation_steps, silence_timeout_seconds, max_inactivity_repeats,
        webhook_url, webhook_method, telegram_chat_id, email_notify, external_host,
        tts_mode, tts_cache_max_age_days, stt_mode, user_uid, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7::json,$8,NULL,$9::json,
        $10::json,$11::json,$12::json,$13::json,
        $14,$15,$16,
        $17,$18,$19,$20,$21,
        $22,$23,$24,$25, NOW(), NOW()
      ) RETURNING uid`,
      [
        robot.name,
        robot.description ?? null,
        robot.active ?? 1,
        robot.language || 'ru-RU',
        sttId,
        ttsId,
        jsonOrNull(robot.greeting_prompts),
        robot.greeting_tts_text ?? null,
        jsonOrNull(robot.vad_config),
        jsonOrNull(robot.fallback_action),
        jsonOrNull(robot.fallback_bot_action),
        jsonOrNull(robot.max_retries_action),
        jsonOrNull(robot.max_retries_bot_action),
        robot.max_conversation_steps ?? 0,
        robot.silence_timeout_seconds ?? 15,
        robot.max_inactivity_repeats ?? 3,
        robot.webhook_url ?? null,
        robot.webhook_method || 'POST',
        robot.telegram_chat_id ?? null,
        robot.email_notify ?? null,
        robot.external_host ?? null,
        robot.tts_mode || 'batch',
        robot.tts_cache_max_age_days ?? 0,
        robot.stt_mode || 'hybrid',
        robot.user_uid ?? 0,
      ],
    );
    robotUid = inserted.rows[0].uid;
    const groupMap = new Map();
    let initialGroup = null;
    for (const group of bundle.groups || []) {
      const created = await client.query(
        `INSERT INTO voice_robot_keyword_groups
          (robot_id, name, description, priority, active, is_global, user_uid)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING uid`,
        [
          robotUid,
          group.name,
          group.description ?? null,
          group.priority ?? 0,
          group.active ?? 1,
          group.is_global ?? 0,
          group.user_uid ?? 0,
        ],
      );
      groupMap.set(group.uid, created.rows[0].uid);
      if (Number(group.uid) === Number(robot.initial_group_id)) initialGroup = created.rows[0].uid;
    }
    if (initialGroup) {
      await client.query('UPDATE voice_robots SET initial_group_id = $1 WHERE uid = $2', [initialGroup, robotUid]);
    }
    for (const keyword of bundle.keywords || []) {
      const groupId = groupMap.get(keyword.group_id);
      if (!groupId) continue;
      await client.query(
        `INSERT INTO voice_robot_keywords (
          group_id, keywords, negative_keywords, synonyms, actions, bot_action,
          priority, max_repeats, escalation_action, comment, tag, user_uid
        ) VALUES ($1,$2,$3::json,$4::json,$5::json,$6::json,$7,$8,$9::json,$10,$11,$12)`,
        [
          groupId,
          keyword.keywords,
          jsonOrNull(keyword.negative_keywords),
          jsonOrNull(keyword.synonyms),
          jsonOrNull(keyword.actions),
          jsonOrNull(keyword.bot_action),
          keyword.priority ?? 0,
          keyword.max_repeats ?? 0,
          jsonOrNull(keyword.escalation_action),
          keyword.comment ?? null,
          keyword.tag ?? null,
          keyword.user_uid ?? 0,
        ],
      );
    }
  } else if (sttId || ttsId) {
    await client.query(
      'UPDATE voice_robots SET stt_engine_id = COALESCE($1, stt_engine_id), tts_engine_id = COALESCE($2, tts_engine_id) WHERE uid = $3',
      [sttId, ttsId, robotUid],
    );
  }
  await client.query('COMMIT');
  process.stdout.write(`robot_uid=${robotUid}\n`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
