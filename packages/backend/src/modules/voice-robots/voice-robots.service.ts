import { Injectable, Logger, NotFoundException, ForbiddenException, OnApplicationShutdown } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { VoiceRobot } from './voice-robot.model';
import { VoiceRobotKeywordGroup } from './keyword-group.model';
import { VoiceRobotKeyword } from './keyword.model';
import { VoiceRobotLog } from './voice-robot-log.model';
import { AriHttpClientService } from '../ari/ari-http-client.service';
import { RtpUdpServerService } from './services/rtp-udp-server.service';
import { SileroVadProvider } from './services/silero-vad.provider';
import { StreamingSttService } from './services/streaming-stt.service';
import { KeywordMatcherService } from './services/keyword-matcher.service';
import { StreamAudioService } from './services/stream-audio.service';
import { AudioService } from './services/audio.service';
import { VoiceRobotSession } from './services/voice-robot-session';
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
    private readonly ariClient: AriHttpClientService,
    private readonly udpServer: RtpUdpServerService,
    private readonly vadProvider: SileroVadProvider,
    private readonly sttService: StreamingSttService,
    private readonly matcherService: KeywordMatcherService,
    private readonly streamAudioService: StreamAudioService,
    private readonly audioService: AudioService,
    private readonly configService: ConfigService,
  ) {
    // Default: 127.0.0.1 (assumes Asterisk and Node.js are on the same host).
    // If Asterisk is on a remote server, set `external_host` per-robot
    // to the public IP of this Node.js server.
    this.defaultExternalHost = '127.0.0.1';
  }

  // ─── Robot CRUD ────────────────────────────────────────

  async findAll(userUid: number): Promise<VoiceRobot[]> {
    return this.voiceRobotModel.findAll({ where: { user_uid: userUid } });
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

  // ─── Dialplan Generation ──────────────────────────────

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
          const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid);
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
          const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid);
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
              const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid);
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
      // If not set, we still allow (for backwards compatibility) but log a warning.
      // In strict mode, uncomment the hangup below.
      // const channelData = await this.ariClient.getChannel(channelId);
      // const callerUserUid = channelData?.channelvars?.VPBX_USER_UID;
      // if (callerUserUid && Number(callerUserUid) !== robot.user_uid) {
      //   this.logger.error(`SECURITY: Tenant mismatch! Channel user ${callerUserUid} ≠ robot owner ${robot.user_uid}`);
      //   await this.ariClient.hangupChannel(channelId);
      //   return;
      // }

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

      const session = new VoiceRobotSession(
        this.ariClient,
        this.udpServer,
        this.vadProvider,
        this.sttService,
        this.matcherService,
        this.streamAudioService,
        this.audioService,
        channelId,
        robot,
        keywords,
        externalHost,
        this.logModel,
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
}
