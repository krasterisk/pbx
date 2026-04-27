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
import { VoiceRobotKeywordGroup } from '../keyword-group.model';
import { VoiceRobotLog } from '../voice-robot-log.model';
import { VoiceRobotCdr } from '../voice-robot-cdr.model';
import { VoiceRobotDataList } from '../data-list.model';
import { IVoiceRobotBotAction, ISlotDefinition } from '../interfaces/bot-action.types';
import { DataListSearchService } from './data-list-search.service';
import { randomUUID } from 'crypto';

/** Caller info passed from StasisStart event */
export interface CallerInfo {
  callerId: string | null;
  callerName: string | null;
  callUniqueId: string | null;
}

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

  // Inactivity detection — repeat question if user is silent
  private inactivityTimer: NodeJS.Timeout | null = null;
  private inactivityRepeatCount = 0;
  private inactivityFallbackCycles = 0; // Global counter: how many times inactivity triggered fallback
  private static readonly MAX_INACTIVITY_FALLBACK_CYCLES = 3;
  private lastBotResponse: { type: string; value?: string } | null = null;

  // RTP params (filled asynchronously by ChannelVarset events)
  private rtpAddress: string | null = null;
  private rtpPort: number | null = null;

  // Cleanup guard
  private cleanedUp = false;

  // ─── CDR tracking ─────────────────────────────────────
  private readonly sessionId = randomUUID();
  private readonly startedAt = new Date();
  private readonly transcript: string[] = [];
  private noMatchCount = 0;
  private consecutiveNoMatchCount = 0;  // Resets on successful match
  private totalConfidence = 0;
  private totalMatches = 0;
  private cdrDisposition: 'completed' | 'caller_hangup' | 'fallback' | 'max_steps' | 'error' | 'timeout' = 'completed';
  private lastActionType: string | null = null;
  private lastTransferTarget: string | null = null;
  private informationDelivered = false;  // Set when caller receives data (data list found, webhook success)

  // Active keyword set (can change via switch_group)
  private activeKeywords: VoiceRobotKeyword[];

  // Global keywords (always active regardless of current group)
  private readonly globalKeywords: VoiceRobotKeyword[];

  // Dialogue context — persistent session memory, sent to every webhook
  private dialogueContext: Record<string, any> = {};

  // Group navigation stack (for "go back" support in switch_group)
  private groupStack: number[] = [];

  // Tags: names of keyword groups visited during the session
  private visitedTags: string[] = [];

  // Streaming STT session (null = batch mode)
  private sttStream: SttStream | null = null;
  private sttStreamFinalText = '';
  private sttStreamPartialText = '';

  // Keyword repetition counter for escalation
  private keywordHitCounts: Record<number, number> = {};

  // Data list search not-found retry counter (keyed by listId)
  private dataListNotFoundCounts: Record<number, number> = {};

  // Slot filling state
  private slotFillingState: {
    action: IVoiceRobotBotAction;
    keyword: VoiceRobotKeyword;
    slots: ISlotDefinition[];
    filledSlots: Record<string, string | boolean>;
    currentSlotIndex: number;
    retryCount: number;
  } | null = null;

  // Data list search state — when set, the next utterance is used as search query
  private pendingDataListSearch: {
    action: IVoiceRobotBotAction;
    filledSlots: Record<string, string | boolean>;
  } | null = null;

  /** Tenant ID (vpbx_user_uid) for context/queue name resolution */
  private readonly tenantId: number;

  /**
   * Resolve a tenant-aware Asterisk context.
   * Convention from dialplan.util.ts: `${contextBase}${vpbxUserUid}`
   * Examples: "sip-out" → "sip-out1", "ctx-" → "ctx-1"
   * If no context provided, uses the internal context "ctx-{tenantId}".
   */
  private resolveContext(context?: string): string {
    if (!context) return `ctx-${this.tenantId}`;
    // If context already ends with tenantId string, don't double-add
    const suffix = String(this.tenantId);
    if (context.endsWith(suffix)) return context;
    return `${context}${this.tenantId}`;
  }

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
    private readonly keywordGroupsDb: VoiceRobotKeywordGroup[],
    private readonly externalHost: string,
    private readonly logModel: typeof VoiceRobotLog,
    private readonly cdrModel: typeof VoiceRobotCdr,
    private readonly callerInfo: CallerInfo,
    private readonly dataListSearchService: DataListSearchService | null,
    private readonly dataListsDb: VoiceRobotDataList[],
  ) {
    const config = this.robotConfig.vad_config || {};
    this.PRE_SPEECH_FRAMES = Math.ceil((config.prefix_padding_ms || 300) / 32);
    this.maxSteps = this.robotConfig.max_conversation_steps || 10;
    this.tenantId = this.robotConfig.user_uid;

    // ─── FSM Initialization: activate only initial group + globals ───
    // Global keywords are always active in every dialogue state
    const globalGroupIds = this.keywordGroupsDb
      .filter(g => g.is_global === 1)
      .map(g => g.uid);
    this.globalKeywords = this.keywordsDb.filter(k => globalGroupIds.includes(k.group_id));

    // Initial group = explicitly set via initial_group_id, fallback to first non-global
    const initialGroupId = this.robotConfig.initial_group_id;
    const initialGroup = initialGroupId
      ? this.keywordGroupsDb.find(g => g.uid === initialGroupId)
      : this.keywordGroupsDb.filter(g => g.is_global !== 1)[0];

    if (initialGroup) {
      const initialKeywords = this.keywordsDb.filter(k => k.group_id === initialGroup.uid);
      this.activeKeywords = [...initialKeywords, ...this.globalKeywords];
      this.logger.log(`[FSM] Initial group: "${initialGroup.name}" (id=${initialGroup.uid}, ${initialKeywords.length} keywords + ${this.globalKeywords.length} global)`);
      this.visitedTags.push(initialGroup.name);
    } else {
      // Fallback: all keywords (backwards compat if no groups configured properly)
      this.activeKeywords = [...this.keywordsDb];
      this.logger.warn(`[FSM] No initial group found, activating all ${this.keywordsDb.length} keywords`);
    }
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

      // 9. Hook VAD audio processing FIRST — so we can hear during greeting
      this.setupAudioPipeline();

      // 10. Play greeting (VAD is already attached and will gate via isBotSpeaking)
      await this.playGreeting();

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
      // Audio ALWAYS flows to STT stream ("always listening").
      // VAD is used only for speech start/end detection and barge-in.
      this.logger.log('[Pipeline] Hybrid STT mode: always-on stream + VAD silence detection');

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

      // Always pipe PCM16 to STT stream — no deaf gaps
      this.rtpSession.eventEmitter.on('audio-pcm16', (pcm: Buffer) => {
        // Always pipe to gRPC stream (keeps it alive, captures all speech)
        if (this.sttStream) {
          this.sttStream.write(pcm);
        }

        if (this.isSpeaking) {
          this.sttBuffer.push(pcm);
        } else {
          // Pre-speech ring buffer (for batch fallback)
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

      const currentStream = this.sttStream;

      this.sttStreamFinalText = '';
      this.sttStreamPartialText = '';

      currentStream.events.on('partial', (text: string) => {
        if (this.sttStream !== currentStream) return;
        this.logger.debug(`[STT/stream] Partial: "${text}"`);
        this.sttStreamPartialText = text;
      });

      currentStream.events.on('final', (text: string) => {
        if (this.sttStream !== currentStream) return;
        this.logger.log(`[STT/stream] Final: "${text}"`);
        this.sttStreamFinalText = text;
      });

      currentStream.events.on('eou', () => {
        if (this.sttStream !== currentStream) return;
        // End of utterance detected by the provider's EOU classifier
        if (this.sttStreamFinalText || this.sttStreamPartialText) {
          const text = this.sttStreamFinalText || this.sttStreamPartialText;
          this.logger.log(`[STT/stream] EOU → processing: "${text}"`);
          this.sttStreamFinalText = '';
          this.sttStreamPartialText = '';
          this.handleStreamingSttResult(text);
        }
      });

      currentStream.events.on('error', (err: Error) => {
        if (this.sttStream !== currentStream) return;
        this.logger.error(`[STT/stream] Error: ${err.message}`);
        this.sttStream = null;
        // Auto-recreate after error (keep always-on)
        if (!this.cleanedUp) {
          setTimeout(() => this.initStreamingStt(), 200);
        }
      });

      currentStream.events.on('end', () => {
        if (this.sttStream !== currentStream) return;
        this.logger.debug('[STT/stream] Stream ended — recreating');
        this.sttStream = null;
        // Auto-recreate so we're always listening
        if (!this.cleanedUp) {
          setTimeout(() => this.initStreamingStt(), 50);
        }
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

    // While bot is speaking, only handle barge-in (speech detection that
    // interrupts the bot). Skip all other VAD state transitions to avoid
    // the bot's own RTP echo from triggering phantom STT sessions.
    if (this.isBotSpeaking) {
      if (prob >= speechThreshold && !this.isSpeaking && (config.barge_in !== false)) {
        this.logger.log(`[VAD] Barge-in — interrupting bot speech`);
        this.abortPipeline();
        this.streamAudio.interruptStream(this.channelId);
      }
      return;
    }

    if (prob >= speechThreshold && !this.isSpeaking) {
      // ─── SPEECH START ───
      this.logger.log(`[VAD] Speech started (prob: ${prob.toFixed(2)})`);
      this.isSpeaking = true;

      // Ensure STT stream exists (recreate if Yandex closed it)
      if (!this.sttStream) {
        this.initStreamingStt();
      }

      // Cancel inactivity timer — user is responding
      this.clearInactivityTimer();

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // Start max duration watchdog for this speech segment
      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer);
      }
      const maxDurationSec = config.max_duration_seconds || 15;
      this.maxDurationTimer = setTimeout(() => {
        this.logger.warn(`[VAD] Max duration ${maxDurationSec}s reached — forcefully cutting off speaker`);
        this.isSpeaking = false;
        this.maxDurationTimer = null;
        this.processSttBuffer();
      }, maxDurationSec * 1000);


      // Restore pre-speech frames into STT buffer for batch fallback
      this.sttBuffer = [...this.preSpeechRingBuffer];
      this.preSpeechRingBuffer.length = 0;

    } else if (prob <= silenceThreshold && this.isSpeaking) {
      // ─── SILENCE DURING SPEECH ───
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.logger.log(`[VAD] Speech ended (silence timeout ${silenceTimeoutMs}ms)`);
          this.isSpeaking = false;
          
          if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
          }
          
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
    if (this.sttStream) {
      let textToProcess = '';
      if (this.sttStreamFinalText) {
        textToProcess = this.sttStreamFinalText;
      } else if (this.sttStreamPartialText) {
        textToProcess = this.sttStreamPartialText;
      }

      this.sttStreamFinalText = '';
      this.sttStreamPartialText = '';

      if (textToProcess) {
        this.sttBuffer = [];
        this.stepCount++;
        this.logger.log(`[STT/stream] Silence-triggered: "${textToProcess}"`);
        
        // Close current stream — auto-recreate handler will open a new one
        try { this.sttStream.end(); } catch {}
        this.sttStream = null;
        // Immediately recreate so we're listening during handleRecognizedText/TTS
        this.initStreamingStt();

        await this.handleRecognizedText(textToProcess, { text: textToProcess, rawJson: { streaming: true } }, 0);
        if (this.stepCount >= this.maxSteps) {
          this.exitToFallback('MAX_RETRIES');
        }
        return;
      }

      // No text available
      this.sttBuffer = [];
      this.logger.debug('[STT/stream] No final or partial text at silence — waiting for next utterance');
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
    // Reset inactivity timer repeats since user responded
    this.inactivityRepeatCount = 0;
    this.inactivityFallbackCycles = 0;

    // ─── If we're waiting for a search query, use this utterance directly ───
    if (this.pendingDataListSearch) {
      // Filter out noise/phatic utterances — not real search queries
      const noiseWords = new Set([
        'алло', 'да', 'нет', 'ага', 'угу', 'ну', 'ой', 'ало', 'слушаю',
        'что', 'а', 'эй', 'хм', 'ммм', 'так', 'ладно', 'хорошо', 'ок',
      ]);
      const normalized = text.toLowerCase().replace(/[^а-яёa-z\s]/g, '').trim();
      const words = normalized.split(/\s+/).filter(w => w.length > 0);
      const isNoise = words.length <= 2 && words.every(w => noiseWords.has(w));

      if (isNoise) {
        this.logger.log(`[DataListSearch] Ignoring noise utterance: "${text}" — waiting for real query`);
        // Re-speak the last prompt so the user knows to answer
        if (this.lastBotResponse) {
          await this.speakResponse(this.lastBotResponse);
        }
        return; // Keep pendingDataListSearch active
      }

      const { action, filledSlots } = this.pendingDataListSearch;
      this.pendingDataListSearch = null;
      this.logger.log(`[DataListSearch] Got search utterance: "${text}"`);
      // Clear inactivity timer — search can take seconds (embedding cache, semantic search)
      this.clearInactivityTimer();
      await this.executeDataListSearch(action, filledSlots, text);
      return;
    }

    // ─── If we're in slot filling mode, check global keywords first ───
    if (this.slotFillingState) {
      const currentSlot = this.slotFillingState.slots[this.slotFillingState.currentSlotIndex];

      // For freetext slots, check if the user is saying a global keyword
      // (e.g. "соедини с оператором" while we're waiting for an address)
      if (currentSlot?.type === 'freetext' && this.globalKeywords.length > 0) {
        const globalMatch = await this.matcherService.match(
          text,
          this.globalKeywords,
          [],
        );
        if (globalMatch && globalMatch.confidence >= 0.7) {
          this.logger.log(
            `[Slot] Global keyword intercepted during slot filling: ` +
            `"${text}" → keyword ${globalMatch.keyword.uid} (confidence: ${globalMatch.confidence.toFixed(2)})`,
          );
          // Clear slot state — global keyword takes priority
          this.slotFillingState = null;
          this.consecutiveNoMatchCount = 0;

          await this.writeLog(text, sttResult, sttDurationMs, globalMatch.keyword.uid, globalMatch.confidence, globalMatch.keyword.group_id);

          // Track tag
          const customTag = globalMatch.keyword.tag;
          if (customTag && !this.visitedTags.includes(customTag)) {
            this.visitedTags.push(customTag);
          }

          // Execute bot action
          const botAction = globalMatch.keyword.bot_action;
          if (botAction) {
            await this.executeBotAction(botAction, globalMatch);
          }
          return;
        }
      }

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

      await this.writeLog(text, sttResult, sttDurationMs, matchResult.keyword.uid, matchResult.confidence, matchResult.keyword.group_id);

      // Reset consecutive no-match counter on successful match
      this.consecutiveNoMatchCount = 0;

      // Track custom keyword tag (if set) or group name
      const customTag = matchResult.keyword.tag;
      if (customTag && !this.visitedTags.includes(customTag)) {
        this.visitedTags.push(customTag);
      } else if (!customTag) {
        // Fallback: use group name (only if no custom tag)
        const groupMeta = this.keywordGroupsDb.find(g => g.uid === matchResult.keyword.group_id);
        if (groupMeta?.name && !this.visitedTags.includes(groupMeta.name)) {
          this.visitedTags.push(groupMeta.name);
        }
      }

      // ─── Keyword Escalation (Repeat limit) ───
      const kwUid = matchResult.keyword.uid;
      this.keywordHitCounts[kwUid] = (this.keywordHitCounts[kwUid] || 0) + 1;

      let botAction: IVoiceRobotBotAction | null = matchResult.keyword.bot_action;
      const maxRepeats = matchResult.keyword.max_repeats || 0;

      if (maxRepeats > 0 && this.keywordHitCounts[kwUid] > maxRepeats) {
        this.logger.warn(`[Escalation] Keyword ${kwUid} repeated ${this.keywordHitCounts[kwUid]} times (limit ${maxRepeats}). Executing escalation_action.`);
        botAction = matchResult.keyword.escalation_action || botAction;
      }

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

      this.consecutiveNoMatchCount++;
      const maxFallbackRetries = this.robotConfig.max_inactivity_repeats ?? 3;

      const fallbackAction = this.robotConfig.fallback_bot_action;
      if (fallbackAction && this.consecutiveNoMatchCount < maxFallbackRetries) {
        this.logger.log(`[Action] Executing fallback_bot_action (attempt ${this.consecutiveNoMatchCount}/${maxFallbackRetries})`);
        await this.executeBotAction(fallbackAction, {
          keyword: { uid: -1, keywords: '' } as any,
          confidence: 0,
          matchedPhrase: '',
          matchedWordCount: 0,
          method: 'fallback'
        });
      } else {
        if (this.consecutiveNoMatchCount >= maxFallbackRetries) {
          this.logger.warn(`[Action] Max consecutive no-match retries (${maxFallbackRetries}) reached. Executing max_retries_bot_action or exiting.`);
          const maxRetriesAction = this.robotConfig.max_retries_bot_action;
          if (maxRetriesAction) {
            await this.executeBotAction(maxRetriesAction, {
              keyword: { uid: -1, keywords: '' } as any,
              confidence: 0,
              matchedPhrase: '',
              matchedWordCount: 0,
              method: 'max_retries'
            });
          } else {
            await this.exitToFallback('MAX_RETRIES');
          }
        } else {
          this.logger.log(`[Action] No fallback_bot_action defined, exiting to fallback dialplan`);
          await this.exitToFallback('NO_MATCH');
        }
      }
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
    // 1. Play response (TTS or prompt) — interpolate {{variables}} from dialogueContext
    if (action.response && action.response.type !== 'none') {
      const interpolatedResponse = action.response.value
        ? { ...action.response, value: this.interpolateTemplateString(action.response.value, this.dialogueContext) }
        : action.response;
      await this.speakResponse(interpolatedResponse);

      // Mark information as delivered if this is a successful keyword match
      // (not a fallback or max_retries action)
      if (matchResult.keyword?.uid > 0 && matchResult.confidence > 0) {
        this.informationDelivered = true;
      }
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
    // Guard: don't execute actions after session cleanup
    if (this.cleanedUp) return;
    const { nextState } = action;
    const target = String(nextState.target || '');

    this.logger.log(`[Action] Executing nextState: ${nextState.type} → ${target || '(none)'}`);

    try {
      switch (nextState.type) {
        case 'listen':
          // Stay in session, listen for next utterance
          break;

        case 'switch_group': {
          // In-session group switch: filter keywords by group_id + always include globals
          const groupId = Number(target);
          if (groupId) {
            const groupKeywords = this.keywordsDb.filter(k => k.group_id === groupId);
            if (groupKeywords.length > 0) {
              // Push current group to stack for potential "go back"
              const currentGroupId = this.activeKeywords.find(k => !this.globalKeywords.some(g => g.uid === k.uid))?.group_id;
              if (currentGroupId) this.groupStack.push(currentGroupId);
              this.activeKeywords = [...groupKeywords, ...this.globalKeywords];
              this.logger.log(`[FSM] Switched to group ${groupId} (${groupKeywords.length} keywords + ${this.globalKeywords.length} global, stack depth: ${this.groupStack.length})`);
              // Track group name as tag
              const groupMeta = this.keywordGroupsDb.find(g => g.uid === groupId);
              if (groupMeta?.name && !this.visitedTags.includes(groupMeta.name)) {
                this.visitedTags.push(groupMeta.name);
              }
            } else {
              this.logger.warn(`[FSM] Group ${groupId} has no keywords, keeping current set`);
            }
          }
          break;
        }

        case 'transfer_exten': {
          // Transfer call to extension in the tenant dialplan.
          // Format: "700" or "700@sip-out1" — context tenantId appended if missing.
          const [exten, rawContext] = target.includes('@')
            ? target.split('@')
            : [target, undefined];

          if (!exten) {
            this.logger.error(
              `[Action] transfer_exten: extension is empty (target="${target}"). ` +
              `Check onFoundNextState config — extension field must not be blank.`,
            );
            break;
          }

          const resolvedContext = this.resolveContext(rawContext);
          this.lastActionType = 'transfer_exten';
          this.lastTransferTarget = `${exten}@${resolvedContext}`;
          this.cdrDisposition = 'completed';
          await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'TRANSFER_EXTEN');
          this.logger.log(`[Action] Transfer to ${exten}@${resolvedContext}`);
          await this.ariClient.continueInDialplan(this.channelId, resolvedContext, exten, 1);
          break;
        }

        case 'webhook':
          await this.executeWebhook(action, filledSlots);
          break;

        case 'hangup':
          this.lastActionType = 'hangup';
          this.cdrDisposition = 'completed';
          await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'HANGUP');
          await this.ariClient.hangupChannel(this.channelId).catch(() => {});
          break;

        case 'search_data_list':
          // Don't search immediately — wait for the NEXT utterance from the user.
          // The response (Шаг 1) has already been spoken; now enter listen mode
          // and mark pendingDataListSearch so the next STT result triggers the search.
          this.pendingDataListSearch = { action, filledSlots };
          this.logger.log('[DataListSearch] Waiting for next utterance to use as search query...');
          break;

        default:
          this.logger.warn(`[Action] Unknown nextState type: ${nextState.type}`);
      }
    } catch (e: any) {
      this.logger.error(`[Action] executeNextState(${nextState.type}) failed: ${e.message}`);
      this.cdrDisposition = 'error';
      // Attempt graceful cleanup — don't crash the process
      this.cleanup();
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
          robot_name: this.robotConfig.name || null,
          user_uid: this.robotConfig.user_uid || 0,
          channel_id: this.channelId,
          caller_id: this.callerInfo.callerId || null,
          caller_name: this.callerInfo.callerName || null,
          slots: payload,
          context: this.dialogueContext,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, any>;
      this.logger.log(`[Webhook] Response: ${response.status}, action: ${data.action || 'none'}`);

      // Log PHP exceptions / errors from webhook
      if (data.error) {
        this.logger.error(`[Webhook] Error from webhook: ${data.error}`);
      }

      // ─── Handle non-200 responses (403, 500, etc.) → treat as fallback ───
      if (!response.ok) {
        this.logger.warn(`[Webhook] Non-OK status ${response.status} — treating as fallback`);
        this.consecutiveNoMatchCount++;

        const maxRetries = this.robotConfig.max_inactivity_repeats ?? 3;
        if (this.consecutiveNoMatchCount >= maxRetries) {
          this.logger.warn(`[Webhook] Max retries (${maxRetries}) reached after webhook errors`);
          const maxRetriesAction = this.robotConfig.max_retries_bot_action;
          if (maxRetriesAction?.response?.value || maxRetriesAction?.nextState?.type) {
            if (maxRetriesAction.response?.type !== 'none' && maxRetriesAction.response?.value) {
              await this.speakResponse(maxRetriesAction.response);
            }
            if (maxRetriesAction.nextState) {
              await this.executeNextState(maxRetriesAction.nextState, {});
            }
          } else {
            this.exitToFallback('MAX_RETRIES');
          }
          return;
        }

        // Execute fallback_bot_action
        const fallbackAction = this.robotConfig.fallback_bot_action;
        if (fallbackAction?.response?.value) {
          this.logger.log(`[Action] Executing fallback_bot_action after webhook error (attempt ${this.consecutiveNoMatchCount}/${maxRetries})`);
          await this.speakResponse(fallbackAction.response);
        }
        this.startInactivityTimer();
        return;
      }

      // ─── 1. Merge context_update from webhook into session memory ───
      if (data.context_update && typeof data.context_update === 'object') {
        Object.assign(this.dialogueContext, data.context_update);
        this.logger.log(`[Webhook] Context updated: ${Object.keys(data.context_update).join(', ')}`);

        // Log webhook DB errors for diagnostics
        if (data.context_update.db_error) {
          this.logger.error(`[Webhook] DB error from webhook: ${data.context_update.db_error}`);
        }
        if (data.context_update.request_created !== undefined) {
          this.logger.log(`[Webhook] Service request created: ${data.context_update.request_created}, id: ${data.context_update.request_id ?? 'null'}`);
        }
      }

      // Log search debug data from webhook (address lookup diagnostics)
      if (data._search_debug) {
        const sd = data._search_debug;
        this.logger.debug(`[Webhook] Search: query=${JSON.stringify(sd.query_parsed)}, strategy=${sd.strategy}, candidates=${sd.candidates}, scored=${sd.scored}`);
        if (sd.top5?.length) {
          for (const t of sd.top5.slice(0, 3)) {
            this.logger.debug(`[Webhook] Top: "${t.address}" score=${t.total} (street=${t.street_sc}, house=${t.house_sc}, apt=${t.apt_sc})`);
          }
        }
      }

      // ─── 2. Speak say_text if webhook provides it (dynamic TTS) ───
      // Clear inactivity timer first — webhook TTS can take seconds to play,
      // and we don't want the old timer to repeat the greeting during playback
      this.clearInactivityTimer();

      let webhookBotResponse: string | null = null;
      if (data.say_text) {
        // Interpolate {{variables}} in say_text with dialogue context + webhook response data
        const interpolatedSayText = this.interpolateTemplateString(
          data.say_text,
          { ...this.dialogueContext, ...data },
        );
        webhookBotResponse = interpolatedSayText;
        await this.speakResponse({ type: 'tts', value: interpolatedSayText });
        // Mark information as delivered for CDR disposition
        this.informationDelivered = true;
      } else if (action.webhookResponseTemplate) {
        // Fallback: use configured response template
        const responseText = this.interpolateTemplateString(
          action.webhookResponseTemplate,
          { ...filledSlots, ...data },
        );
        webhookBotResponse = responseText;
        await this.speakResponse({ type: 'tts', value: responseText });
        // Mark information as delivered for CDR disposition
        this.informationDelivered = true;
      }

      // ─── 2b. Log webhook interaction in transcript & voice_robot_logs ───
      {
        const slotSummary = Object.entries(filledSlots)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        const kwUid = this.slotFillingState?.keyword?.uid ?? null;
        const groupId = this.slotFillingState?.keyword?.group_id ?? null;
        this.transcript.push(`[Webhook] POST ${url} (${slotSummary})`);
        if (webhookBotResponse) {
          this.transcript.push(`[Робот] ${webhookBotResponse}`);
        }
        if (data.found !== undefined) {
          this.transcript.push(`[Webhook] found=${data.found}, action=${data.action || 'none'}`);
        }
        // Write log entry for webhook step
        await this.writeLog(
          slotSummary || null,    // recognizedText — slot values sent
          null,                    // sttResult
          0,                       // sttDurationMs
          kwUid,                   // matchedKeywordId
          data.confidence || data.fio_score || 0, // confidence
          groupId,                 // matchedGroupId
          webhookBotResponse,      // botResponse
          { type: 'webhook', url, response: { action: data.action, found: data.found, verified: data.verified } },
        );
      }

      await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'WEBHOOK_OK').catch(() => {});
      await this.ariClient.setChannelVar(this.channelId, 'WEBHOOK_DATA', JSON.stringify(data)).catch((e: any) => {
        this.logger.warn(`[Webhook] Failed to set WEBHOOK_DATA channel var: ${e.message}`);
      });

      // ─── 3. Dynamic Routing via Webhook Response ───

      // 3a. Terminal: transfer to extension (also handles legacy transfer_queue)
      if ((data.action === 'transfer_exten' || data.action === 'transfer_queue') && data.target) {
        const [whExten, whRawCtx] = String(data.target).includes('@')
          ? String(data.target).split('@')
          : [String(data.target), undefined];
        const whCtx = this.resolveContext(whRawCtx);
        this.logger.log(`[Webhook] Dynamic transfer to ${whExten}@${whCtx}`);
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'TRANSFER_EXTEN');
        await this.ariClient.continueInDialplan(this.channelId, whCtx, whExten, 1);
        return;
      }

      // 3c. Terminal: hangup
      if (data.action === 'hangup') {
        this.logger.log(`[Webhook] Dynamic hangup requested`);
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'HANGUP');
        await this.ariClient.hangupChannel(this.channelId).catch(() => {});
        return;
      }
      // 3d. Terminal: exit to fallback dialplan (configured by PBX admin)
      if (data.action === 'fallback') {
        this.logger.log(`[Webhook] Fallback requested — exiting to fallback dialplan`);
        if (data.say_text) {
          const interpolated = this.interpolateTemplateString(data.say_text, { ...this.dialogueContext, ...data });
          await this.speakResponse({ type: 'tts', value: interpolated });
        }
        await this.exitToFallback('WEBHOOK_FALLBACK');
        return;
      }

      // 3e. Non-terminal: continue_dialogue — webhook returns control to the robot
      //     with optional new slots to collect or a group to switch to
      if (data.action === 'continue_dialogue') {
        this.logger.log(`[Webhook] continue_dialogue — extending conversation`);
        this.stepCount++;

        // Check step limit to prevent infinite loops
        if (this.stepCount >= this.maxSteps) {
          this.logger.warn(`[Webhook] Max steps (${this.maxSteps}) reached during continue_dialogue`);
          const maxRetriesAction = this.robotConfig.max_retries_bot_action;
          if (maxRetriesAction?.response?.value || maxRetriesAction?.nextState?.type) {
            if (maxRetriesAction.response?.type !== 'none' && maxRetriesAction.response?.value) {
              await this.speakResponse(maxRetriesAction.response);
            }
            if (maxRetriesAction.nextState) {
              await this.executeNextState(maxRetriesAction.nextState, {});
            }
          } else {
            this.exitToFallback('MAX_STEPS');
          }
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

          // Preserve original keyword/group info for CDR logging
          const originalKeyword = this.slotFillingState?.keyword || { uid: -1, group_id: null } as any;
          this.slotFillingState = {
            action: continuationAction,
            keyword: originalKeyword,
            slots: dynamicSlots,
            filledSlots: {},
            currentSlotIndex: 0,
            retryCount: 0,
          };

          // Reset inactivity timer — new conversation step, fresh timer
          this.inactivityRepeatCount = 0;
          this.clearInactivityTimer();

          // Ask for first slot if it has a prompt
          if (dynamicSlots[0].prompt?.type !== 'none' && dynamicSlots[0].prompt?.value) {
            await this.askForSlot(dynamicSlots[0]);
          } else {
            // No prompt — just start listening with fresh inactivity timer
            this.startInactivityTimer();
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
        this.inactivityRepeatCount = 0;
        this.startInactivityTimer();
        return;
      }

      // ─── 3e. No recognized action — terminal response ───
      // Webhook returned data without action → response already spoken, slot flow complete
      this.logger.log(`[Webhook] Terminal response (no action) — clearing slot state, returning to listening`);
      this.slotFillingState = null;
      this.inactivityRepeatCount = 0;
      this.startInactivityTimer();

    } catch (e: any) {
      this.logger.error(`[Webhook] Failed: ${e.message}`);
      await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'WEBHOOK_ERROR').catch(() => {});
    }
  }

  // ─── Data List Search ─────────────────────────────────────

  /**
   * Execute a data list search: find a row by query, extract a field,
   * store in dialogueContext, then execute onFoundNextState.
   */
  private async executeDataListSearch(
    action: IVoiceRobotBotAction,
    filledSlots: Record<string, string | boolean>,
    forcedQuery?: string,  // when provided, overrides querySource (used from pending search)
  ): Promise<void> {
    const config = action.dataListSearch;
    if (!config) {
      this.logger.warn('[DataListSearch] No dataListSearch config on action');
      return;
    }

    // Default resultVariable to 'result' if not set
    if (!config.resultVariable) {
      config.resultVariable = 'result';
    }

    if (!this.dataListSearchService) {
      this.logger.warn('[DataListSearch] DataListSearchService not available');
      return;
    }

    // Find the data list by ID
    const list = this.dataListsDb.find(dl => dl.uid === config.listId);
    if (!list) {
      this.logger.warn(`[DataListSearch] Data list ${config.listId} not found in session`);
      return;
    }

    // Determine query text
    let query = '';
    if (forcedQuery !== undefined) {
      // Called from pending search — use the utterance that was just spoken
      query = forcedQuery;
    } else if (config.querySource === 'slot' && config.querySlotName) {
      const slotValue = filledSlots[config.querySlotName] ?? this.dialogueContext[config.querySlotName];
      query = String(slotValue || '');
    } else {
      // last_utterance: use the last recognized text from transcript
      query = this.transcript.length > 0 ? this.transcript[this.transcript.length - 1] : '';
    }

    if (!query.trim()) {
      this.logger.warn('[DataListSearch] Empty query, nothing to search');
      if (config.notFoundResponse && config.notFoundResponse.type !== 'none') {
        await this.speakResponse(config.notFoundResponse);
      }
      return;
    }

    this.logger.log(`[DataListSearch] Searching list "${list.name}" for "${query}", return field="${config.returnField}"`);

    // Preload embeddings for this list (cached, fast if already loaded)
    await this.dataListSearchService.preloadList(list);

    // Perform hybrid search (strategy-aware)
    let result;
    if (config.multiMatchStrategy === 'random') {
      const allMatches = await this.dataListSearchService.searchAll(query, list, config.returnField);
      if (allMatches.length > 0) {
        const randomIndex = Math.floor(Math.random() * allMatches.length);
        result = allMatches[randomIndex];
        this.logger.log(
          `[DataListSearch] Random pick: ${randomIndex + 1}/${allMatches.length} matches`,
        );
      } else {
        result = null;
      }
    } else {
      result = await this.dataListSearchService.search(query, list, config.returnField);
    }

    if (result) {
      this.logger.log(
        `[DataListSearch] ✅ Found: ${config.resultVariable}="${result.value}" ` +
        `(confidence: ${result.confidence.toFixed(3)}, method: ${result.method})`,
      );

      // Reset not-found counter on success
      this.dataListNotFoundCounts[config.listId] = 0;

      // Reset no-match counter — successful search = valid interaction
      this.consecutiveNoMatchCount = 0;

      // Mark information as delivered for CDR disposition
      this.informationDelivered = true;

      // Store result in dialogueContext for use in TTS templates and subsequent actions
      this.dialogueContext[config.resultVariable] = result.value;

      // Store full row as well for multi-field access
      for (const [key, val] of Object.entries(result.row)) {
        this.dialogueContext[`${config.resultVariable}_${key}`] = val;
      }

      // Set channel variable for dialplan access
      await this.ariClient.setChannelVar(this.channelId, 'DATA_LIST_RESULT', result.value).catch(() => {});

      // Speak onFoundResponse if configured (supports {{variable}} interpolation)
      if (config.onFoundResponse && config.onFoundResponse.type !== 'none' && config.onFoundResponse.value) {
        // Clear inactivity timer before speaking — response can be long
        this.clearInactivityTimer();
        const interpolatedText = this.interpolateTemplateString(
          config.onFoundResponse.value,
          this.dialogueContext,
        );
        this.logger.log(`[DataListSearch] Speaking onFoundResponse: "${interpolatedText.substring(0, 80)}${interpolatedText.length > 80 ? '...' : ''}"`);
        await this.speakResponse({ type: config.onFoundResponse.type, value: interpolatedText });
      } else {
        // Auto-speak result value if no explicit onFoundResponse configured
        this.clearInactivityTimer();
        this.logger.log(`[DataListSearch] No onFoundResponse configured — auto-speaking result`);
        await this.speakResponse({ type: 'tts', value: result.value });
      }

      // Execute onFoundNextState if configured
      if (config.onFoundNextState) {
        // Resolve target: interpolate {{variables}}, or fall back to resultVariable if ext part empty
        let rawTarget = config.onFoundNextState.target
          ? String(config.onFoundNextState.target)
          : '';

        // Handle case where user set context but left extension blank (e.g. '@sip-out')
        if (config.onFoundNextState.type === 'transfer_exten') {
          const atIdx = rawTarget.indexOf('@');
          const extPart = atIdx >= 0 ? rawTarget.slice(0, atIdx) : rawTarget;
          const ctxPart = atIdx >= 0 ? rawTarget.slice(atIdx + 1) : '';

          if (!extPart && config.resultVariable) {
            // Auto-use result variable as extension
            rawTarget = `{{${config.resultVariable}}}${ctxPart ? '@' + ctxPart : ''}`;
            this.logger.log(
              `[DataListSearch] Auto-filled empty extension with {{${config.resultVariable}}}`,
            );
          }
        }

        const interpolatedTarget = this.interpolateTemplateString(rawTarget, this.dialogueContext);

        this.logger.log(
          `[DataListSearch] onFoundNextState: type=${config.onFoundNextState.type}, ` +
          `rawTarget="${rawTarget}" → resolved="${interpolatedTarget}"`,
        );

        const syntheticAction: IVoiceRobotBotAction = {
          response: { type: 'none' },
          nextState: {
            type: config.onFoundNextState.type,
            target: interpolatedTarget,
          },
        };

        await this.executeNextState(syntheticAction, filledSlots);
      }
    } else {
      // ─── Not found logic with retries ───
      const notFoundCount = (this.dataListNotFoundCounts[config.listId] || 0) + 1;
      this.dataListNotFoundCounts[config.listId] = notFoundCount;
      const maxRetries = config.maxNotFoundRetries ?? 1;

      this.logger.log(
        `[DataListSearch] ❌ No match for "${query}" in list "${list.name}" ` +
        `(attempt ${notFoundCount}/${maxRetries})`,
      );

      if (notFoundCount >= maxRetries && config.notFoundNextState) {
        // Max retries exhausted → execute notFoundNextState
        this.logger.log(
          `[DataListSearch] Max not-found retries reached → executing notFoundNextState: ${config.notFoundNextState.type}`,
        );

        // Speak not-found response before executing the action
        if (config.notFoundResponse && config.notFoundResponse.type !== 'none') {
          await this.speakResponse(config.notFoundResponse);
        }

        // Reset counter
        this.dataListNotFoundCounts[config.listId] = 0;

        const syntheticAction: IVoiceRobotBotAction = {
          response: { type: 'none' },
          nextState: {
            type: config.notFoundNextState.type,
            target: config.notFoundNextState.target,
          },
        };

        await this.executeNextState(syntheticAction, filledSlots);
      } else {
        // Still have retries left → speak not-found response and return to listening
        if (config.notFoundResponse && config.notFoundResponse.type !== 'none') {
          await this.speakResponse(config.notFoundResponse);
        }
        // Robot returns to listen mode automatically (no explicit action needed)
      }
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
    // Guard: don't speak after session cleanup (prevents zombie timers)
    if (this.cleanedUp) return;

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
        // Start inactivity timer after bot finishes speaking
        this.startInactivityTimer();
      }
    } else if (response.type === 'prompt' && response.value) {
      try {
        await this.ariClient.playMedia(this.channelId, `sound:${response.value}`);
      } catch (e: any) {
        this.logger.warn(`[Prompt] Failed to play "${response.value}": ${e.message}`);
      }
      // Start inactivity timer after prompt finishes
      this.startInactivityTimer();
    }

    // Remember last bot response for inactivity repeats
    this.lastBotResponse = response;
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
    // Yandex SpeechKit v3 limit is ~250 chars; split long texts into chunks
    const MAX_CHUNK_LEN = 230;
    const chunks = text.length > MAX_CHUNK_LEN
      ? this.splitTextIntoChunks(text, MAX_CHUNK_LEN)
      : [text];

    if (chunks.length > 1) {
      this.logger.log(`[TTS] Long text (${text.length} chars) → split into ${chunks.length} chunks`);
    }

    for (const chunk of chunks) {
      if (this.pipelineAbort?.signal.aborted) return;

      const settings = this.ttsEngine!.settings || {};
      const cacheKey = this.ttsCache.getCacheKey(
        chunk,
        settings.voice || 'default',
        settings.speed || 1.0,
        this.ttsEngine!.type,
      );

      let alawBuffer: Buffer;

      if (this.ttsCache.has(cacheKey)) {
        alawBuffer = this.ttsCache.get(cacheKey);
        this.logger.debug(`[TTS] Cache HIT: ${cacheKey.substring(0, 8)}... (${alawBuffer.length} bytes)`);
      } else {
        const pcm16 = await this.ttsFactory.synthesizeBatch(this.ttsEngine!, chunk);
        alawBuffer = this.audioService.encodePcm16ToAlaw(pcm16);
        this.ttsCache.put(cacheKey, alawBuffer);
        this.logger.log(
          `[TTS] Cache MISS → saved: ${cacheKey.substring(0, 8)}... (${alawBuffer.length} bytes, ` +
          `~${(alawBuffer.length / 8000).toFixed(1)}s audio)`,
        );
      }

      await this.streamAudio.streamAudio(this.channelId, alawBuffer);
    }
  }

  /**
   * Split text into chunks that don't exceed maxLen.
   * Tries to split by sentence boundaries first, then by commas/semicolons.
   */
  private splitTextIntoChunks(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let remaining = text.trim();

    while (remaining.length > maxLen) {
      // Try to split at sentence boundary (. ! ?)
      let splitIdx = -1;
      for (let i = maxLen - 1; i >= maxLen * 0.4; i--) {
        if ('.!?\n'.includes(remaining[i])) {
          splitIdx = i + 1;
          break;
        }
      }

      // Fallback: split at comma, semicolon, or closing paren
      if (splitIdx === -1) {
        for (let i = maxLen - 1; i >= maxLen * 0.4; i--) {
          if (',;)'.includes(remaining[i])) {
            splitIdx = i + 1;
            break;
          }
        }
      }

      // Last resort: split at last space
      if (splitIdx === -1) {
        splitIdx = remaining.lastIndexOf(' ', maxLen - 1);
        if (splitIdx <= 0) splitIdx = maxLen; // no space found — hard cut
      }

      chunks.push(remaining.substring(0, splitIdx).trim());
      remaining = remaining.substring(splitIdx).trim();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
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
    return template.replace(/\{\{([\p{L}\p{N}_]+)\}\}/gu, (_, key) => {
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
    matchedGroupId?: number | null,
    botResponse?: string | null,
    flowAction?: any | null,
  ): Promise<void> {
    try {
      // Track transcript for CDR
      if (recognizedText) {
        this.transcript.push(`[Клиент] ${recognizedText}`);
      }
      if (botResponse) {
        this.transcript.push(`[Робот] ${botResponse}`);
      }

      // Track CDR stats
      if (matchedKeywordId) {
        this.totalMatches++;
        this.totalConfidence += confidence;
      } else {
        this.noMatchCount++;
      }

      const actionTaken = matchedKeywordId ? `voicerobot_keyword_${matchedKeywordId}` : 'no_match';

      await this.logModel.create({
        robot_id: this.robotConfig.uid,
        call_uniqueid: this.callerInfo.callUniqueId || this.channelId,
        session_id: this.sessionId,
        channel_id: this.channelId,
        caller_id: this.callerInfo.callerId,
        step_number: this.stepCount,
        matched_group_id: matchedGroupId || null,
        recognized_text: recognizedText,
        raw_stt_json: sttResult?.rawJson || { streaming: true },
        matched_keyword_id: matchedKeywordId,
        match_confidence: confidence,
        action_taken: actionTaken,
        stt_duration_ms: sttDurationMs,
        matching_score: sttResult?.matchingScore || null,
        ai_response: botResponse || null,
        flow_action: flowAction || null,
        user_uid: this.robotConfig.user_uid,
      });
    } catch (e: any) {
      this.logger.error(`Failed to write log: ${e.message}`);
    }
  }

  /**
   * Write CDR record (1 per call) — called from cleanup().
   */
  private async writeCdr(): Promise<void> {
    try {
      const endedAt = new Date();
      const durationSeconds = Math.round((endedAt.getTime() - this.startedAt.getTime()) / 1000);

      // Smart disposition: determine actual call outcome from collected data
      const effectiveDisposition = this.resolveDisposition();

      await this.cdrModel.create({
        robot_id: this.robotConfig.uid,
        robot_name: this.robotConfig.name,
        call_uniqueid: this.callerInfo.callUniqueId || this.channelId,
        channel_id: this.channelId,
        session_id: this.sessionId,
        caller_id: this.callerInfo.callerId,
        caller_name: this.callerInfo.callerName,
        started_at: this.startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        disposition: effectiveDisposition,
        last_action: this.lastActionType,
        transfer_target: this.lastTransferTarget,
        total_steps: this.stepCount,
        matched_keywords_count: this.totalMatches,
        no_match_count: this.noMatchCount,
        avg_confidence: this.totalMatches > 0
          ? Math.round((this.totalConfidence / this.totalMatches) * 100) / 100
          : null,
        collected_slots: {
          ...(this.slotFillingState?.filledSlots || {}),
          ...this.dialogueContext,
        },
        transcript: this.transcript.join('\n') || null,
        tags: this.visitedTags.length > 0 ? this.visitedTags : null,
        user_uid: this.robotConfig.user_uid,
      });

      this.logger.log(
        `CDR written: ${this.sessionId} (${effectiveDisposition}, ${durationSeconds}s, ${this.stepCount} steps, ` +
        `action=${this.lastActionType || 'none'}, infoDelivered=${this.informationDelivered})`,
      );
    } catch (e: any) {
      this.logger.error(`Failed to write CDR: ${e.message}`);
    }
  }

  /**
   * Resolve final CDR disposition based on explicit status + collected data.
   *
   * Priority:
   *  1. Explicitly set dispositions (error, timeout, max_steps) — always respected
   *  2. Bot executed a terminal action (transfer_exten, hangup) — 'completed'
   *  3. Caller received information (data list found, webhook data) — 'completed'
   *     even if the caller hung up (they got the info they needed)
   *  4. Some meaningful interaction but no data delivered — 'caller_hangup'
   *  5. No interaction at all — 'caller_hangup'
   */
  private resolveDisposition(): string {
    // 1. Explicit error/timeout/max_steps — always take priority
    if (['error', 'timeout', 'max_steps'].includes(this.cdrDisposition)) {
      return this.cdrDisposition;
    }

    // 2. Bot executed a terminal action (transfer or hangup by scenario) — success
    if (this.lastActionType === 'transfer_exten' || this.lastActionType === 'hangup') {
      return 'completed';
    }

    // 3. Transfer happened — success
    if (this.lastTransferTarget) {
      return 'completed';
    }

    // 4. Check if caller received meaningful information during the session
    if (this.callerReceivedInformation()) {
      return 'completed';
    }

    // 5. Some interaction happened but no data found — caller left mid-flow
    if (this.totalMatches > 0 && this.stepCount >= 2) {
      return 'caller_hangup';
    }

    // 6. Very short call, no interaction
    if (this.stepCount === 0 || this.totalMatches === 0) {
      return 'caller_hangup';
    }

    return this.cdrDisposition;
  }

  /**
   * Determine if the caller received meaningful information during the session.
   *
   * Checks multiple signals:
   * - Explicit informationDelivered flag (set by data list search / webhook)
   * - dialogueContext has any non-empty data values
   *   (webhook/data-list results are stored here)
   */
  private callerReceivedInformation(): boolean {
    // Explicit flag set by data list search or webhook success
    if (this.informationDelivered) {
      return true;
    }

    // Check dialogueContext for any data that was delivered to the caller
    const ctx = this.dialogueContext;
    const dataKeys = Object.keys(ctx).filter(k =>
      !k.startsWith('_') && ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== '',
    );
    if (dataKeys.length > 0) {
      return true;
    }

    return false;
  }

  // ─── Inactivity Timer ──────────────────────────────────────

  /**
   * Start inactivity timer after bot finishes speaking.
   * If user doesn't respond within silence_timeout_seconds,
   * repeat the last question. After MAX_INACTIVITY_REPEATS,
   * execute fallback action.
   */
  private startInactivityTimer(): void {
    // Guard: don't start timers after session cleanup
    if (this.cleanedUp) return;
    this.clearInactivityTimer();

    const timeoutSec = this.robotConfig.silence_timeout_seconds || 15;
    const maxRepeats = this.robotConfig.max_inactivity_repeats ?? 3;
    this.logger.debug(`[Inactivity] Timer started: ${timeoutSec}s (repeat ${this.inactivityRepeatCount}/${maxRepeats})`);

    this.inactivityTimer = setTimeout(() => {
      this.handleInactivityTimeout();
    }, timeoutSec * 1000);
  }

  /**
   * Clear the inactivity timer (called when user starts speaking).
   */
  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Handle inactivity timeout:
   * 1. If repeats < MAX → repeat last bot response
   * 2. If repeats >= MAX → execute fallback action or exit
   */
  private async handleInactivityTimeout(): Promise<void> {
    // Guard: don't process timeout after session cleanup
    if (this.cleanedUp) return;
    this.inactivityRepeatCount++;
    const maxRepeats = this.robotConfig.max_inactivity_repeats ?? 3;

    if (this.inactivityRepeatCount > maxRepeats) {
      this.inactivityFallbackCycles++;
      this.logger.warn(
        `[Inactivity] Max repeats (${maxRepeats}) exceeded — fallback cycle ${this.inactivityFallbackCycles}/${VoiceRobotSession.MAX_INACTIVITY_FALLBACK_CYCLES}`,
      );
      this.inactivityRepeatCount = 0;

      // Safety net: if fallback keeps returning to 'listen', stop after N cycles
      if (this.inactivityFallbackCycles >= VoiceRobotSession.MAX_INACTIVITY_FALLBACK_CYCLES) {
        this.logger.warn(`[Inactivity] Max fallback cycles reached — hanging up`);
        this.cdrDisposition = 'timeout';
        await this.ariClient.setChannelVar(this.channelId, 'ROBOT_STATUS', 'INACTIVITY_HANGUP').catch(() => {});
        await this.ariClient.hangupChannel(this.channelId).catch(() => {});
        return;
      }

      const fallbackAction = this.robotConfig.fallback_bot_action;
      if (fallbackAction) {
        await this.executeBotAction(fallbackAction, {
          keyword: { uid: -1, keywords: '' } as any,
          confidence: 0,
          matchedPhrase: '',
          matchedWordCount: 0,
          method: 'fallback',
        });
      } else {
        await this.exitToFallback('INACTIVITY_TIMEOUT');
      }
      return;
    }

    this.logger.log(`[Inactivity] No response — repeating last question (${this.inactivityRepeatCount}/${maxRepeats})`);

    // Repeat last bot response
    if (this.lastBotResponse && this.lastBotResponse.value) {
      await this.speakResponse(this.lastBotResponse);
    } else {
      // No last response to repeat → start timer again anyway
      this.startInactivityTimer();
    }
  }

  /**
   * Full cleanup — idempotent, call on StasisEnd or error.
   */
  cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    this.logger.log(`Cleaning up session for ${this.channelId}`);

    // Write CDR record (async, fire-and-forget)
    this.writeCdr().catch((e) => this.logger.error(`CDR write failed: ${e.message}`));

    // Cancel timers
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    this.clearInactivityTimer();

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

  /** Set CDR disposition (called before cleanup for specific exit reasons) */
  setDisposition(disposition: typeof this.cdrDisposition): void {
    this.cdrDisposition = disposition;
  }
}
