"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceTelemetryService = void 0;
const common_1 = require("@nestjs/common");
const conference_telemetry_dto_1 = require("./dto/conference-telemetry.dto");
const TELEMETRY_TTL_MS = 60_000;
const QUALITY_REASONS = new Set(conference_telemetry_dto_1.QUALITY_LIMITATION_REASONS);
function isNonNegativeFinite(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
let ConferenceTelemetryService = class ConferenceTelemetryService {
    store = new Map();
    ingest(roomUid, ref, raw) {
        const fields = {};
        const reason = raw?.qualityLimitationReason;
        if (typeof reason === 'string' && QUALITY_REASONS.has(reason)) {
            fields.qualityLimitationReason = reason;
        }
        if (isNonNegativeFinite(raw?.packetsLost)) {
            fields.packetsLost = raw.packetsLost;
        }
        if (isNonNegativeFinite(raw?.totalFreezesDuration)) {
            fields.totalFreezesDuration = raw.totalFreezesDuration;
        }
        this.store.set(this.key(roomUid, ref), { fields, seenAt: Date.now() });
        return fields;
    }
    get(roomUid, ref) {
        const key = this.key(roomUid, ref);
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() - entry.seenAt > TELEMETRY_TTL_MS) {
            this.store.delete(key);
            return null;
        }
        return entry.fields;
    }
    key(roomUid, ref) {
        return `${roomUid}:${ref}`;
    }
};
exports.ConferenceTelemetryService = ConferenceTelemetryService;
exports.ConferenceTelemetryService = ConferenceTelemetryService = __decorate([
    (0, common_1.Injectable)()
], ConferenceTelemetryService);
//# sourceMappingURL=conference-telemetry.service.js.map