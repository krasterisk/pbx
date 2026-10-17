import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { fn, literal, Op, type WhereOptions } from 'sequelize';
import type { CcDashboardLosses } from '@krasterisk/shared';
import { CcMissedCall } from '../models/missed-call.model';

export const RECOVERY_FAST_SEC = 15 * 60;
export const RECOVERY_SLOW_SEC = 60 * 60;

type Row = Record<string, string | number | null | undefined>;

const num = (value: string | number | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Seconds between the abandon and the operator's callback; the only dialect-specific SQL here. */
export function recoverySecondsSql(dialect: string): string {
  return dialect === 'postgres'
    ? 'EXTRACT(EPOCH FROM (called_back_at - created_at))'
    : 'TIMESTAMPDIFF(SECOND, created_at, called_back_at)';
}

const countWhen = (condition: string) => fn('COALESCE', fn('SUM', literal(`CASE WHEN ${condition} THEN 1 ELSE 0 END`)), 0);

/**
 * Lost-call recovery for the management dashboard (cc-analytics E, section "Losses").
 * Reads `cc_missed_calls` (one row per abandoned call), so it needs no new storage.
 */
@Injectable()
export class CallCenterLossesService {
  constructor(@InjectModel(CcMissedCall) private readonly missedCallModel: typeof CcMissedCall) {}

  private where(userUid: number, from: Date, to: Date, queues: readonly string[]): WhereOptions {
    return {
      user_uid: userUid,
      personal: false,
      created_at: { [Op.gte]: from, [Op.lt]: to },
      ...(queues.length > 0 ? { queue_name: { [Op.in]: [...queues] } } : {}),
    };
  }

  async countLost(userUid: number, from: Date, to: Date, queues: readonly string[]): Promise<number> {
    return this.missedCallModel.count({ where: this.where(userUid, from, to, queues) });
  }

  async getLosses(
    userUid: number,
    window: { from: Date; to: Date },
    previous: { from: Date; to: Date } | null,
    queues: readonly string[],
  ): Promise<CcDashboardLosses> {
    const dialect = this.missedCallModel.sequelize?.getDialect() ?? 'mysql';
    const diff = recoverySecondsSql(dialect);
    const byAgent = 'called_back = TRUE AND called_back_at IS NOT NULL';

    const [row, previousTotal] = await Promise.all([
      this.missedCallModel.findOne({
        raw: true,
        where: this.where(userUid, window.from, window.to, queues),
        attributes: [
          [fn('COUNT', literal('*')), 'total'],
          [countWhen('called_back = TRUE'), 'agent'],
          [countWhen(`${byAgent} AND ${diff} <= ${RECOVERY_FAST_SEC}`), 'fast'],
          [countWhen(`${byAgent} AND ${diff} <= ${RECOVERY_SLOW_SEC}`), 'slow'],
          [countWhen('called_back = FALSE AND client_called_back = TRUE'), 'client'],
          [countWhen('COALESCE(hold_time, 0) <= 5'), 'b5'],
          [countWhen('COALESCE(hold_time, 0) > 5 AND COALESCE(hold_time, 0) <= 20'), 'b20'],
          [countWhen('COALESCE(hold_time, 0) > 20 AND COALESCE(hold_time, 0) <= 60'), 'b60'],
          [countWhen('COALESCE(hold_time, 0) > 60'), 'b60p'],
        ],
      }) as Promise<Row | null>,
      previous ? this.countLost(userUid, previous.from, previous.to, queues) : Promise.resolve(null),
    ]);

    const total = num(row?.total);
    const recoveredByAgent = num(row?.agent);
    const clientCalledBack = num(row?.client);
    return {
      total,
      previousTotal,
      recoveredByAgent,
      recoveredWithin15: num(row?.fast),
      recoveredWithin60: num(row?.slow),
      clientCalledBack,
      pending: Math.max(0, total - recoveredByAgent - clientCalledBack),
      waitBuckets: { upTo5: num(row?.b5), upTo20: num(row?.b20), upTo60: num(row?.b60), over60: num(row?.b60p) },
    };
  }
}
