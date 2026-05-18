import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService } from '../trunks/trunks.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { QueuesService } from '../queues/queues.service';
import { RoutesService } from '../routes/routes.service';
import { ContextIncludesService } from '../routes/context-includes.service';
import { ContextsService } from '../contexts/contexts.service';
import { AmiService } from '../ami/ami.service';
import { PbxContextBuilderService } from '../ai-chat/pbx-context-builder.service';
import { InjectModel } from '@nestjs/sequelize';
import { Context } from '../contexts/context.model';
import { CdrService } from '../reports/cdr/cdr.service';

/**
 * McpToolsService — регистрирует все инструменты KrAsterisk в локальном реестре.
 *
 * ПРАВИЛО (ARCHITECTURE): При создании любой новой сущности АТС — добавить
 * инструмент здесь, чтобы AI-агент мог с ней работать.
 *
 * Все инструменты используют this.reg() который хранит handler в toolRegistry Map.
 * McpSessionService вызывает callTool() и getToolsList() напрямую — без MCP SDK session.
 */
@Injectable()
export class McpToolsService {
    private readonly logger = new Logger(McpToolsService.name);

    /** Tool registry для прямого JSON-RPC dispatch (без MCP SDK session) */
    private readonly toolRegistry = new Map<string, {
        description: string;
        inputSchema: Record<string, any>;
        handler: (args: any) => Promise<Array<{ type: string; text: string }>>;
    }>();

    constructor(
        private readonly endpointsService: EndpointsService,
        private readonly trunksService: TrunksService,
        private readonly ivrsService: IvrsService,
        private readonly queuesService: QueuesService,
        private readonly routesService: RoutesService,
        private readonly contextIncludesService: ContextIncludesService,
        private readonly contextsService: ContextsService,
        private readonly amiService: AmiService,
        private readonly contextBuilder: PbxContextBuilderService,
        @InjectModel(Context) private readonly contextModel: typeof Context,
        private readonly cdrService: CdrService,
    ) {}

    registerAll(_server: McpServer, vpbxUserUid: number): void {
        this.toolRegistry.clear();
        this.regGetPbxState(vpbxUserUid);
        this.regCreateEndpointsBulk(vpbxUserUid);
        this.regCreateEndpoint(vpbxUserUid);
        this.regDeleteEndpoint(vpbxUserUid);
        this.regCreateTrunk(vpbxUserUid);
        this.regDeleteTrunk(vpbxUserUid);
        this.regCreateIvr(vpbxUserUid);
        this.regUpdateIvr(vpbxUserUid);
        this.regDeleteIvr(vpbxUserUid);
        this.regCreateQueue(vpbxUserUid);
        this.regUpdateQueue(vpbxUserUid);
        this.regDeleteQueue(vpbxUserUid);
        this.regCreateRoute(vpbxUserUid);
        this.regDeleteRoute(vpbxUserUid);
        this.regApplyDialplan(vpbxUserUid);
        this.regListContexts(vpbxUserUid);
        this.regGetCdrSummary(vpbxUserUid);
        this.regFindCdrCalls(vpbxUserUid);
        this.logger.log(`Registered ${this.toolRegistry.size} MCP tools for tenant ${vpbxUserUid}`);
    }

