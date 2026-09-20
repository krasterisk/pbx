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
var NotificationsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsAiAdapter = exports.OPERATIONS_PREVIEW_LENGTH = exports.OPERATIONS_RESULT_CEILING = void 0;
exports.clampOperationsCount = clampOperationsCount;
exports.toNotificationViews = toNotificationViews;
exports.truncatePreview = truncatePreview;
const common_1 = require("@nestjs/common");
const notifications_service_1 = require("./notifications.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
/** Shared result ceiling for the four operational read adapters (T-15-90, T-15-94). */
exports.OPERATIONS_RESULT_CEILING = 20;
/** Shared free-text preview length for the four operational read adapters (T-15-90). */
exports.OPERATIONS_PREVIEW_LENGTH = 120;
/**
 * NotificationsAiAdapter — read-only recent notifications (D-12, D-15).
 * Sending is an outward action with no undo and is not declared.
 */
let NotificationsAiAdapter = NotificationsAiAdapter_1 = class NotificationsAiAdapter {
    notifications;
    registry;
    logger = new common_1.Logger(NotificationsAiAdapter_1.name);
    domain = 'notifications';
    constructor(notifications, registry) {
        this.notifications = notifications;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('NotificationsAiAdapter registered');
    }
    getTools() {
        return [this.toolListNotifications()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Уведомления
- Список недавних исходящих уведомлений: канал, статус, время и превью текста.
- Отправить уведомление агент не может.`;
    }
    async buildSummary(vpbxUserUid) {
        const rows = toNotificationViews(await this.notifications.findAll(vpbxUserUid), {
            limit: 5,
        });
        if (rows.length === 0)
            return '';
        return `Уведомления: ${rows.map((row) => `${row.kind} (${row.status})`).join(', ')}`;
    }
    toolListNotifications() {
        return {
            name: 'list_notifications',
            description: 'Недавние уведомления тенанта: канал, статус, время и усечённое превью. Отправка недоступна.',
            inputSchema: {
                date_from: { type: 'string', description: 'Начало диапазона (ISO или YYYY-MM-DD)' },
                date_to: { type: 'string', description: 'Конец диапазона (ISO или YYYY-MM-DD)' },
                limit: {
                    type: 'number',
                    description: `Число строк, не больше ${exports.OPERATIONS_RESULT_CEILING}`,
                },
            },
            entityType: 'notification',
            handler: async (args, uid) => ({
                notifications: toNotificationViews(await this.notifications.findAll(uid), args),
            }),
        };
    }
};
exports.NotificationsAiAdapter = NotificationsAiAdapter;
exports.NotificationsAiAdapter = NotificationsAiAdapter = NotificationsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], NotificationsAiAdapter);
function clampOperationsCount(limit) {
    if (limit == null || limit === '')
        return exports.OPERATIONS_RESULT_CEILING;
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0)
        return exports.OPERATIONS_RESULT_CEILING;
    return Math.min(Math.floor(n), exports.OPERATIONS_RESULT_CEILING);
}
function toNotificationViews(rows, args = {}) {
    const limit = clampOperationsCount(args.limit);
    const dateFrom = optionalString(args.date_from);
    const dateTo = optionalString(args.date_to);
    return (rows ?? [])
        .map((row) => toNotificationView(row))
        .filter((row) => inDateRange(row.timestamp, dateFrom, dateTo))
        .slice(0, limit);
}
function toNotificationView(row) {
    return {
        id: String(row.uid ?? row.id ?? ''),
        kind: String(row.kind ?? row.channel ?? ''),
        status: String(row.status ?? 'configured'),
        timestamp: toIso(row.timestamp ?? row.created_at ?? row.updated_at),
        preview: truncatePreview(row.body ?? row.message ?? ''),
    };
}
function truncatePreview(value) {
    return value.slice(0, exports.OPERATIONS_PREVIEW_LENGTH);
}
function toIso(value) {
    if (value instanceof Date)
        return value.toISOString();
    return value ? String(value) : '';
}
function optionalString(value) {
    if (value == null)
        return undefined;
    const text = String(value).trim();
    return text || undefined;
}
function inDateRange(timestamp, dateFrom, dateTo) {
    if (!dateFrom && !dateTo)
        return true;
    if (!timestamp)
        return false;
    const t = Date.parse(timestamp);
    if (Number.isNaN(t))
        return false;
    if (dateFrom) {
        const from = Date.parse(dateFrom);
        if (!Number.isNaN(from) && t < from)
            return false;
    }
    if (dateTo) {
        const to = Date.parse(expandDateToEnd(dateTo));
        if (!Number.isNaN(to) && t > to)
            return false;
    }
    return true;
}
function expandDateToEnd(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}
//# sourceMappingURL=notifications-ai.adapter.js.map