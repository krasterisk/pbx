"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseStreamSession = exports.DEFAULT_SSE_HEARTBEAT_MS = void 0;
exports.formatSseEvent = formatSseEvent;
exports.formatSseHeartbeat = formatSseHeartbeat;
exports.DEFAULT_SSE_HEARTBEAT_MS = 15_000;
/** One named SSE event: header line plus a single JSON payload line. */
function formatSseEvent(name, payload) {
    return `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;
}
/** Comment-style ping so idle proxies do not close a long tool call. */
function formatSseHeartbeat() {
    return ': ping\n\n';
}
/**
 * Manual header-and-write session. The Nest @Sse decorator's Observable
 * shape cannot interleave named events with a heartbeat on one POST.
 */
class SseStreamSession {
    writeChunk;
    intervalMs;
    timer;
    lastWriteAt = 0;
    constructor(writeChunk, intervalMs = exports.DEFAULT_SSE_HEARTBEAT_MS) {
        this.writeChunk = writeChunk;
        this.intervalMs = intervalMs;
    }
    emit(name, payload) {
        this.writeChunk(formatSseEvent(name, payload));
        this.lastWriteAt = Date.now();
    }
    startHeartbeat() {
        this.lastWriteAt = Date.now();
        this.timer = setInterval(() => {
            if (Date.now() - this.lastWriteAt >= this.intervalMs) {
                this.writeChunk(formatSseHeartbeat());
                this.lastWriteAt = Date.now();
            }
        }, this.intervalMs);
    }
    stop() {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
}
exports.SseStreamSession = SseStreamSession;
//# sourceMappingURL=agent-sse.util.js.map