import { emptyMediaStores, allocateUpload, appendChunk, finalizeUpload } from '../modules/media-assets/upload-pipeline';
import { ObjectMediaStorage } from '../modules/media-assets/object-media.storage';
import { MemoryObjectStore } from '../modules/media-assets/memory-object.store';
import { pcmWav } from '../modules/media-assets/wav-fixture';
import { AI_MEDIA_MAX_BYTES } from '@krasterisk/shared';
import {
  emptyUsageStores, insertPrice, seedQuota, utcMonthStart, reserveJobBudget, settleReservation,
  usageDigest,
} from '../modules/ai-usage/usage-engine';
import { disabledWallet, settleShadow } from '../modules/ai-usage/shadow-settlement';
import { evaluateAiReadiness } from './ai-readiness';

describe('D6 foundation path', () => {
  it('uploads, admits a fake job, shadows usage, and replays the receipt digest', async () => {
    const wav = pcmWav({ channels: 1, sampleRate: 8000, samples: 40, amplitude: 1 });
    const media = emptyMediaStores();
    const allocated = allocateUpload({ tenantUid: 8, principalId: 'prin-1', expectedBytes: wav.length, now: new Date() });
    media.uploads.set(allocated.upload.id, allocated.upload);
    media.assets.set(allocated.asset.id, allocated.asset);
    const uploading = appendChunk(allocated.upload, wav, AI_MEDIA_MAX_BYTES);
    const ready = await finalizeUpload({
      upload: uploading, asset: allocated.asset, storage: new ObjectMediaStorage(new MemoryObjectStore()),
    });
    expect(ready.asset.state).toBe('ready');
    const now = new Date('2026-09-19T12:00:00.000Z');
    const usage = emptyUsageStores();
    seedQuota(usage, {
      tenantUid: 8, product: 'speech_analytics', metric: 'audio_ms',
      periodStart: utcMonthStart(now), limitUnits: 100,
    });
    const price = insertPrice(usage, {
      id: 'p1', providerUid: 'test', product: 'speech_analytics', unit: 'audio_ms',
      currency: 'RUB', rate: '0.5', scale: 2, roundingMode: 'half_up', moneyPolicy: 'shadow',
      configDigest: 'dd'.repeat(32),
    });
    const reservation = reserveJobBudget(usage, {
      tenantUid: 8, jobId: ready.asset.id, product: 'speech_analytics', metric: 'audio_ms',
      units: 10, now, expiresAt: new Date('2026-09-19T13:00:00.000Z'),
    });
    const wallet = disabledWallet();
    expect(settleShadow({
      stores: usage, reservationId: reservation.id, tenantUid: 8, actualUnits: 10, price, wallet,
    }).charged).toBe(false);
    const replay = emptyUsageStores();
    seedQuota(replay, {
      tenantUid: 8, product: 'speech_analytics', metric: 'audio_ms',
      periodStart: utcMonthStart(now), limitUnits: 100,
    });
    insertPrice(replay, price);
    const again = reserveJobBudget(replay, {
      tenantUid: 8, jobId: ready.asset.id, product: 'speech_analytics', metric: 'audio_ms',
      units: 10, now, expiresAt: new Date('2026-09-19T13:00:00.000Z'),
    });
    settleReservation(replay, { id: again.id, tenantUid: 8, actualUnits: 10, priceRevisionId: price.id });
    expect(usageDigest(usage)).toBe(usageDigest(replay));
    expect(evaluateAiReadiness({
      role: 'ai-api', schemaReady: true, redisReady: true, storageReady: true,
      encryptionReady: true, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
    }).ready).toBe(true);
    expect(wallet.chargeCalls).toBe(0);
  });
});
