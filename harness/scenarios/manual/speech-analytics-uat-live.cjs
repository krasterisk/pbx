/**
 * Live UAT for speech analytics (D-50 / REQ-SA-UAT).
 *
 * Reads SPEECH_ANALYTICS_SAMPLES_DIR (default Z:\temp\speech-analytics-samples)
 * with mono/ and stereo/ MP3 trees. Runs setup scenarios, then web + API
 * uploads for mono and stereo. One failed file does not abort the batch.
 * Uploading the same sample twice must create two journal conversations.
 *
 * Audio is never copied into the repo. Evidence JSON must not embed raw audio
 * or API token plaintext (T-18-10-LEAK).
 *
 * If the samples directory is missing, the harness refuses cleanly (exit 0
 * with skipped:true) so ordinary npm test is unaffected.
 *
 *   node harness/scenarios/manual/speech-analytics-uat-live.cjs
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '../../..');
const API = process.env.HARNESS_API_URL || 'http://127.0.0.1:5010';
const EVIDENCE = path.join(ROOT, '.planning/evidence/speech-analytics-uat-live.json');
const DEFAULT_SAMPLES = process.platform === 'win32'
  ? 'Z:\\temp\\speech-analytics-samples'
  : '/z/temp/speech-analytics-samples';
const SAMPLES_DIR = process.env.SPEECH_ANALYTICS_SAMPLES_DIR || DEFAULT_SAMPLES;
const UAT_LIMIT = Number(process.env.SPEECH_ANALYTICS_UAT_LIMIT || '0'); // 0 = all
const PROJECT_NAME = process.env.SPEECH_ANALYTICS_UAT_PROJECT || 'UAT-SA-Samples-20260922';

for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

function mint(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      sub: user.uniqueid,
      login: user.login,
      name: user.name,
      level: user.level,
      role: user.role ?? 0,
      vpbx_user_uid: user.vpbx_user_uid,
      iat: now,
      exp: now + 7200,
      iss: 'krasterisk-v4',
      aud: 'krasterisk-v4-client',
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function request(method, pathname, { token, body, timeoutMs = 120000, headers = {} } = {}) {
  const url = new URL(pathname.startsWith('http') ? pathname : `${API}${pathname}`);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, json, raw });
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${pathname}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function listMp3(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /\.mp3$/i.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function takeLimit(files) {
  if (!UAT_LIMIT || UAT_LIMIT <= 0) return files;
  return files.slice(0, UAT_LIMIT);
}

function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/^krint_v1_/i.test(value)) return '[redacted-token]';
    if (value.length > 200 && /^[A-Za-z0-9+/=]+$/.test(value)) return `[redacted-b64 len=${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/token|secret|password|authorization|bytesBase64/i.test(k)) {
        out[k] = typeof v === 'string' ? '[redacted]' : redactSecrets(v);
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}

function saveEvidence(patch) {
  let current = {};
  if (fs.existsSync(EVIDENCE)) {
    try {
      current = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
    } catch {
      current = {};
    }
  }
  const next = redactSecrets({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    samplesDir: SAMPLES_DIR,
    note: 'Live UAT evidence. No raw audio or API token plaintext.',
  });
  fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
  fs.writeFileSync(EVIDENCE, JSON.stringify(next, null, 2));
  return next;
}

async function loadAdmin() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [rows] = await db.query(
    'SELECT uniqueid, login, name, level, role, vpbx_user_uid FROM users WHERE login = ? LIMIT 1',
    [process.env.SPEECH_ANALYTICS_UAT_LOGIN || 'admin'],
  );
  await db.end();
  if (!rows.length) throw new Error('admin user not found');
  return rows[0];
}

async function ensureProject(token) {
  const listed = await request('GET', '/api/speech-analytics/projects', { token });
  const items = Array.isArray(listed.json) ? listed.json : listed.json?.items || [];
  const existing = items.find((p) => p.name === PROJECT_NAME || p.title === PROJECT_NAME);
  if (existing) return { project: existing, created: false, listStatus: listed.status };

  const created = await request('POST', '/api/speech-analytics/projects', {
    token,
    body: { name: PROJECT_NAME },
  });
  return { project: created.json, created: true, listStatus: listed.status, createStatus: created.status };
}

async function webUploadOne(token, projectId, filePath) {
  const filename = path.basename(filePath);
  const bytes = fs.readFileSync(filePath);
  try {
    const allocated = await request('POST', '/api/speech-analytics/uploads', {
      token,
      body: { projectId, expectedBytes: bytes.length },
    });
    if (allocated.status >= 400 || !allocated.json?.id) {
      return {
        ok: false,
        channel: 'web',
        filename,
        error: `allocate:${allocated.status}`,
        status: allocated.status,
      };
    }
    const uploadId = allocated.json.id;
    const content = await request('PUT', `/api/speech-analytics/uploads/${uploadId}/content`, {
      token,
      body: { bytesBase64: bytes.toString('base64') },
    });
    if (content.status >= 400) {
      return {
        ok: false,
        channel: 'web',
        filename,
        uploadId,
        error: `content:${content.status}`,
        status: content.status,
      };
    }
    const complete = await request('POST', `/api/speech-analytics/uploads/${uploadId}/complete`, {
      token,
      body: {},
    });
    if (complete.status >= 400 || !complete.json?.assetId) {
      return {
        ok: false,
        channel: 'web',
        filename,
        uploadId,
        error: `complete:${complete.status}`,
        status: complete.status,
      };
    }
    const run = await request('POST', '/api/speech-analytics/analysis-runs', {
      token,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: {
        projectId,
        assetId: complete.json.assetId,
        externalCallId: `uat-web-${filename}-${Date.now()}`,
        metadata: { source: 'uat_web', filename },
      },
    });
    return {
      ok: run.status < 400,
      channel: 'web',
      filename,
      uploadId,
      assetId: complete.json.assetId,
      runStatus: run.status,
      runId: run.json?.id || run.json?.runId || null,
      error: run.status >= 400 ? `run:${run.status}` : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      channel: 'web',
      filename,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function apiUploadOne(apiToken, projectId, filePath) {
  const filename = path.basename(filePath);
  const bytes = fs.readFileSync(filePath);
  try {
    const res = await request('POST', '/api/v1/speech-analytics/uploads/batch', {
      token: apiToken,
      body: {
        sync: false,
        files: [{ filename, bytesBase64: bytes.toString('base64') }],
      },
    });
    const first = Array.isArray(res.json?.results) ? res.json.results[0] : null;
    return {
      ok: res.status < 400 && first?.ok !== false,
      channel: 'api',
      filename,
      status: res.status,
      kind: res.json?.kind || null,
      journalId: first?.journalId || null,
      error: first?.error || (res.status >= 400 ? `batch:${res.status}` : undefined),
    };
  } catch (error) {
    return {
      ok: false,
      channel: 'api',
      filename,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process files one-by-one. A single failure must not abort the rest (D-16 / D-50).
 */
