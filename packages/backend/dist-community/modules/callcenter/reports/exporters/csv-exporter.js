"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReportCsv = buildReportCsv;
/**
 * Hand-rolled CSV builder (same convention as cdr.controller export):
 * delimiter `;`, double-quote escape, UTF-8 BOM.
 */
function buildReportCsv(columns, rows) {
    const delimiter = ';';
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = columns.map((c) => esc(c.header)).join(delimiter);
    const lines = rows.map((row) => columns.map((c) => {
        const val = row[c.key];
        if (val != null && typeof val === 'object') {
            return esc(JSON.stringify(val));
        }
        return esc(val);
    }).join(delimiter));
    return '\uFEFF' + [header, ...lines].join('\n');
}
//# sourceMappingURL=csv-exporter.js.map