"use strict";
/**
 * Call Center reports types (D-33 / D-34 backend).
 * reportId is a closed whitelist — never accept arbitrary strings into SQL.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CC_REPORT_IDS = void 0;
exports.isCcReportId = isCcReportId;
exports.CC_REPORT_IDS = [
    'queue-summary',
    'call-detail',
    'operator-stats',
    'pause-report',
    'hourly-heatmap',
    'agent-timeline',
    'missed-callback',
];
function isCcReportId(value) {
    return exports.CC_REPORT_IDS.includes(value);
}
//# sourceMappingURL=callcenter-reports.types.js.map