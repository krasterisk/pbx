import { describe, expect, it } from 'vitest';
import { loginSession } from '../../environment/seed.js';
import { waitForSseEvent } from '../../assertions/sse.js';

/**
 * @tags sse realtime
 * D-04: SSE connects with JWT ?token= against backend port 5010.
 * Does NOT require HAS_ASTERISK=1 — heartbeat works without live AMI.
 */
const apiUrl = (): string =>
  (process.env.HARNESS_API_URL ?? 'http://localhost:5010').replace(/\/$/, '');

describe('GET /api/callcenter/events SSE', () => {
  it('receives fullSnapshot or heartbeat within 25s', async () => {
    const session = await loginSession();
    const url = `${apiUrl()}/api/callcenter/events?token=${encodeURIComponent(session.accessToken)}`;

    const result = await waitForSseEvent(url, ['fullSnapshot', 'heartbeat'], 25_000);

    expect(['fullSnapshot', 'heartbeat']).toContain(result.event);
  }, 30_000);
});