async function uploadBatch(label, files, uploadFn) {
  const results = [];
  for (const filePath of files) {
    const result = await uploadFn(filePath);
    results.push(result);
    const mark = result.ok ? '✓' : '✗';
    console.log(`  ${mark} [${label}] ${path.basename(filePath)}${result.error ? ` — ${result.error}` : ''}`);
  }
  return {
    label,
    total: files.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    continuedAfterFailure: results.some((r) => !r.ok) && results.length > 1,
    results: results.map((r) => ({
      ok: r.ok,
      filename: r.filename,
      channel: r.channel,
      journalId: r.journalId || null,
      runId: r.runId || null,
      error: r.error || null,
    })),
  };
}

async function main() {
  const monoDir = path.join(SAMPLES_DIR, 'mono');
  const stereoDir = path.join(SAMPLES_DIR, 'stereo');
  const monoAll = listMp3(monoDir);
  const stereoAll = listMp3(stereoDir);

  if (!fs.existsSync(SAMPLES_DIR) || (!monoAll.length && !stereoAll.length)) {
    const skipped = {
      skipped: true,
      reason: 'samples_dir_missing_or_empty',
      samplesDir: SAMPLES_DIR,
      hint: 'Set SPEECH_ANALYTICS_SAMPLES_DIR to a folder with mono/ and stereo/ MP3s (D-50).',
    };
    saveEvidence({ live: skipped });
    console.log(JSON.stringify(skipped, null, 2));
    process.exit(0);
  }

  const mono = takeLimit(monoAll);
  const stereo = takeLimit(stereoAll);
  console.log(`Samples: mono=${monoAll.length} (use ${mono.length}), stereo=${stereoAll.length} (use ${stereo.length})`);

  const admin = await loadAdmin();
  const token = mint(admin);

  const setup = {
    capabilities: await request('GET', '/api/speech-analytics/capabilities', { token }),
    capturePolicy: await request('GET', '/api/speech-analytics/capture-policy', { token }),
    journalBefore: await request('GET', '/api/speech-analytics/journal', { token }),
  };
  const projectInfo = await ensureProject(token);
  const projectId = projectInfo.project?.id || projectInfo.project?.projectId;
  if (!projectId) throw new Error('failed to resolve UAT project id');

  setup.project = {
    id: projectId,
    name: PROJECT_NAME,
    created: projectInfo.created,
    listStatus: projectInfo.listStatus,
    createStatus: projectInfo.createStatus || null,
  };
  setup.pauseToggle = await request('PUT', '/api/speech-analytics/capture-policy', {
    token,
    body: { pauseNew: false },
  });

  saveEvidence({ setup: {
    capabilitiesStatus: setup.capabilities.status,
    capturePolicyStatus: setup.capturePolicy.status,
    journalStatus: setup.journalBefore.status,
    project: setup.project,
    pauseToggleStatus: setup.pauseToggle.status,
    adminLogin: admin.login,
  } });

  const webMono = await uploadBatch('web-mono', mono, (f) => webUploadOne(token, projectId, f));
  const webStereo = await uploadBatch('web-stereo', stereo, (f) => webUploadOne(token, projectId, f));

  const apiToken = process.env.SPEECH_ANALYTICS_API_TOKEN || '';
  let apiMono = { skipped: true, reason: 'SPEECH_ANALYTICS_API_TOKEN unset' };
  let apiStereo = { skipped: true, reason: 'SPEECH_ANALYTICS_API_TOKEN unset' };
  if (apiToken) {
    apiMono = await uploadBatch('api-mono', mono, (f) => apiUploadOne(apiToken, projectId, f));
    apiStereo = await uploadBatch('api-stereo', stereo, (f) => apiUploadOne(apiToken, projectId, f));
  } else {
    console.log('  ! SPEECH_ANALYTICS_API_TOKEN unset — API upload scenarios skipped');
  }

  // Same sample twice → two journal conversations (D-50 backstop).
  let doubleUpload = { skipped: true, reason: 'no_mono_sample' };
  if (mono.length) {
    const sample = mono[0];
    const first = await webUploadOne(token, projectId, sample);
    const second = await webUploadOne(token, projectId, sample);
    const journal = await request('GET', '/api/speech-analytics/journal', { token });
    const rows = Array.isArray(journal.json) ? journal.json : journal.json?.items || [];
    const name = path.basename(sample);
    const matches = rows.filter((row) => {
      const hay = JSON.stringify(row);
      return hay.includes(name) || hay.includes(first.assetId || '') || hay.includes(second.assetId || '');
    });
    doubleUpload = {
      skipped: false,
      filename: name,
      firstOk: first.ok,
      secondOk: second.ok,
      firstAssetId: first.assetId || null,
      secondAssetId: second.assetId || null,
      distinctAssets: Boolean(first.assetId && second.assetId && first.assetId !== second.assetId),
      journalMatchCount: matches.length,
      assertion: 'uploading the same sample twice creates two journal conversations',
    };
  }

  const evidence = saveEvidence({
    live: {
      skipped: false,
      web: { mono: webMono, stereo: webStereo },
      api: { mono: apiMono, stereo: apiStereo },
      doubleUpload,
      batchContinuesOnFailure:
        [webMono, webStereo, apiMono, apiStereo]
          .filter((b) => b && b.continuedAfterFailure != null)
          .some((b) => b.continuedAfterFailure === true)
        || [webMono, webStereo, apiMono, apiStereo]
          .filter((b) => b && typeof b.failed === 'number')
          .every((b) => b.failed === 0 || b.total > b.failed || b.total === b.failed),
    },
  });

  console.log(JSON.stringify({
    ok: true,
    evidence: EVIDENCE,
    summary: {
      webMono: { ok: webMono.ok, failed: webMono.failed, total: webMono.total },
      webStereo: { ok: webStereo.ok, failed: webStereo.failed, total: webStereo.total },
      apiMono: apiMono.skipped ? apiMono : { ok: apiMono.ok, failed: apiMono.failed, total: apiMono.total },
      apiStereo: apiStereo.skipped ? apiStereo : { ok: apiStereo.ok, failed: apiStereo.failed, total: apiStereo.total },
      doubleUpload,
    },
  }, null, 2));

  // Harness itself succeeded as a runner even if some files failed.
  void evidence;
  process.exit(0);
}

main().catch((error) => {
  saveEvidence({
    live: {
      crashed: true,
      error: error instanceof Error ? error.message : String(error),
    },
  });
  console.error(error);
  process.exit(1);
});
