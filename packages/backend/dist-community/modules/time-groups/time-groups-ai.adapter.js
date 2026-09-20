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
var TimeGroupsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeGroupsAiAdapter = void 0;
exports.evaluateSchedule = evaluateSchedule;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const time_groups_service_1 = require("./time-groups.service");
const tenant_settings_service_1 = require("../tenant-settings/tenant-settings.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DEFAULT_TIMEZONE = 'Europe/Moscow';
const SCHEMA_VERSION = 'time-groups-1';
const TIME_HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const intervalInput = zod_1.z.strictObject({
    time_start: zod_1.z.string().regex(TIME_HM).describe('Начало, HH:MM'),
    time_end: zod_1.z.string().regex(TIME_HM).describe('Конец, HH:MM'),
    days_of_week: zod_1.z.string().min(1).optional().describe('mon-fri | mon,wed,fri | *'),
    days_of_month: zod_1.z.string().min(1).optional().describe('1-15 | 12 | *'),
    months: zod_1.z.string().min(1).optional().describe('jan-jun | jan | *'),
});
const intervalArgs = zod_1.z.strictObject({
    time_start: zod_1.z.string().regex(TIME_HM),
    time_end: zod_1.z.string().regex(TIME_HM),
    days_of_week: zod_1.z.string().min(1),
    days_of_month: zod_1.z.string().min(1),
    months: zod_1.z.string().min(1),
});
const createInput = zod_1.z.strictObject({
    name: zod_1.z.string().min(1).describe('Название календаря'),
    comment: zod_1.z.string().optional().describe('Комментарий'),
    intervals: zod_1.z.array(intervalInput).min(1).describe('Интервалы ExecIfTime'),
});
const createArgs = zod_1.z.strictObject({
    name: zod_1.z.string().min(1),
    comment: zod_1.z.string().optional(),
    intervals: zod_1.z.array(intervalArgs).min(1),
});
const updateInput = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive().describe('UID календаря из list_time_groups'),
    name: zod_1.z.string().min(1).optional(),
    comment: zod_1.z.string().optional(),
    intervals: zod_1.z.array(intervalInput).min(1).optional(),
});
const updateArgs = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
    comment: zod_1.z.string().optional(),
    intervals: zod_1.z.array(intervalArgs).min(1),
});
/**
 * TimeGroupsAiAdapter — schedule read tools plus proposal-gated create/update.
 * Intervals are the same ExecIfTime fields the routing path already emits.
 */
