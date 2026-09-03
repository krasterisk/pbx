import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { VoicemailMessage } from './voicemail-message.model';
import { VoicemailService } from './voicemail.service';

const SCAN_INTERVAL_MS = 30_000;
const SCAN_LEASE_MS = 60_000;
const NOTIFY_BATCH = 20;
const MAX_NOTIFY_ATTEMPTS = 3;
const NOTIFY_BACKOFF_MS = [60_000, 4 * 60_000];

@Injectable()
export class VoicemailScannerService {
  private readonly logger = new Logger(VoicemailScannerService.name);
  private running = false;

  constructor(
    @InjectModel(VoicemailMessage) private readonly messages: typeof VoicemailMessage,
    private readonly voicemail: VoicemailService,
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
    const due = await this.messages.findAll({
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

    for (const row of due) {
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
}
