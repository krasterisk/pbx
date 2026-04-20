import { Injectable, Logger, NotFoundException, ForbiddenException, OnApplicationShutdown } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Op } from 'sequelize';
import { VoiceRobot } from './voice-robot.model';
import { VoiceRobotKeywordGroup } from './keyword-group.model';
import { VoiceRobotKeyword } from './keyword.model';
import { VoiceRobotLog } from './voice-robot-log.model';
import { VoiceRobotCdr } from './voice-robot-cdr.model';
import { SttEngine } from '../stt-engines/stt-engine.model';
import { TtsEngine } from '../tts-engines/tts-engine.model';
import { AriHttpClientService } from '../ari/ari-http-client.service';
import { RtpUdpServerService } from './services/rtp-udp-server.service';
import { SileroVadProvider } from './services/silero-vad.provider';
import { StreamingSttService } from './services/streaming-stt.service';
import { KeywordMatcherService } from './services/keyword-matcher.service';
import { SlotExtractorService } from './services/slot-extractor.service';
import { StreamAudioService } from './services/stream-audio.service';
import { AudioService } from './services/audio.service';
import { TtsCacheService } from './services/tts-cache.service';
import { VoiceRobotSession, CallerInfo } from './services/voice-robot-session';
import { SttProviderFactory, TtsProviderFactory } from './providers/provider-factory';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';

@Injectable()
export class VoiceRobotsService implements OnApplicationShutdown {
  private readonly logger = new Logger(VoiceRobotsService.name);
  private readonly activeSessions = new Map<string, VoiceRobotSession>();
  private readonly defaultExternalHost: string;

  constructor(
    @InjectModel(VoiceRobot) private voiceRobotModel: typeof VoiceRobot,
    @InjectModel(VoiceRobotKeywordGroup) private groupModel: typeof VoiceRobotKeywordGroup,
    @InjectModel(VoiceRobotKeyword) private keywordModel: typeof VoiceRobotKeyword,
    @InjectModel(VoiceRobotLog) private logModel: typeof VoiceRobotLog,
    @InjectModel(VoiceRobotCdr) private cdrModel: typeof VoiceRobotCdr,
    @InjectModel(SttEngine) private sttEngineModel: typeof SttEngine,
    @InjectModel(TtsEngine) private ttsEngineModel: typeof TtsEngine,
    private readonly ariClient: AriHttpClientService,
    private readonly udpServer: RtpUdpServerService,
    private readonly vadProvider: SileroVadProvider,
    private readonly sttService: StreamingSttService,
    private readonly matcherService: KeywordMatcherService,
    private readonly streamAudioService: StreamAudioService,
    private readonly audioService: AudioService,
    private readonly configService: ConfigService,
    private readonly sttProviderFactory: SttProviderFactory,
    private readonly ttsProviderFactory: TtsProviderFactory,
    private readonly slotExtractorService: SlotExtractorService,
    private readonly ttsCacheService: TtsCacheService,
  ) {
    // Default: 127.0.0.1 (assumes Asterisk and Node.js are on the same host).
    // If Asterisk is on a remote server, set `external_host` per-robot
    // to the public IP of this Node.js server.
    this.defaultExternalHost = this.configService.get<string>('EXTERNAL_RTP_HOST', '127.0.0.1');
  }

  // ─── Robot CRUD ────────────────────────────────────────

  async findAll(userUid: number): Promise<VoiceRobot[]> {
    return this.voiceRobotModel.findAll({ where: { user_uid: userUid } });
  }

