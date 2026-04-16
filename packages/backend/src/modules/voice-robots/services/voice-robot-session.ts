import { Logger } from '@nestjs/common';
import { AriHttpClientService, Channel, Bridge } from '../../ari/ari-http-client.service';
import { RtpUdpServerService, RtpSession } from './rtp-udp-server.service';
import { SileroVadProvider, VadSessionInstance } from './silero-vad.provider';
import { KeywordMatcherService, MatchResult } from './keyword-matcher.service';
import { SlotExtractorService } from './slot-extractor.service';
import { StreamingSttService } from './streaming-stt.service';
import { StreamAudioService } from './stream-audio.service';
import { AudioService } from './audio.service';
import { TtsCacheService } from './tts-cache.service';
import { TtsProviderFactory } from '../providers/provider-factory';
import { SttProviderFactory } from '../providers/provider-factory';
import { TtsEngine } from '../../tts-engines/tts-engine.model';
import { SttEngine } from '../../stt-engines/stt-engine.model';
import { SttStream } from '../interfaces/stt-provider.interface';
import { VoiceRobot } from '../voice-robot.model';
import { VoiceRobotKeyword } from '../keyword.model';
import { VoiceRobotLog } from '../voice-robot-log.model';
import { IVoiceRobotBotAction, ISlotDefinition } from '../interfaces/bot-action.types';

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
 * - Per-session VAD instance (isolated LSTM state)
 */
export class VoiceRobotSession {
  private readonly logger = new Logger(VoiceRobotSession.name);

  // ARI resources (must be cleaned up)
  private bridge: Bridge | null = null;
  private externalChannel: Channel | null = null;
  private rtpSession: RtpSession | null = null;

  // VAD — per-session isolated instance
  private vadInstance: VadSessionInstance | null = null;

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

  // Active keyword set (can change via switch_group)
  private activeKeywords: VoiceRobotKeyword[];

  // Dialogue context — persistent session memory, sent to every webhook
  private dialogueContext: Record<string, any> = {};

  // Group navigation stack (for "go back" support in switch_group)
  private groupStack: number[] = [];

  // Streaming STT session (null = batch mode)
  private sttStream: SttStream | null = null;
  private sttStreamFinalText = '';

  // Slot filling state
  private slotFillingState: {
    action: IVoiceRobotBotAction;
    keyword: VoiceRobotKeyword;
    slots: ISlotDefinition[];
    filledSlots: Record<string, string | boolean>;
    currentSlotIndex: number;
    retryCount: number;
  } | null = null;

  constructor(
    private readonly ariClient: AriHttpClientService,
    private readonly udpServer: RtpUdpServerService,
    private readonly vadProvider: SileroVadProvider,
    private readonly sttService: StreamingSttService,
    private readonly matcherService: KeywordMatcherService,
    private readonly slotExtractor: SlotExtractorService,
    private readonly streamAudio: StreamAudioService,
    private readonly audioService: AudioService,
    private readonly ttsFactory: TtsProviderFactory,
    private readonly ttsCache: TtsCacheService,
    private readonly ttsEngine: TtsEngine | null,
    private readonly sttProviderFactory: SttProviderFactory,
    private readonly sttEngine: SttEngine | null,
    private readonly channelId: string,
    private readonly robotConfig: VoiceRobot,
    private readonly keywordsDb: VoiceRobotKeyword[],
    private readonly externalHost: string,
    private readonly logModel: typeof VoiceRobotLog,
  ) {
    const config = this.robotConfig.vad_config || {};
    this.PRE_SPEECH_FRAMES = Math.ceil((config.prefix_padding_ms || 300) / 32);
    this.maxSteps = this.robotConfig.max_conversation_steps || 10;
    this.activeKeywords = [...this.keywordsDb];
  }

