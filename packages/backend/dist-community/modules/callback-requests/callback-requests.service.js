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
var CallbackRequestsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackRequestsService = void 0;
exports.parseTenantUid = parseTenantUid;
exports.sanitizeCaller = sanitizeCaller;
exports.sanitizeQueueName = sanitizeQueueName;
exports.sanitizeWindow = sanitizeWindow;
exports.parsePositiveInt = parsePositiveInt;
exports.parseCallbackSource = parseCallbackSource;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const shared_1 = require("@krasterisk/shared");
const sequelize_2 = require("sequelize");
const agent_queue_model_1 = require("../callcenter/models/agent-queue.model");
const route_model_1 = require("../routes/route.model");
const user_model_1 = require("../users/user.model");
const callback_request_model_1 = require("./callback-request.model");
const WINDOW_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CALLER_SAFE = /[^0-9+*#]/g;
const QUEUE_NAME_SAFE = /[^\w.\-]/g;
const DEDUPE_WINDOW_MS = 60_000;
const ACTIVE_STATUSES = ['pending', 'dialing'];
const COMPLETED_STATUSES = ['completed', 'failed', 'cancelled', 'expired'];
function parseTenantUid(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0)
        return null;
    return n;
}
function sanitizeCaller(value) {
    return String(value ?? '').replace(CALLER_SAFE, '').slice(0, 64);
}
function sanitizeQueueName(value) {
    const raw = String(value ?? '').replace(QUEUE_NAME_SAFE, '').slice(0, 64);
    return raw || null;
}
function sanitizeWindow(value, fallback) {
    const raw = String(value ?? '').trim();
    return WINDOW_HH_MM.test(raw) ? raw : fallback;
}
function parsePositiveInt(value, fallback, max) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1)
        return fallback;
    return Math.min(Math.trunc(n), max);
}
function parseCallbackSource(value) {
    const raw = String(value ?? '');
    return shared_1.CALLBACK_SOURCES.includes(raw)
        ? raw
        : 'route_step';
}
function statusesFor(listStatus) {
    return listStatus === 'completed' ? COMPLETED_STATUSES : ACTIVE_STATUSES;
}
let CallbackRequestsService = CallbackRequestsService_1 = class CallbackRequestsService {
    requests;
    agentQueues;
    users;
    routes;
    logger = new common_1.Logger(CallbackRequestsService_1.name);
    constructor(requests, agentQueues, users, routes) {
        this.requests = requests;
        this.agentQueues = agentQueues;
        this.users = users;
        this.routes = routes;
    }
    /**
     * Persist a pending callback request from dialplan CURL or queue hooks.
     * Dedupes rapid double-fire (same tenant + caller + uniqueid within 60s).
     */
    async enqueue(body) {
        const userUid = parseTenantUid(body.vpbx_user_uid ?? body.user_uid);
        if (userUid == null) {
            this.logger.warn('callback enqueue rejected: invalid tenant uid');
            return null;
        }
        const caller = sanitizeCaller(body.caller ?? body.clid);
        if (!caller) {
            this.logger.warn('callback enqueue rejected: empty caller');
            return null;
        }
        const uniqueid = String(body.uniqueid ?? '').replace(/[^\w.\-]/g, '').slice(0, 128) || null;
        const source = parseCallbackSource(body.source);
        const existing = await this.findRecentDuplicate(userUid, caller, uniqueid, source);
        if (existing)
            return existing;
        const now = new Date();
        return this.requests.create({
            user_uid: userUid,
            caller,
            route_uid: parseTenantUid(body.route_uid),
            queue_uid: parseTenantUid(body.queue_uid),
            queue_name: sanitizeQueueName(body.queue_name),
            step_id: String(body.step_id ?? '').slice(0, 64) || null,
            uniqueid,
            status: 'pending',
            attempt_count: 0,
            max_attempts: parsePositiveInt(body.max_attempts, 3, 20),
            pause_minutes: parsePositiveInt(body.pause_minutes, 30, 1440),
            next_attempt_at: now,
            window_start: sanitizeWindow(body.window_start, '09:00'),
            window_end: sanitizeWindow(body.window_end, '21:00'),
            claimed_agent_uid: null,
            source,
            created_at: now,
            updated_at: now,
        });
    }
    async listForAgent(tenantUid, agentUid, listStatus) {
        const queueNames = await this.agentQueueNames(tenantUid, agentUid);
        const rows = await this.requests.findAll({
            where: {
                user_uid: tenantUid,
                status: { [sequelize_2.Op.in]: statusesFor(listStatus) },
                queue_name: { [sequelize_2.Op.in]: queueNames.length ? queueNames : [''] },
            },
            order: [['created_at', 'DESC']],
        });
        return this.toListItems(tenantUid, rows);
    }
    async listForSupervisor(tenantUid, listStatus) {
        const rows = await this.requests.findAll({
            where: {
                user_uid: tenantUid,
                status: { [sequelize_2.Op.in]: statusesFor(listStatus) },
            },
            order: [['created_at', 'DESC']],
        });
        return this.toListItems(tenantUid, rows);
    }
    async claim(tenantUid, agentUid, id) {
        const [updated] = await this.requests.update({ claimed_agent_uid: agentUid, updated_at: new Date() }, {
            where: {
                uid: id,
                user_uid: tenantUid,
                claimed_agent_uid: null,
            },
        });
        if (updated === 0) {
            const existing = await this.requests.findOne({
                where: { uid: id, user_uid: tenantUid },
            });
            if (!existing)
                throw new common_1.NotFoundException('Callback request not found');
            throw new common_1.ConflictException({ message: 'Callback request already claimed' });
        }
        return { id, claimed_agent_uid: agentUid };
    }
    async cancel(tenantUid, agentUid, id, isSupervisor) {
        const existing = await this.requests.findOne({
            where: { uid: id, user_uid: tenantUid },
        });
        if (!existing)
            throw new common_1.NotFoundException('Callback request not found');
        if (!isSupervisor) {
            if (existing.status !== 'pending') {
                throw new common_1.ForbiddenException('Not allowed to cancel this request');
            }
            const names = await this.agentQueueNames(tenantUid, agentUid);
            if (!existing.queue_name || !names.includes(existing.queue_name)) {
                throw new common_1.ForbiddenException('Not allowed to cancel this request');
            }
        }
        await this.requests.update({ status: 'cancelled', updated_at: new Date() }, { where: { uid: id, user_uid: tenantUid } });
        return { id, status: 'cancelled' };
    }
    async agentQueueNames(tenantUid, agentUid) {
        const rows = await this.agentQueues.findAll({
            where: { user_uid: tenantUid, user_id: agentUid },
            attributes: ['queue_name'],
        });
        return [...new Set(rows.map((r) => r.queue_name).filter(Boolean))];
    }
    async toListItems(tenantUid, rows) {
        const claimedIds = [...new Set(rows.map((r) => r.claimed_agent_uid).filter((id) => id != null && id > 0))];
        const routeIds = [...new Set(rows.map((r) => r.route_uid).filter((id) => id != null && id > 0))];
        const [userRows, routeRows] = await Promise.all([
            claimedIds.length
                ? this.users.findAll({
                    where: { uniqueid: { [sequelize_2.Op.in]: claimedIds }, vpbx_user_uid: tenantUid },
                    attributes: ['uniqueid', 'name'],
                })
                : Promise.resolve([]),
            routeIds.length
                ? this.routes.findAll({
                    where: { uid: { [sequelize_2.Op.in]: routeIds }, user_uid: tenantUid },
                    attributes: ['uid', 'name'],
                })
                : Promise.resolve([]),
        ]);
        const namesById = new Map(userRows.map((u) => [u.uniqueid, u.name || null]));
        const routesById = new Map(routeRows.map((r) => [r.uid, r.name || null]));
        return rows.map((r) => ({
            id: r.uid,
            caller: r.caller,
            queue_label: r.queue_name || null,
            route_label: r.route_uid != null ? (routesById.get(r.route_uid) ?? null) : null,
            status: r.status,
            attempt_count: r.attempt_count,
            max_attempts: r.max_attempts,
            next_attempt_at: r.next_attempt_at,
            window_start: r.window_start,
            window_end: r.window_end,
            claimed_agent: r.claimed_agent_uid != null
                ? (namesById.get(r.claimed_agent_uid) ?? null)
                : null,
            claimed_agent_uid: r.claimed_agent_uid,
            source: r.source,
            created_at: r.created_at,
        }));
    }
    async findRecentDuplicate(userUid, caller, uniqueid, source) {
        const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
        const where = {
            user_uid: userUid,
            caller,
            source,
            status: 'pending',
            created_at: { [sequelize_2.Op.gte]: since },
        };
        if (uniqueid)
            where.uniqueid = uniqueid;
        return this.requests.findOne({ where, order: [['uid', 'DESC']] });
    }
};
exports.CallbackRequestsService = CallbackRequestsService;
exports.CallbackRequestsService = CallbackRequestsService = CallbackRequestsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(callback_request_model_1.CallbackRequest)),
    __param(1, (0, sequelize_1.InjectModel)(agent_queue_model_1.CcAgentQueue)),
    __param(2, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(3, (0, sequelize_1.InjectModel)(route_model_1.Route)),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], CallbackRequestsService);
//# sourceMappingURL=callback-requests.service.js.map