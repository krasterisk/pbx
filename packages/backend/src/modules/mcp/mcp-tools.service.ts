import { Injectable, Logger } from '@nestjs/common';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService } from '../trunks/trunks.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { QueuesService } from '../queues/queues.service';
import { RoutesService } from '../routes/routes.service';
import { ContextIncludesService } from '../routes/context-includes.service';
import { ContextsService } from '../contexts/contexts.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { PbxContextBuilderService } from '../ai-chat/pbx-context-builder.service';
import { InjectModel } from '@nestjs/sequelize';
import { Context } from '../contexts/context.model';
import { CdrService } from '../reports/cdr/cdr.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AiChatSettingsService } from '../ai-chat/ai-chat-settings.service';
import { LoggerService } from '../logger/logger.service';

interface McpToolEntry {
    description: string;
    inputSchema: Record<string, any>;
    entityType: string;
    /** Subject to the per-tenant confirmation gate (D-20, D-25) */
    destructive: boolean;
    /** vpbxUserUid is ALWAYS a call parameter — never captured via closure (D-23) */
    handler: (args: any, vpbxUserUid: number) => Promise<Array<{ type: string; text: string }>>;
}

const CONFIRM_SCHEMA_PROP = {
    type: 'boolean',
    description: 'Подтверждение деструктивной операции — передай confirm=true только после явного согласия пользователя',
};

/**
 * McpToolsService — регистрирует все инструменты KrAsterisk в локальном реестре.
 *
 * ПРАВИЛО (ARCHITECTURE): При создании любой новой сущности АТС — добавить
 * инструмент здесь, чтобы AI-агент мог с ней работать. Domain AI Adapter tools
 * (D-14/D-15) регистрируются автоматически из AiAdapterRegistryService — их
 * добавлять сюда не нужно.
 *
 * Все инструменты используют this.reg() который хранит handler в toolRegistry Map.
 * McpSessionService вызывает callTool() и getToolsList() напрямую — без MCP SDK session.
 *
 * Handler-сигнатура — (args, vpbxUserUid): uid ВСЕГДА передаётся параметром вызова,
 * а не замыканием на момент регистрации (D-23 — исправленный cross-tenant баг: до
 * фикса toolRegistry был общим Map, а uid замыкался в handlers первого тенанта,
 * обратившегося к пустому реестру — все последующие тенанты исполняли чужой uid).
 */
@Injectable()
export class McpToolsService {
    private readonly logger = new Logger(McpToolsService.name);

    /** Tool registry для прямого JSON-RPC dispatch (без MCP SDK session). uid-независим. */
    private readonly toolRegistry = new Map<string, McpToolEntry>();

    constructor(
        private readonly endpointsService: EndpointsService,
        private readonly trunksService: TrunksService,
        private readonly ivrsService: IvrsService,
        private readonly queuesService: QueuesService,
        private readonly routesService: RoutesService,
        private readonly contextIncludesService: ContextIncludesService,
        private readonly contextsService: ContextsService,
        private readonly dialplanApplyService: DialplanApplyService,
        private readonly contextBuilder: PbxContextBuilderService,
        @InjectModel(Context) private readonly contextModel: typeof Context,
        private readonly cdrService: CdrService,
        private readonly aiAdapterRegistry: AiAdapterRegistryService,
        private readonly aiChatSettingsService: AiChatSettingsService,
        private readonly loggerService: LoggerService,
    ) {}

