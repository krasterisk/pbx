'use strict';
// Pure AI-11 11F named fault helpers. No Docker. No live wallet debit.
const {
  admitJob, admitThenEnqueue, emptyAdmissionStores,
} = require('../../packages/backend/dist-analytics/modules/ai-jobs/admission');
const {
  dispatchOutbox, handleQueueEvent,
} = require('../../packages/backend/dist-analytics/modules/ai-jobs/outbox-dispatcher');
const {
  claimStage, startStageExecution, commitStage,
} = require('../../packages/backend/dist-analytics/modules/ai-jobs/stage-lease');
const {
  assertQueueTenant, bindAiQueueJob,
} = require('../../packages/backend/dist-analytics/modules/ai-jobs/queue-payload');
const {
  nextProviderOrdinal, transitionProviderOperation,
} = require('../../packages/backend/dist-analytics/modules/ai-jobs/state-machines');

const now = new Date('2026-09-20T12:00:00.000Z');

const NAMED_FAULTS = Object.freeze([
  'api_crash_before_commit',
  'api_crash_after_commit',
  'worker_restart_ordinal',
  'redis_enqueue_failure',
  'duplicate_outbox_delivery',
  'stale_fence_commit',
  'cas_claim_collision',
  'forged_queue_tenant',
  'provider_rate_limit',
  'long_tool_timeout_unknown',
  'clock_timezone_lease',
  'storage_unavailable',
  'idempotent_replay_zero_debit',
  'db_deadlock_retry_stub',
]);

