"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchOutbox = dispatchOutbox;
exports.dedupeDelivery = dedupeDelivery;
exports.handleQueueEvent = handleQueueEvent;
async function dispatchOutbox(record, queue, now, crash) {
    if (record.deliveredAt) {
        return record;
    }
    await queue.enqueue(record.id);
    if (crash === 'after-enqueue') {
        throw Object.assign(new Error('crash after enqueue'), { code: 'crash_after_enqueue' });
    }
    return { ...record, deliveredAt: now, attempts: record.attempts + 1, leaseOwner: null };
}
function dedupeDelivery(record) {
    return record.deliveredAt ? 'skip' : 'apply';
}
function handleQueueEvent(processed, eventId) {
    if (processed.has(eventId))
        return 'skip';
    processed.add(eventId);
    return 'apply';
}
//# sourceMappingURL=outbox-dispatcher.js.map