  /**
   * Initialize the call session: answer, bridge, ExternalMedia, greet.
   */
  async start() {
    this.logger.log(`Starting Voice Robot Session for channel ${this.channelId}`);

    try {
      // 0. Create per-session VAD instance (isolated LSTM state)
      if (this.vadProvider.isAvailable) {
        this.vadInstance = await this.vadProvider.createSessionInstance();
        this.logger.log(`VAD session instance created for ${this.channelId}`);
      } else {
        this.logger.warn(`VAD not available — session ${this.channelId} will run without VAD`);
      }

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

    // TTS greeting
    if (this.robotConfig.greeting_tts_text) {
      await this.speakResponse({ type: 'tts', value: this.robotConfig.greeting_tts_text });
    }
  }

  /**
   * Connect RTP audio events to VAD + STT processing.
   *
   * Two modes controlled by `robotConfig.stt_mode`:
   *
   * 1. **hybrid** (default, recommended):
   *    - Silero VAD runs locally, detects speech start/end.
   *    - gRPC stream opened at session start, but audio piped ONLY during speech.
   *    - VAD silence triggers buffer flush → keyword match.
   *    - Cost-efficient: stream idles during silence.
   *
   * 2. **full_stream**:
   *    - No local VAD. gRPC stream receives ALL audio frames.
   *    - Yandex detects speech/silence internally via EOU events.
   *    - Zero local latency, but higher API cost (continuous stream).
   */
  private setupAudioPipeline(): void {
    if (!this.rtpSession) return;

    const isFullStream = this.robotConfig.stt_mode === 'full_stream';
    const supportsStreaming = this.sttEngine && this.sttProviderFactory.isStreamingSupported(this.sttEngine);

    // ─── Open gRPC stream (both modes need it if engine supports streaming) ───
    if (supportsStreaming) {
      this.initStreamingStt();
    }

    if (isFullStream && supportsStreaming) {
      // ═══ Full-Stream Mode ═══
      // No VAD processing. All audio goes directly to gRPC stream.
      // Yandex handles speech detection via internal EOU logic.
      this.logger.log('[Pipeline] Full-stream STT mode: VAD disabled, all audio → gRPC');

      this.rtpSession.eventEmitter.on('audio-pcm16', (pcm: Buffer) => {
        if (this.sttStream) {
          this.sttStream.write(pcm);
        }
        // Still accumulate for fallback (if stream dies mid-session)
        this.sttBuffer.push(pcm);
      });

      // No audio-float32 handler — VAD completely bypassed
    } else {
      // ═══ Hybrid Mode (default) ═══
      // VAD gates audio to stream. Cost-efficient.
      this.logger.log('[Pipeline] Hybrid STT mode: VAD → gated gRPC stream');

      // VAD processing on Float32 frames (per-session instance)
      this.rtpSession.eventEmitter.on('audio-float32', async (frame: Float32Array) => {
        if (!this.vadInstance) return;

        try {
          const result = await this.vadInstance.processFrame(frame);
          this.handleVadResult(result.probability);
        } catch (e: any) {
          this.logger.error(`VAD processing error: ${e.message}`);
        }
      });

      // Accumulate PCM16 for STT — only during speech
      this.rtpSession.eventEmitter.on('audio-pcm16', (pcm: Buffer) => {
        if (this.isSpeaking) {
          this.sttBuffer.push(pcm);
          // In streaming mode — also pipe to gRPC stream
          if (this.sttStream) {
            this.sttStream.write(pcm);
          }
        } else {
          // Pre-speech ring buffer: keep last N frames
          this.preSpeechRingBuffer.push(pcm);
          if (this.preSpeechRingBuffer.length > this.PRE_SPEECH_FRAMES) {
            this.preSpeechRingBuffer.shift();
          }
        }
      });
    }
  }

  /**
   * Initialize a persistent streaming STT session.
   * Listens for 'final' and 'eou' events from the gRPC stream.
   *
   * In streaming mode:
   * - VAD speech start → pre-speech buffer flushed to stream
   * - Each audio frame is piped to stream.write()
   * - On EOU (end of utterance) → process recognized text
   * - On speech end (VAD silence) → if no EOU yet, wait for final
   */
  private initStreamingStt(): void {
    if (!this.sttEngine) return;

    try {
      this.sttStream = this.sttProviderFactory.createStream(
        this.sttEngine,
        this.robotConfig.language || 'ru-RU',
      );

      this.sttStreamFinalText = '';

      this.sttStream.events.on('partial', (text: string) => {
        this.logger.debug(`[STT/stream] Partial: "${text}"`);
      });

      this.sttStream.events.on('final', (text: string) => {
        this.logger.log(`[STT/stream] Final: "${text}"`);
        this.sttStreamFinalText = text;
      });

      this.sttStream.events.on('eou', () => {
        // End of utterance detected by the provider's EOU classifier
        if (this.sttStreamFinalText) {
          this.logger.log(`[STT/stream] EOU → processing: "${this.sttStreamFinalText}"`);
          const text = this.sttStreamFinalText;
          this.sttStreamFinalText = '';
          this.handleStreamingSttResult(text);
        }
      });

      this.sttStream.events.on('error', (err: Error) => {
        this.logger.error(`[STT/stream] Error: ${err.message}`);
        this.sttStream = null;
        // Degrade gracefully to batch mode
      });

      this.sttStream.events.on('end', () => {
        this.logger.debug('[STT/stream] Stream ended');
        this.sttStream = null;
      });

      this.logger.log(`[STT/stream] Streaming STT initialized (engine: ${this.sttEngine.type})`);
    } catch (e: any) {
      this.logger.error(`[STT/stream] Failed to initialize: ${e.message}`);
      this.sttStream = null;
    }
  }

  /**
   * Handle a completed utterance from the streaming STT.
   * Same pipeline as batch mode: keyword match → bot action.
   */
  private async handleStreamingSttResult(text: string): Promise<void> {
    this.stepCount++;
    this.logger.log(`[STT/stream] Step ${this.stepCount}/${this.maxSteps}`);

    const sttResult = { text, rawJson: { streaming: true } };
    await this.handleRecognizedText(text, sttResult, 0);

    if (this.stepCount >= this.maxSteps) {
      this.logger.warn(`[Session] Max steps (${this.maxSteps}) reached`);
      this.exitToFallback('MAX_RETRIES');
    }
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
    // ─── Streaming Mode ───
    // If streaming STT is active and we got a final via EOU, it was already handled.
    // If we reach here in streaming mode, it means VAD silence triggered before EOU.
    // Wait briefly for a final event, then use whatever we have.
    if (this.sttStream) {
      if (this.sttStreamFinalText) {
        const text = this.sttStreamFinalText;
        this.sttStreamFinalText = '';
        this.sttBuffer = [];
        this.stepCount++;
        this.logger.log(`[STT/stream] Silence-triggered: "${text}"`);
        await this.handleRecognizedText(text, { text, rawJson: { streaming: true } }, 0);
        if (this.stepCount >= this.maxSteps) {
          this.exitToFallback('MAX_RETRIES');
        }
        return;
      }
      // No final text available — the stream may still be processing.
      // Clear buffer and wait for next speech segment.
      this.sttBuffer = [];
      this.logger.debug('[STT/stream] No final text at silence — waiting for next utterance');
      return;
    }

    // ─── Batch Mode (legacy) ───
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
   * Supports both new bot_action format and legacy dialplan routing.
   */
  private async handleRecognizedText(
    text: string,
    sttResult: any,
    sttDurationMs: number,
  ): Promise<void> {
    // ─── If we're in slot filling mode, handle slot extraction ───
    if (this.slotFillingState) {
      await this.handleSlotInput(text, sttResult, sttDurationMs);
      return;
    }

    // ─── Keyword matching ───
    const negativePhrases = this.activeKeywords
      .flatMap(k => k.negative_keywords || [])
      .filter(Boolean);

    const matchResult = await this.matcherService.match(
      text,
      this.activeKeywords,
      negativePhrases,
    );

    if (matchResult) {
      this.logger.log(
        `[Matcher] ✅ Matched keyword ${matchResult.keyword.uid} ` +
        `(confidence: ${matchResult.confidence.toFixed(2)}, method: ${matchResult.method})`,
      );

      await this.writeLog(text, sttResult, sttDurationMs, matchResult.keyword.uid, matchResult.confidence);

      // ─── New: Use bot_action if available ───
      const botAction: IVoiceRobotBotAction | null = matchResult.keyword.bot_action;

      if (botAction) {
        await this.executeBotAction(botAction, matchResult);
      } else {
        // ─── Legacy: exit to dialplan ───
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'SUCCESS');
        await this.ariClient.continueInDialplan(
          this.channelId,
          `voicerobot_keyword_${matchResult.keyword.uid}`,
          's',
          1,
        );
      }
    } else {
      this.logger.log(`[Matcher] ❌ No match for "${text}"`);
      await this.writeLog(text, sttResult, sttDurationMs, null, 0);
    }
  }

  // ─── Bot Action Execution Engine ─────────────────────────

  /**
   * Execute a bot action: response → optional slot filling → next state.
   */
  private async executeBotAction(
    action: IVoiceRobotBotAction,
    matchResult: MatchResult,
  ): Promise<void> {
    // 1. Play response (TTS or prompt)
    if (action.response && action.response.type !== 'none') {
      await this.speakResponse(action.response);
    }

    // 2. If slots are defined, enter slot filling mode
    if (action.slots && action.slots.length > 0) {
      this.slotFillingState = {
        action,
        keyword: matchResult.keyword,
        slots: action.slots,
        filledSlots: {},
        currentSlotIndex: 0,
        retryCount: 0,
      };
      // Ask for first slot
      await this.askForSlot(action.slots[0]);
      return;
    }

    // 3. Execute next state immediately (no slots)
    await this.executeNextState(action, {});
  }

  /**
   * Ask the caller for a slot value via TTS.
   */
  private async askForSlot(slot: ISlotDefinition): Promise<void> {
    if (slot.prompt && slot.prompt.type !== 'none' && slot.prompt.value) {
      await this.speakResponse(slot.prompt);
    }
  }

  /**
   * Handle STT input during slot filling.
   */
  private async handleSlotInput(
    text: string,
    sttResult: any,
    sttDurationMs: number,
  ): Promise<void> {
    if (!this.slotFillingState) return;

    const { action, slots, currentSlotIndex, retryCount } = this.slotFillingState;
    const currentSlot = slots[currentSlotIndex];
    const maxRetries = currentSlot.maxRetries || 3;

    // Extract slot value
    const result = this.slotExtractor.extract(text, currentSlot);

    this.logger.log(
      `[Slot] ${currentSlot.name} (${currentSlot.type}): ` +
      `"${text}" → ${result.success ? result.value : 'FAIL'} ` +
      `(confidence: ${result.confidence.toFixed(2)})`,
    );

    await this.writeLog(text, sttResult, sttDurationMs, this.slotFillingState.keyword.uid, result.confidence);

    if (result.success && result.value !== undefined) {
      // Slot extracted successfully
      this.slotFillingState.filledSlots[currentSlot.name] = result.value;
      // Persist in session-level dialogue context for cross-step memory
      this.dialogueContext[currentSlot.name] = result.value;
      this.slotFillingState.retryCount = 0;

      // Move to next slot
      const nextIndex = currentSlotIndex + 1;
      if (nextIndex < slots.length) {
        this.slotFillingState.currentSlotIndex = nextIndex;
        await this.askForSlot(slots[nextIndex]);
      } else {
        // All slots filled → execute next state
        const filledSlots = { ...this.slotFillingState.filledSlots };
        const savedAction = this.slotFillingState.action;
        this.slotFillingState = null;
        await this.executeNextState(savedAction, filledSlots);
      }
    } else {
      // Extraction failed → retry
      this.slotFillingState.retryCount = retryCount + 1;

      if (this.slotFillingState.retryCount >= maxRetries) {
        this.logger.warn(`[Slot] Max retries (${maxRetries}) for slot "${currentSlot.name}"`);
        this.slotFillingState = null;
        this.exitToFallback('SLOT_EXTRACTION_FAILED');
        return;
      }

      // Retry prompt
      if (currentSlot.retryPrompt && currentSlot.retryPrompt.type !== 'none') {
        await this.speakResponse(currentSlot.retryPrompt);
      } else {
        await this.askForSlot(currentSlot);
      }
    }
  }

  /**
   * Execute the next state of a bot action.
   */
  private async executeNextState(
    action: IVoiceRobotBotAction,
    filledSlots: Record<string, string | boolean>,
  ): Promise<void> {
    const { nextState } = action;
    const target = String(nextState.target || '');

    this.logger.log(`[Action] Executing nextState: ${nextState.type} → ${target || '(none)'}`);

    switch (nextState.type) {
      case 'listen':
        // Stay in session, listen for next utterance
        break;

      case 'switch_group': {
        // In-session group switch: filter keywords by group_id
        const groupId = Number(target);
        if (groupId) {
          const groupKeywords = this.keywordsDb.filter(k => k.group_id === groupId);
          if (groupKeywords.length > 0) {
            // Push current group to stack for potential "go back"
            const currentGroupId = this.activeKeywords[0]?.group_id;
            if (currentGroupId) this.groupStack.push(currentGroupId);
            this.activeKeywords = groupKeywords;
            this.logger.log(`[Action] Switched to keyword group ${groupId} (${groupKeywords.length} keywords, stack depth: ${this.groupStack.length})`);
          } else {
            this.logger.warn(`[Action] Group ${groupId} has no keywords, keeping current set`);
          }
        }
        break;
      }

      case 'transfer_queue':
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'TRANSFER_QUEUE');
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_QUEUE', target);
        await this.ariClient.continueInDialplan(this.channelId);
        break;

      case 'transfer_exten': {
        const [exten, context] = target.includes('@')
          ? target.split('@')
          : [target, 'from-internal'];
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'TRANSFER_EXTEN');
        await this.ariClient.continueInDialplan(this.channelId, context, exten, 1);
        break;
      }

      case 'webhook':
        await this.executeWebhook(action, filledSlots);
        break;

      case 'hangup':
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'HANGUP');
        await this.ariClient.hangupChannel(this.channelId).catch(() => {});
        break;

