import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { QueryTypes, Sequelize } from 'sequelize';
import { encryptSecret } from './secret-cipher.util';

/**
 * Current installs still decrypt unversioned envelopes with the configured secret.
 * v2 refuses a secret shorter than 32 bytes, which is this development key.
 */
function encryptEngineToken(plain: string): string {
  try {
    return encryptSecret(plain);
  } catch (error) {
    if ((error as Error).message !== 'AI_PROVIDER_KEY_TOO_SHORT') throw error;
    const secret = process.env.CC_AI_KEY_SECRET || '';
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      scryptSync(secret, Buffer.from('krsk-ai-providers-v1'), 32),
      iv,
    );
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }
}
import {
  legacyEngineKey,
  mapLegacySpeechEngine,
  rewriteIvrPrompts,
  rewriteNotifyDispatch,
  rewriteRouteActions,
  remapSpeechUid,
  repairLegacySpeechProvider,
  type LegacySpeechEngineRow,
  type SpeechCapability,
} from './speech-engine';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Copy tts_engines and stt_engines into the superadmin catalog.
 * Tokens are encrypted here; SQL migration 0026 is only the schema marker.
 *
 *   npx ts-node -r tsconfig-paths/register src/modules/ai-connectivity/migrate-speech-engines.ts
 */
function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  const parsed = parseJson<unknown>(value, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

async function walkTtsMeta(dir: string, visit: (file: string) => Promise<void>): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkTtsMeta(full, visit);
    else if (entry.isFile() && entry.name.endsWith('.tts.json')) await visit(full);
  }
}

