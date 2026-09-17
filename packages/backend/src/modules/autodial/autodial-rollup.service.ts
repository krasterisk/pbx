import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectConnection } from '@nestjs/sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { AutodialStateService } from './autodial-state.service';

/**
 * Nightly aggregation of `ac_attempts` into `ac_daily_campaign_stats`, matching
 * the cc_daily_queue_stats pattern. Reports over closed days then never touch
 * the attempt table.
 */
@Injectable()
export class AutodialRollupService {
  private readonly logger = new Logger(AutodialRollupService.name);

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly state: AutodialStateService,
  ) {}

  /** 00:20 local — after Asterisk has flushed the last CDRs of the day. */
  @Cron('0 20 0 * * *')
  async nightlyRollup(): Promise<void> {
    const day = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    try {
      const rows = await this.rollupDay(day);
      this.logger.log(`Autodial rollup for ${day}: ${rows} campaign row(s)`);
    } catch (e) {
      this.logger.error(`Autodial rollup for ${day} failed: ${(e as Error).message}`);
    }
    // Live counters are per reporting day, so they reset with the rollup.
    this.state.resetDailyCounters();
  }

  /**
   * Idempotent: re-running a day replaces its rows rather than doubling them.
   * Exposed so a missed night can be backfilled by hand.
   */
  async rollupDay(day: string): Promise<number> {
    await this.sequelize.query('DELETE FROM ac_daily_campaign_stats WHERE day = :day', {
      replacements: { day },
      type: QueryTypes.DELETE,
    });

    const [inserted] = await this.sequelize.query(
      `INSERT INTO ac_daily_campaign_stats
         (vpbx_user_uid, campaign_uid, day, dials, answered, success, short,
          no_answer, busy, amd, failed, talk_sec_sum, billsec_sum)
       SELECT vpbx_user_uid,
              campaign_uid,
              :day,
              COUNT(*),
              SUM(answered_at IS NOT NULL),
              SUM(disposition = 'success'),
              SUM(disposition = 'answered_short'),
              SUM(disposition = 'no_answer'),
              SUM(disposition = 'busy'),
              SUM(disposition IN ('amd_machine','voicemail')),
              SUM(disposition IN ('failed','congestion','invalid_number')),
              COALESCE(SUM(talk_sec), 0),
              COALESCE(SUM(billsec), 0)
         FROM ac_attempts
        WHERE started_at >= :dayStart
          AND started_at < :dayEnd
          AND disposition <> 'dialing'
        GROUP BY vpbx_user_uid, campaign_uid`,
      {
        replacements: {
          day,
          dayStart: `${day} 00:00:00`,
          dayEnd: `${day} 23:59:59`,
        },
        type: QueryTypes.INSERT,
      },
    );
    return typeof inserted === 'number' ? inserted : 0;
  }
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
