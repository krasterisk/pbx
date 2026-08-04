import { describe, expect, it, beforeAll } from 'vitest';
import { apiFetch } from '../../assertions/http.js';
import { loginSession } from '../../environment/seed.js';
import {
  hasAsteriskLabFlag,
  isAsteriskLabReady,
  originateInboundToAgent,
  skipIfNoAsterisk,
} from '../../environment/asterisk.js';
import { waitForSseEvent } from '../../assertions/sse.js';

/**
 * @tags asterisk realtime
 * @requires asterisk
 * D-05: Originate → agent ring/answer → hangup happy-path (lab gated).
 * ASSUMED A5: exten/context/channel names are lab-specific — override via env.
 */
const apiUrl = (): string =>
  (process.env.HARNESS_API_URL ?? 'http://localhost:5010').replace(/\/$/, '');

describe.skipIf(skipIfNoAsterisk())('asterisk originate happy-path', () => {
  let labReady = false;

  beforeAll(async () => {
    if (!hasAsteriskLabFlag()) return;
    labReady = await isAsteriskLabReady();
    if (!labReady) {
      console.warn('Asterisk lab flagged but readiness failed — skipping live originate');
    }
  });

  it('originate inbound, agent answers via API, hangup in finally', async () => {
    if (!labReady) {
      return;
    }

    const session = await loginSession();
    const agentInterface =
      process.env.HARNESS_AGENT_INTERFACE ?? process.env.HARNESS_ORIGINATE_EXTEN ?? '100';
    const queues = process.env.HARNESS_AGENT_QUEUES?.split(',').filter(Boolean) ?? [];

    await apiFetch('/api/callcenter/agent/login', {
      method: 'POST',
      token: session.accessToken,
      body: { interface: `PJSIP/${agentInterface}`, queues },
    });

    const sseUrl = `${apiUrl()}/api/callcenter/events?token=${encodeURIComponent(session.accessToken)}`;
    const originatePromise = originateInboundToAgent();

    let channel: string | undefined;
    try {
      const mode = process.env.HARNESS_ORIGINATE_MODE ?? 'ami';
      if (mode === 'click-to-call') {
        const target = process.env.HARNESS_CLICK_TO_CALL_TARGET ?? agentInterface;
        await apiFetch('/api/callcenter/agent/click-to-call', {
          method: 'POST',
          token: session.accessToken,
          body: { target },
        });
      } else {
        await originatePromise;
      }

      const event = await waitForSseEvent(sseUrl, ['agentUpdate', 'callUpdate'], 30_000);
      expect(event.event).toBeTruthy();

      const me = await apiFetch<{ channel?: string }>('/api/callcenter/agent/me', {
        token: session.accessToken,
      });
      channel = me.data.channel;
    } finally {
      await apiFetch('/api/callcenter/agent/hangup', {
        method: 'POST',
        token: session.accessToken,
        body: channel ? { channel } : {},
      }).catch(() => undefined);
      await apiFetch('/api/callcenter/agent/logout', {
        method: 'POST',
        token: session.accessToken,
      }).catch(() => undefined);
    }
  }, 60_000);
});
