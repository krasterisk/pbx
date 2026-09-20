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
var SystemSettingsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingsController = void 0;
const common_1 = require("@nestjs/common");
const system_settings_service_1 = require("./system-settings.service");
const dialplan_subroutines_service_1 = require("./dialplan-subroutines.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const user_model_1 = require("../users/user.model");
const redis_module_1 = require("../redis/redis.module");
const webhook_queue_service_1 = require("../routes/webhook-queue.service");
let SystemSettingsController = SystemSettingsController_1 = class SystemSettingsController {
    systemSettingsService;
    subroutinesService;
    webhookQueueService;
    redis;
    logger = new common_1.Logger(SystemSettingsController_1.name);
    constructor(systemSettingsService, subroutinesService, webhookQueueService, redis) {
        this.systemSettingsService = systemSettingsService;
        this.subroutinesService = subroutinesService;
        this.webhookQueueService = webhookQueueService;
        this.redis = redis;
    }
    async findAll() {
        return this.systemSettingsService.findAll();
    }
    // ---------------------------------------------------------------------------
    // Redis / Queue status
    // ---------------------------------------------------------------------------
    /**
     * Returns Redis connection status and BullMQ webhook queue stats.
     * Useful for admin health dashboard.
     */
    async getRedisStatus() {
        const isConnected = this.redis.status === 'ready';
        if (!isConnected) {
            return { connected: false, message: 'Redis not connected — using in-memory fallback' };
        }
        const info = await this.redis.info('server').catch(() => '');
        const versionMatch = info.match(/redis_version:(\S+)/);
        return {
            connected: true,
            version: versionMatch?.[1] ?? 'unknown',
            host: this.redis.options?.host,
            port: this.redis.options?.port,
        };
    }
    // ---------------------------------------------------------------------------
    // Server Config — Records, Security, Integration
    // ---------------------------------------------------------------------------
    /**
     * Get server configuration values (from DB overrides or .env fallback).
     * Webhook secret is always masked in the response (••••••••).
     */
    async getServerConfig() {
        return this.systemSettingsService.getServerConfig();
    }
    /**
     * Update server configuration values.
     * Saves overrides to system_settings table — no SSH/restart required.
     * Empty string clears DB override and falls back to .env.
     */
    async updateServerConfig(body) {
        return this.systemSettingsService.updateServerConfig(body);
    }
    // ---------------------------------------------------------------------------
    // ffmpeg status check
    // ---------------------------------------------------------------------------
    /**
     * Check if ffmpeg is available on the backend server.
     * Returns { available: boolean, version?, error? }.
     * NOTE: This checks the BACKEND server PATH — which is the Asterisk server in production.
     */
    async getFfmpegStatus() {
        return this.systemSettingsService.checkFfmpeg();
    }
    // ---------------------------------------------------------------------------
    // Dialplan subroutines
    // ---------------------------------------------------------------------------
    /**
     * Regenerate and apply global Asterisk subroutines file.
     * Writes [krsk-on-answer], [krsk-hangup-handler] and [krsk-click-to-call] contexts
     * to krasterisk/subroutines/subroutines.conf via AMI and reloads dialplan.
     * Auto-picked up by: #include krasterisk/*\/*.conf (already in extensions.conf).
     *
     * Called automatically at backend startup (onModuleInit).
     * Can also be triggered manually from System Settings UI.
     */
    async applySubroutines() {
        try {
            return await this.subroutinesService.applySubroutines();
        }
        catch (err) {
            this.logger.error(`Failed to apply subroutines: ${err?.message}`);
            return { success: false, linesApplied: 0, error: err?.message || 'Unknown error' };
        }
    }
    // ---------------------------------------------------------------------------
    // Webhook Failures — Dead-letter management
    // ---------------------------------------------------------------------------
    /**
     * List failed webhook deliveries with pagination and optional filters.
     * Query params: page, limit, resolved (true/false), event
     */
    async getWebhookFailures(page, limit, resolved, event) {
        return this.webhookQueueService.getFailures({
            page: page ? Number(page) : 1,
            limit: limit ? Math.min(Number(limit), 200) : 50,
            resolved: resolved !== undefined ? resolved === 'true' : false, // default: unresolved only
            event: event || undefined,
        });
    }
    /**
     * Retry a specific failed webhook delivery.
     * Re-enqueues into BullMQ (or in-memory fallback) and sets retried_at.
     */
    async retryWebhookFailure(id) {
        return this.webhookQueueService.retryFailure(id);
    }
    /**
     * Mark a specific failure as resolved (dismiss without retry).
     */
    async resolveWebhookFailure(id) {
        await this.webhookQueueService.resolveFailure(id);
        return { resolved: true };
    }
    /**
     * Bulk-resolve all unresolved failures (optionally filter by route_uid).
     */
    async resolveAllWebhookFailures(routeUid) {
        const count = await this.webhookQueueService.resolveAll(routeUid);
        return { resolved: count };
    }
};
exports.SystemSettingsController = SystemSettingsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('redis-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "getRedisStatus", null);
__decorate([
    (0, common_1.Get)('server-config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "getServerConfig", null);
__decorate([
    (0, common_1.Put)('server-config'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "updateServerConfig", null);
__decorate([
    (0, common_1.Get)('ffmpeg-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "getFfmpegStatus", null);
__decorate([
    (0, common_1.Post)('apply-subroutines'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "applySubroutines", null);
__decorate([
    (0, common_1.Get)('webhook-failures'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('resolved')),
    __param(3, (0, common_1.Query)('event')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "getWebhookFailures", null);
__decorate([
    (0, common_1.Post)('webhook-failures/:id/retry'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "retryWebhookFailure", null);
__decorate([
    (0, common_1.Delete)('webhook-failures/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "resolveWebhookFailure", null);
__decorate([
    (0, common_1.Post)('webhook-failures/resolve-all'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)('route_uid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "resolveAllWebhookFailures", null);
exports.SystemSettingsController = SystemSettingsController = SystemSettingsController_1 = __decorate([
    (0, common_1.Controller)('system-settings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserLevel.ADMIN),
    __param(3, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [system_settings_service_1.SystemSettingsService,
        dialplan_subroutines_service_1.DialplanSubroutinesService,
        webhook_queue_service_1.WebhookQueueService, Object])
], SystemSettingsController);
//# sourceMappingURL=system-settings.controller.js.map