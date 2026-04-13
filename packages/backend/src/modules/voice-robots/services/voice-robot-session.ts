import { Logger } from '@nestjs/common';
import { AriHttpClientService, Channel, Bridge } from '../../ari/ari-http-client.service';
import { RtpUdpServerService, RtpSession } from './rtp-udp-server.service';
import { SileroVadProvider } from './silero-vad.provider';
import { KeywordMatcherService, MatchResult } from './keyword-matcher.service';
import { StreamingSttService } from './streaming-stt.service';
import { StreamAudioService } from './stream-audio.service';
import { AudioService } from './audio.service';
import { VoiceRobot } from '../voice-robot.model';
import { VoiceRobotKeyword } from '../keyword.model';
import { VoiceRobotLog } from '../voice-robot-log.model';
import { InjectModel } from '@nestjs/sequelize';

/**
 * Per-call Voice Robot session.
 *
 * Lifecycle:
 * 1. ARI StasisStart → new VoiceRobotSession()
 * 2. start() → answer → bridge → externalMedia → greeting → VAD loop
 * 3. VAD detects speech → STT → KeywordMatcher → route or retry
 * 4. ARI StasisEnd → cleanup()
 *
 * Production patterns ported from aiPBX:
 * - Bridge flow (createBridge → addChannel → externalMedia → addChannel)
 * - Pre-speech ring buffer (captures ~300ms before VAD trigger)
 * - Step counter with max_conversation_steps
 * - Max duration watchdog
 * - Barge-in via AbortController
 * - Idempotent cleanup (bridge destroy, external channel hangup)
 * - Two-phase RTP init (wait for ChannelVarset with UNICASTRTP params)
 */
export class VoiceRobotSession {
  private readonly logger = new Logger(VoiceRobotSession.name);

  // ARI resources (must be cleaned up)
  private bridge: Bridge | null = null;
  private externalChannel: Channel | null = null;
  private rtpSession: RtpSession | null = null;

  // VAD state
  private isSpeaking = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private sttBuffer: Buffer[] = [];

  // Pre-speech ring buffer
  private readonly preSpeechRingBuffer: Buffer[] = [];
  private readonly PRE_SPEECH_FRAMES: number;

  // Step counter
  private stepCount = 0;
  private readonly maxSteps: number;

  // Max duration watchdog
  private maxDurationTimer: NodeJS.Timeout | null = null;

  // Barge-in
  private pipelineAbort: AbortController | null = null;
  private isBotSpeaking = false;

  // RTP params (filled asynchronously by ChannelVarset events)
  private rtpAddress: string | null = null;
  private rtpPort: number | null = null;

  // Cleanup guard
  private cleanedUp = false;

  constructor(
    private readonly ariClient: AriHttpClientService,
    private readonly udpServer: RtpUdpServerService,
    private readonly vadProvider: SileroVadProvider,
    private readonly sttService: StreamingSttService,
    private readonly matcherService: KeywordMatcherService,
    private readonly streamAudio: StreamAudioService,
    private readonly audioService: AudioService,
    private readonly channelId: string,
    private readonly robotConfig: VoiceRobot,
    private readonly keywordsDb: VoiceRobotKeyword[],
    private readonly externalHost: string,
    private readonly logModel: typeof VoiceRobotLog,
  ) {
    const config = this.robotConfig.vad_config || {};
    this.PRE_SPEECH_FRAMES = Math.ceil((config.prefix_padding_ms || 300) / 32);
    this.maxSteps = this.robotConfig.max_conversation_steps || 10;
  }