    /** Builds/rebuilds the uid-independent tool registry. Safe to call once, lazily or eagerly. */
    registerAll(): void {
        this.toolRegistry.clear();
        this.regGetPbxState();
        this.regCreateEndpointsBulk();
        this.regCreateEndpoint();
        this.regDeleteEndpoint();
        this.regCreateTrunk();
        this.regDeleteTrunk();
        this.regCreateIvr();
        this.regUpdateIvr();
        this.regDeleteIvr();
        this.regCreateQueue();
        this.regUpdateQueue();
        this.regDeleteQueue();
        this.regCreateRoute();
        this.regDeleteRoute();
        this.regApplyDialplan();
        this.regListContexts();
        this.regGetCdrSummary();
        this.regFindCdrCalls();

        // Domain AI Adapter tools (D-14/D-15) — dispatched through the same registry,
        // same audit/confirmation pipeline as legacy tools.
        for (const t of this.aiAdapterRegistry.getAllTools()) {
            this.reg(t.name, t.description, t.inputSchema, async (args, uid) => {
                const result = await t.handler(args, uid);
                const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                return [{ type: 'text', text }];
            }, t.entityType, !!t.destructive);
        }

        this.logger.log(`Registered ${this.toolRegistry.size} MCP tools`);
    }

    getToolsList(vpbxUserUid: number): Array<{ name: string; description: string; inputSchema: any }> {
        if (this.toolRegistry.size === 0) this.registerAll();
        return Array.from(this.toolRegistry.entries()).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: { type: 'object', properties: def.inputSchema },
        }));
    }

    async callTool(name: string, args: Record<string, any>, vpbxUserUid: number): Promise<Array<{ type: string; text: string }>> {
        if (this.toolRegistry.size === 0) this.registerAll();
        const tool = this.toolRegistry.get(name);
        if (!tool) {
            const available = Array.from(this.toolRegistry.keys()).join(', ');
            throw new Error(`Tool not found: "${name}". Available: ${available}`);
        }

        // Per-tenant confirmation gate for destructive tools (D-20, D-25) — default OFF.
        if (tool.destructive && args?.confirm !== true) {
            const settings = await this.aiChatSettingsService.getSettings(vpbxUserUid);
            if (settings.confirmDestructive) {
                return [{ type: 'text', text:
                    `⚠️ Требуется подтверждение: операция "${name}" деструктивна. ` +
                    `Повтори вызов с confirm=true после явного согласия пользователя.`,
                }];
            }
        }

        try {
            const result = await tool.handler(args, vpbxUserUid);
            this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, args), 'success').catch(() => {});
            return result;
        } catch (err: any) {
            this.logger.error(`Tool "${name}" failed for tenant ${vpbxUserUid}: ${err.message}`);
            this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, args), 'error').catch(() => {});
            return [{ type: 'text', text: `❌ Ошибка: ${err.message}` }];
        }
    }

    /** Compact, truncated audit message — avoids writing huge entry payloads into action_logs (D-19). */
    private buildLogDetails(name: string, args: Record<string, any>): string {
        let argsStr: string;
        try {
            argsStr = JSON.stringify(args ?? {});
        } catch {
            argsStr = String(args);
        }
        const truncated = argsStr.length > 200 ? `${argsStr.slice(0, 200)}...` : argsStr;
        return `mcp:${name}: ${truncated}`;
    }

    private reg(
        name: string,
        description: string,
        inputSchema: Record<string, any>,
        handler: (args: any, vpbxUserUid: number) => Promise<Array<{ type: string; text: string }>>,
        entityType: string = 'pbx',
        destructive: boolean = false,
    ): void {
        const schema = destructive ? { ...inputSchema, confirm: CONFIRM_SCHEMA_PROP } : inputSchema;
        this.toolRegistry.set(name, { description, inputSchema: schema, entityType, destructive, handler });
    }

    /** Генерирует криптостойкий SIP-пароль */
    private generateSipPassword(): string {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bytes = require('crypto').randomBytes(12) as Buffer;
        return Array.from(bytes).map(b => chars[b % chars.length]).join('');
    }

    // ─── Tools ────────────────────────────────────────────────────────────────────

    private regGetPbxState() {
        this.reg('get_pbx_state',
            'Возвращает текущее состояние АТС: абоненты, транки, IVR, очереди, контексты. Вызывай чтобы узнать актуальную конфигурацию.',
            {},
            async (_args, uid) => {
                const [endpoints, trunks, ivrs, queues, contexts] = await Promise.all([
                    this.endpointsService.findAll(uid),
                    this.trunksService.findAll(uid),
                    this.ivrsService.findAll(uid),
                    this.queuesService.findAll(uid),
                    this.contextsService.findAll(uid),
                ]);
                return [{ type: 'text', text: JSON.stringify({ endpoints, trunks, ivrs, queues, contexts }, null, 2) }];
            },
            'pbx',
        );
    }

    private regCreateEndpointsBulk() {
        this.reg('create_endpoints_bulk',
            'Создаёт несколько SIP-абонентов по паттерну. Пример: "200-220" создаст 21 абонента. Максимум 5000 за раз.',
            {
                extensionsPattern: { type: 'string', description: 'Паттерн: "200-220" или "201,205,210-215"' },
                context: { type: 'string', default: 'from-internal' },
                passwordPattern: { type: 'string', default: 'auto', description: '"auto" — случайные пароли' },
                displayNamePattern: { type: 'string', description: 'Шаблон имени: "Абонент {N}"' },
                codecs: { type: 'string', description: '"ulaw,alaw,g722"' },
                natProfile: { type: 'string', enum: ['lan', 'nat', 'webrtc'] },
            },
            async (args, uid) => {
                const result = await this.endpointsService.bulkCreate(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'endpoint',
        );
    }

    private regCreateEndpoint() {
        this.reg('create_endpoint',
            'Создаёт одного SIP-абонента. Поле extension (или username) — номер. Пароль генерируется автоматически если не указан или слабый. Пароль возвращается — сообщи его пользователю.',
            {
                extension: { type: 'string', description: 'Номер абонента (например "201"). Также принимается как username.' },
                username: { type: 'string', description: 'Псевдоним для extension.' },
                password: { type: 'string', description: 'SIP-пароль. Если не указан — генерируется автоматически.' },
                displayName: { type: 'string', description: 'Отображаемое имя' },
                context: { type: 'string', description: 'Контекст маршрутизации. Если не указан — используется первый контекст тенанта.' },
                codecs: { type: 'string' },
                natProfile: { type: 'string', enum: ['lan', 'nat', 'webrtc'] },
            },
            async (args, uid) => {
                const extension = args.extension ?? args.username;
                if (!extension) return [{ type: 'text', text: '❌ Укажите extension или username' }];

                const WEAK = ['defaultpassword', 'password', '1234', '12345', '123456', 'pass', 'qwerty', 'sip', ''];
                const raw: string = args.password ?? '';
                const needsAuto = !raw || raw.length < 6 || WEAK.includes(raw.toLowerCase());
                const password = needsAuto ? this.generateSipPassword() : raw;

                // Если context не указан — спрашиваем LLM какой выбрать
                let context: string = args.context;
                if (!context) {
                    const contexts = await this.contextsService.findAll(uid).catch(() => []);
                    if (contexts.length === 0) {
                        context = 'from-internal';
                    } else if (contexts.length === 1) {
                        // Один контекст — используем его автоматически
                        context = (contexts[0] as any).name;
                    } else {
                        // Несколько контекстов — возвращаем список LLM-у, пусть выберет
                        const list = contexts.map((c: any) =>
                            `• "${c.name}"${c.comment ? ` — ${c.comment}` : ''}`,
                        ).join('\n');
                        return [{ type: 'text', text:
                            `❓ Укажи контекст для абонента ${extension}. Доступные контексты:\n${list}\n\n` +
                            `Вызови create_endpoint снова с параметром context="<выбранный контекст>".`,
                        }];
                    }
                }

                const result = await this.endpointsService.create({ ...args, extension, password, context } as any, uid);
                return [{ type: 'text', text: [
                    `✅ Абонент ${extension} создан.`,
                    `SIP ID: ${result.sipUsername}`,
                    `Пароль: ${password}${needsAuto ? ' (авто)' : ''}`,
                    `Контекст: ${context}`,
                ].join('\n') }];
            },
            'endpoint',
        );
    }


    private regDeleteEndpoint() {
        this.reg('delete_endpoint',
            'Удаляет SIP-абонента по SIP-ID (например "e201_42"). Получи SIP-ID из get_pbx_state.',
            { sipId: { type: 'string', description: 'SIP ID абонента (e{extension}_{tenantId})' } },
            async ({ sipId }, uid) => {
                await this.endpointsService.remove(sipId, uid);
                return [{ type: 'text', text: `✅ Абонент ${sipId} удалён.` }];
            },
            'endpoint',
            true,
        );
    }

    private regCreateTrunk() {
        this.reg('create_trunk',
            'Создаёт исходящий SIP транк. Тип "auth" — с регистрацией, "ip" — по IP-адресу.',
            {
                name: { type: 'string', description: 'Имя транка ("МТТ", "Ростелеком")' },
                trunkType: { type: 'string', enum: ['auth', 'ip'] },
                host: { type: 'string', description: 'Адрес SIP-сервера' },
                port: { type: 'number' },
                username: { type: 'string' },
                password: { type: 'string' },
                context: { type: 'string', description: 'Контекст для входящих (from-trunk)' },
                codecs: { type: 'string' },
                fromDomain: { type: 'string' },
            },
            async (args, uid) => {
                const result = await this.trunksService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'trunk',
        );
    }

    private regDeleteTrunk() {
        this.reg('delete_trunk',
            'Удаляет SIP-транк по ID (формат: t_{name}_{tenantId}).',
            { trunkId: { type: 'string' } },
            async ({ trunkId }, uid) => {
                await this.trunksService.remove(trunkId, uid);
                return [{ type: 'text', text: `✅ Транк ${trunkId} удалён.` }];
            },
            'trunk',
            true,
        );
    }

    private regCreateIvr() {
        this.reg('create_ivr',
            'Создаёт IVR-меню (интерактивное голосовое меню).',
            {
                name: { type: 'string' },
                description: { type: 'string' },
                steps: { type: 'array', description: 'Шаги IVR' },
            },
            async (args, uid) => {
                const result = await this.ivrsService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'ivr',
        );
    }

    private regUpdateIvr() {
        this.reg('update_ivr',
            'Изменяет IVR-меню. ID из get_pbx_state.',
            { id: { type: 'number' }, name: { type: 'string' }, description: { type: 'string' }, steps: { type: 'array' } },
            async ({ id, ...rest }, uid) => {
                const result = await this.ivrsService.update(id, rest as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'ivr',
        );
    }

    private regDeleteIvr() {
        this.reg('delete_ivr', 'Удаляет IVR по ID.',
            { id: { type: 'number' } },
            async ({ id }, uid) => { await this.ivrsService.remove(id, uid); return [{ type: 'text', text: `✅ IVR ${id} удалён.` }]; },
            'ivr',
            true,
        );
    }

    private regCreateQueue() {
        this.reg('create_queue',
            'Создаёт очередь звонков для распределения по абонентам.',
            {
                name: { type: 'string' },
                strategy: { type: 'string', default: 'ringall', description: 'ringall, leastrecent, fewestcalls, random, rrmemory' },
                timeout: { type: 'number' },
                members: { type: 'array', description: '[{interface: "PJSIP/e201_42", penalty: 0}]' },
            },
            async (args, uid) => {
                const result = await this.queuesService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'queue',
        );
    }

    private regUpdateQueue() {
        this.reg('update_queue', 'Изменяет очередь звонков.',
            { name: { type: 'string' }, strategy: { type: 'string' }, timeout: { type: 'number' }, members: { type: 'array' } },
            async ({ name, ...rest }, uid) => {
                const result = await this.queuesService.update(name, rest as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'queue',
        );
    }

    private regDeleteQueue() {
        this.reg('delete_queue', 'Удаляет очередь по имени.',
            { name: { type: 'string' } },
            async ({ name }, uid) => { await this.queuesService.remove(name, uid); return [{ type: 'text', text: `✅ Очередь ${name} удалена.` }]; },
            'queue',
            true,
        );
    }

    private regCreateRoute() {
        this.reg('create_route',
            'Создаёт правило маршрутизации. ПОСЛЕ создания ОБЯЗАТЕЛЬНО вызови apply_dialplan.',
            {
                context_uid: { type: 'number', description: 'UID контекста (из get_pbx_state)' },
                pattern: { type: 'string', description: '"_X." — любой, "_2XX" — 200-299' },
                app: { type: 'string', description: 'Dial, Queue, Playback, Hangup' },
                appdata: { type: 'string', description: '"PJSIP/e201_42,30" или "Queue(sales)"' },
                priority: { type: 'number' },
                description: { type: 'string' },
            },
            async (args, uid) => {
                const result = await this.routesService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'route',
        );
    }

    private regDeleteRoute() {
        this.reg('delete_route', 'Удаляет правило маршрутизации. После вызови apply_dialplan.',
            { id: { type: 'number' } },
            async ({ id }, uid) => { await this.routesService.remove(id, uid); return [{ type: 'text', text: `✅ Маршрут ${id} удалён.` }]; },
            'route',
            true,
        );
    }

    private regApplyDialplan() {
        this.reg('apply_dialplan',
            'Применяет dialplan к Asterisk через AMI. ОБЯЗАТЕЛЬНО после изменений маршрутов.',
            { contextUid: { type: 'number', description: 'UID контекста из get_pbx_state' } },
            async ({ contextUid }, uid) => {
                const context = await this.contextModel.findOne({ where: { uid: contextUid, user_uid: uid } });
                if (!context) return [{ type: 'text', text: `❌ Контекст ${contextUid} не найден.` }];

                const includes = await this.contextIncludesService.getIncludeNames(contextUid, uid);
                const dialplan = await this.routesService.generateContextDialplan(contextUid, uid, context.name, includes, true);
                const suffix = String(uid);
                const contextName = context.name.endsWith(suffix) ? context.name : `${context.name}${suffix}`;
                const filename = `krasterisk/routes/extensions_${contextName}.conf`;
                const lines = dialplan.split('\n');

                const result = await this.dialplanApplyService.applyCategories(
                    filename,
                    [{ name: contextName, lines }],
                    { reload: true },
                );
                return [{ type: 'text', text: `✅ Диалплан [${contextName}] применён. ${result.linesApplied} строк.` }];
            },
            'pbx',
        );
    }

    private regListContexts() {
        this.reg('list_contexts',
            'Возвращает все контексты маршрутизации с UID. Используй перед create_route.',
            {},
            async (_args, uid) => {
                const contexts = await this.contextsService.findAll(uid);
                return [{ type: 'text', text: JSON.stringify(contexts, null, 2) }];
            },
            'context',
        );
    }

    private regGetCdrSummary() {
        this.reg('get_cdr_summary',
            'Сводка CDR за период: количество звонков, ASR, средняя длительность. Параметры dateFrom/dateTo в формате YYYY-MM-DD.',
            {
                dateFrom: { type: 'string', description: 'Начало периода YYYY-MM-DD' },
                dateTo: { type: 'string', description: 'Конец периода YYYY-MM-DD' },
            },
            async (args, uid) => {
                const stats = await this.cdrService.getStats(uid, {
                    dateFrom: args.dateFrom,
                    dateTo: args.dateTo,
                });
                return [{ type: 'text', text: JSON.stringify(stats, null, 2) }];
            },
            'cdr',
        );
    }

    private regFindCdrCalls() {
        this.reg('find_cdr_calls',
            'Поиск звонков CDR (одна запись на звонок, GROUP BY linkedid). Лимит до 50.',
            {
                dateFrom: { type: 'string' },
                dateTo: { type: 'string' },
                search: { type: 'string', description: 'Поиск по номеру' },
                direction: { type: 'string', enum: ['in', 'out', 'int', 'external'] },
                limit: { type: 'number', default: 20 },
            },
            async (args, uid) => {
                const result = await this.cdrService.findCalls(uid, {
                    dateFrom: args.dateFrom,
                    dateTo: args.dateTo,
                    search: args.search,
                    direction: args.direction,
                    limit: Math.min(args.limit || 20, 50),
                    offset: 0,
                });
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
            'cdr',
        );
    }
}
