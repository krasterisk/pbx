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
var CallCenterAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterAlertService = exports.ALERT_EVAL_INTERVAL_MS = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const alert_config_model_1 = require("./models/alert-config.model");
const callcenter_metrics_service_1 = require("./callcenter-metrics.service");
const callcenter_settings_service_1 = require("./callcenter-settings.service");
const callcenter_state_service_1 = require("./callcenter-state.service");
const notification_dispatcher_service_1 = require("../notifications/notification-dispatcher.service");
/**
 * How often the threshold evaluator runs (ms).
 * Not AMI hot path — 30s is enough for supervisor alerts.
 */
exports.ALERT_EVAL_INTERVAL_MS = 30_000;
/**
 * Periodical evaluator: compare live metrics + state snapshot against
 * cc_settings.alert_thresholds (WHEN — D-27 from 07-05) and route via
 * cc_alert_config + notification_integration (WHERE — D-28).
 * Credential store is NOT duplicated — reuse Phase 6 notification_integration.
 */
let CallCenterAlertService = CallCenterAlertService_1 = class CallCenterAlertService {
    alertConfigModel;
    metricsService;
    settingsService;
    stateService;
    dispatcherService;
    logger = new common_1.Logger(CallCenterAlertService_1.name);
    /** Cooldown state: `${userUid}:${thresholdKey}` → last fire timestamp */
    lastFired = new Map();
    constructor(alertConfigModel, metricsService, settingsService, stateService, dispatcherService) {
        this.alertConfigModel = alertConfigModel;
        this.metricsService = metricsService;
        this.settingsService = settingsService;
        this.stateService = stateService;
        this.dispatcherService = dispatcherService;
    }
    async evaluate() {
        try {
            const configs = await this.alertConfigModel.findAll({
                where: { enabled: true },
            });
            for (const row of configs) {
                await this.evaluateTenant(row);
            }
        }
        catch (e) {
            this.logger.error(`Alert evaluate failed: ${e?.message ?? e}`);
        }
    }
    async evaluateTenant(row) {
        const userUid = row.user_uid;
        if (row.integration_uid == null || !row.target) {
            return; // nowhere / nothing to send with
        }
        const settings = await this.settingsService.getTenantSettings(userUid);
        const thresholds = settings.alert_thresholds;
        if (!thresholds) {
            return;
        }
        const metrics = this.metricsService.getTenantQueueMetrics(userUid);
        const snapshot = this.stateService.getSnapshot(userUid);
        const breaches = this.detectBreaches(thresholds, metrics, snapshot);
        const now = Date.now();
        const cooldownMs = (row.cooldown_sec ?? 300) * 1000;
        for (const breach of breaches) {
            const mapKey = `${userUid}:${breach.key}`;
            const last = this.lastFired.get(mapKey) ?? 0;
            if (now - last < cooldownMs) {
                continue; // anti-flood (T-07-10-05)
            }
            this.lastFired.set(mapKey, now);
            await this.dispatcherService.dispatch({
                integration_uid: row.integration_uid,
                target: row.target,
                message: breach.message,
            });
        }
    }
    detectBreaches(thresholds, metrics, snapshot) {
        const breaches = [];
        if (thresholds.sla_critical_pct != null) {
            for (const m of metrics) {
                if (m.sla < thresholds.sla_critical_pct) {
                    breaches.push({
                        key: 'sla',
                        message: `КЦ: SLA очереди ${m.queueName} упал до ${Math.round(m.sla)}% (порог ${thresholds.sla_critical_pct}%)`,
                    });
                    break;
                }
            }
        }
        if (thresholds.abandon_rate_pct != null) {
            for (const m of metrics) {
                if (m.abandonRate > thresholds.abandon_rate_pct) {
                    breaches.push({
                        key: 'abandon',
                        message: `КЦ: abandon rate очереди ${m.queueName} ${Math.round(m.abandonRate)}% (порог ${thresholds.abandon_rate_pct}%)`,
                    });
                    break;
                }
            }
        }
        if (thresholds.agents_available_min != null) {
            const available = snapshot.queues.reduce((sum, q) => sum + (q.agents?.available ?? 0), 0);
            if (available < thresholds.agents_available_min) {
                breaches.push({
                    key: 'agents',
                    message: `КЦ: доступно агентов ${available} (порог min ${thresholds.agents_available_min})`,
                });
            }
        }
        if (thresholds.max_wait_sec != null) {
            const now = Date.now();
            let maxWaitSec = 0;
            for (const call of snapshot.calls) {
                if (call.status !== 'WAITING')
                    continue;
                const enterMs = call.enterTime instanceof Date
                    ? call.enterTime.getTime()
                    : new Date(call.enterTime).getTime();
                const waitSec = Math.floor((now - enterMs) / 1000);
                if (waitSec > maxWaitSec)
                    maxWaitSec = waitSec;
            }
            if (maxWaitSec > thresholds.max_wait_sec) {
                breaches.push({
                    key: 'wait',
                    message: `КЦ: макс. ожидание ${maxWaitSec}с (порог ${thresholds.max_wait_sec}с)`,
                });
            }
        }
        return breaches;
    }
    /** Test helper — clear cooldown state between specs. */
    clearCooldown() {
        this.lastFired.clear();
    }
};
exports.CallCenterAlertService = CallCenterAlertService;
__decorate([
    (0, schedule_1.Interval)('cc-alert-eval', exports.ALERT_EVAL_INTERVAL_MS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CallCenterAlertService.prototype, "evaluate", null);
exports.CallCenterAlertService = CallCenterAlertService = CallCenterAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(alert_config_model_1.CcAlertConfig)),
    __metadata("design:paramtypes", [Object, callcenter_metrics_service_1.CallCenterMetricsService,
        callcenter_settings_service_1.CallCenterSettingsService,
        callcenter_state_service_1.CallCenterStateService,
        notification_dispatcher_service_1.NotificationDispatcherService])
], CallCenterAlertService);
//# sourceMappingURL=callcenter-alert.service.js.map