      default:
        this.logger.warn(`[Action] Unknown nextState type: ${nextState.type}`);
    }
  }

  /**
   * Execute webhook: HTTP POST with slot data, then speak template response.
   */
  private async executeWebhook(
    action: IVoiceRobotBotAction,
    filledSlots: Record<string, string | boolean>,
  ): Promise<void> {
    const url = String(action.nextState.target || '');
    if (!url) {
      this.logger.error('[Webhook] No URL configured');
      return;
    }

    // Build payload from template or raw slots
    const payload = action.webhookPayload
      ? this.interpolateTemplate(action.webhookPayload, filledSlots)
      : filledSlots;

    this.logger.log(`[Webhook] POST ${url} with ${Object.keys(payload).length} fields`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (action.webhookAuth) {
      if (action.webhookAuth.mode === 'bearer' && action.webhookAuth.token) {
        headers['Authorization'] = `Bearer ${action.webhookAuth.token}`;
      } else if (action.webhookAuth.mode === 'custom' && action.webhookAuth.customHeaders) {
        for (const h of action.webhookAuth.customHeaders) {
          if (h.key && h.value) {
            headers[h.key] = h.value;
          }
        }
      }
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          robot_id: this.robotConfig.uid,
          channel_id: this.channelId,
          slots: payload,
          context: this.dialogueContext,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, any>;
      this.logger.log(`[Webhook] Response: ${response.status}, action: ${data.action || 'none'}`);

      // ─── 1. Merge context_update from webhook into session memory ───
      if (data.context_update && typeof data.context_update === 'object') {
        Object.assign(this.dialogueContext, data.context_update);
        this.logger.log(`[Webhook] Context updated: ${Object.keys(data.context_update).join(', ')}`);
      }

      // ─── 2. Speak say_text if webhook provides it (dynamic TTS) ───
      if (data.say_text) {
        await this.speakResponse({ type: 'tts', value: data.say_text });
      } else if (action.webhookResponseTemplate) {
        // Fallback: use configured response template
        const responseText = this.interpolateTemplateString(
          action.webhookResponseTemplate,
          { ...filledSlots, ...data },
        );
        await this.speakResponse({ type: 'tts', value: responseText });
      }

      await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'WEBHOOK_OK');
      await this.ariClient.setChannelVar(this.channelId, 'WEBHOOK_DATA', JSON.stringify(data));

      // ─── 3. Dynamic Routing via Webhook Response ───

      // 3a. Terminal: transfer to extension
      if (data.action === 'transfer_exten' && data.target) {
        this.logger.log(`[Webhook] Dynamic transfer_exten to ${data.target}`);
        const [exten, context] = String(data.target).includes('@')
          ? String(data.target).split('@')
          : [String(data.target), 'from-internal'];
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'TRANSFER_EXTEN');
        await this.ariClient.continueInDialplan(this.channelId, context, exten, 1);
        return;
      }

      // 3b. Terminal: transfer to queue
      if (data.action === 'transfer_queue' && data.target) {
        this.logger.log(`[Webhook] Dynamic transfer_queue to ${data.target}`);
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'TRANSFER_QUEUE');
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_QUEUE', String(data.target));
        await this.ariClient.continueInDialplan(this.channelId);
        return;
      }

      // 3c. Terminal: hangup
      if (data.action === 'hangup') {
        this.logger.log(`[Webhook] Dynamic hangup requested`);
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'HANGUP');
        await this.ariClient.hangupChannel(this.channelId).catch(() => {});
        return;
      }

      // 3d. Non-terminal: continue_dialogue — webhook returns control to the robot
      //     with optional new slots to collect or a group to switch to
      if (data.action === 'continue_dialogue') {
        this.logger.log(`[Webhook] continue_dialogue — extending conversation`);
        this.stepCount++;

        // Check step limit to prevent infinite loops
        if (this.stepCount >= this.maxSteps) {
          this.logger.warn(`[Webhook] Max steps (${this.maxSteps}) reached during continue_dialogue`);
          this.exitToFallback('MAX_STEPS');
          return;
        }

        // Option A: webhook provides new slots → enter slot filling with next_webhook
        const dynamicSlots: ISlotDefinition[] = (data.slots || []).map((s: any) => ({
          name: s.name || 'input',
          type: s.type || 'freetext',
          prompt: s.prompt || { type: 'none' },
          choices: s.choices,
          maxRetries: s.maxRetries || 3,
          retryPrompt: s.retryPrompt,
        }));

        if (dynamicSlots.length > 0) {
          // Build a continuation action that points to next_webhook (or same webhook)
          const continuationAction: IVoiceRobotBotAction = {
            response: { type: 'none' },
            nextState: { type: 'webhook', target: data.next_webhook || url },
            slots: dynamicSlots,
            webhookAuth: action.webhookAuth,
            webhookResponseTemplate: data.response_template,
          };

          this.slotFillingState = {
            action: continuationAction,
            keyword: { uid: -1 } as any,
            slots: dynamicSlots,
            filledSlots: {},
            currentSlotIndex: 0,
            retryCount: 0,
          };

          // Ask for first slot if it has a prompt
          if (dynamicSlots[0].prompt?.type !== 'none' && dynamicSlots[0].prompt?.value) {
            await this.askForSlot(dynamicSlots[0]);
          }
          return;
        }

        // Option B: webhook says switch_group → return to keyword matching in a different group
        if (data.switch_group) {
          const groupId = Number(data.switch_group);
          const groupKeywords = this.keywordsDb.filter(k => k.group_id === groupId);
          if (groupKeywords.length > 0) {
            const currentGroupId = this.activeKeywords[0]?.group_id;
            if (currentGroupId) this.groupStack.push(currentGroupId);
            this.activeKeywords = groupKeywords;
            this.logger.log(`[Webhook] Switched to group ${groupId} via continue_dialogue`);
          } else {
            this.logger.warn(`[Webhook] continue_dialogue switch_group ${groupId}: no keywords found`);
          }
          return;
        }

        // Option C: no slots, no switch → just return to listening with current keywords
        this.logger.log(`[Webhook] continue_dialogue — returning to listening mode`);
        return;
      }

    } catch (e: any) {
      this.logger.error(`[Webhook] Failed: ${e.message}`);
      await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'WEBHOOK_ERROR');
    }
  }

  // ─── TTS Playback ───────────────────────────────────────

  /**
   * Speak a bot response (TTS or prompt).
   */
  private async speakResponse(
    response: { type: string; value?: string },
  ): Promise<void> {
    if (!response.value) return;

    if (response.type === 'tts') {
      this.isBotSpeaking = true;
      this.pipelineAbort = new AbortController();
      try {
        if (!this.ttsEngine) {
          this.logger.warn('[TTS] No engine configured — skipping synthesis');
          return;
        }
        const mode = this.robotConfig.tts_mode || 'batch';
        this.logger.log(`[TTS/${mode}] "${response.value.substring(0, 60)}${response.value.length > 60 ? '...' : ''}"`);

        if (mode === 'streaming') {
          await this.speakStreaming(response.value);
        } else {
          await this.speakBatch(response.value);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          this.logger.error(`[TTS] Error: ${e.message}`);
        }
      } finally {
        this.isBotSpeaking = false;
        this.pipelineAbort = null;
      }
    } else if (response.type === 'prompt' && response.value) {
      try {
        await this.ariClient.playMedia(this.channelId, `sound:${response.value}`);
      } catch (e: any) {
        this.logger.warn(`[Prompt] Failed to play "${response.value}": ${e.message}`);
      }
    }
  }

  /**
   * Streaming TTS: send PCM16 chunks → A-law → RTP in real-time.
   * Low latency (~100-200ms first byte), no caching.
   * Best for: dynamic webhook responses, interpolated templates.
   */
  private async speakStreaming(text: string): Promise<void> {
    await this.ttsFactory.synthesize(
      this.ttsEngine!,
      text,
      (pcm16: Buffer) => {
        if (this.pipelineAbort?.signal.aborted) return;
        const alaw = this.audioService.encodePcm16ToAlaw(pcm16);
        this.streamAudio.streamAudio(this.channelId, alaw);
      },
      this.pipelineAbort?.signal,
    );
  }

  /**
   * Batch TTS with MD5 cache: synthesize once → store as .alaw → reuse.
   * Zero latency on cache hits, ~1-2s on first synthesis.
   * Best for: greetings, FAQ responses, static prompts.
   */
  private async speakBatch(text: string): Promise<void> {
    const settings = this.ttsEngine!.settings || {};
    const cacheKey = this.ttsCache.getCacheKey(
      text,
      settings.voice || 'default',
      settings.speed || 1.0,
      this.ttsEngine!.type,
    );

    let alawBuffer: Buffer;

    if (this.ttsCache.has(cacheKey)) {
      // Cache HIT — zero latency, no external API call
      alawBuffer = this.ttsCache.get(cacheKey);
      this.logger.debug(`[TTS] Cache HIT: ${cacheKey.substring(0, 8)}... (${alawBuffer.length} bytes)`);
    } else {
      // Cache MISS — synthesize, convert, and store
      const pcm16 = await this.ttsFactory.synthesizeBatch(this.ttsEngine!, text);
      alawBuffer = this.audioService.encodePcm16ToAlaw(pcm16);
      this.ttsCache.put(cacheKey, alawBuffer);
      this.logger.log(
        `[TTS] Cache MISS → saved: ${cacheKey.substring(0, 8)}... (${alawBuffer.length} bytes, ` +
        `~${(alawBuffer.length / 8000).toFixed(1)}s audio)`,
      );
    }

    // Stream from in-memory buffer → RTP → Asterisk → caller
    await this.streamAudio.streamAudio(this.channelId, alawBuffer);
  }

  // ─── Template Interpolation ─────────────────────────────

  /**
   * Interpolate {{variable}} placeholders in an object's values.
   */
  private interpolateTemplate(
    template: Record<string, string>,
    data: Record<string, string | boolean>,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = this.interpolateTemplateString(value, data);
    }
    return result;
  }

  /**
   * Interpolate {{variable}} placeholders in a string.
   */
  private interpolateTemplateString(
    template: string,
    data: Record<string, any>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });
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

    // Destroy per-session VAD instance (release ONNX resources)
    if (this.vadInstance) {
      this.vadInstance.destroy();
      this.vadInstance = null;
    }

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

    // Close streaming STT session (if active)
    if (this.sttStream) {
      try { this.sttStream.end(); } catch { /* ignore */ }
      this.sttStream = null;
    }

    // Reset VAD state
    this.sttBuffer = [];
    this.preSpeechRingBuffer.length = 0;
  }
}
