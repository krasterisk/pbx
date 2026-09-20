"use strict";
/**
 * Abstraction over Asterisk queue_log backends (file-tail vs realtime table).
 * Both branches select at runtime via CC_QUEUE_LOG_BACKEND (D-05).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_LOG_READER = void 0;
/** DI token for the active QueueLogReader implementation. */
exports.QUEUE_LOG_READER = 'QUEUE_LOG_READER';
//# sourceMappingURL=queue-log-reader.interface.js.map