async function main(): Promise<void> {
  const dialect = (process.env.DB_DIALECT as 'mysql' | 'postgres') || 'mysql';
  const sequelize = new Sequelize({
    dialect,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || (dialect === 'postgres' ? 5432 : 3306),
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: false,
  });

  const providers = await sequelize.query<{
    uid: number;
    vendor: string;
    endpoint: string | null;
    auth_type: string | null;
    capabilities: unknown;
    defaults: unknown;
    encrypted_api_key: string | null;
  }>(
    `SELECT uid, vendor, endpoint, auth_type, capabilities, defaults,
            CASE WHEN encrypted_api_key IS NULL OR encrypted_api_key = '' THEN NULL ELSE 'set' END AS encrypted_api_key
     FROM cc_ai_providers`,
    { type: QueryTypes.SELECT },
  );
  const byUid = new Map(providers.map((row) => [Number(row.uid), row]));
  const byLegacy = new Map<string, number>();
  const providerLegacyUid = new Map<number, number>();
  for (const row of providers) {
    const defaults = asRecord(row.defaults);
    const key = legacyEngineKey(defaults);
    if (!key) continue;
    byLegacy.set(key, Number(row.uid));
    providerLegacyUid.set(Number(row.uid), Number(key.split(':')[1]));
  }

  const inserted = { tts: 0, stt: 0, reused: 0, repaired: 0 };
  const maps: Record<SpeechCapability, Map<number, number>> = {
    tts: new Map(),
    stt: new Map(),
  };

  async function importTable(table: string, capability: SpeechCapability): Promise<void> {
    const rows = await sequelize.query<LegacySpeechEngineRow & { uid: number }>(
      `SELECT uid, name, type, token, settings, custom_url, auth_mode, custom_headers FROM ${table}`,
      { type: QueryTypes.SELECT },
    );
    for (const row of rows) {
      const key = `${capability}:${row.uid}`;
      const known = byLegacy.get(key);
      if (known) {
        maps[capability].set(Number(row.uid), known);
        inserted.reused += 1;
        const current = byUid.get(known);
        if (current) {
          const patch = repairLegacySpeechProvider({
            vendor: current.vendor,
            endpoint: current.endpoint,
            auth_type: current.auth_type,
            capabilities: current.capabilities,
            defaults: asRecord(current.defaults),
            hasKey: current.encrypted_api_key === 'set',
          });
          if (patch) {
            await sequelize.query(
              `UPDATE cc_ai_providers
               SET endpoint = ?, auth_type = ?, defaults = CAST(? AS JSON)
               WHERE uid = ?`,
              {
                replacements: [
                  patch.endpoint ?? current.endpoint ?? '',
                  patch.auth_type ?? current.auth_type ?? 'none',
                  JSON.stringify(patch.defaults ?? asRecord(current.defaults)),
                  known,
                ],
              },
            );
            inserted.repaired += 1;
          }
        }
        continue;
      }
      const mapped = mapLegacySpeechEngine({
        ...row,
        settings: asRecord(row.settings),
        custom_headers: asRecord(row.custom_headers) as Record<string, string>,
      }, capability);
      const encrypted = mapped.plainToken ? encryptEngineToken(mapped.plainToken) : null;
      const flag = dialect === 'postgres';
      const sql = `INSERT INTO cc_ai_providers
        (name, kind, vendor, endpoint, auth_type, encrypted_api_key, capabilities, defaults, enabled, is_global, vpbx_user_uid)
        VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`;
      const replacements = [
        mapped.name,
        mapped.kind,
        mapped.vendor,
        mapped.endpoint,
        mapped.auth_type,
        encrypted,
        JSON.stringify(mapped.capabilities),
        JSON.stringify(mapped.defaults),
        flag ? true : 1,
        flag ? true : 1,
        0,
      ];
      if (dialect === 'postgres') {
        await sequelize.query(`${sql} RETURNING uid`, { type: QueryTypes.SELECT, replacements });
      } else {
        await sequelize.query(sql, { replacements });
      }
      const lookupSql = dialect === 'postgres'
        ? `SELECT uid FROM cc_ai_providers
           WHERE is_global = TRUE
             AND defaults->'legacyEngine'->>'kind' = ?
             AND (defaults->'legacyEngine'->>'uid')::int = ?
           ORDER BY uid DESC LIMIT 1`
        : `SELECT uid FROM cc_ai_providers
           WHERE is_global = 1
             AND JSON_UNQUOTE(JSON_EXTRACT(defaults, '$.legacyEngine.kind')) = ?
             AND JSON_EXTRACT(defaults, '$.legacyEngine.uid') = ?
           ORDER BY uid DESC LIMIT 1`;
      const created = await sequelize.query<{ uid: number }>(lookupSql, {
        type: QueryTypes.SELECT,
        replacements: [capability, Number(row.uid)],
      });
      const providerUid = Number(created[0]?.uid);
      if (!providerUid) throw new Error(`speech engine insert failed for ${key}`);
      maps[capability].set(Number(row.uid), providerUid);
      byLegacy.set(key, providerUid);
      providerLegacyUid.set(providerUid, Number(row.uid));
      inserted[capability] += 1;
    }
  }

  await importTable('tts_engines', 'tts');
  await importTable('stt_engines', 'stt');

  const robots = await sequelize.query<{ uid: number; stt_engine_id: number | null; tts_engine_id: number | null }>(
    'SELECT uid, stt_engine_id, tts_engine_id FROM voice_robots',
    { type: QueryTypes.SELECT },
  );
  let robotsUpdated = 0;
  for (const robot of robots) {
    const stt = remapSpeechUid(robot.stt_engine_id, maps.stt, providerLegacyUid);
    const tts = remapSpeechUid(robot.tts_engine_id, maps.tts, providerLegacyUid);
    if (stt === robot.stt_engine_id && tts === robot.tts_engine_id) continue;
    await sequelize.query(
      'UPDATE voice_robots SET stt_engine_id = ?, tts_engine_id = ? WHERE uid = ?',
      { replacements: [stt, tts, robot.uid] },
    );
    robotsUpdated += 1;
  }

  const ivrs = await sequelize.query<{ uid: number; prompts: unknown }>(
    'SELECT uid, prompts FROM ivrs',
    { type: QueryTypes.SELECT },
  );
  let ivrsUpdated = 0;
  for (const ivr of ivrs) {
    const prompts = parseJson<unknown>(ivr.prompts, []);
    const next = rewriteIvrPrompts(prompts, maps.tts, providerLegacyUid);
    if (JSON.stringify(next) === JSON.stringify(prompts)) continue;
    await sequelize.query(
      'UPDATE ivrs SET prompts = CAST(? AS JSON) WHERE uid = ?',
      { replacements: [JSON.stringify(next), ivr.uid] },
    );
    ivrsUpdated += 1;
  }

  const routes = await sequelize.query<{ uid: number; actions: unknown }>(
    'SELECT uid, actions FROM routes',
    { type: QueryTypes.SELECT },
  );
  let routesUpdated = 0;
  for (const route of routes) {
    const actions = parseJson<unknown>(route.actions, []);
    const next = rewriteRouteActions(actions, maps, providerLegacyUid);
    if (JSON.stringify(next) === JSON.stringify(actions)) continue;
    await sequelize.query(
      'UPDATE routes SET actions = CAST(? AS JSON) WHERE uid = ?',
      { replacements: [JSON.stringify(next), route.uid] },
    );
    routesUpdated += 1;
  }

  const messages = await sequelize.query<{ uid: number; notify_dispatch: string | null }>(
    'SELECT uid, notify_dispatch FROM voicemail_messages WHERE notify_dispatch IS NOT NULL',
    { type: QueryTypes.SELECT },
  );
  let messagesUpdated = 0;
  for (const message of messages) {
    const next = rewriteNotifyDispatch(message.notify_dispatch, maps.stt, providerLegacyUid);
    if (next === message.notify_dispatch) continue;
    await sequelize.query(
      'UPDATE voicemail_messages SET notify_dispatch = ? WHERE uid = ?',
      { replacements: [next, message.uid] },
    );
    messagesUpdated += 1;
  }

  const keyColumn = dialect === 'postgres' ? 'key' : '`key`';
  const settings = await sequelize.query<{ value: string | null }>(
    `SELECT value FROM system_settings WHERE ${keyColumn} = 'records_base_path' LIMIT 1`,
    { type: QueryTypes.SELECT },
  ).catch(() => [] as { value: string | null }[]);
  const recordsBase = settings[0]?.value || process.env.RECORDS_BASE_PATH || '/usr/records';
  let filesUpdated = 0;
  await walkTtsMeta(recordsBase, async (file) => {
    const raw = await fs.readFile(file, 'utf8');
    let parsed: { engine_uid?: unknown; text?: string; settings?: unknown };
    try { parsed = JSON.parse(raw); } catch { return; }
    const nextUid = remapSpeechUid(parsed.engine_uid, maps.tts, providerLegacyUid);
    if (nextUid === parsed.engine_uid) return;
    parsed.engine_uid = nextUid;
    await fs.writeFile(file, JSON.stringify(parsed), 'utf8');
    filesUpdated += 1;
  });

  console.log(JSON.stringify({
    inserted,
    robotsUpdated,
    ivrsUpdated,
    routesUpdated,
    messagesUpdated,
    filesUpdated,
    tts: maps.tts.size,
    stt: maps.stt.size,
  }));
  await sequelize.close();
}

if (require.main === module) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
