import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AriHttpClientService } from '../ari/ari-http-client.service';
import { RtpUdpServerService } from '../voice-robots/services/rtp-udp-server.service';
import { ModulesRegistryService } from '../cloud-admin/modules-registry.service';
import { CallCenterStateService } from './callcenter-state.service';

const CC_AI_VOICE_MODULE = 'cc_ai_voice';

interface PcmAttachment {
  port: number;
  externalChannelId: string;
  callUniqueid: string;
  vpbxUserUid: number;
  onPcm: (frame: Buffer) => void;
}

/**
 * CallCenterMediaBridgeService — ARI externalMedia PCM skeleton (D-41c).
 *
 * Reuses voice-robots RTP pipeline (RtpUdpServerService + AriHttpClientService.externalMedia)
 * and emits `media.pcmFrame` into the typed CC event bus. NO STT/VAD (D-42/D-44).
 *
 * Inert by design: never auto-subscribes to StasisStart — paid AI modules call
 * attachPcmSkeleton when licensed. License-gate via ModulesRegistryService (D-43).
 */
@Injectable()
export class CallCenterMediaBridgeService {
  private readonly logger = new Logger(CallCenterMediaBridgeService.name);
  private readonly attachments = new Map<string, PcmAttachment>();
  private readonly externalHost: string;

  constructor(
    private readonly ariClient: AriHttpClientService,
    private readonly udpServer: RtpUdpServerService,
    private readonly stateService: CallCenterStateService,
    private readonly modulesRegistry: ModulesRegistryService,
    private readonly configService: ConfigService,
  ) {
    this.externalHost = this.configService.get<string>('EXTERNAL_RTP_HOST', '127.0.0.1');
  }

  /**
   * Attach PCM skeleton to a live call channel.
   * No-ops when tenant lacks `cc_ai_voice` license (D-43).
   * Idempotent for the same channelId (re-attach detaches first).
   */
  async attachPcmSkeleton(
    channelId: string,
    callUniqueid: string,
    vpbxUserUid: number,
  ): Promise<{ attached: boolean; reason?: string }> {
    const licensed = await this.modulesRegistry.tenantHasModule(vpbxUserUid, CC_AI_VOICE_MODULE);
    if (!licensed) {
      this.logger.log(
        `attachPcmSkeleton no-op: tenant ${vpbxUserUid} lacks module ${CC_AI_VOICE_MODULE}`,
      );
      return { attached: false, reason: 'module_not_licensed' };
    }

    if (this.attachments.has(channelId)) {
      await this.detachPcmSkeleton(channelId);
    }

    // Format `alaw` matches RtpSession decode path (voice-robots); plan mentioned slin16
    // but existing RTP decoder always decodes A-law → PCM16.
    const session = await this.udpServer.createSession();
    const appName = this.ariClient.getAppName();

    const externalChannel = await this.ariClient.externalMedia(
      null,
      appName,
      `${this.externalHost}:${session.port}`,
      'alaw',
      channelId,
    );

    const onPcm = (frame: Buffer) => {
      this.stateService.emitEvent('media.pcmFrame', vpbxUserUid, {
        channelId,
        callUniqueid,
        frame,
      });
    };
    session.eventEmitter.on('audio-pcm16', onPcm);

    this.attachments.set(channelId, {
      port: session.port,
      externalChannelId: externalChannel.id,
      callUniqueid,
      vpbxUserUid,
      onPcm,
    });

    this.logger.log(
      `PCM skeleton attached: channel=${channelId} call=${callUniqueid} port=${session.port}`,
    );
    return { attached: true };
  }

  /**
   * Idempotent detach — closes RTP session and hangs up externalMedia channel.
   */
  async detachPcmSkeleton(channelId: string): Promise<void> {
    const attachment = this.attachments.get(channelId);
    if (!attachment) return;

    this.attachments.delete(channelId);

    try {
      this.udpServer.closeSession(attachment.port);
    } catch (e: any) {
      this.logger.warn(`closeSession(${attachment.port}) failed: ${e?.message || e}`);
    }

    try {
      await this.ariClient.hangupChannel(attachment.externalChannelId);
    } catch (e: any) {
      this.logger.warn(
        `hangup external ${attachment.externalChannelId} failed: ${e?.message || e}`,
      );
    }

    this.logger.log(`PCM skeleton detached: channel=${channelId}`);
  }
}

export { CC_AI_VOICE_MODULE };
