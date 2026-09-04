export const DEFAULT_SSE_HEARTBEAT_MS = 15_000;

/** One named SSE event: header line plus a single JSON payload line. */
export function formatSseEvent(name: string, payload: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;
}

/** Comment-style ping so idle proxies do not close a long tool call. */
export function formatSseHeartbeat(): string {
  return ': ping\n\n';
}

/**
 * Manual header-and-write session. The Nest @Sse decorator's Observable
 * shape cannot interleave named events with a heartbeat on one POST.
 */
export class SseStreamSession {
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastWriteAt = 0;

  constructor(
    private readonly writeChunk: (chunk: string) => void,
    private readonly intervalMs = DEFAULT_SSE_HEARTBEAT_MS,
  ) {}

  emit(name: string, payload: unknown): void {
    this.writeChunk(formatSseEvent(name, payload));
    this.lastWriteAt = Date.now();
  }

  startHeartbeat(): void {
    this.lastWriteAt = Date.now();
    this.timer = setInterval(() => {
      if (Date.now() - this.lastWriteAt >= this.intervalMs) {
        this.writeChunk(formatSseHeartbeat());
        this.lastWriteAt = Date.now();
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