let TimeGroupsAiAdapter = TimeGroupsAiAdapter_1 = class TimeGroupsAiAdapter {
    timeGroupsService;
    registry;
    tenantSettings;
    logger = new common_1.Logger(TimeGroupsAiAdapter_1.name);
    domain = 'time-groups';
    constructor(timeGroupsService, registry, tenantSettings) {
        this.timeGroupsService = timeGroupsService;
        this.registry = registry;
        this.tenantSettings = tenantSettings;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('TimeGroupsAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListTimeGroups(),
            this.toolEvaluateTimeGroup(),
            this.toolCreateTimeGroup(),
            this.toolUpdateTimeGroup(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Расписания (time groups)
- Календарь — именованный набор интервалов. Создай его через create_time_group, если подходящего нет в list_time_groups.
- Интервал: time_start/time_end (HH:MM), days_of_week (mon-fri | mon,sat | *), days_of_month и months (* если не названы).
- На действии маршрута календарь вешается как condition.time_group_uid (число или steps.<id>.result.uid после create). Это не отдельный tool.
- schedule в actions[] — другой шаг: у него params.intervals[], он не создаёт календарь.
- Оценка «сейчас внутри» — evaluate_time_group в поясе тенанта, не в уме и не в поясе сервера.`;
    }
    async buildSummary(vpbxUserUid) {
        const rows = await this.timeGroupsService.findAll(vpbxUserUid);
        if (rows.length === 0)
            return '';
        const names = rows.map((row) => row.name).join(', ');
        return `Расписания: ${names}`;
    }
    toolListTimeGroups() {
        return {
            name: 'list_time_groups',
            description: 'Список расписаний тенанта с интервалами в читаемом виде. Без изменений. Оценка «сейчас внутри/снаружи» — evaluate_time_group.',
            inputSchema: {},
            entityType: 'time_group',
            handler: async (_args, uid) => {
                const rows = await this.timeGroupsService.findAll(uid);
                return {
                    schedules: rows.map((row) => ({
                        uid: row.uid,
                        name: row.name,
                        comment: row.comment ?? '',
                        intervals: (row.intervals ?? []).map((interval) => formatReadableInterval(interval)),
                    })),
                };
            },
        };
    }
    toolEvaluateTimeGroup() {
        return {
            name: 'evaluate_time_group',
            description: 'Отвечает, находится ли названное расписание внутри своих интервалов в поясе тенанта, и когда состояние следующее изменится.',
            inputSchema: {
                name: { type: 'string', description: 'Имя расписания из list_time_groups' },
                at: { type: 'string', description: 'ISO-момент для оценки; по умолчанию сейчас' },
            },
            entityType: 'time_group',
            handler: async (args, uid) => {
                const name = String(args.name ?? '').trim();
                const rows = await this.timeGroupsService.findAll(uid);
                const found = rows.find((row) => row.name === name || String(row.uid) === name);
                if (!found) {
                    return { error: 'Schedule not found', name };
                }
                const timeZone = await this.resolveTimezone(uid);
                const at = args.at ? new Date(String(args.at)) : new Date();
                return evaluateSchedule(found.intervals ?? [], at, timeZone);
            },
        };
    }
    toolCreateTimeGroup() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_time_group',
            description: 'Предлагает создать календарь (time group) с интервалами. На маршрут вешается через condition.time_group_uid.',
            entityType: 'time_group',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const intervals = this.normalizeIntervals(input.intervals);
                const refused = this.refuseBadIntervals(intervals) ?? (await this.refuseDuplicateName(input.name, ctx));
                if (refused)
                    return refused;
                const applyArgs = {
                    name: input.name.trim(),
                    intervals,
                };
                if (input.comment != null)
                    applyArgs.comment = input.comment;
                return this.proposal('create_time_group', applyArgs.name, applyArgs, null, applyArgs, this.createSummary(applyArgs));
            },
            revalidate: async (args, ctx) => {
                const refused = this.refuseBadIntervals(args.intervals) ?? (await this.refuseDuplicateName(args.name, ctx));
                if (refused)
                    return { ok: false, reason: String(refused.message) };
                return { ok: true, args };
            },
            apply: async (args, ctx) => {
                const created = await this.timeGroupsService.create({
                    name: args.name,
                    comment: args.comment ?? '',
                    intervals: args.intervals,
                }, ctx.vpbxUserUid);
                return { uid: created.uid, name: created.name };
            },
        });
    }
    toolUpdateTimeGroup() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'update_time_group',
            description: 'Предлагает изменить имя, комментарий или интервалы существующего календаря тенанта.',
            entityType: 'time_group',
            schemaVersion: SCHEMA_VERSION,
            input: updateInput,
            args: updateArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.timeGroupsService.findOne(input.uid, ctx.vpbxUserUid);
                if (input.name == null && input.comment == null && input.intervals == null) {
                    return { refused: true, message: 'Нужно хотя бы одно поле: name, comment или intervals' };
                }
                const intervals = input.intervals
                    ? this.normalizeIntervals(input.intervals)
                    : this.normalizeIntervals(current.intervals ?? []);
                const refused = this.refuseBadIntervals(intervals)
                    ?? (input.name ? await this.refuseDuplicateName(input.name, ctx, input.uid) : null);
                if (refused)
                    return refused;
                const applyArgs = {
                    uid: input.uid,
                    name: (input.name ?? current.name).trim(),
                    intervals,
                };
                const comment = input.comment ?? current.comment;
                if (comment != null)
                    applyArgs.comment = comment;
                return this.proposal('update_time_group', applyArgs.name, applyArgs, {
                    name: current.name,
                    comment: current.comment ?? '',
                    intervals: current.intervals ?? [],
                }, applyArgs, this.updateSummary(current.name, applyArgs));
            },
            revalidate: async (args, ctx) => {
                try {
                    await this.timeGroupsService.findOne(args.uid, ctx.vpbxUserUid);
                }
                catch {
                    return { ok: false, reason: `Календарь ${args.uid} не найден у тенанта` };
                }
                const refused = this.refuseBadIntervals(args.intervals)
                    ?? (await this.refuseDuplicateName(args.name, ctx, args.uid));
                if (refused)
                    return { ok: false, reason: String(refused.message) };
                return { ok: true, args };
            },
            apply: async (args, ctx) => {
                const updated = await this.timeGroupsService.update(args.uid, {
                    name: args.name,
                    comment: args.comment ?? '',
                    intervals: args.intervals,
                }, ctx.vpbxUserUid);
                return { uid: updated.uid, name: updated.name };
            },
        });
    }
    normalizeIntervals(rows) {
        return rows.map((row) => ({
            time_start: String(row.time_start ?? '').trim(),
            time_end: String(row.time_end ?? '').trim(),
            days_of_week: (row.days_of_week ?? '*').trim().toLowerCase() || '*',
            days_of_month: (row.days_of_month ?? '*').trim() || '*',
            months: (row.months ?? '*').trim().toLowerCase() || '*',
        }));
    }
    refuseBadIntervals(intervals) {
        if (!intervals.length) {
            return { refused: true, message: 'Нужен хотя бы один интервал календаря' };
        }
        for (const interval of intervals) {
            if (!TIME_HM.test(interval.time_start) || !TIME_HM.test(interval.time_end)) {
                return { refused: true, message: `Неверное время ${interval.time_start}–${interval.time_end}` };
            }
            if (!isTokenSpec(interval.days_of_week, WEEKDAYS)) {
                return { refused: true, message: `Неверные дни недели: ${interval.days_of_week}` };
            }
            if (!isDomSpec(interval.days_of_month)) {
                return { refused: true, message: `Неверные дни месяца: ${interval.days_of_month}` };
            }
            if (!isTokenSpec(interval.months, MONTHS)) {
                return { refused: true, message: `Неверные месяцы: ${interval.months}` };
            }
        }
        return null;
    }
    async refuseDuplicateName(name, ctx, exceptUid) {
        const wanted = name.trim().toLowerCase();
        const rows = await this.timeGroupsService.findAll(ctx.vpbxUserUid);
        const clash = rows.find((row) => row.name.trim().toLowerCase() === wanted && row.uid !== exceptUid);
        if (!clash)
            return null;
        return { refused: true, message: `Календарь «${clash.name}» уже есть у тенанта` };
    }
    createSummary(args) {
        return [`Создать календарь «${args.name}»`, ...args.intervals.map((interval) => formatReadableInterval(interval))];
    }
    updateSummary(previousName, args) {
        const title = args.name !== previousName
            ? `Изменить календарь «${previousName}» → «${args.name}»`
            : `Изменить календарь «${args.name}»`;
        return [title, ...args.intervals.map((interval) => formatReadableInterval(interval))];
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'time_group',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
    async resolveTimezone(vpbxUserUid) {
        if (!this.tenantSettings)
            return DEFAULT_TIMEZONE;
        const all = await this.tenantSettings.getAll(vpbxUserUid);
        const tz = all.timezone ?? all.time_zone;
        return typeof tz === 'string' && tz.trim() ? tz.trim() : DEFAULT_TIMEZONE;
    }
};
exports.TimeGroupsAiAdapter = TimeGroupsAiAdapter;
exports.TimeGroupsAiAdapter = TimeGroupsAiAdapter = TimeGroupsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [time_groups_service_1.TimeGroupsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        tenant_settings_service_1.TenantSettingsService])
], TimeGroupsAiAdapter);
function evaluateSchedule(intervals, at, timeZone) {
    const inside = isInside(intervals, at, timeZone);
    let nextBoundary = null;
    const limit = 8 * 24 * 60;
    for (let step = 1; step <= limit; step++) {
        const candidate = new Date(at.getTime() + step * 60_000);
        if (isInside(intervals, candidate, timeZone) !== inside) {
            nextBoundary = formatBoundary(candidate, timeZone);
            break;
        }
    }
    return { inside, next_boundary: nextBoundary, timezone: timeZone };
}
function isInside(intervals, at, timeZone) {
    const wall = zonedWall(at, timeZone);
    return intervals.some((interval) => intervalMatches(interval, wall));
}
function intervalMatches(interval, wall) {
    if (!expandTokens(interval.days_of_week, WEEKDAYS).has(wall.weekday))
        return false;
    if (!expandTokens(interval.months, MONTHS).has(wall.month))
        return false;
    const days = expandDom(interval.days_of_month);
    if (days && !days.has(wall.day))
        return false;
    const start = parseHm(interval.time_start);
    const end = parseHm(interval.time_end);
    if (start <= end) {
        return wall.minutes >= start && wall.minutes < end;
    }
    return wall.minutes >= start || wall.minutes < end;
}
function formatReadableInterval(interval) {
    const parts = [`${interval.time_start}–${interval.time_end}`];
    if (interval.days_of_week && interval.days_of_week !== '*')
        parts.push(interval.days_of_week);
    if (interval.days_of_month && interval.days_of_month !== '*')
        parts.push(`dom ${interval.days_of_month}`);
    if (interval.months && interval.months !== '*')
        parts.push(interval.months);
    return parts.join(', ');
}
function formatBoundary(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('weekday')} ${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} ${timeZone}`;
}
function zonedWall(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
    return {
        weekday: get('weekday').slice(0, 3).toLowerCase(),
        month: get('month').slice(0, 3).toLowerCase(),
        day: Number(get('day')),
        minutes: Number(get('hour')) * 60 + Number(get('minute')),
    };
}
function expandTokens(spec, universe) {
    if (!spec || spec === '*')
        return new Set(universe);
    const out = new Set();
    for (const part of spec.split(',')) {
        const trimmed = part.trim().toLowerCase();
        if (trimmed.includes('-')) {
            const [from, to] = trimmed.split('-');
            const start = universe.indexOf(from);
            const end = universe.indexOf(to);
            if (start >= 0 && end >= 0) {
                for (let i = start; i <= end; i++)
                    out.add(universe[i]);
            }
        }
        else if (trimmed) {
            out.add(trimmed);
        }
    }
    return out;
}
function expandDom(spec) {
    if (!spec || spec === '*')
        return null;
    const out = new Set();
    for (const part of spec.split(',')) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const [from, to] = trimmed.split('-').map(Number);
            for (let i = from; i <= to; i++)
                out.add(i);
        }
        else if (trimmed) {
            out.add(Number(trimmed));
        }
    }
    return out;
}
function parseHm(hhmm) {
    if (!hhmm)
        return 0;
    const [hours, minutes] = hhmm.split(':').map(Number);
    return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
function isTokenSpec(spec, universe) {
    if (!spec || spec === '*')
        return true;
    return spec.split(',').every((part) => {
        const trimmed = part.trim().toLowerCase();
        if (!trimmed)
            return false;
        if (trimmed.includes('-')) {
            const [from, to] = trimmed.split('-');
            return universe.includes(from) && universe.includes(to);
        }
        return universe.includes(trimmed);
    });
}
function isDomSpec(spec) {
    if (!spec || spec === '*')
        return true;
    return spec.split(',').every((part) => {
        const trimmed = part.trim();
        if (!trimmed)
            return false;
        if (trimmed.includes('-')) {
            const [from, to] = trimmed.split('-').map(Number);
            return Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to <= 31 && from <= to;
        }
        const day = Number(trimmed);
        return Number.isInteger(day) && day >= 1 && day <= 31;
    });
}
//# sourceMappingURL=time-groups-ai.adapter.js.map