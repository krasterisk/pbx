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
var VoiceRobotsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceRobotsService = void 0;
const common_1 = require("@nestjs/common");
const route_references_service_1 = require("../route-references/route-references.service");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const sequelize_2 = require("sequelize");
const voice_robot_cdr_query_1 = require("./voice-robot-cdr-query");
const voice_robot_model_1 = require("./voice-robot.model");
const keyword_group_model_1 = require("./keyword-group.model");
const keyword_model_1 = require("./keyword.model");
const voice_robot_log_model_1 = require("./voice-robot-log.model");
const voice_robot_cdr_model_1 = require("./voice-robot-cdr.model");
const data_list_model_1 = require("./data-list.model");
const data_list_search_service_1 = require("./services/data-list-search.service");
const stt_engine_model_1 = require("../stt-engines/stt-engine.model");
const tts_engine_model_1 = require("../tts-engines/tts-engine.model");
const ari_http_client_service_1 = require("../ari/ari-http-client.service");
const rtp_udp_server_service_1 = require("./services/rtp-udp-server.service");
const silero_vad_provider_1 = require("./services/silero-vad.provider");
const streaming_stt_service_1 = require("./services/streaming-stt.service");
const keyword_matcher_service_1 = require("./services/keyword-matcher.service");
const slot_extractor_service_1 = require("./services/slot-extractor.service");
const stream_audio_service_1 = require("./services/stream-audio.service");
const audio_service_1 = require("./services/audio.service");
const tts_cache_service_1 = require("./services/tts-cache.service");
const voice_robot_session_1 = require("./services/voice-robot-session");
const provider_factory_1 = require("./providers/provider-factory");
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
let VoiceRobotsService = VoiceRobotsService_1 = class VoiceRobotsService {
    voiceRobotModel;
    groupModel;
    keywordModel;
    logModel;
    cdrModel;
    dataListModel;
    sttEngineModel;
    ttsEngineModel;
    ariClient;
    udpServer;
    vadProvider;
    sttService;
    matcherService;
    streamAudioService;
    audioService;
    configService;
    sttProviderFactory;
    ttsProviderFactory;
    slotExtractorService;
    ttsCacheService;
    dataListSearchService;
    routeReferencesService;
    logger = new common_1.Logger(VoiceRobotsService_1.name);
    activeSessions = new Map();
    defaultExternalHost;
    constructor(voiceRobotModel, groupModel, keywordModel, logModel, cdrModel, dataListModel, sttEngineModel, ttsEngineModel, ariClient, udpServer, vadProvider, sttService, matcherService, streamAudioService, audioService, configService, sttProviderFactory, ttsProviderFactory, slotExtractorService, ttsCacheService, dataListSearchService, routeReferencesService) {
        this.voiceRobotModel = voiceRobotModel;
        this.groupModel = groupModel;
        this.keywordModel = keywordModel;
        this.logModel = logModel;
        this.cdrModel = cdrModel;
        this.dataListModel = dataListModel;
        this.sttEngineModel = sttEngineModel;
        this.ttsEngineModel = ttsEngineModel;
        this.ariClient = ariClient;
        this.udpServer = udpServer;
        this.vadProvider = vadProvider;
        this.sttService = sttService;
        this.matcherService = matcherService;
        this.streamAudioService = streamAudioService;
        this.audioService = audioService;
        this.configService = configService;
        this.sttProviderFactory = sttProviderFactory;
        this.ttsProviderFactory = ttsProviderFactory;
        this.slotExtractorService = slotExtractorService;
        this.ttsCacheService = ttsCacheService;
        this.dataListSearchService = dataListSearchService;
        this.routeReferencesService = routeReferencesService;
        // Default: 127.0.0.1 (assumes Asterisk and Node.js are on the same host).
        // If Asterisk is on a remote server, set `external_host` per-robot
        // to the public IP of this Node.js server.
        this.defaultExternalHost = this.configService.get('EXTERNAL_RTP_HOST', '127.0.0.1');
    }
    /**
     * Preload all data list embeddings at service startup.
     * Runs in background — doesn't block app initialization.
     */
    async onModuleInit() {
        // Run in background to not delay server start
        this.preloadAllDataListEmbeddings().catch(e => this.logger.warn(`[DataListSearch] Startup preload failed: ${e.message}`));
    }
    /**
     * Preload embeddings for ALL data lists across all robots.
     * Called once at startup. Cache is invalidated on update/delete.
     */
    async preloadAllDataListEmbeddings() {
        const lists = await this.dataListModel.findAll();
        if (lists.length === 0)
            return;
        const startTime = Date.now();
        let preloaded = 0;
        for (const list of lists) {
            if (list.rows && list.rows.length > 0) {
                await this.dataListSearchService.preloadList(list);
                preloaded++;
            }
        }
        const elapsed = Date.now() - startTime;
        this.logger.log(`[DataListSearch] Startup preload complete: ${preloaded} lists (${lists.reduce((s, l) => s + (l.rows?.length || 0), 0)} total rows) in ${elapsed}ms`);
    }
    // ─── Robot CRUD ────────────────────────────────────────
    async findAll(userUid) {
        return this.voiceRobotModel.findAll({ where: { user_uid: userUid } });
    }
    async findOne(userUid, uid) {
        const robot = await this.voiceRobotModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!robot)
            throw new common_1.NotFoundException(`Robot ${uid} not found`);
        return robot;
    }
    async createRobot(userUid, data) {
        return this.voiceRobotModel.create({
            ...data,
            user_uid: userUid,
        });
    }
    async updateRobot(userUid, uid, data) {
        const robot = await this.voiceRobotModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!robot)
            throw new common_1.NotFoundException(`Robot ${uid} not found`);
        // Prevent overriding user_uid
        delete data.user_uid;
        await robot.update(data);
        return robot;
    }
    async deleteRobot(userUid, uid) {
        const robot = await this.voiceRobotModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!robot)
            throw new common_1.NotFoundException(`Robot ${uid} not found`);
        await this.routeReferencesService.assertNotReferenced('voicerobot', uid, userUid, 'Voice robot is referenced and cannot be deleted');
        await robot.destroy();
    }
    async remove(uid, userUid) {
        return this.deleteRobot(userUid, uid);
    }
    // ─── Keyword Groups CRUD ──────────────────────────────
    async getKeywordGroups(userUid, robotId) {
        // Verify robot belongs to tenant
        await this.assertRobotOwnership(robotId, userUid);
        return this.groupModel.findAll({ where: { robot_id: robotId, user_uid: userUid } });
    }
    async createKeywordGroup(userUid, robotId, data) {
        await this.assertRobotOwnership(robotId, userUid);
        return this.groupModel.create({
            ...data,
            active: data.active === undefined ? 1 : (data.active ? 1 : 0),
            robot_id: robotId,
            user_uid: userUid,
        });
    }
    async updateKeywordGroup(userUid, id, data) {
        const group = await this.groupModel.findOne({
            where: { uid: id, user_uid: userUid },
        });
        if (!group)
            throw new common_1.NotFoundException(`Keyword group ${id} not found`);
        delete data.user_uid;
        await group.update(data);
        return group;
    }
    async deleteKeywordGroup(userUid, id) {
        const group = await this.groupModel.findOne({
            where: { uid: id, user_uid: userUid },
        });
        if (!group)
            throw new common_1.NotFoundException(`Keyword group ${id} not found`);
        await group.destroy();
    }
    // ─── Keywords CRUD ────────────────────────────────────
    async getKeywords(userUid, groupId) {
        await this.assertGroupOwnership(groupId, userUid);
        return this.keywordModel.findAll({ where: { group_id: groupId, user_uid: userUid } });
    }
    async createKeyword(userUid, groupId, data) {
        await this.assertGroupOwnership(groupId, userUid);
        return this.keywordModel.create({
            ...data,
            group_id: groupId,
            user_uid: userUid,
        });
    }
    async updateKeyword(userUid, uid, data) {
        const keyword = await this.keywordModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!keyword)
            throw new common_1.NotFoundException(`Keyword ${uid} not found`);
        delete data.user_uid;
        await keyword.update(data);
        return keyword;
    }
    async deleteKeyword(userUid, uid) {
        const keyword = await this.keywordModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!keyword)
            throw new common_1.NotFoundException(`Keyword ${uid} not found`);
        await keyword.destroy();
    }
    // ─── Logs ─────────────────────────────────────────────
    async getLogs(userUid, robotId) {
        await this.assertRobotOwnership(robotId, userUid);
        return this.logModel.findAll({
            where: { robot_id: robotId, user_uid: userUid },
            order: [['timestamp', 'DESC']],
            limit: 500,
        });
    }
    // ─── CDR (Call Detail Records) ─────────────────────────
    /** List CDR records with pagination and filters */
    async findAllCdr(userUid, options) {
        const where = { user_uid: userUid };
        if (options?.robotId)
            where.robot_id = options.robotId;
        if (options?.disposition)
            where.disposition = options.disposition;
        if (options?.callerId)
            where.caller_id = { [sequelize_2.Op.like]: (0, voice_robot_cdr_query_1.literalLikePattern)(options.callerId) };
        // Date range filter
        if (options?.dateFrom || options?.dateTo) {
            where.started_at = {};
            if (options?.dateFrom)
                where.started_at[sequelize_2.Op.gte] = new Date(options.dateFrom);
            if (options?.dateTo)
                where.started_at[sequelize_2.Op.lte] = new Date(options.dateTo);
        }
        const lastTag = (0, voice_robot_cdr_query_1.lastVoiceRobotTagSql)(this.cdrModel.sequelize.getDialect());
        // Tag filter — match only the LAST string tag (consistent with UI display).
        if (options?.tag) {
            where[sequelize_2.Op.and] = [
                ...(where[sequelize_2.Op.and] || []),
                (0, sequelize_2.where)((0, sequelize_2.literal)(lastTag), { [sequelize_2.Op.eq]: options.tag }),
            ];
        }
        // Full-text search across multiple fields (search in last tag only)
        if (options?.search) {
            const searchTerm = (0, voice_robot_cdr_query_1.literalLikePattern)(options.search);
            where[sequelize_2.Op.or] = [
                { caller_id: { [sequelize_2.Op.like]: searchTerm } },
                { caller_name: { [sequelize_2.Op.like]: searchTerm } },
                { call_uniqueid: { [sequelize_2.Op.like]: searchTerm } },
                { robot_name: { [sequelize_2.Op.like]: searchTerm } },
                { transcript: { [sequelize_2.Op.like]: searchTerm } },
                { transfer_target: { [sequelize_2.Op.like]: searchTerm } },
                (0, sequelize_2.where)((0, sequelize_2.literal)(lastTag), { [sequelize_2.Op.like]: searchTerm }),
            ];
        }
        return this.cdrModel.findAndCountAll({
            where,
            order: [['started_at', 'DESC'], ['uid', 'DESC']],
            limit: options?.limit || 50,
            offset: options?.offset || 0,
        });
    }
    /** Get distinct LAST tags from all CDR records for a tenant (for filter dropdown) */
    async getDistinctTags(userUid) {
        const lastTag = (0, voice_robot_cdr_query_1.lastVoiceRobotTagSql)(this.cdrModel.sequelize.getDialect());
        const results = await this.cdrModel.sequelize.query(`SELECT DISTINCT ${lastTag} AS tag_value FROM voice_robot_cdr
       WHERE user_uid = :userUid AND ${lastTag} IS NOT NULL AND ${lastTag} <> ''`, { replacements: { userUid }, type: sequelize_2.QueryTypes.SELECT });
        return results.map(row => row.tag_value).sort();
    }
    /** Get single CDR record */
    async findOneCdr(userUid, uid) {
        return this.cdrModel.findOne({ where: { uid, user_uid: userUid } });
    }
    /** Get CDR with linked step logs (detail view) */
    async getCdrWithLogs(userUid, uid) {
        const cdr = await this.cdrModel.findOne({ where: { uid, user_uid: userUid } });
        if (!cdr)
            return null;
        // Find all step logs for this call by session_id (most reliable) or call_uniqueid
        const logWhere = { user_uid: userUid };
        if (cdr.session_id) {
            logWhere.session_id = cdr.session_id;
        }
        else if (cdr.call_uniqueid) {
            logWhere.call_uniqueid = cdr.call_uniqueid;
        }
        else {
            return { cdr, logs: [] };
        }
        const logs = await this.logModel.findAll({
            where: logWhere,
            order: [['step_number', 'ASC']],
            raw: true,
        });
        // Resolve group and keyword names
        const mappedLogs = await Promise.all(logs.map(async (log) => {
            let groupName = null;
            let keywordName = null;
            if (log.matched_group_id) {
                const group = await this.groupModel.findByPk(log.matched_group_id, { attributes: ['name'] });
                if (group)
                    groupName = group.name;
            }
            if (log.matched_keyword_id) {
                const keyword = await this.keywordModel.findByPk(log.matched_keyword_id, { attributes: ['keywords', 'comment'] });
                if (keyword)
                    keywordName = keyword.comment || keyword.keywords;
            }
            return {
                ...log,
                matched_group_name: groupName,
                matched_keyword_name: keywordName,
            };
        }));
        return { cdr, logs: mappedLogs };
    }
    /** CDR statistics (disposition breakdown + totals) */
    async getCdrStats(userUid, robotId) {
        const where = { user_uid: userUid };
        if (robotId)
            where.robot_id = robotId;
        // Disposition counts
        const dispositionRows = await this.cdrModel.findAll({
            where,
            attributes: [
                'disposition',
                [this.cdrModel.sequelize.fn('COUNT', '*'), 'count'],
            ],
            group: ['disposition'],
            raw: true,
        });
        const byDisposition = {};
        let totalCalls = 0;
        for (const row of dispositionRows) {
            const count = parseInt(row.count, 10);
            byDisposition[row.disposition] = count;
            totalCalls += count;
        }
        // Averages
        const avgResult = await this.cdrModel.findOne({
            where,
            attributes: [
                [this.cdrModel.sequelize.fn('AVG', this.cdrModel.sequelize.col('duration_seconds')), 'avgDuration'],
                [this.cdrModel.sequelize.fn('AVG', this.cdrModel.sequelize.col('total_steps')), 'avgSteps'],
            ],
            raw: true,
        });
        return {
            byDisposition,
            totalCalls,
            avgDuration: Math.round(avgResult?.avgDuration || 0),
            avgSteps: Math.round((avgResult?.avgSteps || 0) * 10) / 10,
        };
    }
    /**
     * Generate Asterisk dialplan contexts for all voice robots of a tenant.
     * Creates Stasis entry points, fallback/max-retries handlers, and keyword contexts.
     */
    async generateAllVoiceRobotContexts(vpbxUserUid) {
        const robots = await this.voiceRobotModel.findAll({
            where: { user_uid: vpbxUserUid, active: 1 },
        });
        if (!robots.length)
            return '';
        const lines = [];
        for (const robot of robots) {
            lines.push(`; ===== Voice Robot: ${robot.name} (UID: ${robot.uid}) =====`);
            lines.push(`[voicerobot_${robot.uid}]`);
            lines.push(`exten => s,1,NoOp(Starting Voice Robot: ${robot.name})`);
            lines.push(`same => n,Stasis(${this.ariClient.getAppName()}, ${robot.uid})`);
            lines.push(`same => n,GotoIf($["\${ROBOT_STATUS}" = "SUCCESS"]?end_robot)`);
            // Max retries handler
            lines.push(`same => n,GotoIf($["\${ROBOT_STATUS}" = "MAX_RETRIES"]?max_retries)`);
            lines.push(`same => n,GotoIf($["\${ROBOT_STATUS}" = "MAX_DURATION"]?max_retries)`);
            // Default fallback
            lines.push(`same => n,Gosub(voicerobot_fallback_${robot.uid},s,1)`);
            lines.push(`same => n(end_robot),Return()`);
            // Max retries action (separate from fallback)
            lines.push(`same => n(max_retries),NoOp(Max retries for ${robot.name})`);
            if (robot.max_retries_action && Array.isArray(robot.max_retries_action)) {
                const dp = (0, dialplan_util_1.renderActionChain)(robot.max_retries_action, { vpbxUserUid, host: 'robot' });
                if (dp)
                    lines.push((0, dialplan_util_1.prefixSamePriority)(dp));
            }
            lines.push(`same => n,Return()`);
            lines.push('');
            // Fallback context
            lines.push(`[voicerobot_fallback_${robot.uid}]`);
            lines.push(`exten => s,1,NoOp(Fallback for Robot: ${robot.name})`);
            if (robot.fallback_action && Array.isArray(robot.fallback_action)) {
                const dp = (0, dialplan_util_1.renderActionChain)(robot.fallback_action, { vpbxUserUid, host: 'robot' });
                if (dp)
                    lines.push((0, dialplan_util_1.prefixSamePriority)(dp));
            }
            lines.push(`same => n,Return()`);
            lines.push('');
            // Keyword intent contexts
            const keywordGroups = await this.groupModel.findAll({
                where: { robot_id: robot.uid, active: 1 },
            });
            const groupIds = keywordGroups.map((g) => g.uid);
            if (groupIds.length) {
                const keywords = await this.keywordModel.findAll({
                    where: { group_id: groupIds },
                });
                for (const keyword of keywords) {
                    lines.push(`[voicerobot_keyword_${keyword.uid}]`);
                    lines.push(`exten => s,1,NoOp(Robot Keyword Match: ${keyword.keywords})`);
                    if (keyword.actions && Array.isArray(keyword.actions)) {
                        const dp = (0, dialplan_util_1.renderActionChain)(keyword.actions, { vpbxUserUid, host: 'robot' });
                        if (dp)
                            lines.push((0, dialplan_util_1.prefixSamePriority)(dp));
                    }
                    lines.push(`same => n,Return()`);
                    lines.push('');
                }
            }
        }
        return lines.join('\n');
    }
    // ─── ARI Event Handlers ───────────────────────────────
    /**
     * Handle StasisStart: create and start a Voice Robot session.
     * CRITICAL: Validates tenant ownership (user_uid) to prevent cross-tenant execution.
     */
    async handleStasisStart(event) {
        // Only handle events for our app
        if (event.application !== this.ariClient.getAppName())
            return;
        // Autodial deliberately uses the same ARI application so its originator
        // can receive answer-state events. It does not carry a robot UID: treating
        // it as a malformed voice-robot session would hang up an answered campaign
        // call before AutodialOriginatorService can continue it into its scenario.
        if (event.channel?.id?.startsWith('ac-'))
            return;
        // Ignore second-leg channels (UnicastRTP/Snoop)
        if (event.channel?.name?.startsWith('UnicastRTP/'))
            return;
        if (event.channel?.name?.startsWith('Snoop/'))
            return;
        const robotUid = Number(event.args?.[0]);
        const channelId = event.channel?.id;
        if (!robotUid || !channelId) {
            this.logger.error(`StasisStart: missing robotUid or channelId`);
            if (channelId)
                await this.ariClient.hangupChannel(channelId).catch(() => { });
            return;
        }
        // Prevent duplicate sessions
        if (this.activeSessions.has(channelId)) {
            this.logger.warn(`Session already exists for channel ${channelId}`);
            return;
        }
        try {
            const robot = await this.voiceRobotModel.findByPk(robotUid);
            if (!robot || robot.active !== 1) {
                this.logger.warn(`Robot ${robotUid} not found or inactive. Hanging up.`);
                await this.ariClient.hangupChannel(channelId);
                return;
            }
            // 🔐 TENANT ISOLATION: Verify the robot belongs to the calling tenant.
            // The channel variable VPBX_USER_UID is set by the dialplan before Stasis().
            try {
                const channelData = await this.ariClient.getChannel(channelId);
                const callerUserUid = channelData?.channelvars?.VPBX_USER_UID;
                if (callerUserUid && Number(callerUserUid) !== robot.user_uid) {
                    this.logger.error(`SECURITY: Tenant mismatch! Channel user ${callerUserUid} ≠ robot owner ${robot.user_uid}`);
                    await this.ariClient.hangupChannel(channelId);
                    return;
                }
                if (!callerUserUid) {
                    this.logger.warn(`SECURITY: VPBX_USER_UID not set on channel ${channelId}. Allowing for backwards compatibility.`);
                }
            }
            catch (e) {
                this.logger.warn(`Could not verify tenant isolation for ${channelId}: ${e.message}`);
            }
            // Pre-fetch all active keywords for this robot
            const keywordGroups = await this.groupModel.findAll({
                where: { robot_id: robotUid, active: 1 },
            });
            const groupIds = keywordGroups.map((g) => g.uid);
            const keywords = groupIds.length
                ? await this.keywordModel.findAll({ where: { group_id: groupIds } })
                : [];
            // Per-robot external host, fallback to ARI_HOST
            const externalHost = robot.external_host || this.defaultExternalHost;
            // Resolve TTS engine (if configured)
            let ttsEngine = null;
            if (robot.tts_engine_id) {
                ttsEngine = await this.ttsEngineModel.findByPk(robot.tts_engine_id);
                if (!ttsEngine) {
                    this.logger.warn(`TTS engine ${robot.tts_engine_id} not found for robot ${robot.name}`);
                }
            }
            // Run cache eviction for this robot's settings
            if (robot.tts_cache_max_age_days > 0) {
                this.ttsCacheService.evict(robot.tts_cache_max_age_days);
            }
            // Resolve STT engine (if configured)
            let sttEngine = null;
            if (robot.stt_engine_id) {
                sttEngine = await this.sttEngineModel.findByPk(robot.stt_engine_id);
                if (!sttEngine) {
                    this.logger.warn(`STT engine ${robot.stt_engine_id} not found for robot ${robot.name}`);
                }
            }
            // Extract caller info from ARI channel event
            const callerInfo = {
                callerId: event.channel?.caller?.number || null,
                callerName: event.channel?.caller?.name || null,
                callUniqueId: event.channel?.accountcode || event.channel?.id || null,
            };
            this.logger.log(`Caller: ${callerInfo.callerId || 'unknown'} (${callerInfo.callerName || ''})`);
            // Pre-fetch data lists for this robot (used by search_data_list action)
            const dataLists = await this.dataListModel.findAll({
                where: { robot_id: robotUid, user_uid: robot.user_uid },
            });
            const session = new voice_robot_session_1.VoiceRobotSession(this.ariClient, this.udpServer, this.vadProvider, this.sttService, this.matcherService, this.slotExtractorService, this.streamAudioService, this.audioService, this.ttsProviderFactory, this.ttsCacheService, ttsEngine, this.sttProviderFactory, sttEngine, channelId, robot, keywords, keywordGroups, externalHost, this.logModel, this.cdrModel, callerInfo, this.dataListSearchService, dataLists);
            this.activeSessions.set(channelId, session);
            await session.start();
            this.logger.log(`Voice Robot session started for channel ${channelId} (robot: ${robot.name})`);
        }
        catch (e) {
            this.logger.error(`Failed to start session for ${channelId}: ${e.message}`, e.stack);
            this.ariClient.hangupChannel(channelId).catch(() => { });
        }
    }
    /**
     * Handle ChannelVarset for UNICASTRTP params — route to the correct session.
     */
    handleExternalMediaRtpReady(event) {
        const { parentChannelId, variable, value } = event;
        const session = this.activeSessions.get(parentChannelId);
        if (session) {
            session.updateRtpParams(variable, value);
        }
    }
    /**
     * Handle StasisEnd: cleanup session.
     */
    handleStasisEnd(event) {
        const channelId = event.channel?.id;
        if (!channelId)
            return;
        const session = this.activeSessions.get(channelId);
        if (session) {
            // Don't blindly override disposition — resolveDisposition() will determine
            // the true outcome based on session data (lastActionType, dialogueContext, etc.).
            // setDisposition() is only for explicit statuses set DURING the session
            // (error, timeout, max_steps), not at cleanup time.
            session.cleanup();
            this.activeSessions.delete(channelId);
            this.logger.log(`Session cleaned up for channel ${channelId}`);
        }
    }
    // ─── Helpers ──────────────────────────────────────────
    async assertRobotOwnership(robotId, userUid) {
        const robot = await this.voiceRobotModel.findOne({
            where: { uid: robotId, user_uid: userUid },
        });
        if (!robot)
            throw new common_1.NotFoundException(`Robot ${robotId} not found`);
    }
    async assertGroupOwnership(groupId, userUid) {
        const group = await this.groupModel.findOne({
            where: { uid: groupId, user_uid: userUid },
        });
        if (!group)
            throw new common_1.NotFoundException(`Keyword group ${groupId} not found`);
    }
    /**
     * Graceful shutdown — cleanup all active sessions.
     */
    onApplicationShutdown() {
        this.logger.log(`Shutting down ${this.activeSessions.size} active Voice Robot sessions...`);
        for (const [channelId, session] of this.activeSessions) {
            session.cleanup();
        }
        this.activeSessions.clear();
    }
    // ─── Data Lists CRUD ───────────────────────────────────
    async getDataLists(userUid, robotId) {
        await this.assertRobotOwnership(robotId, userUid);
        return this.dataListModel.findAll({
            where: { robot_id: robotId, user_uid: userUid },
            order: [['created_at', 'ASC']],
        });
    }
    async getDataList(userUid, uid) {
        const list = await this.dataListModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!list)
            throw new common_1.NotFoundException(`Data list ${uid} not found`);
        return list;
    }
    async createDataList(userUid, robotId, data) {
        await this.assertRobotOwnership(robotId, userUid);
        return this.dataListModel.create({
            ...data,
            robot_id: robotId,
            user_uid: userUid,
        });
    }
    async updateDataList(userUid, uid, data) {
        const list = await this.dataListModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!list)
            throw new common_1.NotFoundException(`Data list ${uid} not found`);
        delete data.user_uid;
        await list.update(data);
        // Invalidate embedding cache and re-preload in background
        this.dataListSearchService.clearListCache(uid);
        this.dataListSearchService.preloadList(list).catch(e => this.logger.warn(`[DataListSearch] Re-preload after update failed: ${e.message}`));
        return list;
    }
    async deleteDataList(userUid, uid) {
        const list = await this.dataListModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!list)
            throw new common_1.NotFoundException(`Data list ${uid} not found`);
        this.dataListSearchService.clearListCache(uid);
        await list.destroy();
    }
    /**
     * Test search against a data list (for frontend debugging).
     */
    async testDataListSearch(userUid, listId, query, returnField) {
        const list = await this.getDataList(userUid, listId);
        await this.dataListSearchService.preloadList(list);
        const startTime = Date.now();
        const result = await this.dataListSearchService.search(query, list, returnField);
        const elapsedMs = Date.now() - startTime;
        return {
            input_query: query,
            return_field: returnField,
            result: result ? {
                value: result.value,
                row: result.row,
                rowIndex: result.rowIndex,
                confidence: Number(result.confidence.toFixed(4)),
                method: result.method,
            } : null,
            total_rows: list.rows?.length || 0,
            elapsed_ms: elapsedMs,
        };
    }
    // ─── Test Match (Debugging) ────────────────────────────
    /**
     * Test keyword matching against a robot's keywords without making a real call.
     * Used by the frontend test panel.
     */
    async testMatch(userUid, robotId, text) {
        await this.assertRobotOwnership(robotId, userUid);
        // Load all keyword groups → keywords for this robot
        const groups = await this.groupModel.findAll({
            where: { robot_id: robotId, user_uid: userUid, active: true },
        });
        const allKeywords = [];
        for (const group of groups) {
            const keywords = await this.keywordModel.findAll({
                where: { group_id: group.uid, user_uid: userUid },
            });
            allKeywords.push(...keywords);
        }
        // Pre-cache embeddings for semantic matching
        await this.matcherService.preloadEmbeddings(allKeywords);
        // Run the hybrid matcher
        const startTime = Date.now();
        const match = await this.matcherService.match(text, allKeywords);
        const elapsedMs = Date.now() - startTime;
        return {
            input_text: text,
            match: match ? {
                keyword_uid: match.keyword.uid,
                keyword_text: match.keyword.keywords,
                matched_phrase: match.matchedPhrase,
                confidence: Number(match.confidence.toFixed(4)),
                method: match.method,
                matched_word_count: match.matchedWordCount,
                bot_action: match.keyword.bot_action || null,
            } : null,
            total_keywords: allKeywords.length,
            elapsed_ms: elapsedMs,
        };
    }
};
exports.VoiceRobotsService = VoiceRobotsService;
__decorate([
    (0, event_emitter_1.OnEvent)('ari.StasisStart'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsService.prototype, "handleStasisStart", null);
__decorate([
    (0, event_emitter_1.OnEvent)('ari.ExternalMediaRtpReady'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VoiceRobotsService.prototype, "handleExternalMediaRtpReady", null);
__decorate([
    (0, event_emitter_1.OnEvent)('ari.StasisEnd'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VoiceRobotsService.prototype, "handleStasisEnd", null);
exports.VoiceRobotsService = VoiceRobotsService = VoiceRobotsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(voice_robot_model_1.VoiceRobot)),
    __param(1, (0, sequelize_1.InjectModel)(keyword_group_model_1.VoiceRobotKeywordGroup)),
    __param(2, (0, sequelize_1.InjectModel)(keyword_model_1.VoiceRobotKeyword)),
    __param(3, (0, sequelize_1.InjectModel)(voice_robot_log_model_1.VoiceRobotLog)),
    __param(4, (0, sequelize_1.InjectModel)(voice_robot_cdr_model_1.VoiceRobotCdr)),
    __param(5, (0, sequelize_1.InjectModel)(data_list_model_1.VoiceRobotDataList)),
    __param(6, (0, sequelize_1.InjectModel)(stt_engine_model_1.SttEngine)),
    __param(7, (0, sequelize_1.InjectModel)(tts_engine_model_1.TtsEngine)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, ari_http_client_service_1.AriHttpClientService,
        rtp_udp_server_service_1.RtpUdpServerService,
        silero_vad_provider_1.SileroVadProvider,
        streaming_stt_service_1.StreamingSttService,
        keyword_matcher_service_1.KeywordMatcherService,
        stream_audio_service_1.StreamAudioService,
        audio_service_1.AudioService,
        config_1.ConfigService,
        provider_factory_1.SttProviderFactory,
        provider_factory_1.TtsProviderFactory,
        slot_extractor_service_1.SlotExtractorService,
        tts_cache_service_1.TtsCacheService,
        data_list_search_service_1.DataListSearchService,
        route_references_service_1.RouteReferencesService])
], VoiceRobotsService);
//# sourceMappingURL=voice-robots.service.js.map