import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { ATTACHMENT_REJECTED } from '../notifications/providers/notification-provider.interface';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { VoicemailAccessToken } from './voicemail-access-token.model';
import { VoicemailMessage } from './voicemail-message.model';

export const PLAY_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** D-64/D-65: attach iff size is strictly less than 2 MiB. */
export const VOICEMAIL_ATTACH_MAX_BYTES = 2 * 1024 * 1024;
const FIRST_NOTIFY_RETRY_MS = 60_000;

/** Asterisk UNIQUEID / safe filename stem: digits, letters, dot, underscore, hyphen. */
export const UNIQUEID_ALLOW = /^[A-Za-z0-9._-]{1,128}$/;

export type VoicemailIngestBody = {
  uniqueid?: string;
  file?: string;
  status?: string;
  clid?: string;
  exten?: string;
  user_uid?: string | number;
  vpbx_user_uid?: string | number;
  duration_sec?: string | number;
  integration_uid?: string | number;
  body?: string;
  target?: string;
  subject?: string;
};

export function sanitizeUniqueid(raw?: string): string | null {
  const value = String(raw ?? '').trim();
  if (!UNIQUEID_ALLOW.test(value)) return null;
  return value;
}

export function parseTenantUid(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

/**
 * D-72: rebuild a relative path under `{vpbx_user_uid}/voicemail/`.
 * Never persist a caller-supplied absolute path (T-13-05).
 */
export function toRelativeFileRel(userUid: number, uniqueid: string, file?: string): string {
  const escaped = uniqueid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normalized = String(file ?? '').replace(/\\/g, '/');
  const match = normalized.match(new RegExp(`(${escaped}-\\d+)(?:\\.wav)?$`, 'i'));
  const name = match ? `${match[1]}.wav` : `${uniqueid}.wav`;
  return `${userUid}/voicemail/${name}`;
}

/**
 * Resolve a voicemail wav under records_base_path (T-13-12).
 * Same `..` / startsWith guards as CDR; uses the DB relative path as-is (never appends .mp3).
 */
export function safeVoicemailFilePath(base: string, rel: string): string | null {
  const cleaned = String(rel ?? '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!cleaned || cleaned.includes('..')) return null;
  const baseResolved = path.resolve(base);
  const fileResolved = path.resolve(baseResolved, cleaned);
  if (!fileResolved.startsWith(baseResolved)) return null;
  return fs.existsSync(fileResolved) ? fileResolved : null;
}

@Injectable()
export class VoicemailService {
  private readonly logger = new Logger(VoicemailService.name);

  constructor(
    @InjectModel(VoicemailMessage) private readonly messages: typeof VoicemailMessage,
    @InjectModel(VoicemailAccessToken) private readonly tokens: typeof VoicemailAccessToken,
    private readonly config: ConfigService,
    private readonly systemSettings: SystemSettingsService,
    @Optional() private readonly dispatcher?: NotificationDispatcherService,
  ) {}

  /**
   * Mint a 7-day opaque play URL for notify links (D-59 / D-67).
   * Never attached to JWT list/detail JSON.
   */
  async mintPlayToken(message: Pick<VoicemailMessage, 'uid' | 'user_uid'>): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PLAY_TOKEN_TTL_MS);
    await this.tokens.create({
      token,
      message_uid: message.uid,
      vpbx_user_uid: message.user_uid,
      expires_at: expiresAt,
      revoked_at: null,
    });
    const appUrl = (this.config.get<string>('APP_URL') ?? 'https://pbx.krasterisk.ru').replace(/\/$/, '');
    return `${appUrl}/api/voicemail/play?token=${encodeURIComponent(token)}`;
  }

  async streamByPlayToken(
    token: string,
    vpbxUserUid: number,
    req: Request,
    res: Response,
  ): Promise<void> {
    const row = await this.tokens.findOne({ where: { token } });
    if (!row || row.vpbx_user_uid !== vpbxUserUid) {
      throw new NotFoundException('Voicemail message not found');
    }

    const message = await this.messages.findOne({
      where: { uid: row.message_uid, user_uid: vpbxUserUid },
    });
    if (!message) {
      throw new NotFoundException('Voicemail message not found');
    }

    const cfg = await this.systemSettings.getServerConfigRaw();
    const basePath = cfg.records_base_path || '/usr/records';
    const filePath = safeVoicemailFilePath(basePath, message.file_rel);
    if (!filePath) {
      throw new NotFoundException('Voicemail file not found');
    }

    await this.streamWavFile(filePath, message.uniqueid, req, res);
  }

  private async streamWavFile(
    filePath: string,
    uniqueid: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    let fileSize: number;
    try {
      fileSize = (await fs.promises.stat(filePath)).size;
    } catch {
      throw new NotFoundException('Voicemail file not found');
    }

    const download = req?.query?.download === '1' || req?.query?.download === 'true';
    const safeName = String(uniqueid).replace(/[^\w.-]+/g, '_');
    const disposition = download
      ? `attachment; filename="${safeName}.wav"`
      : 'inline';

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Accept-Ranges', 'bytes');

    const rangeHeader = req?.headers?.range;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }

      let start: number;
      let end: number;

      if (match[1] === '' && match[2]) {
        const suffix = parseInt(match[2], 10);
        start = Math.max(fileSize - suffix, 0);
        end = fileSize - 1;
      } else {
        start = match[1] ? parseInt(match[1], 10) : 0;
        end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      }

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }

      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(404).end();
      });
      stream.pipe(res);
      return;
    }

    res.setHeader('Content-Length', fileSize);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end();
    });
    stream.pipe(res);
  }

  /**
   * Hangup-handler ingest (D-60 / D-62 / D-72). Upserts the row, then first notify.
   * Does not call STT or LLM (D-60). Controller returns `{accepted:true}` before this settles.
   */
  async ingest(body: VoicemailIngestBody): Promise<void> {
    const uniqueid = sanitizeUniqueid(body.uniqueid);
    if (!uniqueid) {
      this.logger.warn('voicemail ingest rejected: invalid uniqueid');
      return;
    }

    const userUid = parseTenantUid(body.vpbx_user_uid ?? body.user_uid);
    if (userUid == null) {
      this.logger.warn('voicemail ingest rejected: invalid tenant uid');
      return;
    }

    const fileRel = toRelativeFileRel(userUid, uniqueid, body.file);
    const recordStatus = String(body.status ?? '').slice(0, 32);
    const callerId = String(body.clid ?? '').slice(0, 64);
    const exten = String(body.exten ?? '').slice(0, 64);
    const durationRaw = Number(body.duration_sec);
    const durationSec = Number.isFinite(durationRaw) && durationRaw >= 0
      ? Math.trunc(durationRaw)
      : null;

    const existing = await this.messages.findOne({
      where: { user_uid: userUid, uniqueid },
    });

    const patch = {
      file_rel: fileRel,
      record_status: recordStatus,
      caller_id: callerId,
      exten,
      duration_sec: durationSec,
    };

    if (existing) {
      await existing.update(patch);
      return;
    }

    const row = await this.messages.create({
      user_uid: userUid,
      uniqueid,
      ...patch,
      notify_status: 'pending',
      transcript_status: 'pending',
      notify_attempts: 0,
      transcript_attempts: 0,
      next_notify_at: null,
      scan_locked_until: null,
    });
    await this.sendFirstNotify(row, body);
  }

  /**
   * First notify after insert (D-62). Byte-gated attach (D-64/D-65).
   * `attachment_rejected` same-channel link fallback does not increment attempts (D-66).
   */
  private async sendFirstNotify(
    row: VoicemailMessage,
    body: VoicemailIngestBody,
  ): Promise<void> {
    const integrationUid = parseTenantUid(body.integration_uid);
    if (integrationUid == null || !this.dispatcher) return;

    try {
      const cfg = await this.systemSettings.getServerConfigRaw();
      const basePath = cfg.records_base_path || '/usr/records';
      const filePath = safeVoicemailFilePath(basePath, row.file_rel);
      if (!filePath) {
        await this.markNotifyTransportFail(row, 'file_missing');
        return;
      }

      const stat = await fs.promises.stat(filePath);
      const filename = path.posix.basename(row.file_rel.replace(/\\/g, '/')) || `${row.uniqueid}.wav`;

      if (stat.size < VOICEMAIL_ATTACH_MAX_BYTES) {
        const content = await fs.promises.readFile(filePath);
        const message = this.buildNotifyBody(body.body, row.file_rel);
        const first = await this.dispatcher.dispatch({
          integration_uid: integrationUid,
          message,
          target: body.target,
          subject: body.subject,
          clid: body.clid,
          exten: body.exten,
          uniqueid: row.uniqueid,
          attach: { filename, content, contentType: 'audio/wav' },
        });

        if (first?.success) {
          await row.update({ notify_status: 'sent', notify_error: null });
          return;
        }

        if (first?.error === ATTACHMENT_REJECTED) {
          await this.dispatchLinkNotify(row, body, integrationUid);
          return;
        }

        await this.markNotifyTransportFail(row, first?.error ?? 'transport_error');
        return;
      }

      await this.dispatchLinkNotify(row, body, integrationUid);
    } catch (e: any) {
      this.logger.error(`voicemail first notify failed: ${e?.message ?? e}`);
      await this.markNotifyTransportFail(row, e?.message ?? 'transport_error');
    }
  }

  private async dispatchLinkNotify(
    row: VoicemailMessage,
    body: VoicemailIngestBody,
    integrationUid: number,
  ): Promise<void> {
    const playUrl = await this.mintPlayToken(row);
    const message = this.buildNotifyBody(body.body, row.file_rel, playUrl);
    const result = await this.dispatcher!.dispatch({
      integration_uid: integrationUid,
      message,
      target: body.target,
      subject: body.subject,
      clid: body.clid,
      exten: body.exten,
      uniqueid: row.uniqueid,
    });

    if (result?.success) {
      await row.update({ notify_status: 'sent', notify_error: null });
      return;
    }
    await this.markNotifyTransportFail(row, result?.error ?? 'transport_error');
  }

  private buildNotifyBody(base: string | undefined, fileRel: string, playUrl?: string): string {
    const parts = [String(base ?? '').trim() || 'New voicemail', `RECORDED_FILE=${fileRel}`];
    if (playUrl) parts.push(playUrl);
    return parts.join('\n');
  }

  private async markNotifyTransportFail(row: VoicemailMessage, error: string): Promise<void> {
    await row.update({
      notify_status: 'pending',
      notify_attempts: 1,
      notify_error: String(error).slice(0, 2000),
      next_notify_at: new Date(Date.now() + FIRST_NOTIFY_RETRY_MS),
    });
  }

  list(vpbxUserUid: number) {
    return this.messages.findAll({
      where: { user_uid: vpbxUserUid },
      order: [['created_at', 'DESC']],
    });
  }
}
