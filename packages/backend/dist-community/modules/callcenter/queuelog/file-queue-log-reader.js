"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FileQueueLogReader_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileQueueLogReader = void 0;
exports.parseQueueLogTimestamp = parseQueueLogTimestamp;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * File-tail reader for `/var/log/asterisk/queue_log` (pipe-separated lines).
 *
 * Path is taken ONLY from env CC_QUEUE_LOG_PATH (threat T-07-04-01) —
 * never from request input. Missing/unreadable file is an error when selected.
 */
let FileQueueLogReader = FileQueueLogReader_1 = class FileQueueLogReader {
    source = 'file';
    logger = new common_1.Logger(FileQueueLogReader_1.name);
    filePath;
    constructor() {
        const configured = process.env.CC_QUEUE_LOG_PATH || '/var/log/asterisk/queue_log';
        const resolved = path.resolve(configured);
        if (!path.isAbsolute(resolved)) {
            throw new Error(`CC_QUEUE_LOG_PATH must resolve to an absolute path, got: ${resolved}`);
        }
        // Ensure no accidental join with untrusted segments — path is env-only.
        this.filePath = resolved;
    }
    async isAvailable() {
        try {
            await fs.promises.access(this.filePath, fs.constants.R_OK);
            return true;
        }
        catch (err) {
            if (err.code === 'ENOENT')
                return false;
            throw err;
        }
    }
    async readEntries(since, until) {
        try {
            const fh = await fs.promises.open(this.filePath, 'r');
            try {
                const content = await fh.readFile({ encoding: 'utf8' });
                const entries = [];
                for (const line of content.split(/\r?\n/)) {
                    const parsed = FileQueueLogReader_1.parseLine(line);
                    if (!parsed)
                        continue;
                    if (parsed.timestamp < since || parsed.timestamp > until)
                        continue;
                    entries.push(parsed);
                }
                return entries;
            }
            finally {
                await fh.close();
            }
        }
        catch (err) {
            this.logger.warn(`queue_log file unavailable (${this.filePath}): ${err.message}`);
            throw err;
        }
    }
    /** Exported for unit tests — pipe format: ts|callid|queue|agent|event|data... */
    static parseLine(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            return null;
        const parts = trimmed.split('|');
        if (parts.length < 5)
            return null;
        const [tsRaw, callId, queueName, agent, event, ...params] = parts;
        const timestamp = parseQueueLogTimestamp(tsRaw);
        if (!timestamp || !callId)
            return null;
        return {
            timestamp,
            callId,
            queueName: queueName || '',
            agent: agent || '',
            event: (event || '').toUpperCase(),
            params,
        };
    }
};
exports.FileQueueLogReader = FileQueueLogReader;
exports.FileQueueLogReader = FileQueueLogReader = FileQueueLogReader_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], FileQueueLogReader);
function parseQueueLogTimestamp(raw) {
    if (!raw)
        return null;
    // Classic file format: unix epoch seconds
    if (/^\d+(\.\d+)?$/.test(raw)) {
        const sec = Number(raw);
        if (!Number.isFinite(sec))
            return null;
        return new Date(sec * 1000);
    }
    const d = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
}
//# sourceMappingURL=file-queue-log-reader.js.map