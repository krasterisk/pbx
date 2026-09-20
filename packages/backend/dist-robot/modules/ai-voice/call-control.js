"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeVoiceTool = executeVoiceTool;
exports.confirmVoiceTool = confirmVoiceTool;
const voice_engine_1 = require("./voice-engine");
const TOOLS = new Set(['end_call', 'transfer', 'get_session_context']);
function executeVoiceTool(input) {
    if (input.preview)
        throw new voice_engine_1.DomainError('preview_no_side_effect', 403);
    if (!TOOLS.has(input.action))
        throw new voice_engine_1.DomainError('tool_forbidden', 403);
    if (!input.operationKey)
        throw new voice_engine_1.DomainError('operation_key_required', 422);
    const prior = input.seen.get(input.operationKey);
    if (prior)
        return { state: prior.state, replay: true };
    if (input.action === 'transfer') {
        if (!input.targetId || !input.allowlist.includes(input.targetId)) {
            throw new voice_engine_1.DomainError('transfer_target_denied', 403);
        }
    }
    const row = { action: input.action, state: 'requested' };
    input.seen.set(input.operationKey, row);
    return { state: 'requested', replay: false };
}
function confirmVoiceTool(seen, operationKey, observed) {
    const row = seen.get(operationKey);
    if (!row)
        throw new voice_engine_1.DomainError('operation_not_found', 404);
    if (row.state !== 'requested')
        return;
    row.state = observed;
}
//# sourceMappingURL=call-control.js.map