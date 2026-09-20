"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STREAM_KBPS = void 0;
exports.maxParticipantsForBudget = maxParticipantsForBudget;
exports.streamsForParticipants = streamsForParticipants;
exports.effectiveMax = effectiveMax;
/**
 * Bandwidth budget for conference admission. No I/O, no exceptions, no dialplan.
 * Formula locked by 16.1-RESEARCH Pattern 3 (D-18 / D-19). Do not recalculate.
 */
exports.STREAM_KBPS = 800;
function maxParticipantsForBudget(budgetStreams) {
    if (budgetStreams <= 0)
        return 0;
    return Math.floor((1 + Math.sqrt(1 + 4 * budgetStreams)) / 2);
}
function streamsForParticipants(n) {
    return n <= 1 ? 0 : n * (n - 1);
}
function effectiveMax(tariffMax, budgetMax) {
    return Math.min(tariffMax ?? budgetMax, budgetMax);
}
//# sourceMappingURL=conference-capacity.util.js.map