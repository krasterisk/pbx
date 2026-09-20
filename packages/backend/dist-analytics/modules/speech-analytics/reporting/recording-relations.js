"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readInternalRelation = readInternalRelation;
function readInternalRelation(input) {
    const allowed = input.callPermission && input.analyticsPermission;
    if (!allowed) {
        return { visible: false, statusLink: false, snippet: null, audio: false };
    }
    return {
        visible: true,
        statusLink: true,
        snippet: input.transcriptPermission ? (input.snippet ?? null) : null,
        audio: input.audioPermission === true,
    };
}
//# sourceMappingURL=recording-relations.js.map