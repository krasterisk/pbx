import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Req,
    UseGuards,
    Logger,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrServiceTokenGuard } from '../auth/jwt-or-service-token.guard';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService, CreateTrunkDto } from '../trunks/trunks.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { QueuesService } from '../queues/queues.service';
import { RoutesService } from '../routes/routes.service';
import { ContextIncludesService } from '../routes/context-includes.service';
import { AmiService } from '../ami/ami.service';
import { ContextsService } from '../contexts/contexts.service';
import { BulkCreateEndpointDto } from '../endpoints/dto/create-endpoint.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Context } from '../contexts/context.model';
import { LoggerService } from '../logger/logger.service';

/**
 * AiWebhookController — dedicated endpoints for aiPBX tool calls.
 *
 * All routes are under /api/ai-tools/* and accept EITHER:
 *   - Regular JWT (Authorization: Bearer <user-jwt>)
 *   - Service token (Authorization: Bearer <KRASTERISK_SERVICE_TOKEN>
 *                  + X-Vpbx-User-Uid: <tenantId>)
 *
 * This is the ONLY controller that aiPBX webhooks should call.
 * Existing controllers remain unchanged for regular users.
 */
@ApiTags('AI Tools (Webhooks)')
@ApiBearerAuth()
@UseGuards(JwtOrServiceTokenGuard)
@Controller('ai-tools')
export class AiWebhookController {
    private readonly logger = new Logger(AiWebhookController.name);

    constructor(
        private readonly endpointsService: EndpointsService,
        private readonly trunksService: TrunksService,
        private readonly ivrsService: IvrsService,
        private readonly queuesService: QueuesService,
        private readonly routesService: RoutesService,
        private readonly contextIncludesService: ContextIncludesService,
        private readonly contextsService: ContextsService,
        private readonly amiService: AmiService,
        private readonly loggerService: LoggerService,
        @InjectModel(Context) private readonly contextModel: typeof Context,
    ) {}

    // ─── Tool: get_pbx_state ────────────────────────────────────────────────────

    /**
     * GET /api/ai-tools/state
     * Returns a structured JSON snapshot of the current PBX configuration.
     * Used by the get_pbx_state tool.
     */
    @ApiOperation({ summary: 'get_pbx_state — full PBX config snapshot' })
    @Get('state')
    async getPbxState(@Req() req: Request & { user: any }) {
        const uid = req.user.vpbx_user_uid;
        const [endpoints, trunks, ivrs, queues, contexts] = await Promise.all([
            this.endpointsService.findAll(uid),
            this.trunksService.findAll(uid),
            this.ivrsService.findAll(uid),
            this.queuesService.findAll(uid),
            this.contextsService.findAll(uid),
        ]);
        return { endpoints, trunks, ivrs, queues, contexts };
    }

    // ─── Tool: create_endpoints_bulk ────────────────────────────────────────────

    /**
     * POST /api/ai-tools/endpoints/bulk
     * Bulk-create SIP endpoints.
     *
     * Body: { extensionsPattern: "200-220", context: "from-internal",
     *         passwordPattern: "auto", displayNamePattern: "Абонент {N}" }
     */
    @ApiOperation({ summary: 'create_endpoints_bulk — bulk create SIP endpoints' })
    @Post('endpoints/bulk')
    createEndpointsBulk(
        @Body() dto: BulkCreateEndpointDto,
        @Req() req: Request & { user: any },
    ) {
        const uid = req.user.vpbx_user_uid;
        const userId = req.user.sub || 0;
        this.logger.log(`[AI Tool] create_endpoints_bulk: ${dto.extensionsPattern} for tenant ${uid}`);
        const result = this.endpointsService.bulkCreate(dto, uid, userId);
        // audit log async
        Promise.resolve(result).then(r => {
            this.loggerService.logAction(userId, 'ai_tool', 'endpoint', null, uid,
                `bulk_create: pattern=${dto.extensionsPattern}`);
        }).catch(() => {});
        return result;
    }

    // ─── Tool: create_trunk ─────────────────────────────────────────────────────

    /**
     * POST /api/ai-tools/trunks
     * Create a new SIP trunk.
     *
     * Body: { name, trunkType: "auth"|"ip", host, username, password, context, codecs }
     */
    @ApiOperation({ summary: 'create_trunk — create a SIP trunk' })
    @Post('trunks')
    createTrunk(
        @Body() dto: CreateTrunkDto,
        @Req() req: Request & { user: any },
    ) {
        const uid = req.user.vpbx_user_uid;
        const userId = req.user.sub || 0;
        this.logger.log(`[AI Tool] create_trunk: "${dto.name}" for tenant ${uid}`);
        const result = this.trunksService.create(dto, uid, userId);
        Promise.resolve(result).then(() => {
            this.loggerService.logAction(userId, 'ai_tool', 'trunk', null, uid,
                `create: name=${dto.name}`);
        }).catch(() => {});
        return result;
    }

    // ─── Tool: create_ivr ───────────────────────────────────────────────────────

    /**
     * POST /api/ai-tools/ivrs
     * Create a new IVR menu.
     *
     * Body: { name, description?, steps: [...] }
     */
    @ApiOperation({ summary: 'create_ivr — create an IVR menu' })
    @Post('ivrs')
    createIvr(
        @Body() body: any,
        @Req() req: Request & { user: any },
    ) {
        const uid = req.user.vpbx_user_uid;
        const userId = req.user.sub || 0;
        this.logger.log(`[AI Tool] create_ivr: "${body.name}" for tenant ${uid}`);
        const result = this.ivrsService.create(body, uid);
        Promise.resolve(result).then((r: any) => {
            this.loggerService.logAction(userId, 'ai_tool', 'ivr', r?.uid || null, uid,
                `create: name=${body.name}`);
        }).catch(() => {});
        return result;
    }

