"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_OUTBOX_QUEUE = void 0;
exports.bindAiQueueJob = bindAiQueueJob;
exports.assertQueueTenant = assertQueueTenant;
exports.AI_OUTBOX_QUEUE = 'ai-outbox';
function bindAiQueueJob(input) {
    if (!Number.isInteger(input.tenantUid) || input.tenantUid < 0) {
        throw new Error('queue payload tenantUid must be a trusted non-negative integer');
    }
    if (!input.eventId || !input.aggregateId) {
        throw new Error('queue payload requires event and aggregate ids');
    }
    return {
        eventId: input.eventId,
        tenantUid: input.tenantUid,
        aggregateKind: input.aggregateKind,
        aggregateId: input.aggregateId,
    };
}
function assertQueueTenant(payload, expectedTenant) {
    if (payload.tenantUid !== expectedTenant) {
        throw Object.assign(new Error('forged queue payload'), {
            code: 'forged_queue_payload',
            status: 403,
        });
    }
}
//# sourceMappingURL=queue-payload.js.map