import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { QueueLogEntry, QueueLogReader } from './queue-log-reader.interface';

/**
 * File-tail reader for `/var/log/asterisk/queue_log` (pipe-separated lines).
 *
 * Path is taken ONLY from env CC_QUEUE_LOG_PATH (threat T-07-04-01) —
 * never from request input. Missing/unreadable file → warn + [].
 */
@Injectable()
export class FileQueueLogReader implements QueueLogReader {
  readonly source = 'file' as const;
  private readonly logger = new Logger(FileQueueLogReader.name);
  private readonly filePath: string;

  constructor() {
    const configured = process.env.CC_QUEUE_LOG_PATH || '/var/log/asterisk/queue_log';
    const resolved = path.resolve(configured);
    if (!path.isAbsolute(resolved)) {
      throw new Error(`CC_QUEUE_LOG_PATH must resolve to an absolute path, got: ${resolved}`);
    }
    // Ensure no accidental join with untrusted segments — path is env-only.
    this.filePath = resolved;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await fs.promises.access(this.filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async readEntries(since: Date, until: Date): Promise<QueueLogEntry[]> {
    try {
      const fh = await fs.promises.open(this.filePath, 'r');
      try {
        const content = await fh.readFile({ encoding: 'utf8' });
        const entries: QueueLogEntry[] = [];
        for (const line of content.split(/\r?\n/)) {
          const parsed = FileQueueLogReader.parseLine(line);
          if (!parsed) continue;
          if (parsed.timestamp < since || parsed.timestamp > until) continue;
          entries.push(parsed);
        }
        return entries;
      } finally {
        await fh.close();
      }
    } catch (err) {
      this.logger.warn(
        `queue_log file unavailable (${this.filePath}): ${(err as Error).message}`,
      );
      return [];
    }
  }

  /** Exported for unit tests — pipe format: ts|callid|queue|agent|event|data... */
  static parseLine(line: string): QueueLogEntry | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const parts = trimmed.split('|');
    if (parts.length < 5) return null;
    const [tsRaw, callId, queueName, agent, event, ...params] = parts;
    const timestamp = parseQueueLogTimestamp(tsRaw);
    if (!timestamp || !callId) return null;
    return {
      timestamp,
      callId,
      queueName: queueName || '',
      agent: agent || '',
      event: (event || '').toUpperCase(),
      params,
    };
  }
}

export function parseQueueLogTimestamp(raw: string): Date | null {
  if (!raw) return null;
  // Classic file format: unix epoch seconds
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const sec = Number(raw);
    if (!Number.isFinite(sec)) return null;
    return new Date(sec * 1000);
  }
  const d = new Date(raw.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}
