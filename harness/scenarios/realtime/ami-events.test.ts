import { describe, expect, it, beforeAll } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  hasAsteriskLabFlag,
  isAsteriskLabReady,
  originateInboundToAgent,
  skipIfNoAsterisk,
} from '../../environment/asterisk.js';

/**
 * @tags asterisk ami-events realtime
 * @requires asterisk
 * D-05/D-07: Socket.IO /ami-events receives newChannel or hangup during telephony.
 * Namespace verified against ami.gateway.ts.
 */
const socketBaseUrl = (): string =>
  (process.env.HARNESS_API_URL ?? 'http://localhost:5010').replace(/\/$/, '');

function waitForAmiEvent(
  socket: Socket,
  eventNames: string[],
  timeoutMs: number,
): Promise<{ event: string; payload: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`ami-events timeout after ${timeoutMs}ms waiting for ${eventNames.join('|')}`));
    }, timeoutMs);

    const handlers: Array<{ name: string; fn: (payload: unknown) => void }> = [];
    for (const name of eventNames) {
      const fn = (payload: unknown) => {
        clearTimeout(timer);
        for (const h of handlers) socket.off(h.name, h.fn);
        resolve({ event: name, payload });
      };
      handlers.push({ name, fn });
      socket.on(name, fn);
    }

    socket.once('connect_error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe.skipIf(skipIfNoAsterisk())('Socket.IO /ami-events', () => {
  let labReady = false;

  beforeAll(async () => {
    if (!hasAsteriskLabFlag()) return;
    labReady = await isAsteriskLabReady();
    if (!labReady) {
      console.warn('Asterisk lab flagged but readiness failed — skipping ami-events live test');
    }
  });

  it('receives newChannel or hangup within timeout when lab active', async () => {
    if (!labReady) {
      return;
    }

    const socket: Socket = io(`${socketBaseUrl()}/ami-events`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });

      const eventPromise = waitForAmiEvent(socket, ['newChannel', 'hangup'], 25_000);

      // Minimal originate stub to generate AMI traffic, or rely on existing lab traffic
      if (process.env.HARNESS_AMI_EVENTS_ORIGINATE !== '0') {
        await originateInboundToAgent().catch((err: unknown) => {
          console.warn('originate stub failed (lab may still have traffic):', err);
        });
      }

      const received = await eventPromise;
      expect(['newChannel', 'hangup']).toContain(received.event);
    } finally {
      socket.disconnect();
    }
  }, 45_000);
});
