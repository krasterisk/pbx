"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReportXlsx = buildReportXlsx;
const exceljs_1 = __importDefault(require("exceljs"));
/**
 * XLSX export via exceljs writeBuffer (D-34).
 * Operates only on already tenant-scoped rows — no DB access.
 */
async function buildReportXlsx(sheetName, columns, rows) {
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Report');
    sheet.columns = columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: Math.max(12, c.header.length + 2),
    }));
    for (const row of rows) {
        const flat = {};
        for (const c of columns) {
            const val = row[c.key];
            flat[c.key] =
                val != null && typeof val === 'object' ? JSON.stringify(val) : val;
        }
        sheet.addRow(flat);
    }
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
}
//# sourceMappingURL=xlsx-exporter.js.map