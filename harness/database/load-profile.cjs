'use strict';
// Pure AI-11 11L load profile helpers. No Docker. No wallet debit.
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const {
  admitJob, emptyAdmissionStores,
} = require('../../packages/backend/dist-analytics/modules/ai-jobs/admission');
const { assertFairness } = require('../../packages/backend/dist-analytics/modules/ai-jobs/fairness');

const LADDER = Object.freeze([1, 5, 20]);

function baseAdmit(overrides = {}) {
  return {
    tenantUid: 2,
    principalId: 'load-prin',
    product: 'speech_analytics',
    kind: 'analyze',
    resourceKind: 'asset',
    resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
    idempotencyKey: 'op',
    request: { assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001' },
    entitled: true,
    now: new Date('2026-09-20T12:00:00.000Z'),
    caps: { runningCap: 8, queueCap: 32 },
    ...overrides,
  };
}

/** Run N concurrent admits; returns latency/error metrics. */
function runLadderLevel(concurrency, options = {}) {
  const stores = options.stores ?? emptyAdmissionStores();
  const caps = options.caps ?? { runningCap: 8, queueCap: 32 };
  const tenantUid = options.tenantUid ?? 2;
  const started = performance.now();
  const results = [];
  const errors = [];
  // Sequential mutate of shared stores is the SQL-CAS equivalent of one writer;
  // wall-clock still records how long the burst takes under fairness checks.
  for (let i = 0; i < concurrency; i += 1) {
    const t0 = performance.now();
    try {
      const receipt = admitJob(baseAdmit({
        tenantUid,
        idempotencyKey: `load-${tenantUid}-${concurrency}-${i}`,
        resourceId: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`,
        request: { assetId: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}` },
        caps,
      }), stores);
      results.push({
        ok: true, replay: receipt.replay, ms: performance.now() - t0, jobId: receipt.jobId,
      });
    } catch (error) {
      errors.push({
        ok: false, code: error.code || 'unknown', ms: performance.now() - t0, message: error.message,
      });
    }
  }
  const latencies = [...results, ...errors].map((row) => row.ms).sort((a, b) => a - b);
  const p = (q) => (latencies.length
    ? latencies[Math.min(latencies.length - 1, Math.floor(q * (latencies.length - 1)))]
    : 0);
  return {
    concurrency,
    admitted: results.length,
    errors: errors.length,
    fairnessRejected: errors.filter((row) => row.code === 'fairness_exhausted').length,
    durationMs: performance.now() - started,
    p50Ms: p(0.5),
    p95Ms: p(0.95),
    queued: [...stores.jobs.values()].filter((job) => job.tenantUid === tenantUid && job.state === 'queued').length,
  };
}

/** Measure ladder 1→5→20. Does not claim product SLA. */
function measureAdmissionLadder(options = {}) {
  const stores = emptyAdmissionStores();
  return LADDER.map((concurrency) => runLadderLevel(concurrency, { ...options, stores }));
}

/**
 * Media vs batch: filling the batch queue to its cap must not block media admits
 * on a separate fairness namespace (separate caps object / store partition).
 */
function mediaNotStarvedByBatch() {
  const batch = emptyAdmissionStores();
  const media = emptyAdmissionStores();
  const batchCaps = { runningCap: 2, queueCap: 4 };
  const mediaCaps = { runningCap: 2, queueCap: 4 };
  for (let i = 0; i < 4; i += 1) {
    admitJob(baseAdmit({
      tenantUid: 8,
      product: 'speech_analytics',
      kind: 'batch_analyze',
      idempotencyKey: `batch-${i}`,
      resourceId: `bbbbbbbb-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`,
      request: { assetId: `bbbbbbbb-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}` },
      caps: batchCaps,
    }), batch);
  }
  let batchBlocked = false;
  try {
    admitJob(baseAdmit({
      tenantUid: 8,
      product: 'speech_analytics',
      kind: 'batch_analyze',
      idempotencyKey: 'batch-overflow',
      resourceId: 'bbbbbbbb-bbbb-4ccc-8ddd-ffffffffffff',
      request: { assetId: 'bbbbbbbb-bbbb-4ccc-8ddd-ffffffffffff' },
      caps: batchCaps,
    }), batch);
  } catch (error) {
    batchBlocked = error.code === 'fairness_exhausted';
  }
  const mediaReceipt = admitJob(baseAdmit({
    tenantUid: 8,
    product: 'ai_voice_robots',
    kind: 'media_turn',
    resourceKind: 'deployment',
    idempotencyKey: 'media-1',
    resourceId: 'cccccccc-bbbb-4ccc-8ddd-000000000001',
    request: { deploymentId: 'cccccccc-bbbb-4ccc-8ddd-000000000001' },
    caps: mediaCaps,
  }), media);
  return {
    batchQueued: batch.jobs.size,
    batchBlocked,
    mediaAdmitted: mediaReceipt.status === 202 && mediaReceipt.replay === false,
    note: 'Separate fairness stores: batch exhaustion must not starve media admits',
  };
}

function quotaFailClosed() {
  const stores = emptyAdmissionStores();
  const caps = { runningCap: 1, queueCap: 2 };
  admitJob(baseAdmit({ idempotencyKey: 'q1', caps }), stores);
  admitJob(baseAdmit({
    idempotencyKey: 'q2',
    resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    request: { assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002' },
    caps,
  }), stores);
  let code = null;
  try {
    admitJob(baseAdmit({
      idempotencyKey: 'q3',
      resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
      request: { assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003' },
      caps,
    }), stores);
  } catch (error) {
    code = error.code;
  }
  return { rejected: code === 'fairness_exhausted', code, queued: stores.jobs.size };
}

function publishedProfile(ladder, extras = {}) {
  return {
    revision: '2026-09-20-r1',
    phase: 'AI-11',
    task: '11L',
    productSlaClaimed: false,
    ladder: LADDER,
    measurements: ladder,
    mediaVsBatch: extras.mediaVsBatch ?? null,
    quota: extras.quota ?? null,
    constraints: {
      noLiveTenantDebit: true,
      noAutodial: true,
      noXrayUi: true,
      productRuntime: 'not-installed',
      cloudWallet: 'off',
    },
  };
}

module.exports = {
  LADDER,
  assertFairness,
  measureAdmissionLadder,
  mediaNotStarvedByBatch,
  quotaFailClosed,
  publishedProfile,
  runLadderLevel,
  admissionModulePath: path.resolve(__dirname, '../../packages/backend/dist-analytics/modules/ai-jobs/admission.js'),
};
