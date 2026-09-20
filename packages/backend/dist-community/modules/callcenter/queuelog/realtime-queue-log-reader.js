"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeQueueLogReader = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const file_queue_log_reader_1 = require("./file-queue-log-reader");
/**
 * Realtime-table reader for Asterisk `queue_log` in the selected application DB.
 *
 * Confirmed schema (07-04 Task 1 on target DB):
 *   time, callid, queuename, agent, event, data, data1..data5, userfield
 *
 * SQL uses Sequelize replacements (T-07-04-05) — never string-concatenated bounds.
 */
let RealtimeQueueLogReader = class RealtimeQueueLogReader {
    sequelize;
    source = 'realtime';
    constructor(sequelize) {
        this.sequelize = sequelize;
    }
    async isAvailable() {
        // Sequelize's dialect-aware catalog query checks the current schema. A DB
        // outage or privilege error must propagate, not trigger an auto file fallback.
        return this.sequelize.getQueryInterface().tableExists('queue_log');
    }
    async readEntries(since, until) {
        const rows = await this.sequelize.query(`SELECT time, callid, queuename, agent, event, data, data1, data2, data3, data4, data5
         FROM queue_log
         WHERE time BETWEEN :since AND :until
         ORDER BY time ASC, callid ASC, event ASC, agent ASC`, {
            type: sequelize_2.QueryTypes.SELECT,
            replacements: {
                since: formatSqlDateTime(since),
                until: formatSqlDateTime(until),
            },
        });
        const entries = [];
        for (const row of rows) {
            const timestamp = (0, file_queue_log_reader_1.parseQueueLogTimestamp)(String(row.time ?? ''));
            if (!timestamp || !row.callid)
                continue;
            const params = [row.data1, row.data2, row.data3, row.data4, row.data5]
                .map((p) => (p == null ? '' : String(p)));
            // Some installs put first param in `data` when data1 is empty
            if (!params[0] && row.data)
                params[0] = String(row.data);
            entries.push({
                timestamp,
                callId: String(row.callid),
                queueName: String(row.queuename || ''),
                agent: String(row.agent || ''),
                event: String(row.event || '').toUpperCase(),
                params,
            });
        }
        return entries;
    }
};
exports.RealtimeQueueLogReader = RealtimeQueueLogReader;
exports.RealtimeQueueLogReader = RealtimeQueueLogReader = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectConnection)()),
    __metadata("design:paramtypes", [sequelize_2.Sequelize])
], RealtimeQueueLogReader);
function formatSqlDateTime(d) {
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return (`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
}
//# sourceMappingURL=realtime-queue-log-reader.js.map