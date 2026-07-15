import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import { QueueLogEntry, QueueLogReader } from './queue-log-reader.interface';
import { parseQueueLogTimestamp } from './file-queue-log-reader';

/**
 * Realtime-table reader for Asterisk `queue_log` in the same MySQL DB.
 *
 * Confirmed schema (07-04 Task 1 on target DB):
 *   time, callid, queuename, agent, event, data, data1..data5, userfield
 *
 * SQL uses Sequelize replacements (T-07-04-05) — never string-concatenated bounds.
 */
@Injectable()
export class RealtimeQueueLogReader implements QueueLogReader {
  readonly source = 'realtime' as const;
  private readonly logger = new Logger(RealtimeQueueLogReader.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async isAvailable(): Promise<boolean> {
    try {
      const rows = await this.sequelize.query<{ name: string }>(
        "SHOW TABLES LIKE 'queue_log'",
        { type: QueryTypes.SELECT },
      );
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      this.logger.warn(`queue_log table check failed: ${(err as Error).message}`);
      return false;
    }
  }

  async readEntries(since: Date, until: Date): Promise<QueueLogEntry[]> {
    try {
      const rows = await this.sequelize.query<{
        time: string;
        callid: string;
        queuename: string;
        agent: string;
        event: string;
        data: string | null;
        data1: string | null;
        data2: string | null;
        data3: string | null;
        data4: string | null;
        data5: string | null;
      }>(
        `SELECT time, callid, queuename, agent, event, data, data1, data2, data3, data4, data5
         FROM queue_log
         WHERE time BETWEEN :since AND :until
         ORDER BY time ASC`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            since: formatSqlDateTime(since),
            until: formatSqlDateTime(until),
          },
        },
      );

      const entries: QueueLogEntry[] = [];
      for (const row of rows) {
        const timestamp = parseQueueLogTimestamp(String(row.time ?? ''));
        if (!timestamp || !row.callid) continue;
        const params = [row.data1, row.data2, row.data3, row.data4, row.data5]
          .map((p) => (p == null ? '' : String(p)));
        // Some installs put first param in `data` when data1 is empty
        if (!params[0] && row.data) params[0] = String(row.data);
        entries.push({
          timestamp,
          callId: String(row.callid),
          queueName: String(row.queuename || ''),
          agent: String(row.agent || ''),
          event: String(row.event || '').toUpperCase(),
          params,
        });
      }
      return entries;
    } catch (err) {
      this.logger.warn(`queue_log realtime read failed: ${(err as Error).message}`);
      return [];
    }
  }
}

function formatSqlDateTime(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
