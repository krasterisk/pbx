import EventSource from 'eventsource';

export interface SseEventResult {
  event: string;
  data: string;
}

/**
 * Wait for one of the named SSE events on url, or fail on connection error / timeout.
 * Uses the eventsource package against HARNESS_API_URL (port 5010), not the Vite proxy.
 */
export function waitForSseEvent(
  url: string,
  eventNames: string[],
  timeoutMs: number,
): Promise<SseEventResult> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(url);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      es.close();
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        reject(new Error(`SSE timeout after ${timeoutMs}ms waiting for ${eventNames.join('|')}`));
      });
    }, timeoutMs);

    es.onerror = () => {
      finish(() => {
        reject(new Error('SSE connection error'));
      });
    };

    for (const name of eventNames) {
      es.addEventListener(name, (event: MessageEvent) => {
        finish(() => {
          resolve({ event: name, data: event.data ?? '' });
        });
      });
    }
  });
}
