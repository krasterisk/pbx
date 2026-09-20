"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewLegacyBackfill = previewLegacyBackfill;
const project_engine_1 = require("../project-engine");
function previewLegacyBackfill(input) {
    if (input.requestedPath)
        throw new project_engine_1.DomainError('arbitrary_path_denied', 400);
    if (!input.enabled)
        throw new project_engine_1.DomainError('backfill_disabled', 403);
    if (!input.tenantInstalled) {
        return { skipped: true, count: 0, bytes: 0, missing: 0, sourceQuality: 'legacy_lossy' };
    }
    const owned = input.files.filter(file => file.owned && file.format === 'mp3');
    const missing = input.files.filter(file => !file.owned).length;
    return {
        skipped: false,
        count: owned.length,
        bytes: owned.reduce((sum, file) => sum + file.bytes, 0),
        missing,
        sourceQuality: 'legacy_lossy',
    };
}
//# sourceMappingURL=backfill-preview.js.map