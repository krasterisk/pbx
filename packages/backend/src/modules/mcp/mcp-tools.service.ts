import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
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

/**
 * McpToolsService — регистрирует все инструменты KrAsterisk на McpServer.
 *
 * ПРАВИЛО (ARCHITECTURE): При создании любой новой сущности АТС (абоненты,
 * транки, IVR, очереди, контексты, маршруты и т.д.) — обязательно добавить
 * соответствующий инструмент здесь, чтобы AI-агент мог с ней работать.
 *
 * Структура инструмента:
 *   mcpServer.registerTool(name, { description, inputSchema }, handler)
 *
 * Каждый handler получает vpbxUserUid из замыкания (передаётся при инициализации
 * для конкретной сессии тенанта).
 */
@Injectable()
export class McpToolsService {
    private readonly logger = new Logger(McpToolsService.name);

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
    ) {}

    /**
     * Регистрирует все PBX tools на McpServer для конкретного тенанта.
     * Вызывается один раз при создании новой MCP-сессии.
     *
     * @param server - экземпляр McpServer для данной сессии
     * @param vpbxUserUid - ID тенанта из JWT/service token
     */
    registerAll(server: McpServer, vpbxUserUid: number): void {
        this.registerGetPbxState(server, vpbxUserUid);
        this.registerCreateEndpointsBulk(server, vpbxUserUid);
        this.registerCreateEndpoint(server, vpbxUserUid);
        this.registerDeleteEndpoint(server, vpbxUserUid);
        this.registerCreateTrunk(server, vpbxUserUid);
        this.registerDeleteTrunk(server, vpbxUserUid);
        this.registerCreateIvr(server, vpbxUserUid);
        this.registerUpdateIvr(server, vpbxUserUid);
        this.registerDeleteIvr(server, vpbxUserUid);
        this.registerCreateQueue(server, vpbxUserUid);
        this.registerUpdateQueue(server, vpbxUserUid);
        this.registerDeleteQueue(server, vpbxUserUid);
        this.registerCreateRoute(server, vpbxUserUid);
        this.registerDeleteRoute(server, vpbxUserUid);
        this.registerApplyDialplan(server, vpbxUserUid);
        this.registerListContexts(server, vpbxUserUid);

        this.logger.log(`Registered ${16} MCP tools for tenant ${vpbxUserUid}`);
    }

    // ─── Tool: get_pbx_state ─────────────────────────────────────────────────────

    private registerGetPbxState(server: McpServer, uid: number) {
        server.registerTool(
            'get_pbx_state',
            {
                title: 'Получить состояние АТС',
                description: 'Возвращает полный snapshot конфигурации АТС: абоненты, транки, IVR, очереди, контексты маршрутизации. Используй ПЕРЕД любой операцией настройки.',
                inputSchema: {},
            },
            async () => {
                const [endpoints, trunks, ivrs, queues, contexts] = await Promise.all([
                    this.endpointsService.findAll(uid),
                    this.trunksService.findAll(uid),
                    this.ivrsService.findAll(uid),
                    this.queuesService.findAll(uid),
                    this.contextsService.findAll(uid),
                ]);
                const state = { endpoints, trunks, ivrs, queues, contexts };
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(state, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: create_endpoints_bulk ─────────────────────────────────────────────

    private registerCreateEndpointsBulk(server: McpServer, uid: number) {
        server.registerTool(
            'create_endpoints_bulk',
            {
                title: 'Массовое создание абонентов',
                description: 'Создаёт несколько SIP-абонентов по паттерну. Пример: "200-220" создаст 21 абонента. Поддерживает диапазоны (200-220) и списки (201,205,210). Максимум 5000 за раз.',
                inputSchema: {
                    extensionsPattern: z.string().describe('Паттерн номеров: "200-220" или "201,205,210-215"'),
                    context: z.string().default('from-internal').describe('Контекст маршрутизации (обычно "from-internal")'),
                    passwordPattern: z.string().default('auto').describe('"auto" — случайные пароли, или фиксированный пароль'),
                    displayNamePattern: z.string().optional().describe('Шаблон имени абонента: "Абонент {N}" где {N} — номер'),
                    codecs: z.string().optional().describe('Кодеки через запятую: "ulaw,alaw,g722"'),
                    natProfile: z.enum(['lan', 'nat', 'webrtc']).optional().describe('NAT профиль (nat по умолчанию)'),
                },
            },
            async (args) => {
                const result = await this.endpointsService.bulkCreate(args as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: create_endpoint ───────────────────────────────────────────────────

    private registerCreateEndpoint(server: McpServer, uid: number) {
        server.registerTool(
            'create_endpoint',
            {
                title: 'Создать одного абонента',
                description: 'Создаёт одного SIP-абонента (extension). Используй для точечного создания.',
                inputSchema: {
                    extension: z.string().describe('Номер абонента (например "201")'),
                    password: z.string().min(4).describe('SIP-пароль (минимум 4 символа)'),
                    displayName: z.string().optional().describe('Отображаемое имя'),
                    context: z.string().default('from-internal').describe('Контекст маршрутизации'),
                    codecs: z.string().optional().describe('Кодеки: "ulaw,alaw,g722"'),
                    natProfile: z.enum(['lan', 'nat', 'webrtc']).optional(),
                },
            },
            async (args) => {
                const result = await this.endpointsService.create(args as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: delete_endpoint ───────────────────────────────────────────────────

    private registerDeleteEndpoint(server: McpServer, uid: number) {
        server.registerTool(
            'delete_endpoint',
            {
                title: 'Удалить абонента',
                description: 'Удаляет SIP-абонента по его SIP-ID (например "e201_42"). Получи SIP-ID из get_pbx_state.',
                inputSchema: {
                    sipId: z.string().describe('SIP ID абонента (формат: e{extension}_{tenantId})'),
                },
            },
            async ({ sipId }) => {
                await this.endpointsService.remove(sipId, uid);
                return {
                    content: [{ type: 'text' as const, text: `Абонент ${sipId} удалён.` }],
                };
            },
        );
    }

    // ─── Tool: create_trunk ──────────────────────────────────────────────────────

    private registerCreateTrunk(server: McpServer, uid: number) {
        server.registerTool(
            'create_trunk',
            {
                title: 'Создать SIP транк',
                description: 'Создаёт исходящий SIP транк для подключения к провайдеру. Тип "auth" — с регистрацией (логин/пароль), "ip" — по IP-адресу.',
                inputSchema: {
                    name: z.string().describe('Имя транка (например "МТТ" или "Ростелеком")'),
                    trunkType: z.enum(['auth', 'ip']).describe('"auth" — с регистрацией, "ip" — по IP'),
                    host: z.string().describe('Адрес SIP-сервера провайдера'),
                    port: z.number().optional().describe('Порт (по умолчанию 5060)'),
                    username: z.string().optional().describe('Логин (для auth-типа)'),
                    password: z.string().optional().describe('Пароль (для auth-типа)'),
                    context: z.string().optional().describe('Контекст для входящих вызовов (по умолчанию "from-trunk")'),
                    codecs: z.string().optional().describe('Кодеки: "ulaw,alaw,g722"'),
                    fromDomain: z.string().optional().describe('Домен для заголовка From'),
                },
            },
            async (args) => {
                const result = await this.trunksService.create(args as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: delete_trunk ──────────────────────────────────────────────────────

    private registerDeleteTrunk(server: McpServer, uid: number) {
        server.registerTool(
            'delete_trunk',
            {
                title: 'Удалить транк',
                description: 'Удаляет SIP-транк по его ID. ID транка — строка формата t_{name}_{tenantId}.',
                inputSchema: {
                    trunkId: z.string().describe('ID транка (формат: t_{name}_{tenantId})'),
                },
            },
            async ({ trunkId }) => {
                await this.trunksService.remove(trunkId, uid);
                return {
                    content: [{ type: 'text' as const, text: `Транк ${trunkId} удалён.` }],
                };
            },
        );
    }

    // ─── Tool: create_ivr ────────────────────────────────────────────────────────

    private registerCreateIvr(server: McpServer, uid: number) {
        server.registerTool(
            'create_ivr',
            {
                title: 'Создать IVR-меню',
                description: 'Создаёт интерактивное голосовое меню (IVR). Поддерживает шаги: воспроизведение звука, ввод цифры (DTMF), перевод на абонента/очередь/внешний номер.',
                inputSchema: {
                    name: z.string().describe('Название IVR'),
                    description: z.string().optional().describe('Описание'),
                    steps: z.array(z.object({
                        type: z.string().describe('Тип шага: playback, dtmf, goto, hangup'),
                        params: z.record(z.string(), z.unknown()).optional().describe('Параметры шага'),
                    })).optional().describe('Шаги IVR'),
                },
            },
            async (args) => {
                const result = await this.ivrsService.create(args as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: update_ivr ────────────────────────────────────────────────────────

    private registerUpdateIvr(server: McpServer, uid: number) {
        server.registerTool(
            'update_ivr',
            {
                title: 'Обновить IVR-меню',
                description: 'Изменяет существующее IVR-меню. Получи ID IVR из get_pbx_state.',
                inputSchema: {
                    id: z.number().describe('ID IVR'),
                    name: z.string().optional(),
                    description: z.string().optional(),
                    steps: z.array(z.object({
                        type: z.string(),
                        params: z.record(z.string(), z.unknown()).optional(),
                    })).optional(),
                },
            },
            async ({ id, ...rest }) => {
                const result = await this.ivrsService.update(id, rest as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: delete_ivr ────────────────────────────────────────────────────────

    private registerDeleteIvr(server: McpServer, uid: number) {
        server.registerTool(
            'delete_ivr',
            {
                title: 'Удалить IVR',
                description: 'Удаляет IVR-меню по ID.',
                inputSchema: { id: z.number().describe('ID IVR') },
            },
            async ({ id }) => {
                await this.ivrsService.remove(id, uid);
                return { content: [{ type: 'text' as const, text: `IVR ${id} удалён.` }] };
            },
        );
    }

    // ─── Tool: create_queue ──────────────────────────────────────────────────────

    private registerCreateQueue(server: McpServer, uid: number) {
        server.registerTool(
            'create_queue',
            {
                title: 'Создать очередь звонков',
                description: 'Создаёт группу абонентов (очередь), на которую звонки распределяются по заданной стратегии.',
                inputSchema: {
                    name: z.string().describe('Имя очереди'),
                    strategy: z.string().default('ringall').describe('Стратегия: ringall, leastrecent, fewestcalls, random, rrmemory'),
                    timeout: z.number().optional().describe('Таймаут ожидания (секунды)'),
                    members: z.array(z.object({
                        interface: z.string().describe('SIP ID участника: PJSIP/e201_42'),
                        penalty: z.number().optional().describe('Приоритет (0 = первый)'),
                    })).optional().describe('Участники очереди'),
                },
            },
            async (args) => {
                const result = await this.queuesService.create(args as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: update_queue ──────────────────────────────────────────────────────

    private registerUpdateQueue(server: McpServer, uid: number) {
        server.registerTool(
            'update_queue',
            {
                title: 'Обновить очередь звонков',
                description: 'Изменяет настройки или участников существующей очереди.',
                inputSchema: {
                    name: z.string().describe('Имя очереди (формат: q{exten}_{tenantId}, из get_pbx_state)'),
                    strategy: z.string().optional(),
                    timeout: z.number().optional(),
                    members: z.array(z.object({
                        interface: z.string(),
                        penalty: z.number().optional(),
                    })).optional(),
                },
            },
            async ({ name, ...rest }) => {
                const result = await this.queuesService.update(name, rest as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: delete_queue ──────────────────────────────────────────────────────

    private registerDeleteQueue(server: McpServer, uid: number) {
        server.registerTool(
            'delete_queue',
            {
                title: 'Удалить очередь',
                description: 'Удаляет очередь звонков по ID.',
                inputSchema: { name: z.string().describe('Имя очереди (из get_pbx_state → queues[].name)') },
            },
            async ({ name }) => {
                await this.queuesService.remove(name, uid);
                return { content: [{ type: 'text' as const, text: `Очередь ${name} удалена.` }] };
            },
        );
    }

    // ─── Tool: create_route ──────────────────────────────────────────────────────

    private registerCreateRoute(server: McpServer, uid: number) {
        server.registerTool(
            'create_route',
            {
                title: 'Создать правило маршрутизации',
                description: 'Создаёт правило в диалплане: какой номер (паттерн) → куда направить вызов (приложение Asterisk). После создания ОБЯЗАТЕЛЬНО вызвать apply_dialplan.',
                inputSchema: {
                    context_uid: z.number().describe('UID контекста (из get_pbx_state → contexts[].uid)'),
                    pattern: z.string().describe('Паттерн набора: "_X." — любой номер, "_2XX" — внутренние 200-299'),
                    app: z.string().describe('Приложение Asterisk: Dial, Queue, Playback, Hangup, GotoIf'),
                    appdata: z.string().describe('Параметры приложения: "PJSIP/e201_42,30" или "Queue(sales)"'),
                    priority: z.number().optional().describe('Приоритет в контексте (по умолчанию автоматически)'),
                    description: z.string().optional().describe('Комментарий к правилу'),
                },
            },
            async (args) => {
                const result = await this.routesService.create(args as any, uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    }

    // ─── Tool: delete_route ──────────────────────────────────────────────────────

    private registerDeleteRoute(server: McpServer, uid: number) {
        server.registerTool(
            'delete_route',
            {
                title: 'Удалить правило маршрутизации',
                description: 'Удаляет правило маршрутизации по ID. После удаления вызови apply_dialplan.',
                inputSchema: { id: z.number().describe('ID маршрута (из get_pbx_state → routes[].id)') },
            },
            async ({ id }) => {
                await this.routesService.remove(id, uid);
                return { content: [{ type: 'text' as const, text: `Маршрут ${id} удалён.` }] };
            },
        );
    }

    // ─── Tool: apply_dialplan ─────────────────────────────────────────────────────

    private registerApplyDialplan(server: McpServer, uid: number) {
        server.registerTool(
            'apply_dialplan',
            {
                title: 'Применить диалплан',
                description: 'Генерирует dialplan-конфиг и применяет его к Asterisk через AMI. ОБЯЗАТЕЛЬНО вызывать после любых изменений маршрутов. Без этого вызова изменения не вступят в силу.',
                inputSchema: {
                    contextUid: z.number().describe('UID контекста (из get_pbx_state → contexts[].uid)'),
                },
            },
            async ({ contextUid }) => {
                const context = await this.contextModel.findOne({
                    where: { uid: contextUid, user_uid: uid },
                });
                if (!context) {
                    return { content: [{ type: 'text' as const, text: `Контекст ${contextUid} не найден.` }] };
                }

                const includes = await this.contextIncludesService.getIncludeNames(contextUid, uid);
                const dialplan = await this.routesService.generateContextDialplan(
                    contextUid, uid, context.name, includes, true,
                );

                const suffix = String(uid);
                const contextName = context.name.endsWith(suffix) ? context.name : `${context.name}${suffix}`;
                const filename = `krasterisk/routes/extensions_${contextName}.conf`;

                const lines = dialplan.split('\n')
                    .map((l) => l.trim())
                    .filter((l) => l && !l.startsWith('[') && !l.startsWith(';'));

                try {
                    await this.amiService.action({ action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, 'Action-000000': 'DelCat', 'Cat-000000': contextName, reload: 'no' });
                } catch { /* expected */ }

                await this.amiService.action({ action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no', 'Action-000000': 'NewCat', 'Cat-000000': contextName });

                const BATCH = 20;
                for (let i = 0; i < lines.length; i += BATCH) {
                    const batch = lines.slice(i, i + BATCH);
                    const act: Record<string, string> = { action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no' };
                    batch.forEach((line, idx) => {
                        const pad = String(idx).padStart(6, '0');
                        act[`Action-${pad}`] = 'Append';
                        act[`Cat-${pad}`] = contextName;
                        const ap = line.indexOf('=>');
                        if (ap !== -1) { act[`Var-${pad}`] = line.substring(0, ap).trim(); act[`Value-${pad}`] = `> ${line.substring(ap + 2).trim()}`; }
                        else { const eq = line.indexOf('='); act[`Var-${pad}`] = eq !== -1 ? line.substring(0, eq).trim() : line; act[`Value-${pad}`] = eq !== -1 ? line.substring(eq + 1).trim() : ''; }
                    });
                    await this.amiService.action(act);
                }

                await this.amiService.command('dialplan reload');
                return { content: [{ type: 'text' as const, text: `✅ Диалплан [${contextName}] применён. ${lines.length} строк записано.` }] };
            },
        );
    }

    // ─── Tool: list_contexts ─────────────────────────────────────────────────────

    private registerListContexts(server: McpServer, uid: number) {
        server.registerTool(
            'list_contexts',
            {
                title: 'Список контекстов маршрутизации',
                description: 'Возвращает все контексты маршрутизации тенанта с их UID. Используй перед create_route для получения context_uid.',
                inputSchema: {},
            },
            async () => {
                const contexts = await this.contextsService.findAll(uid);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(contexts, null, 2) }],
                };
            },
        );
    }
}
