import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { VoicemailMessage } from './voicemail-message.model';

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

@Injectable()
export class VoicemailService {
  private readonly logger = new Logger(VoicemailService.name);

  constructor(
    @InjectModel(VoicemailMessage) private readonly messages: typeof VoicemailMessage,
  ) {}

  /**
   * Hangup-handler ingest (D-60 / D-62 / D-72). Upserts the row only.
   * Does not call STT, LLM, or notify.
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

    await this.messages.create({
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
  }

  list(vpbxUserUid: number) {
    return this.messages.findAll({
      where: { user_uid: vpbxUserUid },
      order: [['created_at', 'DESC']],
    });
  }
}