  /**
   * Initialize the call session: answer, bridge, ExternalMedia, greet.
   */
  async start() {
    this.logger.log(`Starting Voice Robot Session for channel ${this.channelId}`);

    try {
      // 1. Answer channel
      await this.ariClient.answerChannel(this.channelId);

      // 2. Create mixing bridge
      this.bridge = await this.ariClient.createBridge('mixing');
      this.logger.log(`Bridge created: ${this.bridge.id}`);

      // 3. Add primary channel to bridge
      await this.ariClient.addChannelToBridge(this.bridge.id, this.channelId);

      // 4. Create RTP UDP session (ephemeral port)
      this.rtpSession = await this.udpServer.createSession();

      // 5. Create ExternalMedia channel → Asterisk will stream RTP to our UDP port
      //    The 'data' param passes our channelId so ChannelVarset events can be routed back
      this.externalChannel = await this.ariClient.externalMedia(
        null, // Asterisk assigns channel ID
        'krasterisk_voicerobots',
        `${this.externalHost}:${this.rtpSession.port}`,
        'alaw',
        this.channelId, // data = parent channel ID for routing
      );
      this.logger.log(`ExternalMedia channel: ${this.externalChannel.id} → port ${this.rtpSession.port}`);

      // 6. Add ExternalMedia channel to the SAME bridge
      await this.ariClient.addChannelToBridge(this.bridge.id, this.externalChannel.id);

      // 7. Extract RTP params from channel vars (may come synchronously or via ChannelVarset event)
      const vars = this.externalChannel.channelvars || {};
      if (vars.UNICASTRTP_LOCAL_ADDRESS && vars.UNICASTRTP_LOCAL_PORT) {
        this.rtpAddress = vars.UNICASTRTP_LOCAL_ADDRESS;
        this.rtpPort = Number(vars.UNICASTRTP_LOCAL_PORT);
      }

      // 8. Initialize StreamAudio for TTS playback (if RTP params already known)
      if (this.rtpAddress && this.rtpPort) {
        this.streamAudio.addStream(this.channelId, this.rtpAddress, this.rtpPort);
      }

      // 9. Play greeting
      await this.playGreeting();

      // 10. Hook VAD audio processing
      this.setupAudioPipeline();

      // 11. Start max duration watchdog
      const maxDurationSec = this.robotConfig.vad_config?.max_duration_seconds || 60;
      this.maxDurationTimer = setTimeout(() => {
        this.logger.warn(`[Session] Max duration ${maxDurationSec}s reached for ${this.channelId}`);
        this.exitToFallback('MAX_DURATION');
      }, maxDurationSec * 1000);

      this.logger.log(`Session ${this.channelId} fully initialized`);

    } catch (e: any) {
      this.logger.error(`Failed to start session: ${e.message}`, e.stack);
      this.cleanup();
    }
  }

  /**
   * Called when ChannelVarset provides UNICASTRTP_LOCAL_ADDRESS/PORT asynchronously.
   */
  updateRtpParams(variable: string, value: string): void {
    if (variable === 'UNICASTRTP_LOCAL_ADDRESS') {
      this.rtpAddress = value;
    } else if (variable === 'UNICASTRTP_LOCAL_PORT') {
      this.rtpPort = Number(value);
    }

    // Once both are known, initialize the StreamAudio sender
    if (this.rtpAddress && this.rtpPort) {
      this.streamAudio.addStream(this.channelId, this.rtpAddress, this.rtpPort);
      this.logger.log(`RTP params resolved: ${this.rtpAddress}:${this.rtpPort}`);
    }
  }

  /**
   * Play greeting prompt or TTS.
   */
  private async playGreeting(): Promise<void> {
    // Greeting via pre-recorded prompts
    if (this.robotConfig.greeting_prompts && Array.isArray(this.robotConfig.greeting_prompts)) {
      for (const prompt of this.robotConfig.greeting_prompts) {
        try {
          await this.ariClient.playMedia(this.channelId, prompt);
        } catch (e: any) {
          this.logger.warn(`Failed to play greeting prompt "${prompt}": ${e.message}`);
        }
      }
    }

    // TODO: TTS greeting (requires TTS provider integration)
    if (this.robotConfig.greeting_tts_text) {
      this.logger.log(`TTS greeting pending integration: "${this.robotConfig.greeting_tts_text}"`);
    }
  }

