import { Injectable, Logger, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import * as fs from 'fs';
import { Op } from 'sequelize';
import type { CcAiProvider } from '../ai-agents/models/ai-provider.model';
import { AiProvidersService } from '../ai-agents/ai-providers.service';
import { SttEnginesService } from '../stt-engines/stt-engines.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { SttProviderFactory } from '../voice-robots/providers/provider-factory';
import {
  LlmSummaryService,
  parseAndValidateSummary,
  resolveChatCompletionsUrl,
} from './llm-summary.service';
import { VoicemailMessage } from './voicemail-message.model';
import { safeVoicemailFilePath, VoicemailService } from './voicemail.service';
import { parseWavPcm16 } from './wav-pcm.util';

const SCAN_INTERVAL_MS = 30_000;
const SCAN_LEASE_MS = 60_000;
const NOTIFY_BATCH = 20;
const TRANSCRIPT_BATCH = 20;
const MAX_NOTIFY_ATTEMPTS = 3;
const MAX_TRANSCRIPT_ATTEMPTS = 3;
const NOTIFY_BACKOFF_MS = [60_000, 4 * 60_000];
const MAX_WAV_BYTES = 20 * 1024 * 1024;
const MIN_LLM_CHARS = 8;

@Injectable()
export class VoicemailScannerService {
  private readonly logger = new Logger(VoicemailScannerService.name);
  private running = false;

  constructor(
    @InjectModel(VoicemailMessage) private readonly messages: typeof VoicemailMessage,
    private readonly voicemail: VoicemailService,
    @Optional() private readonly sttEngines?: SttEnginesService,
    @Optional() private readonly sttFactory?: SttProviderFactory,
    @Optional() private readonly llm?: LlmSummaryService,
    @Optional() private readonly aiProviders?: AiProvidersService,
    @Optional() private readonly systemSettings?: SystemSettingsService,
  ) {}

  @Interval('vm-scan', SCAN_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.scanOnce();
    } catch (e) {
      this.logger.warn(`vm scan: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async scanOnce(): Promise<void> {
    const now = new Date();
    const notifyDue = await this.messages.findAll({
      where: {
        notify_status: 'pending',
        next_notify_at: { [Op.lte]: now },
        [Op.or]: [
          { scan_locked_until: null },
          { scan_locked_until: { [Op.lte]: now } },
        ],
      },
      limit: NOTIFY_BATCH,
    });

    const transcriptDue = this.sttEngines && this.sttFactory
      ? await this.messages.findAll({
          where: { transcript_status: 'pending' },
          limit: TRANSCRIPT_BATCH,
        })
      : [];

    for (const row of notifyDue) {
      await row.update({
        scan_locked_until: new Date(Date.now() + SCAN_LEASE_MS),
      });
      try {
        await this.voicemail.retryNotify(row);
        await row.update({
          notify_status: 'sent',
          notify_error: null,
          scan_locked_until: null,
        });
      } catch (e) {
        await this.markNotifyFail(row, (e as Error).message ?? 'notify_error');
      }
    }

    for (const row of transcriptDue) {
      await this.processTranscript(row);
    }
  }

  async retryTranscript(uniqueid: string): Promise<void> {
    const row = await this.messages.findOne({ where: { uniqueid } });
    if (!row) return;
    await row.update({
      transcript_status: 'pending',
      transcript_attempts: 0,
    });
  }

  private async processTranscript(row: VoicemailMessage): Promise<void> {
    const engine = await this.resolveEngine(row);
    if (!engine) {
      await row.update({ transcript_status: 'not_configured' });
      return;
    }

    try {
      const cfg = await this.systemSettings!.getServerConfigRaw();
      const basePath = cfg.records_base_path || '/usr/records';
      const filePath = safeVoicemailFilePath(basePath, row.file_rel);
      if (!filePath) {
        throw new Error('file_missing');
      }

      const stat = await fs.promises.stat(filePath);
      if (stat.size > MAX_WAV_BYTES) {
        throw new Error('wav_too_large');
      }

      const wavBuf = await fs.promises.readFile(filePath);
      const pcm = parseWavPcm16(wavBuf);
      if (pcm.sampleRate !== 8000 || pcm.channels !== 1) {
        throw new Error('bad wav');
      }

      const stt = await this.sttFactory!.transcribe(engine, pcm.pcm, 'ru-RU');
      const transcript = String(stt.text ?? '').trim();
      await row.update({ transcript });

      const provider = await this.pickLlm(row);
      if (!provider || transcript.length < MIN_LLM_CHARS) {
        await row.update({ transcript_status: 'ready', summary: row.summary ?? '' });
        return;
      }

      const raw = await this.llm!.summarize(provider, transcript);
      const parsed = parseAndValidateSummary(raw, transcript);
      await row.update({ transcript_status: 'ready', summary: parsed.summary });
    } catch (e) {
      this.logger.warn(`vm stt uid=${row.uid}: ${(e as Error).message}`);
      await this.markTranscriptFail(row);
    }
  }

  private async resolveEngine(row: VoicemailMessage) {
    const stepUid = Number((row as VoicemailMessage & { stt_engine_uid?: number }).stt_engine_uid);
    if (Number.isInteger(stepUid) && stepUid > 0) {
      try {
        return await this.sttEngines!.findOne(stepUid, row.user_uid);
      } catch {
        // fall through to tenant default
      }
    }
    const all = await this.sttEngines!.findAll(row.user_uid);
    return all[0] ?? null;
  }

  private async pickLlm(row: VoicemailMessage): Promise<CcAiProvider | null> {
    if (!this.aiProviders || !this.llm) return null;
    const stepUid = Number((row as VoicemailMessage & { llm_provider_uid?: number }).llm_provider_uid);
    const all = await this.aiProviders.findAll(row.user_uid);
    const httpLlm = all.filter((p) => (
      p.enabled
      && Array.isArray(p.capabilities)
      && p.capabilities.includes('llm')
      && resolveChatCompletionsUrl(p.endpoint)
    ));
    if (Number.isInteger(stepUid) && stepUid > 0) {
      const match = httpLlm.find((p) => p.uid === stepUid);
      if (match) return match;
    }
    return httpLlm[0] ?? null;
  }

  private async markNotifyFail(row: VoicemailMessage, error: string): Promise<void> {
    const attempts = Number(row.notify_attempts ?? 0) + 1;
    if (attempts >= MAX_NOTIFY_ATTEMPTS) {
      await row.update({
        notify_status: 'failed',
        notify_attempts: attempts,
        notify_error: String(error).slice(0, 2000),
        scan_locked_until: null,
      });
      return;
    }
    await row.update({
      notify_status: 'pending',
      notify_attempts: attempts,
      notify_error: String(error).slice(0, 2000),
      next_notify_at: new Date(Date.now() + NOTIFY_BACKOFF_MS[attempts - 1]),
      scan_locked_until: null,
    });
  }

  private async markTranscriptFail(row: VoicemailMessage): Promise<void> {
    const attempts = Number(row.transcript_attempts ?? 0) + 1;
    if (attempts >= MAX_TRANSCRIPT_ATTEMPTS) {
      await row.update({
        transcript_status: 'failed',
        transcript_attempts: attempts,
      });
      return;
    }
    await row.update({
      transcript_status: 'pending',
      transcript_attempts: attempts,
    });
  }
}