  async findOne(userUid: number, uid: number): Promise<VoiceRobot> {
    const robot = await this.voiceRobotModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!robot) throw new NotFoundException(`Robot ${uid} not found`);
    return robot;
  }

  async createRobot(userUid: number, data: Partial<VoiceRobot>): Promise<VoiceRobot> {
    return this.voiceRobotModel.create({
      ...data,
      user_uid: userUid,
    });
  }

  async updateRobot(userUid: number, uid: number, data: Partial<VoiceRobot>): Promise<VoiceRobot> {
    const robot = await this.voiceRobotModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!robot) throw new NotFoundException(`Robot ${uid} not found`);
    
    // Prevent overriding user_uid
    delete data.user_uid;
    await robot.update(data);
    return robot;
  }

  async deleteRobot(userUid: number, uid: number): Promise<void> {
    const robot = await this.voiceRobotModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!robot) throw new NotFoundException(`Robot ${uid} not found`);
    await robot.destroy();
  }

  // ─── Keyword Groups CRUD ──────────────────────────────

  async getKeywordGroups(userUid: number, robotId: number): Promise<VoiceRobotKeywordGroup[]> {
    // Verify robot belongs to tenant
    await this.assertRobotOwnership(robotId, userUid);
    return this.groupModel.findAll({ where: { robot_id: robotId, user_uid: userUid } });
  }

  async createKeywordGroup(
    userUid: number,
    robotId: number,
    data: Partial<VoiceRobotKeywordGroup>,
  ): Promise<VoiceRobotKeywordGroup> {
    await this.assertRobotOwnership(robotId, userUid);
    return this.groupModel.create({
      ...data,
      active: data.active === undefined ? 1 : (data.active ? 1 : 0),
      robot_id: robotId,
      user_uid: userUid,
    });
  }

  async updateKeywordGroup(
    userUid: number,
    id: number,
    data: Partial<VoiceRobotKeywordGroup>,
  ): Promise<VoiceRobotKeywordGroup> {
    const group = await this.groupModel.findOne({
      where: { uid: id, user_uid: userUid },
    });
    if (!group) throw new NotFoundException(`Keyword group ${id} not found`);
    
    delete data.user_uid;
    await group.update(data);
    return group;
  }

  async deleteKeywordGroup(userUid: number, id: number): Promise<void> {
    const group = await this.groupModel.findOne({
      where: { uid: id, user_uid: userUid },
    });
    if (!group) throw new NotFoundException(`Keyword group ${id} not found`);
    await group.destroy();
  }

  // ─── Keywords CRUD ────────────────────────────────────

  async getKeywords(userUid: number, groupId: number): Promise<VoiceRobotKeyword[]> {
    await this.assertGroupOwnership(groupId, userUid);
    return this.keywordModel.findAll({ where: { group_id: groupId, user_uid: userUid } });
  }

  async createKeyword(
    userUid: number,
    groupId: number,
    data: Partial<VoiceRobotKeyword>,
  ): Promise<VoiceRobotKeyword> {
    await this.assertGroupOwnership(groupId, userUid);
    return this.keywordModel.create({
      ...data,
      group_id: groupId,
      user_uid: userUid,
    });
  }

  async updateKeyword(
    userUid: number,
    uid: number,
    data: Partial<VoiceRobotKeyword>,
  ): Promise<VoiceRobotKeyword> {
    const keyword = await this.keywordModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!keyword) throw new NotFoundException(`Keyword ${uid} not found`);
    
    delete data.user_uid;
    await keyword.update(data);
    return keyword;
  }

  async deleteKeyword(userUid: number, uid: number): Promise<void> {
    const keyword = await this.keywordModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!keyword) throw new NotFoundException(`Keyword ${uid} not found`);
    await keyword.destroy();
  }

  // ─── Logs ─────────────────────────────────────────────

  async getLogs(userUid: number, robotId: number): Promise<VoiceRobotLog[]> {
    await this.assertRobotOwnership(robotId, userUid);
    return this.logModel.findAll({
      where: { robot_id: robotId, user_uid: userUid },
      order: [['timestamp', 'DESC']],
      limit: 500,
    });
  }

  // ─── CDR (Call Detail Records) ─────────────────────────

  /** List CDR records with pagination and filters */
  async findAllCdr(
    userUid: number,
    options?: {
      limit?: number;
      offset?: number;
      robotId?: number;
      disposition?: string;
      callerId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
  ): Promise<{ rows: VoiceRobotCdr[]; count: number }> {
    const where: any = { user_uid: userUid };

    if (options?.robotId) where.robot_id = options.robotId;
    if (options?.disposition) where.disposition = options.disposition;
    if (options?.callerId) where.caller_id = { [Op.like]: `%${options.callerId}%` };

    // Date range filter
    if (options?.dateFrom || options?.dateTo) {
      where.started_at = {};
      if (options?.dateFrom) where.started_at[Op.gte] = new Date(options.dateFrom);
      if (options?.dateTo) where.started_at[Op.lte] = new Date(options.dateTo);
    }

    // Full-text search across multiple fields
    if (options?.search) {
      where[Op.or] = [
        { caller_id: { [Op.like]: `%${options.search}%` } },
        { caller_name: { [Op.like]: `%${options.search}%` } },
        { call_uniqueid: { [Op.like]: `%${options.search}%` } },
        { robot_name: { [Op.like]: `%${options.search}%` } },
        { transcript: { [Op.like]: `%${options.search}%` } },
        { transfer_target: { [Op.like]: `%${options.search}%` } },
      ];
    }

    return this.cdrModel.findAndCountAll({
      where,
      order: [['started_at', 'DESC']],
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });
  }

  /** Get single CDR record */
  async findOneCdr(userUid: number, uid: number): Promise<VoiceRobotCdr | null> {
    return this.cdrModel.findOne({ where: { uid, user_uid: userUid } });
  }

  /** Get CDR with linked step logs (detail view) */
  async getCdrWithLogs(userUid: number, uid: number): Promise<{
    cdr: VoiceRobotCdr;
    logs: VoiceRobotLog[];
  } | null> {
    const cdr = await this.cdrModel.findOne({ where: { uid, user_uid: userUid } });
    if (!cdr) return null;

    // Find all step logs for this call by session_id (most reliable) or call_uniqueid
    const logWhere: any = { user_uid: userUid };
    if (cdr.session_id) {
      logWhere.session_id = cdr.session_id;
    } else if (cdr.call_uniqueid) {
      logWhere.call_uniqueid = cdr.call_uniqueid;
    } else {
      return { cdr, logs: [] };
    }

    const logs = await this.logModel.findAll({
      where: logWhere,
      order: [['step_number', 'ASC']],
      raw: true,
    });

    // Resolve group and keyword names
    const mappedLogs = await Promise.all(logs.map(async (log: any) => {
      let groupName = null;
      let keywordName = null;

      if (log.matched_group_id) {
        const group = await this.groupModel.findByPk(log.matched_group_id, { attributes: ['name'] });
        if (group) groupName = group.name;
      }

      if (log.matched_keyword_id) {
        const keyword = await this.keywordModel.findByPk(log.matched_keyword_id, { attributes: ['keywords', 'comment'] });
        if (keyword) keywordName = keyword.comment || keyword.keywords;
      }

      return {
        ...log,
        matched_group_name: groupName,
        matched_keyword_name: keywordName,
      };
    }));

    return { cdr, logs: mappedLogs as any };
  }

  /** CDR statistics (disposition breakdown + totals) */
  async getCdrStats(userUid: number, robotId?: number): Promise<{
    byDisposition: Record<string, number>;
    totalCalls: number;
    avgDuration: number;
    avgSteps: number;
  }> {
    const where: any = { user_uid: userUid };
    if (robotId) where.robot_id = robotId;

    // Disposition counts
    const dispositionRows = await this.cdrModel.findAll({
      where,
      attributes: [
        'disposition',
        [this.cdrModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      group: ['disposition'],
      raw: true,
    }) as any[];

    const byDisposition: Record<string, number> = {};
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
        [this.cdrModel.sequelize!.fn('AVG', this.cdrModel.sequelize!.col('duration_seconds')), 'avgDuration'],
        [this.cdrModel.sequelize!.fn('AVG', this.cdrModel.sequelize!.col('total_steps')), 'avgSteps'],
      ],
      raw: true,
    }) as any;

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
  async generateAllVoiceRobotContexts(vpbxUserUid: number): Promise<string> {
    const robots = await this.voiceRobotModel.findAll({
      where: { user_uid: vpbxUserUid, active: 1 },
    });
    if (!robots.length) return '';

    const lines: string[] = [];

    for (const robot of robots) {
      lines.push(`; ===== Voice Robot: ${robot.name} (UID: ${robot.uid}) =====`);
      lines.push(`[voicerobot_${robot.uid}]`);
      lines.push(`exten => s,1,NoOp(Starting Voice Robot: ${robot.name})`);
      lines.push(`same => n,Stasis(krasterisk_voicerobots, ${robot.uid})`);
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
        for (const action of robot.max_retries_action) {
          const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, false);
          if (dp) lines.push(`same => n,${dp}`);
        }
      }
      lines.push(`same => n,Return()`);
      lines.push('');

      // Fallback context
      lines.push(`[voicerobot_fallback_${robot.uid}]`);
      lines.push(`exten => s,1,NoOp(Fallback for Robot: ${robot.name})`);
      if (robot.fallback_action && Array.isArray(robot.fallback_action)) {
        for (const action of robot.fallback_action) {
          const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, false);
          if (dp) lines.push(`same => n,${dp}`);
        }
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
            for (const action of keyword.actions) {
              const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, false);
              if (dp) lines.push(`same => n,${dp}`);
            }
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
  @OnEvent('ari.StasisStart')
  async handleStasisStart(event: any) {
    // Only handle events for our app
    if (event.application !== 'krasterisk_voicerobots') return;

    // Ignore second-leg channels (UnicastRTP/Snoop)
    if (event.channel?.name?.startsWith('UnicastRTP/')) return;
    if (event.channel?.name?.startsWith('Snoop/')) return;

    const robotUid = Number(event.args?.[0]);
    const channelId = event.channel?.id;

    if (!robotUid || !channelId) {
      this.logger.error(`StasisStart: missing robotUid or channelId`);
      if (channelId) await this.ariClient.hangupChannel(channelId).catch(() => {});
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
      } catch (e: any) {
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
      let ttsEngine: TtsEngine | null = null;
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
      let sttEngine: SttEngine | null = null;
      if (robot.stt_engine_id) {
        sttEngine = await this.sttEngineModel.findByPk(robot.stt_engine_id);
        if (!sttEngine) {
          this.logger.warn(`STT engine ${robot.stt_engine_id} not found for robot ${robot.name}`);
        }
      }

      // Extract caller info from ARI channel event
      const callerInfo: CallerInfo = {
        callerId: event.channel?.caller?.number || null,
        callerName: event.channel?.caller?.name || null,
        callUniqueId: event.channel?.accountcode || event.channel?.id || null,
      };
      this.logger.log(`Caller: ${callerInfo.callerId || 'unknown'} (${callerInfo.callerName || ''})`);

      const session = new VoiceRobotSession(
        this.ariClient,
        this.udpServer,
        this.vadProvider,
        this.sttService,
        this.matcherService,
        this.slotExtractorService,
        this.streamAudioService,
        this.audioService,
        this.ttsProviderFactory,
        this.ttsCacheService,
        ttsEngine,
        this.sttProviderFactory,
        sttEngine,
        channelId,
        robot,
        keywords,
        keywordGroups,
        externalHost,
        this.logModel,
        this.cdrModel,
        callerInfo,
      );

      this.activeSessions.set(channelId, session);
      await session.start();

      this.logger.log(`Voice Robot session started for channel ${channelId} (robot: ${robot.name})`);

    } catch (e: any) {
      this.logger.error(`Failed to start session for ${channelId}: ${e.message}`, e.stack);
      this.ariClient.hangupChannel(channelId).catch(() => {});
    }
  }

  /**
   * Handle ChannelVarset for UNICASTRTP params — route to the correct session.
   */
  @OnEvent('ari.ExternalMediaRtpReady')
  handleExternalMediaRtpReady(event: any) {
    const { parentChannelId, variable, value } = event;
    const session = this.activeSessions.get(parentChannelId);
    if (session) {
      session.updateRtpParams(variable, value);
    }
  }

  /**
   * Handle StasisEnd: cleanup session.
   */
  @OnEvent('ari.StasisEnd')
  handleStasisEnd(event: any) {
    const channelId = event.channel?.id;
    if (!channelId) return;

    const session = this.activeSessions.get(channelId);
    if (session) {
      // If cleanup hasn't been triggered by a robot action (transfer/hangup),
      // then StasisEnd means the caller hung up
      session.setDisposition('caller_hangup');
      session.cleanup();
      this.activeSessions.delete(channelId);
      this.logger.log(`Session cleaned up for channel ${channelId}`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  private async assertRobotOwnership(robotId: number, userUid: number): Promise<void> {
    const robot = await this.voiceRobotModel.findOne({
      where: { uid: robotId, user_uid: userUid },
    });
    if (!robot) throw new NotFoundException(`Robot ${robotId} not found`);
  }

  private async assertGroupOwnership(groupId: number, userUid: number): Promise<void> {
    const group = await this.groupModel.findOne({
      where: { uid: groupId, user_uid: userUid },
    });
    if (!group) throw new NotFoundException(`Keyword group ${groupId} not found`);
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

  // ─── Test Match (Debugging) ────────────────────────────

  /**
   * Test keyword matching against a robot's keywords without making a real call.
   * Used by the frontend test panel.
   */
  async testMatch(userUid: number, robotId: number, text: string) {
    await this.assertRobotOwnership(robotId, userUid);

    // Load all keyword groups → keywords for this robot
    const groups = await this.groupModel.findAll({
      where: { robot_id: robotId, user_uid: userUid, active: true },
    });

    const allKeywords: VoiceRobotKeyword[] = [];
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
}
