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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WebhookQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookQueueService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const axios_1 = __importDefault(require("axios"));
const webhook_failure_model_1 = require("./webhook-failure.model");
/**
 * Webhook delivery queue with in-memory retry + DB dead-letter persistence.
 *
 * NOTE: BullMQ/ioredis were removed — importing BullMQ caused Node.js-level
 * hooks to fire at module load time, blocking NestJS initialization even when
 * Redis was not configured. This implementation uses setTimeout-based retry
 * with exponential backoff. BullMQ can be re-added as a separate opt-in module
 * when running on Linux with Redis available.
 *
 * Retry schedule:
 *   Attempt 1 → immediate
 *   Attempt 2 → 2s  after failure
 *   Attempt 3 → 4s  after failure
 */
let WebhookQueueService = WebhookQueueService_1 = class WebhookQueueService {
    failureModel;
    logger = new common_1.Logger(WebhookQueueService_1.name);
    timers = new Set();
    constructor(failureModel) {
        this.failureModel = failureModel;
    }
    /**
     * Enqueue a webhook for delivery with exponential retry.
     * Fire-and-forget: returns immediately, delivery is async.
     */
    async enqueue(data) {
        this.deliverWithRetry(data, 1);
    }
    /**
     * List webhook failures from DB with pagination and optional filters.
     */
    async getFailures(opts = {}) {
        const { page = 1, limit = 50, resolved, event } = opts;
        const where = {};
        if (resolved !== undefined)
            where['resolved'] = resolved;
        if (event)
            where['event'] = event;
        const { count, rows } = await this.failureModel.findAndCountAll({
            where,
            order: [['failed_at', 'DESC']],
            limit,
            offset: (page - 1) * limit,
        });
        return { total: count, page, limit, items: rows };
    }
    /**
     * Retry a specific webhook failure by ID.
     */
    async retryFailure(id) {
        const failure = await this.failureModel.findByPk(id);
        if (!failure)
            return { queued: false, reason: 'Not found' };
        const data = {
            url: failure.url,
            payload: failure.payload,
            headers: failure.headers,
            tag: `${failure.event}:${failure.route_uid}:retry`,
        };
        this.deliverWithRetry(data, 1);
        await failure.update({ retried_at: new Date() });
        return { queued: true };
    }
    /** Mark a failure as resolved (dismissed without retry). */
    async resolveFailure(id) {
        await this.failureModel.update({ resolved: true }, { where: { id } });
    }
    /** Bulk resolve all unresolved failures (optionally filtered by route). */
    async resolveAll(routeUid) {
        const where = { resolved: false };
        if (routeUid)
            where['route_uid'] = routeUid;
        const [count] = await this.failureModel.update({ resolved: true }, { where });
        return count;
    }
    /** Queue stats stub — returns null (no persistent queue). */
    async getStats() {
        return null;
    }
    onModuleDestroy() {
        // Cancel pending retry timers on graceful shutdown
        for (const timer of this.timers) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    deliverWithRetry(data, attempt) {
        const maxAttempts = 3;
        axios_1.default
            .post(data.url, data.payload, { timeout: 10_000, headers: data.headers })
            .then(() => {
            this.logger.log(`[${data.tag}] delivered (attempt ${attempt}): ${data.url}`);
        })
            .catch((err) => {
            if (attempt < maxAttempts) {
                const delay = Math.pow(2, attempt) * 1000; // 2s → 4s
                this.logger.warn(`[${data.tag}] attempt ${attempt} failed, retry in ${delay}ms: ${err?.message}`);
                const timer = setTimeout(() => {
                    this.timers.delete(timer);
                    this.deliverWithRetry(data, attempt + 1);
                }, delay);
                this.timers.add(timer);
            }
            else {
                this.logger.error(`[${data.tag}] DEAD after ${maxAttempts} attempts: ${data.url} — ${err?.message}`);
                this.persistFailure(data, err?.message ?? 'Unknown error', attempt).catch(() => null);
            }
        });
    }
    async persistFailure(data, error, attempts) {
        try {
            const [event, ...rest] = data.tag.split(':');
            const routeUid = rest.find(p => !['retry'].includes(p)) || data.payload?.route_uid || '';
            await this.failureModel.create({
                route_uid: routeUid,
                event: event || data.tag,
                url: data.url,
                payload: data.payload,
                headers: data.headers,
                error: error.slice(0, 2000),
                attempts,
                failed_at: new Date(),
                retried_at: null,
                resolved: false,
            });
        }
        catch (dbErr) {
            this.logger.error(`Failed to save webhook failure to DB: ${dbErr?.message}`);
        }
    }
};
exports.WebhookQueueService = WebhookQueueService;
exports.WebhookQueueService = WebhookQueueService = WebhookQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(webhook_failure_model_1.WebhookFailure)),
    __metadata("design:paramtypes", [Object])
], WebhookQueueService);
//# sourceMappingURL=webhook-queue.service.js.map