  /**
   * Connect RTP audio events to VAD processing.
   */
  private setupAudioPipeline(): void {
    if (!this.rtpSession) return;

    // VAD processing on Float32 frames
    this.rtpSession.eventEmitter.on('audio-float32', async (frame: Float32Array) => {
      try {
        const result = await this.vadProvider.processFrame(frame);
        this.handleVadResult(result.probability);
      } catch (e: any) {
        this.logger.error(`VAD processing error: ${e.message}`);
      }
    });

    // Accumulate PCM16 for STT when speaking
    this.rtpSession.eventEmitter.on('audio-pcm16', (pcm: Buffer) => {
      if (this.isSpeaking) {
        this.sttBuffer.push(pcm);
      } else {
        // Pre-speech ring buffer: keep last N frames
        this.preSpeechRingBuffer.push(pcm);
        if (this.preSpeechRingBuffer.length > this.PRE_SPEECH_FRAMES) {
          this.preSpeechRingBuffer.shift();
        }
      }
    });
  }

  /**
   * VAD probability handler — Finite State Machine.
   */
  private handleVadResult(prob: number): void {
    const config = this.robotConfig.vad_config || {};
    const speechThreshold = config.speech_threshold || 0.5;
    const silenceThreshold = config.silence_threshold || 0.3;
    const silenceTimeoutMs = config.silence_timeout_ms || 2000;

    if (prob >= speechThreshold && !this.isSpeaking) {
      // ─── SPEECH START ───
      this.logger.log(`[VAD] Speech started (prob: ${prob.toFixed(2)})`);
      this.isSpeaking = true;

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // Barge-in: interrupt bot speech
      if (this.isBotSpeaking && (config.barge_in !== false)) {
        this.logger.log(`[VAD] Barge-in — interrupting bot speech`);
        this.abortPipeline();
        this.streamAudio.interruptStream(this.channelId);
      }

      // Restore pre-speech frames
      this.sttBuffer = [...this.preSpeechRingBuffer];
      this.preSpeechRingBuffer.length = 0;

    } else if (prob <= silenceThreshold && this.isSpeaking) {
      // ─── SILENCE DURING SPEECH ───
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.logger.log(`[VAD] Speech ended (silence timeout ${silenceTimeoutMs}ms)`);
          this.isSpeaking = false;
          this.processSttBuffer();
        }, silenceTimeoutMs);
      }

    } else if (prob >= speechThreshold && this.isSpeaking) {
      // ─── CONTINUING SPEECH ───
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    }
  }

  /**
   * Process accumulated speech buffer through STT → KeywordMatcher.
   */
  private async processSttBuffer(): Promise<void> {
    const totalPcm = Buffer.concat(this.sttBuffer);
    this.sttBuffer = [];

    // Check min voice duration
    const minMs = this.robotConfig.vad_config?.min_speech_duration_ms || 300;
    const minBytes = minMs * 16; // 8kHz * 2 bytes = 16 bytes/ms
    if (totalPcm.length < minBytes) {
      this.logger.debug(`[VAD] Ignored short noise (${totalPcm.length} bytes < ${minBytes})`);
      return;
    }

    this.stepCount++;
    this.logger.log(`[STT] Step ${this.stepCount}/${this.maxSteps}: Sending ${totalPcm.length} bytes to STT...`);

    const startTime = Date.now();
    const sttResult = await this.sttService.transcribe(
      totalPcm,
      this.robotConfig.language || 'ru-RU',
    );
    const sttDurationMs = Date.now() - startTime;

    if (sttResult.text) {
      this.logger.log(`[STT] Recognized: "${sttResult.text}" (${sttDurationMs}ms)`);
      await this.handleRecognizedText(sttResult.text, sttResult, sttDurationMs);
    } else {
      this.logger.log(`[STT] No text recognized`);
      await this.writeLog(null, sttResult, sttDurationMs, null, 0);
    }

    // Check step limit
    if (this.stepCount >= this.maxSteps) {
      this.logger.warn(`[Session] Max steps (${this.maxSteps}) reached for ${this.channelId}`);
      this.exitToFallback('MAX_RETRIES');
    }
  }

  /**
   * Match recognized text against keyword database and route.
   */
  private async handleRecognizedText(
    text: string,
    sttResult: any,
    sttDurationMs: number,
  ): Promise<void> {
    const matchResult = this.matcherService.match(text, this.keywordsDb);

    if (matchResult) {
      this.logger.log(`[Matcher] ✅ Matched keyword ${matchResult.keyword.uid} (confidence: ${matchResult.confidence.toFixed(2)})`);

      await this.writeLog(text, sttResult, sttDurationMs, matchResult.keyword.uid, matchResult.confidence);

      await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'SUCCESS');
      await this.ariClient.continueInDialplan(
        this.channelId,
        `voicerobot_keyword_${matchResult.keyword.uid}`,
        's',
        1,
      );
    } else {
      this.logger.log(`[Matcher] ❌ No match for "${text}"`);
      await this.writeLog(text, sttResult, sttDurationMs, null, 0);
      // Don't fallback yet — let the user try again until max_steps
    }
  }

  /**
   * Exit the session via Fallback dialplan.
   */
  private async exitToFallback(status: string = 'FALLBACK'): Promise<void> {
    try {
      await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', status);
      await this.ariClient.continueInDialplan(this.channelId);
    } catch (e: any) {
      this.logger.error(`Failed to exit to fallback: ${e.message}`);
    }
  }

  /**
   * Abort current TTS/pipeline for barge-in.
   */
  private abortPipeline(): void {
    if (this.pipelineAbort) {
      this.pipelineAbort.abort();
      this.pipelineAbort = null;
    }
    this.isBotSpeaking = false;
  }

  /**
   * Write a log entry for this STT+match attempt.
   */
  private async writeLog(
    recognizedText: string | null,
    sttResult: any | null,
    sttDurationMs: number,
    matchedKeywordId: number | null,
    confidence: number,
  ): Promise<void> {
    try {
      await this.logModel.create({
        robot_id: this.robotConfig.uid,
        call_uniqueid: this.channelId,
        caller_id: null, // Filled if available from channel data
        step_number: this.stepCount,
        recognized_text: recognizedText,
        raw_stt_json: sttResult?.rawJson || null,
        matched_keyword_id: matchedKeywordId,
        match_confidence: confidence,
        action_taken: matchedKeywordId ? `voicerobot_keyword_${matchedKeywordId}` : 'no_match',
        stt_duration_ms: sttDurationMs,
        user_uid: this.robotConfig.user_uid,
      });
    } catch (e: any) {
      this.logger.error(`Failed to write log: ${e.message}`);
    }
  }

  /**
   * Full cleanup — idempotent, call on StasisEnd or error.
   */
  cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    this.logger.log(`Cleaning up session for ${this.channelId}`);

    // Cancel timers
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);

    // Abort any TTS pipeline
    this.abortPipeline();

    // Destroy ARI bridge (removes all channels from it)
    if (this.bridge?.id) {
      this.ariClient.destroyBridge(this.bridge.id).catch(() => {});
    }

    // Hangup ExternalMedia channel
    if (this.externalChannel?.id) {
      this.ariClient.hangupChannel(this.externalChannel.id).catch(() => {});
    }

    // Close UDP socket
    if (this.rtpSession) {
      this.rtpSession.close();
    }

    // Remove StreamAudio sender
    this.streamAudio.removeStream(this.channelId);

    // Reset VAD state
    this.sttBuffer = [];
    this.preSpeechRingBuffer.length = 0;
  }
}
