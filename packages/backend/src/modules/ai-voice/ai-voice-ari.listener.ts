import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AriHttpClientService } from '../ari/ari-http-client.service';
import { resolveAiVoiceAriAppName } from '../ari/ari-event-classifier';
import { RobotConfigService } from './robot-config.service';

/**
 * Admits a channel that entered the AI-robot Stasis application.
 * The spoken conversation uses the same configuration as the text playground.
 * Until a media session is attached, the listener answers, records the outcome
 * and returns the channel to the dialplan so the route cannot skip the step silently.
 */
@Injectable()
export class AiVoiceAriListener {
  private readonly logger = new Logger(AiVoiceAriListener.name);
  private readonly active = new Set<string>();

  constructor(
    private readonly ari: AriHttpClientService,
    private readonly robots: RobotConfigService,
  ) {}

  @OnEvent('ari.StasisStart')
  async onStart(event: { application?: string; args?: string[]; channel?: { id?: string; name?: string; channelvars?: Record<string, string>; accountcode?: string } }): Promise<void> {
    if (event.application !== resolveAiVoiceAriAppName()) return;
    const name = event.channel?.name ?? '';
    if (name.startsWith('UnicastRTP') || name.startsWith('Snoop/')) return;
    const channelId = event.channel?.id;
    if (!channelId || this.active.has(channelId)) return;
    this.active.add(channelId);
    const arg = String(event.args?.[0] ?? '');
    const robotUid = arg.startsWith('robot:') ? Number(arg.slice('robot:'.length)) : 0;
    try {
      if (!Number.isSafeInteger(robotUid) || robotUid <= 0) throw new Error('missing_robot');
      const tenant = await this.resolveTenant(event, channelId);
      const robot = await this.robots.get(tenant, robotUid);
      if (!robot.config.enabled) throw new Error('disabled');
      await this.ari.answerChannel(channelId);
      await this.ari.setChannelVar(channelId, 'AI_ROBOT_UID', String(robot.uid));
      await this.ari.setChannelVar(channelId, 'AI_ROBOT_OUTCOME', 'completed');
      await this.ari.playMedia(channelId, 'beep').catch(() => undefined);
      await this.ari.continueInDialplan(channelId);
      this.logger.log(`AI robot ${robot.uid} admitted channel ${channelId}`);
    } catch (error) {
      this.logger.warn(`AI robot admission failed for ${channelId}: ${error instanceof Error ? error.message : 'error'}`);
      await this.ari.setChannelVar(channelId, 'AI_ROBOT_OUTCOME', 'failed').catch(() => undefined);
      await this.ari.continueInDialplan(channelId).catch(() => this.ari.hangupChannel(channelId).catch(() => undefined));
    } finally {
      this.active.delete(channelId);
    }
  }

  /**
   * ARI's StasisStart payload normally does not contain dialplan variables.
   * Never turn that omission into tenant 0: retrieve the inherited variable
   * explicitly and refuse admission if the channel cannot prove its owner.
   */
  private async resolveTenant(
    event: { channel?: { channelvars?: Record<string, string>; accountcode?: string } },
    channelId: string,
  ): Promise<number> {
    const explicit = parseTenant(event.channel?.channelvars?.VPBX_USER_UID ?? event.channel?.accountcode);
    if (explicit != null) return explicit;
    const inherited = parseTenant(await this.ari.getChannelVar(channelId, 'VPBX_USER_UID'));
    if (inherited == null) throw new Error('missing_tenant');
    return inherited;
  }
}

function parseTenant(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (String(value).trim() === '') return null;
  const tenant = Number(value);
  return Number.isSafeInteger(tenant) && tenant >= 0 ? tenant : null;
}
