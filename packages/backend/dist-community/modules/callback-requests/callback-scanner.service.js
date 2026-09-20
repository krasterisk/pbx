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
var CallbackScannerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackScannerService = void 0;
exports.isWithinCallbackWindow = isWithinCallbackWindow;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const shared_1 = require("@krasterisk/shared");
const ami_service_1 = require("../ami/ami.service");
const callcenter_settings_service_1 = require("../callcenter/callcenter-settings.service");
const callback_request_model_1 = require("./callback-request.model");
const SCAN_INTERVAL_MS = 30_000;
const SCAN_BATCH = 20;
const BACKOFF_MINUTES = [1, 5, 15];
function isWithinCallbackWindow(now, windowStart, windowEnd) {
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const start = windowStart || '00:00';
    const end = windowEnd || '23:59';
    if (start <= end)
        return hhmm >= start && hhmm <= end;
    return hhmm >= start || hhmm <= end;
}
let CallbackScannerService = CallbackScannerService_1 = class CallbackScannerService {
    requests;
    settings;
    ami;
    logger = new common_1.Logger(CallbackScannerService_1.name);
    running = false;
    constructor(requests, settings, ami) {
        this.requests = requests;
        this.settings = settings;
        this.ami = ami;
    }
    async tick() {
        if (this.running)
            return;
        this.running = true;
        try {
            await this.scanOnce();
        }
        catch (e) {
            this.logger.warn(`cc callback scan: ${e.message}`);
        }
        finally {
            this.running = false;
        }
    }
    async scanOnce(now = new Date()) {
        const due = await this.requests.findAll({
            where: {
                status: 'pending',
                next_attempt_at: { [sequelize_2.Op.lte]: now },
            },
            limit: SCAN_BATCH,
        });
        for (const row of due) {
            if (Number(row.attempt_count) >= Number(row.max_attempts)) {
                await row.update({ status: 'failed', updated_at: now });
                continue;
            }
            if (!isWithinCallbackWindow(now, row.window_start, row.window_end)) {
                continue;
            }
            await this.attempt(row, now);
        }
    }
    async attempt(row, now) {
        const policy = await this.loadPolicy(row.user_uid);
        await row.update({ status: 'dialing', updated_at: now });
        try {
            await this.originate(row, policy.dial_order ?? 'agent_first');
            const attempts = Number(row.attempt_count ?? 0) + 1;
            await row.update({
                status: attempts >= row.max_attempts ? 'failed' : 'pending',
                attempt_count: attempts,
                next_attempt_at: new Date(now.getTime() + row.pause_minutes * 60_000),
                updated_at: now,
            });
        }
        catch (e) {
            const attempts = Number(row.attempt_count ?? 0) + 1;
            if (attempts >= row.max_attempts) {
                await row.update({
                    status: 'failed',
                    attempt_count: attempts,
                    updated_at: now,
                });
                return;
            }
            const backoffMin = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
            await row.update({
                status: 'pending',
                attempt_count: attempts,
                next_attempt_at: new Date(now.getTime() + backoffMin * 60_000),
                updated_at: now,
            });
            this.logger.warn(`callback originate uid=${row.uid}: ${e.message}`);
        }
    }
    async loadPolicy(userUid) {
        if (!this.settings)
            return { ...shared_1.DEFAULT_CALLBACK_POLICY };
        const tenant = await this.settings.getTenantSettings(userUid);
        return (0, callcenter_settings_service_1.sanitizeCallbackPolicy)(tenant?.callback_policy ?? null, shared_1.DEFAULT_CALLBACK_POLICY);
    }
    async originate(row, dialOrder) {
        if (!this.ami)
            return;
        await this.ami.action({
            action: 'Originate',
            channel: `Local/${row.caller}@krsk-click-to-call`,
            context: 'krsk-click-to-call',
            exten: row.caller,
            priority: '1',
            async: 'true',
            variable: `KRSK_CB_DIAL_ORDER=${dialOrder}`,
        });
    }
};
exports.CallbackScannerService = CallbackScannerService;
__decorate([
    (0, schedule_1.Interval)('cc-callback-scan', SCAN_INTERVAL_MS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CallbackScannerService.prototype, "tick", null);
exports.CallbackScannerService = CallbackScannerService = CallbackScannerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(callback_request_model_1.CallbackRequest)),
    __param(1, (0, common_1.Optional)()),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, callcenter_settings_service_1.CallCenterSettingsService,
        ami_service_1.AmiService])
], CallbackScannerService);
//# sourceMappingURL=callback-scanner.service.js.map