    // ─── Tool: create_queue ─────────────────────────────────────────────────────

    /**
     * POST /api/ai-tools/queues
     * Create a new call queue.
     *
     * Body: { name, strategy, members: [{interface}], ... }
     */
    @ApiOperation({ summary: 'create_queue — create a call queue' })
    @Post('queues')
    createQueue(
        @Body() body: any,
        @Req() req: Request & { user: any },
    ) {
        const uid = req.user.vpbx_user_uid;
        const userId = req.user.sub || 0;
        this.logger.log(`[AI Tool] create_queue: "${body.name}" for tenant ${uid}`);
        const result = this.queuesService.create(body, uid);
        Promise.resolve(result).then(() => {
            this.loggerService.logAction(userId, 'ai_tool', 'queue', null, uid,
                `create: name=${body.name}`);
        }).catch(() => {});
        return result;
    }

    // ─── Tool: create_route ─────────────────────────────────────────────────────

    /**
     * POST /api/ai-tools/routes
     * Create a dialplan route.
     *
     * Body: { context_uid, pattern, app, appdata, priority?, ... }
     */
    @ApiOperation({ summary: 'create_route — create a dialplan route' })
    @Post('routes')
    async createRoute(
        @Body() body: any,
        @Req() req: Request & { user: any },
    ) {
        const uid = req.user.vpbx_user_uid;
        const userId = req.user.sub || 0;
        this.logger.log(`[AI Tool] create_route: pattern "${body.pattern}" for tenant ${uid}`);
        const result = await this.routesService.create(body, uid);
        this.loggerService.logAction(userId, 'ai_tool', 'route', (result as any)?.uid || null, uid,
            `create: pattern=${body.pattern} app=${body.app}`).catch(() => {});
        return result;
    }

    // ─── Tool: apply_dialplan ────────────────────────────────────────────────────

    /**
     * POST /api/ai-tools/dialplan/apply/:contextUid
     * Generate and apply dialplan for a context via AMI.
     * MUST be called after any route changes to make them live.
     */
    @ApiOperation({ summary: 'apply_dialplan — write and reload Asterisk dialplan for a context' })
    @Post('dialplan/apply/:contextUid')
    async applyDialplan(
        @Param('contextUid', ParseIntPipe) contextUid: number,
        @Req() req: Request & { user: any },
    ) {
        const uid = req.user.vpbx_user_uid;
        this.logger.log(`[AI Tool] apply_dialplan: context ${contextUid} for tenant ${uid}`);

        const context = await this.contextModel.findOne({
            where: { uid: contextUid, user_uid: uid },
        });
        if (!context) {
            return { success: false, error: `Context ${contextUid} not found` };
        }

        const includes = await this.contextIncludesService.getIncludeNames(contextUid, uid);
        const dialplan = await this.routesService.generateContextDialplan(
            contextUid, uid, context.name, includes, true,
        );

        const suffix = String(uid);
        const contextName = context.name.endsWith(suffix) ? context.name : `${context.name}${suffix}`;
        const filename = `krasterisk/routes/extensions_${contextName}.conf`;

        const lines = dialplan.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('[') && !l.startsWith(';'));

        // Delete existing category
        try {
            await this.amiService.action({
                action: 'UpdateConfig',
                srcfilename: filename,
                dstfilename: filename,
                'Action-000000': 'DelCat',
                'Cat-000000': contextName,
                reload: 'no',
            });
        } catch { /* expected if not exists */ }

        // Create category
        await this.amiService.action({
            action: 'UpdateConfig',
            srcfilename: filename,
            dstfilename: filename,
            reload: 'no',
            'Action-000000': 'NewCat',
            'Cat-000000': contextName,
        });

        // Write lines in batches of 20
        const BATCH = 20;
        for (let i = 0; i < lines.length; i += BATCH) {
            const batch = lines.slice(i, i + BATCH);
            const batchAction: Record<string, string> = {
                action: 'UpdateConfig',
                srcfilename: filename,
                dstfilename: filename,
                reload: 'no',
            };
            batch.forEach((line, idx) => {
                const pad = String(idx).padStart(6, '0');
                batchAction[`Action-${pad}`] = 'Append';
                batchAction[`Cat-${pad}`] = contextName;
                const arrowPos = line.indexOf('=>');
                if (arrowPos !== -1) {
                    batchAction[`Var-${pad}`] = line.substring(0, arrowPos).trim();
                    batchAction[`Value-${pad}`] = `> ${line.substring(arrowPos + 2).trim()}`;
                } else {
                    const eqPos = line.indexOf('=');
                    if (eqPos !== -1) {
                        batchAction[`Var-${pad}`] = line.substring(0, eqPos).trim();
                        batchAction[`Value-${pad}`] = line.substring(eqPos + 1).trim();
                    } else {
                        batchAction[`Var-${pad}`] = line;
                        batchAction[`Value-${pad}`] = '';
                    }
                }
            });
            await this.amiService.action(batchAction);
        }

        await this.amiService.command('dialplan reload');

        this.logger.log(`[AI Tool] Dialplan applied: [${contextName}] ${lines.length} lines`);
        return { success: true, context: contextName, linesApplied: lines.length };
    }
}
