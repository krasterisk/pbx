import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as path from 'path';
import { MailerService } from '../mailer/mailer.service';
import { TelegramService } from '../telegram/telegram.service';
import { NumbersService } from '../numbers/numbers.service';
import { TtsEnginesService } from '../tts-engines/tts-engines.service';
import { IvrTtsService } from '../ivrs/ivr-tts.service';
import { IvrTtsCacheService } from '../ivrs/ivr-tts-cache.service';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import type {
  SendmailPeerDialplanDto,
  SetclidDialplanDto,
  TelegramDialplanDto,
  TtsDialplanDto,
  WebhookDialplanDto,
} from './dto/dialplan-bridge.dto';

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function pickCallerId(numbers: unknown, clidnum: string): string {
  if (Array.isArray(numbers)) {
    const mapped = numbers.find((item) => {
      if (typeof item === 'string') return item === clidnum;
      if (item && typeof item === 'object' && 'from' in item) {
        return String((item as { from?: string }).from) === clidnum;
      }
      return false;
    });
    if (typeof mapped === 'string') return mapped;
    if (mapped && typeof mapped === 'object' && 'to' in mapped) {
      return String((mapped as { to?: string }).to ?? '');
    }
    const first = numbers.find((item) => typeof item === 'string' && item);
    return typeof first === 'string' ? first : '';
  }
  if (numbers && typeof numbers === 'object') {
    const map = numbers as Record<string, unknown>;
    if (clidnum && map[clidnum] != null) return String(map[clidnum]);
    if (Array.isArray(map.numbers)) return pickCallerId(map.numbers, clidnum);
  }
  return '';
}

@Injectable()
export class DialplanBridgeService {
  private readonly logger = new Logger(DialplanBridgeService.name);

  constructor(
    private readonly numbers: NumbersService,
    private readonly http: HttpService,
    private readonly mailer: MailerService,
    private readonly telegramBot: TelegramService,
    private readonly ttsEngines: TtsEnginesService,
    private readonly ivrTts: IvrTtsService,
    private readonly ttsCache: IvrTtsCacheService,
  ) {}

  async setclid(body: SetclidDialplanDto): Promise<{ callerid: string }> {
    const listUid = Number(body.list_uid);
    const tenant = Number(body.vpbx_user_uid);
    if (!Number.isFinite(listUid) || !Number.isFinite(tenant)) {
      return { callerid: '' };
    }
    const list = await this.numbers.findById(listUid, tenant);
    if (!list) return { callerid: '' };
    return { callerid: pickCallerId(list.numbers, String(body.clidnum ?? '')) };
  }

  async webhook(body: WebhookDialplanDto): Promise<{ body: string; error?: string }> {
    const url = String(body.url ?? '');
    if (!isHttpUrl(url)) {
      this.logger.warn('Dialplan webhook skipped: invalid or non-http(s) URL');
      return { body: '', error: 'invalid_url' };
    }
    try {
      const response = await this.http.axiosRef.post(
        url,
        {
          clid: body.clid ?? '',
          exten: body.exten ?? '',
          uniqueid: body.uniqueid ?? '',
          vpbx_user_uid: body.vpbx_user_uid ?? '',
        },
        { timeout: 5_000, maxRedirects: 0 },
      );
      const data = response?.data;
      return { body: typeof data === 'string' ? data : JSON.stringify(data ?? '') };
    } catch (e: any) {
      this.logger.error(`Dialplan webhook failed: ${e?.message ?? e}`);
      return { body: '', error: e?.message ?? 'webhook_failed' };
    }
  }

  async sendmailpeer(body: SendmailPeerDialplanDto): Promise<{ accepted: true }> {
    try {
      const to = String(body.exten ?? '');
      if (to.includes('@')) {
        await this.mailer.sendNotification({
          to,
          text: body.text ?? '',
        });
      } else {
        await this.mailer.sendNotification({
          to: `${to}@localhost`,
          text: body.text ?? '',
        });
      }
    } catch (e: any) {
      this.logger.error(`sendmailpeer failed: ${e?.message ?? e}`);
    }
    return { accepted: true };
  }

  async telegram(body: TelegramDialplanDto): Promise<{ accepted: true }> {
    try {
      const text = [
        body.text ?? '',
        body.chat_id ? `chat_id=${body.chat_id}` : '',
        body.clid ? `clid=${body.clid}` : '',
      ].filter(Boolean).join('\n');
      await this.telegramBot.sendMessage(text);
    } catch (e: any) {
      this.logger.error(`telegram notify failed: ${e?.message ?? e}`);
    }
    return { accepted: true };
  }

  async tts(body: TtsDialplanDto): Promise<{ status: string; file: string }> {
    const tenant = Number(body.vpbx_user_uid);
    const engineUid = Number(body.engine);
    const text = String(body.text ?? '').trim();
    const engines = Number.isFinite(tenant)
      ? await this.ttsEngines.findAll(tenant)
      : [];
    const engine = engines.find((item) => item.uid === engineUid);
    if (!engine) {
      throw new BadRequestException('Unknown TTS engine');
    }
    try {
      const wav = await this.ivrTts.synthesizeToBuffer(engine, text, {
        voice: body.voice,
        language_code: body.language,
      });
      const cacheKey = IvrTtsCacheService.buildCacheKey({
        engine: engineUid,
        text,
        voice: body.voice ?? '',
        language: body.language ?? '',
      });
      const written = this.ttsCache.writeWav(tenant, cacheKey, wav);
      const file = AsteriskDialplanUtils.sanitizeFilePath(
        path.basename(written).replace(/\.[^.]+$/, ''),
      );
      return { status: 'ok', file };
    } catch (e: any) {
      this.logger.error(`TTS engine failed: ${e?.message ?? e}`);
      return { status: 'error', file: '' };
    }
  }
}
