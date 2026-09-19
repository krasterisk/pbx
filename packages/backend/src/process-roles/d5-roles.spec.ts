import * as fs from 'fs';
import * as path from 'path';
import { evaluateAiReadiness, assertNoCloudEgress } from './ai-readiness';
import { aiLogFields, emptyAiMetrics } from './ai-metrics';
import { beginGracefulShutdown, completeInflight, mayForceReleaseUnknown } from './ai-shutdown';
import { AiApiModule } from './ai-api.module';
import { AiWorkerModule } from './ai-worker.module';
import { MediaWorkerModule } from './media-worker.module';
import {
  emptyUsageStores, reserveJobBudget, seedQuota, settleReservation, utcMonthStart,
} from '../modules/ai-usage/usage-engine';

const src = (...parts: string[]) => fs.readFileSync(path.join(__dirname, ...parts), 'utf8');

describe('D5 process roles', () => {
  it('keeps API/worker/media graphs free of ARI/AMI/billing cron and Asterisk', () => {
    const api = src('ai-api.module.ts') + src('..', 'ai-api.main.ts');
    const worker = src('ai-worker.module.ts') + src('..', 'ai-worker.main.ts');
    const media = src('media-worker.module.ts') + src('..', 'media-worker.main.ts');
    expect(AiApiModule).toBeDefined();
    expect(AiWorkerModule).toBeDefined();
    expect(MediaWorkerModule).toBeDefined();
    expect(api).not.toMatch(/ari\.module|ami\.module|BillingScheduler|autodial/i);
    expect(worker).not.toMatch(/Controller|ari\.module|ami\.module|NestFactory.create\(/);
    expect(media).not.toMatch(/ai-jobs|ari\.module|ami\.module|cloud-admin/);
    expect(media).toMatch(/MediaAssetsModule/);
    expect(worker).toMatch(/createApplicationContext/);
  });

  it('splits liveness from readiness and delays API when Redis is down under the backlog cap', () => {
    expect(evaluateAiReadiness({
      role: 'ai-worker', schemaReady: true, redisReady: false, storageReady: true,
      encryptionReady: true, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
    })).toMatchObject({ live: true, status: 503, reason: 'redis' });
    expect(evaluateAiReadiness({
      role: 'ai-api', schemaReady: true, redisReady: false, storageReady: true,
      encryptionReady: true, providerReady: true, inflight: 0, backlog: 1, backlogCap: 8,
    })).toMatchObject({ status: 200, delayed: true, ready: false });
    expect(evaluateAiReadiness({
      role: 'media-worker', schemaReady: true, redisReady: true, storageReady: false,
      encryptionReady: true, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
    }).reason).toBe('storage');
    expect(evaluateAiReadiness({
      role: 'ai-api', schemaReady: false, redisReady: true, storageReady: true,
      encryptionReady: true, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
    }).reason).toBe('schema');
    expect(evaluateAiReadiness({
      role: 'ai-api', schemaReady: true, redisReady: true, storageReady: false,
      encryptionReady: true, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
    }).reason).toBe('storage');
    expect(evaluateAiReadiness({
      role: 'ai-worker', schemaReady: true, redisReady: true, storageReady: true,
      encryptionReady: false, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
    }).reason).toBe('config');
    expect(evaluateAiReadiness({
      role: 'ai-api', schemaReady: true, redisReady: false, storageReady: true,
      encryptionReady: true, providerReady: true, inflight: 0, backlog: 8, backlogCap: 8,
    })).toMatchObject({ status: 503, delayed: true, reason: 'backlog' });
    expect(() => assertNoCloudEgress({ AI_CLOUD_EGRESS: '1' })).toThrow(/egress/);
    assertNoCloudEgress({ AI_CLOUD_EGRESS: '0' });
  });

  it('lets only one of two scheduler settles consume quota', () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const stores = emptyUsageStores();
    seedQuota(stores, {
      tenantUid: 8, product: 'speech_analytics', metric: 'audio_ms',
      periodStart: utcMonthStart(now), limitUnits: 10,
    });
    const held = reserveJobBudget(stores, {
      tenantUid: 8, jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      product: 'speech_analytics', metric: 'audio_ms', units: 4, now,
      expiresAt: new Date('2026-09-19T13:00:00.000Z'),
    });
    settleReservation(stores, { id: held.id, tenantUid: 8, actualUnits: 4 });
    settleReservation(stores, { id: held.id, tenantUid: 8, actualUnits: 4 });
    expect([...stores.quotas.values()][0].usedUnits).toBe(4);
    expect(stores.ledger.filter(row => row.entryKind === 'settle').length).toBe(1);
  });

  it('stops claims on SIGTERM, waits inflight, and never force-releases unknown usage', () => {
    const draining = beginGracefulShutdown({ claiming: true, inflight: 2, draining: false });
    expect(draining).toEqual({ claiming: false, inflight: 2, draining: true });
    expect(completeInflight(draining).inflight).toBe(1);
    expect(mayForceReleaseUnknown()).toBe(false);
    expect(() => aiLogFields({
      requestId: 'r1', jobId: 'j1', tenantUid: 8, errorCode: 'quota_exhausted',
    })).not.toThrow();
    expect(emptyAiMetrics().quotaRejects).toBe(0);
  });
});