    getToolsList(vpbxUserUid: number): Array<{ name: string; description: string; inputSchema: any }> {
        if (this.toolRegistry.size === 0) this.registerAll({} as any, vpbxUserUid);
        return Array.from(this.toolRegistry.entries()).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: { type: 'object', properties: def.inputSchema },
        }));
    }

    async callTool(name: string, args: Record<string, any>, vpbxUserUid: number): Promise<Array<{ type: string; text: string }>> {
        if (this.toolRegistry.size === 0) this.registerAll({} as any, vpbxUserUid);
        const tool = this.toolRegistry.get(name);
        if (!tool) {
            const available = Array.from(this.toolRegistry.keys()).join(', ');
            throw new Error(`Tool not found: "${name}". Available: ${available}`);
        }
        try {
            return await tool.handler(args);
        } catch (err: any) {
            this.logger.error(`Tool "${name}" failed for tenant ${vpbxUserUid}: ${err.message}`);
            return [{ type: 'text', text: `❌ Ошибка: ${err.message}` }];
        }
    }

    private reg(name: string, description: string, inputSchema: Record<string, any>, handler: (args: any) => Promise<Array<{ type: string; text: string }>>): void {
        this.toolRegistry.set(name, { description, inputSchema, handler });
    }

    /** Генерирует криптостойкий SIP-пароль */
    private generateSipPassword(): string {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bytes = require('crypto').randomBytes(12) as Buffer;
        return Array.from(bytes).map(b => chars[b % chars.length]).join('');
    }

    // ─── Tools ────────────────────────────────────────────────────────────────────

    private regGetPbxState(uid: number) {
        this.reg('get_pbx_state',
            'Возвращает текущее состояние АТС: абоненты, транки, IVR, очереди, контексты. Вызывай чтобы узнать актуальную конфигурацию.',
            {},
            async () => {
                const [endpoints, trunks, ivrs, queues, contexts] = await Promise.all([
                    this.endpointsService.findAll(uid),
                    this.trunksService.findAll(uid),
                    this.ivrsService.findAll(uid),
                    this.queuesService.findAll(uid),
                    this.contextsService.findAll(uid),
                ]);
                return [{ type: 'text', text: JSON.stringify({ endpoints, trunks, ivrs, queues, contexts }, null, 2) }];
            },
        );
    }

    private regCreateEndpointsBulk(uid: number) {
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
            async (args) => {
                const result = await this.endpointsService.bulkCreate(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
        );
    }

    private regCreateEndpoint(uid: number) {
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
            async (args) => {
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
        );
    }


    private regDeleteEndpoint(uid: number) {
        this.reg('delete_endpoint',
            'Удаляет SIP-абонента по SIP-ID (например "e201_42"). Получи SIP-ID из get_pbx_state.',
            { sipId: { type: 'string', description: 'SIP ID абонента (e{extension}_{tenantId})' } },
            async ({ sipId }) => {
                await this.endpointsService.remove(sipId, uid);
                return [{ type: 'text', text: `✅ Абонент ${sipId} удалён.` }];
            },
        );
    }

    private regCreateTrunk(uid: number) {
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
            async (args) => {
                const result = await this.trunksService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
        );
    }

    private regDeleteTrunk(uid: number) {
        this.reg('delete_trunk',
            'Удаляет SIP-транк по ID (формат: t_{name}_{tenantId}).',
            { trunkId: { type: 'string' } },
            async ({ trunkId }) => {
                await this.trunksService.remove(trunkId, uid);
                return [{ type: 'text', text: `✅ Транк ${trunkId} удалён.` }];
            },
        );
    }

    private regCreateIvr(uid: number) {
        this.reg('create_ivr',
            'Создаёт IVR-меню (интерактивное голосовое меню).',
            {
                name: { type: 'string' },
                description: { type: 'string' },
                steps: { type: 'array', description: 'Шаги IVR' },
            },
            async (args) => {
                const result = await this.ivrsService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
        );
    }

    private regUpdateIvr(uid: number) {
        this.reg('update_ivr',
            'Изменяет IVR-меню. ID из get_pbx_state.',
            { id: { type: 'number' }, name: { type: 'string' }, description: { type: 'string' }, steps: { type: 'array' } },
            async ({ id, ...rest }) => {
                const result = await this.ivrsService.update(id, rest as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
        );
    }

    private regDeleteIvr(uid: number) {
        this.reg('delete_ivr', 'Удаляет IVR по ID.',
            { id: { type: 'number' } },
            async ({ id }) => { await this.ivrsService.remove(id, uid); return [{ type: 'text', text: `✅ IVR ${id} удалён.` }]; },
        );
    }

    private regCreateQueue(uid: number) {
        this.reg('create_queue',
            'Создаёт очередь звонков для распределения по абонентам.',
            {
                name: { type: 'string' },
                strategy: { type: 'string', default: 'ringall', description: 'ringall, leastrecent, fewestcalls, random, rrmemory' },
                timeout: { type: 'number' },
                members: { type: 'array', description: '[{interface: "PJSIP/e201_42", penalty: 0}]' },
            },
            async (args) => {
                const result = await this.queuesService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
        );
    }

    private regUpdateQueue(uid: number) {
        this.reg('update_queue', 'Изменяет очередь звонков.',
            { name: { type: 'string' }, strategy: { type: 'string' }, timeout: { type: 'number' }, members: { type: 'array' } },
            async ({ name, ...rest }) => {
                const result = await this.queuesService.update(name, rest as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
        );
    }

    private regDeleteQueue(uid: number) {
        this.reg('delete_queue', 'Удаляет очередь по имени.',
            { name: { type: 'string' } },
            async ({ name }) => { await this.queuesService.remove(name, uid); return [{ type: 'text', text: `✅ Очередь ${name} удалена.` }]; },
        );
    }

    private regCreateRoute(uid: number) {
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
            async (args) => {
                const result = await this.routesService.create(args as any, uid);
                return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
            },
        );
    }

    private regDeleteRoute(uid: number) {
        this.reg('delete_route', 'Удаляет правило маршрутизации. После вызови apply_dialplan.',
            { id: { type: 'number' } },
            async ({ id }) => { await this.routesService.remove(id, uid); return [{ type: 'text', text: `✅ Маршрут ${id} удалён.` }]; },
        );
    }

    private regApplyDialplan(uid: number) {
        this.reg('apply_dialplan',
            'Применяет dialplan к Asterisk через AMI. ОБЯЗАТЕЛЬНО после изменений маршрутов.',
            { contextUid: { type: 'number', description: 'UID контекста из get_pbx_state' } },
            async ({ contextUid }) => {
                const context = await this.contextModel.findOne({ where: { uid: contextUid, user_uid: uid } });
                if (!context) return [{ type: 'text', text: `❌ Контекст ${contextUid} не найден.` }];

                const includes = await this.contextIncludesService.getIncludeNames(contextUid, uid);
                const dialplan = await this.routesService.generateContextDialplan(contextUid, uid, context.name, includes, true);
                const suffix = String(uid);
                const contextName = context.name.endsWith(suffix) ? context.name : `${context.name}${suffix}`;
                const filename = `krasterisk/routes/extensions_${contextName}.conf`;
                const lines = dialplan.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('[') && !l.startsWith(';'));

                try { await this.amiService.action({ action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, 'Action-000000': 'DelCat', 'Cat-000000': contextName, reload: 'no' }); } catch { /* ok */ }
                await this.amiService.action({ action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no', 'Action-000000': 'NewCat', 'Cat-000000': contextName });

                for (let i = 0; i < lines.length; i += 20) {
                    const batch = lines.slice(i, i + 20);
                    const act: Record<string, string> = { action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no' };
                    batch.forEach((line, idx) => {
                        const pad = String(idx).padStart(6, '0');
                        act[`Action-${pad}`] = 'Append'; act[`Cat-${pad}`] = contextName;
                        const ap = line.indexOf('=>');
                        if (ap !== -1) { act[`Var-${pad}`] = line.substring(0, ap).trim(); act[`Value-${pad}`] = `> ${line.substring(ap + 2).trim()}`; }
                        else { const eq = line.indexOf('='); act[`Var-${pad}`] = eq !== -1 ? line.substring(0, eq).trim() : line; act[`Value-${pad}`] = eq !== -1 ? line.substring(eq + 1).trim() : ''; }
                    });
                    await this.amiService.action(act);
                }
                await this.amiService.command('dialplan reload');
                return [{ type: 'text', text: `✅ Диалплан [${contextName}] применён. ${lines.length} строк.` }];
            },
        );
    }

    private regListContexts(uid: number) {
        this.reg('list_contexts',
            'Возвращает все контексты маршрутизации с UID. Используй перед create_route.',
            {},
            async () => {
                const contexts = await this.contextsService.findAll(uid);
                return [{ type: 'text', text: JSON.stringify(contexts, null, 2) }];
            },
        );
    }

    private regGetCdrSummary(uid: number) {
        this.reg('get_cdr_summary',
            'Сводка CDR за период: количество звонков, ASR, средняя длительность. Параметры dateFrom/dateTo в формате YYYY-MM-DD.',
            {
                dateFrom: { type: 'string', description: 'Начало периода YYYY-MM-DD' },
                dateTo: { type: 'string', description: 'Конец периода YYYY-MM-DD' },
            },
            async (args) => {
                const stats = await this.cdrService.getStats(uid, {
                    dateFrom: args.dateFrom,
                    dateTo: args.dateTo,
                });
                return [{ type: 'text', text: JSON.stringify(stats, null, 2) }];
            },
        );
    }

    private regFindCdrCalls(uid: number) {
        this.reg('find_cdr_calls',
            'Поиск звонков CDR (одна запись на звонок, GROUP BY linkedid). Лимит до 50.',
            {
                dateFrom: { type: 'string' },
                dateTo: { type: 'string' },
                search: { type: 'string', description: 'Поиск по номеру' },
                direction: { type: 'string', enum: ['in', 'out', 'int', 'external'] },
                limit: { type: 'number', default: 20 },
            },
            async (args) => {
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
        );
    }
}
