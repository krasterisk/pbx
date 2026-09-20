"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.admittedJobPayload = admittedJobPayload;
const shared_1 = require("@krasterisk/shared");
function admittedJobPayload(tenantUid, jobId) {
    return (0, shared_1.createAiOutboxPayloadV1)({
        tenantUid,
        aggregateKind: 'job',
        aggregateId: jobId,
        eventType: 'job.admitted',
    });
}
//# sourceMappingURL=outbox-payload.js.map