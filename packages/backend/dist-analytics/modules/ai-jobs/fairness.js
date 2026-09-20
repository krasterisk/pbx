"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVE_JOB_STATES = exports.DEFAULT_QUEUE_CAP = exports.DEFAULT_RUNNING_CAP = void 0;
exports.assertFairness = assertFairness;
exports.DEFAULT_RUNNING_CAP = 8;
exports.DEFAULT_QUEUE_CAP = 32;
exports.ACTIVE_JOB_STATES = [
    'queued', 'running', 'retry_wait', 'awaiting_reconciliation', 'blocked',
];
function assertFairness(counts, caps = { runningCap: exports.DEFAULT_RUNNING_CAP, queueCap: exports.DEFAULT_QUEUE_CAP }) {
    if (counts.running >= caps.runningCap || counts.queued >= caps.queueCap) {
        throw Object.assign(new Error('tenant fairness cap exceeded'), {
            code: 'fairness_exhausted',
            status: 503,
        });
    }
}
//# sourceMappingURL=fairness.js.map