import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/sequelize';
import * as path from 'path';
import { MailerService } from '../mailer/mailer.service';
import { TelegramService } from '../telegram/telegram.service';
import { NumbersService } from '../numbers/numbers.service';
import { TtsEnginesService } from '../tts-engines/tts-engines.service';
import { IvrTtsService } from '../ivrs/ivr-tts.service';
import { IvrTtsCacheService } from '../ivrs/ivr-tts-cache.service';
import { Route } from '../routes/route.model';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import {
  assertSafeHttpUrl,
  HTTP_REQUEST_DEFAULT_TIMEOUT,
  pickAllowedHttpHeaders,
} from '../../shared/utils/dialplan-http.util';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import type {
  HttpRequestDialplanDto,
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
    @InjectModel(Route) private readonly routeModel: typeof Route,
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

  async httpRequest(body: HttpRequestDialplanDto): Promise<string> {
    const url = String(body.url ?? '').trim();
    if (!url) return '';
    try {
      assertSafeHttpUrl(url);
    } catch (e: any) {
      this.logger.warn(`Dialplan http-request rejected URL: ${e?.message ?? e}`);
      return '';
    }

    const method = String(body.method ?? 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
    const timeoutRaw = Number(body.timeout);
    const timeoutMs = (Number.isFinite(timeoutRaw) && timeoutRaw > 0
      ? Math.min(Math.floor(timeoutRaw), 60)
      : HTTP_REQUEST_DEFAULT_TIMEOUT) * 1000;
    const headers = await this.resolveHttpRequestHeaders(body);

    try {
      const response = await this.http.axiosRef.request({
        url,
        method,
        data: method === 'POST' ? (body.body ?? '') : undefined,
        timeout: timeoutMs,
        maxRedirects: 0,
        headers,
        validateStatus: () => true,
      });
      const data = response?.data;
      return typeof data === 'string' ? data : JSON.stringify(data ?? '');
    } catch (e: any) {
      this.logger.error(`Dialplan http-request failed: ${e?.message ?? e}`);
      return '';
    }
  }

  private async resolveHttpRequestHeaders(
    body: HttpRequestDialplanDto,
  ): Promise<Record<string, string>> {
    const routeUid = String(body.route_uid ?? '').trim();
    const actionId = String(body.action_id ?? '').trim();
    const tenant = Number(body.vpbx_user_uid);
    if (!routeUid || !actionId || !Number.isFinite(tenant)) {
      return {};
    }
    const uid = parseInt(routeUid, 10);
    if (!uid) return {};
    const route = await this.routeModel.findOne({ where: { uid, user_uid: tenant } });
    const actions = Array.isArray(route?.actions) ? route.actions : [];
    const action = actions.find(
      (item: { id?: string; type?: string }) => item?.id === actionId && item?.type === 'http_request',
    );
    return pickAllowedHttpHeaders(action?.params?.headers);
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
    const settings: IIvrPhraseTtsSettings = {};
    if (body.voice) settings.voice = body.voice;
    if (body.language_code) settings.language_code = body.language_code;
    if (body.speed) settings.speed = body.speed;
    if (body.speaking_rate) settings.speaking_rate = body.speaking_rate;
    if (body.role) settings.role = body.role;
    if (body.pitch_shift) settings.pitch_shift = body.pitch_shift;
    try {
      const wav = await this.ivrTts.synthesizeToBuffer(engine, text, settings);
      const cacheKey = IvrTtsCacheService.buildCacheKey({
        engine: engineUid,
        text,
        settings,
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
