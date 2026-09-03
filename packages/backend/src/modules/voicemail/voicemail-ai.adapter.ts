import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import { VoicemailService } from './voicemail.service';

type VoicemailRowLike = {
  uid: number;
  user_uid?: number;
  vpbx_user_uid?: number;
  uniqueid: string;
  file_rel: string;
  record_status?: string | null;
  caller_id?: string | null;
  exten?: string | null;
  duration_sec?: number | null;
  notify_status: string;
  transcript_status: string;
  notify_attempts?: number | null;
  transcript_attempts?: number | null;
  next_notify_at?: Date | string | null;
  scan_locked_until?: Date | string | null;
  transcript?: string | null;
  summary?: string | null;
  notify_error?: string | null;
  created_at: Date | string;
};

/**
 * VoicemailAiAdapter — Domain AI Adapter for tenant voicemail messages (D-58).
 *
 * Read-only tools, registered through AiAdapterRegistryService (MCP + /api/ai-tools/*).
 * Every handler receives `vpbxUserUid` as a call parameter — never closed over (D-23).
 * Payloads never include the opaque play-token URL (T-13-22).
 */
@Injectable()
export class VoicemailAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(VoicemailAiAdapter.name);
  readonly domain = 'voicemail';

  constructor(
    private readonly voicemailService: VoicemailService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('VoicemailAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListVoicemailMessages(), this.toolGetVoicemailMessage()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Голосовая почта (Voicemail)
- Сообщение = WAV после Record() + две независимые оси статуса: notify_status и transcript_status.
- notify_status: pending | sent | failed. transcript_status: pending | ready | failed | not_configured.
- Операторы читают сообщения на вкладке CDR-отчёта (Surface L), не через VoiceMailMain.
- MWI / mailbox / VoiceMail() в продукте нет и не используется.
- Расшифровка опциональна: нет STT/LLM — файл и notify уже есть, это не авария АТС.
- Воспроизведение только по JWT или одноразовой ссылке уведомления; AI-инструменты токен не отдают.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const messages = await this.voicemailService.list(vpbxUserUid);
    if (messages.length === 0) return '';
    return `Голосовая почта: ${messages.length} сообщений`;
  }

  private toolListVoicemailMessages(): AiToolDefinition {
    return {
      name: 'list_voicemail_messages',
      description:
        'Список сообщений голосовой почты тенанта: uniqueid, caller, exten, две оси статуса, краткое summary. Без URL воспроизведения.',
      inputSchema: {},
      entityType: 'voicemail_message',
      handler: async (_args, vpbxUserUid) => {
        const rows = await this.voicemailService.list(vpbxUserUid);
        return { messages: rows.map((row) => this.toSafeMessage(row)) };
      },
    };
  }

  private toolGetVoicemailMessage(): AiToolDefinition {
    return {
      name: 'get_voicemail_message',
      description:
        'Одно сообщение голосовой почты по uniqueid в пределах тенанта. Чужой uniqueid — not-found. Без URL воспроизведения.',
      inputSchema: {
        uniqueid: { type: 'string', description: 'Asterisk UNIQUEID сообщения' },
      },
      entityType: 'voicemail_message',
      handler: async (args, vpbxUserUid) => {
        try {
          const row = await this.voicemailService.findByUniqueid(
            vpbxUserUid,
            String(args.uniqueid ?? ''),
          );
          return this.toSafeMessage(row);
        } catch (err) {
          if (err instanceof NotFoundException) {
            return { found: false };
          }
          throw err;
        }
      },
    };
  }

  /** Whitelist IVoicemailMessage fields — never token / play-by-token / notify_dispatch. */
  private toSafeMessage(row: VoicemailRowLike) {
    return {
      uid: row.uid,
      vpbx_user_uid: row.vpbx_user_uid ?? row.user_uid,
      uniqueid: row.uniqueid,
      file_rel: row.file_rel,
      record_status: row.record_status ?? '',
      caller_id: row.caller_id ?? '',
      exten: row.exten ?? '',
      duration_sec: row.duration_sec ?? undefined,
      notify_status: row.notify_status,
      transcript_status: row.transcript_status,
      notify_attempts: row.notify_attempts ?? 0,
      transcript_attempts: row.transcript_attempts ?? 0,
      next_notify_at: row.next_notify_at ?? null,
      scan_locked_until: row.scan_locked_until ?? null,
      transcript: row.transcript ?? undefined,
      summary: row.summary ?? undefined,
      notify_error: row.notify_error ?? undefined,
      created_at: row.created_at,
    };
  }
}