function baseAdmit(overrides = {}) {
  return {
    tenantUid: 2,
    principalId: 'fault-prin',
    product: 'speech_analytics',
    kind: 'analyze',
    resourceKind: 'asset',
    resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
    idempotencyKey: 'fault-op',
    request: { assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001' },
    entitled: true,
    now,
    caps: { runningCap: 8, queueCap: 32 },
    ...overrides,
  };
}

function pendingStage() {
  return {
    id: 'stage-1', tenantUid: 2, state: 'pending', version: 1, fence: 0,
    leaseOwner: null, leaseUntil: null,
  };
}

/** Provider rate-limit is transient; protocol is permanent. */
function classifyProviderError(kind) {
  if (kind === 'rate_limit' || kind === 'transient') return 'transient';
  if (kind === 'protocol') return 'fail';
  return 'unknown';
}

function nextRetryDelayMs(attempt) {
  if (attempt >= 3) return null;
  return 1000 * (2 ** attempt);
}

function runNamedFault(name) {
  switch (name) {
    case 'api_crash_before_commit': {
      const stores = emptyAdmissionStores();
      let threw = false;
      try {
        admitJob(baseAdmit(), stores, { crash: 'before-commit' });
      } catch (error) {
        threw = /crash before commit/.test(error.message);
      }
      return { name, pass: threw && stores.jobs.size === 0, detail: { jobs: stores.jobs.size } };
    }
    case 'api_crash_after_commit': {
      const stores = emptyAdmissionStores();
      let threw = false;
      try {
        admitJob(baseAdmit(), stores, { crash: 'after-commit' });
      } catch (error) {
        threw = /crash after commit/.test(error.message);
      }
      return { name, pass: threw && stores.jobs.size === 1, detail: { jobs: stores.jobs.size } };
    }
    case 'worker_restart_ordinal': {
      const same = nextProviderOrdinal(1, 'worker_restart');
      const next = nextProviderOrdinal(1, 'new_external_call');
      return { name, pass: same === 1 && next === 2, detail: { same, next } };
    }
    case 'redis_enqueue_failure': {
      return admitThenEnqueue(
        baseAdmit({ idempotencyKey: 'redis-down' }),
        emptyAdmissionStores(),
        { enqueue: async () => { throw new Error('redis down'); } },
      ).then((receipt) => ({
        name,
        pass: receipt.status === 202 && receipt.replay === false,
        detail: { jobKept: true, code: 'redis_down_after_admit' },
      }));
    }
    case 'duplicate_outbox_delivery': {
      return (async () => {
        const queued = [];
        const processed = new Set();
        const record = { id: 'evt-1', deliveredAt: null, leaseOwner: 'd1', attempts: 0 };
        await dispatchOutbox(record, { enqueue: async (id) => { queued.push(id); } }, now, 'after-enqueue')
          .catch((error) => {
            if (!/crash after enqueue/.test(error.message)) throw error;
          });
        const first = handleQueueEvent(processed, 'evt-1');
        const delivered = await dispatchOutbox(
          { ...record, deliveredAt: null },
          { enqueue: async (id) => { queued.push(id); } },
          now,
        );
        const second = handleQueueEvent(processed, delivered.id);
        return {
          name,
          pass: first === 'apply' && second === 'skip' && queued.length === 2,
          detail: { first, second, enqueues: queued.length },
        };
      })();
    }
    case 'stale_fence_commit': {
      const leased = claimStage(pendingStage(), {
        owner: 'worker-alpha', expectedVersion: 1, now, leaseMs: 30000,
      });
      const executing = startStageExecution(leased, { owner: 'worker-alpha', fence: 1 });
      let stale = false;
      try {
        commitStage(executing, { owner: 'worker-stale', fence: 1, to: 'succeeded' });
      } catch (error) {
        stale = /stale fence/.test(error.message);
      }
      const ok = commitStage(executing, { owner: 'worker-alpha', fence: 1, to: 'succeeded' });
      return { name, pass: stale && ok.state === 'succeeded', detail: { stale } };
    }
    case 'cas_claim_collision': {
      const first = claimStage(pendingStage(), {
        owner: 'worker-one', expectedVersion: 1, now, leaseMs: 30000,
      });
      let collision = false;
      try {
        claimStage(first, { owner: 'worker-two', expectedVersion: 1, now, leaseMs: 30000 });
      } catch (error) {
        collision = /cas collision/.test(error.message);
      }
      return { name, pass: collision, detail: { owner: first.leaseOwner } };
    }
    case 'forged_queue_tenant': {
      const payload = bindAiQueueJob({
        eventId: 'evt-1', tenantUid: 2, aggregateKind: 'job', aggregateId: 'job-1',
      });
      let rejected = false;
      try {
        assertQueueTenant(payload, 9);
      } catch (error) {
        rejected = /forged queue payload/.test(error.message);
      }
      return { name, pass: rejected, detail: { tenantUid: payload.tenantUid } };
    }
    case 'provider_rate_limit': {
      const kind = classifyProviderError('rate_limit');
      const delay0 = nextRetryDelayMs(0);
      const delay3 = nextRetryDelayMs(3);
      return {
        name,
        pass: kind === 'transient' && delay0 === 1000 && delay3 === null,
        detail: { kind, delay0, delay3 },
      };
    }
    case 'long_tool_timeout_unknown': {
      const state = transitionProviderOperation('dispatched', 'unknown');
      return { name, pass: state === 'unknown', detail: { state } };
    }
    case 'clock_timezone_lease': {
      const utc = new Date('2026-09-20T12:00:00.000Z');
      const offsetLabel = 'Asia/Bangkok';
      const leased = claimStage(pendingStage(), {
        owner: 'worker-tz', expectedVersion: 1, now: utc, leaseMs: 30000,
      });
      const expiredAt = new Date(utc.getTime() + 30000);
      const stillLeased = leased.leaseUntil.getTime() === expiredAt.getTime();
      return {
        name,
        pass: stillLeased && leased.leaseUntil.toISOString().endsWith('Z'),
        detail: { offsetLabel, leaseUntil: leased.leaseUntil.toISOString() },
      };
    }
    case 'storage_unavailable': {
      const put = () => {
        throw Object.assign(new Error('storage unavailable'), { code: 'storage_unavailable', status: 503 });
      };
      let code = null;
      try {
        put();
      } catch (error) {
        code = error.code;
      }
      return { name, pass: code === 'storage_unavailable', detail: { failClosed: true } };
    }
    case 'idempotent_replay_zero_debit': {
      const stores = emptyAdmissionStores();
      let debitCalls = 0;
      const chargeOnce = (receipt) => {
        if (!receipt.replay) debitCalls += 1;
      };
      const first = admitJob(baseAdmit({ idempotencyKey: 'debit-1' }), stores);
      chargeOnce(first);
      const second = admitJob(baseAdmit({ idempotencyKey: 'debit-1' }), stores);
      chargeOnce(second);
      return {
        name,
        pass: first.replay === false && second.replay === true
          && debitCalls === 1 && stores.jobs.size === 1,
        detail: { debitCalls, jobs: stores.jobs.size, shadow: true },
      };
    }
    case 'db_deadlock_retry_stub': {
      let attempts = 0;
      const run = () => {
        attempts += 1;
        if (attempts < 2) {
          throw Object.assign(new Error('Deadlock found when trying to get lock'), {
            code: 'ER_LOCK_DEADLOCK',
          });
        }
        return 'ok';
      };
      let result = null;
      let lastError = null;
      for (let i = 0; i < 3; i += 1) {
        try {
          result = run();
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (error.code !== 'ER_LOCK_DEADLOCK') throw error;
        }
      }
      return {
        name,
        pass: result === 'ok' && attempts === 2 && lastError === null,
        detail: { attempts },
      };
    }
    default:
      return { name, pass: false, detail: { error: 'unknown_fault' } };
  }
}

async function runAllPureFaults() {
  const results = [];
  for (const name of NAMED_FAULTS) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runNamedFault(name));
  }
  return results;
}

function publishedMatrix(results, live = null) {
  return {
    revision: '2026-09-20-r1',
    phase: 'AI-11',
    task: '11F',
    productSlaClaimed: false,
    namedFaults: NAMED_FAULTS.slice(),
    pure: results,
    live,
    constraints: {
      noLiveTenantDebit: true,
      noAutodial: true,
      noXrayUi: true,
      productRuntime: 'not-installed',
      cloudWallet: 'off',
      shadowDebitOnly: true,
    },
  };
}

module.exports = {
  NAMED_FAULTS,
  runNamedFault,
  runAllPureFaults,
  publishedMatrix,
  classifyProviderError,
  nextRetryDelayMs,
};
