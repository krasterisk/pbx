import { Injectable, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { Cdr } from './cdr.model';
import { CdrQueryDto } from './dto/cdr-query.dto';
import {
  classifyDirection,
  extractExtension,
  extractTrunkSlug,
  isAnswered,
  shortenChannel,
  tenantLegFilter,
} from './cdr.utils';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { PsEndpoint } from '../../endpoints/ps-endpoint.model';
import * as fs from 'fs';
import * as path from 'path';

export interface CdrCallSummary {
  linkedid: string;
  uniqueid: string;
  calldate: string;
  clid: string;
  src: string;
  usrc: string;
  dst: string;
  dialednum: string | null;
  disposition: string;
  dstchannel: string;
  duration: number;
  billsec: number;
  record: string | null;
  transid: string | null;
  dcontext: string;
  legCount: number;
  answered: boolean;
  direction: string;
  srcDisplay: string;
  dstDisplay: string;
  recordingUrl: string | null;
  hasRecording: boolean;
}

export interface CdrFilters extends CdrQueryDto {}

interface SqlParts {
  where: string;
  replacements: Record<string, unknown>;
}

@Injectable()
export class CdrService {
  constructor(
    @InjectModel(Cdr) private readonly cdrModel: typeof Cdr,
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
    private readonly sequelize: Sequelize,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  private legFilter(vpbxUserUid: number): SqlParts {
    const tenant = tenantLegFilter(vpbxUserUid);
    return {
      where: `${tenant.sql} AND c.lastapp <> 'Transferred Call'`,
      replacements: { ...tenant.replacements },
    };
  }

  private applyFilters(vpbxUserUid: number, filters: CdrFilters): SqlParts {
    const parts = this.legFilter(vpbxUserUid);
    const clauses: string[] = [parts.where];
    const replacements = { ...parts.replacements };

    if (filters.dateFrom) {
      clauses.push('c.calldate >= :dateFrom');
      replacements.dateFrom = filters.dateFrom.length <= 10 ? `${filters.dateFrom} 00:00:00` : filters.dateFrom;
    }
    if (filters.dateTo) {
      clauses.push('c.calldate <= :dateTo');
      replacements.dateTo = filters.dateTo.length <= 10 ? `${filters.dateTo} 23:59:59` : filters.dateTo;
    }

    if (filters.direction === 'in') {
      clauses.push(`(c.dialednum IS NOT NULL AND c.dialednum <> '')`);
    } else if (filters.direction === 'out') {
      clauses.push(`c.dcontext LIKE :outCtx`);
      replacements.outCtx = `sip-out${vpbxUserUid}%`;
    } else if (filters.direction === 'int') {
      clauses.push(`(CHAR_LENGTH(c.usrc) <= 4 AND CHAR_LENGTH(c.dst) <= 4)`);
    } else if (filters.direction === 'external') {
      clauses.push(
        `(CHAR_LENGTH(c.usrc) > 4 OR CHAR_LENGTH(c.dst) > 4) AND c.lastapp <> 'Queue'`,
      );
    }

    if (filters.disposition === 'answered') {
      clauses.push(`(c.disposition = 'ANSWERED' AND c.dstchannel <> '')`);
    } else if (filters.disposition === 'missed') {
      clauses.push(`(c.disposition <> 'ANSWERED' OR c.dstchannel = '')`);
    } else if (filters.disposition) {
      clauses.push(`c.disposition = :disposition`);
      replacements.disposition = filters.disposition;
    }

    if (filters.search?.trim()) {
      clauses.push(
        `(c.usrc LIKE :search OR c.dst LIKE :search OR c.dialednum LIKE :search OR c.channel LIKE :search OR c.dstchannel LIKE :search OR c.disposition LIKE :search)`,
      );
      replacements.search = `%${filters.search.trim()}%`;
    }

    if (filters.extension?.trim()) {
      const ext = filters.extension.trim();
      clauses.push(
        `(c.usrc = :ext OR c.dst = :ext OR c.channel LIKE :extPat OR c.dstchannel LIKE :extPat)`,
      );
      replacements.ext = ext;
      replacements.extPat = `%e${ext}_${vpbxUserUid}%`;
    }

    if (filters.trunk?.trim()) {
      const trunk = filters.trunk.trim();
      clauses.push(`(c.dialednum = :trunk OR c.channel LIKE :trunkPat OR c.dstchannel LIKE :trunkPat)`);
      replacements.trunk = trunk;
      replacements.trunkPat = `%t_${trunk}_${vpbxUserUid}%`;
    }

    return { where: clauses.join(' AND '), replacements };
  }

  private summarySelect(): string {
    return `
      c.linkedid AS linkedid,
      SUBSTRING_INDEX(GROUP_CONCAT(c.uniqueid ORDER BY c.calldate SEPARATOR '||'), '||', 1) AS uniqueid,
      MIN(c.calldate) AS calldate,
      SUBSTRING_INDEX(GROUP_CONCAT(c.clid ORDER BY c.calldate SEPARATOR '||'), '||', 1) AS clid,
      SUBSTRING_INDEX(GROUP_CONCAT(c.src ORDER BY c.calldate SEPARATOR '||'), '||', 1) AS src,
      SUBSTRING_INDEX(GROUP_CONCAT(c.usrc ORDER BY c.calldate SEPARATOR '||'), '||', 1) AS usrc,
      SUBSTRING_INDEX(GROUP_CONCAT(c.channel ORDER BY c.calldate SEPARATOR '||'), '||', 1) AS channel,
      SUBSTRING_INDEX(GROUP_CONCAT(c.dst ORDER BY c.calldate DESC SEPARATOR '||'), '||', 1) AS dst,
      MAX(c.dialednum) AS dialednum,
      SUBSTRING_INDEX(GROUP_CONCAT(c.disposition ORDER BY c.calldate DESC SEPARATOR '||'), '||', 1) AS disposition,
      SUBSTRING_INDEX(GROUP_CONCAT(c.dstchannel ORDER BY c.calldate DESC SEPARATOR '||'), '||', 1) AS dstchannel,
      SUM(c.duration) AS duration,
      MAX(c.billsec) AS billsec,
      MAX(c.record) AS record,
      MAX(c.transid) AS transid,
      SUBSTRING_INDEX(GROUP_CONCAT(c.dcontext ORDER BY c.calldate SEPARATOR '||'), '||', 1) AS dcontext,
      COUNT(*) AS leg_count,
      MAX(CASE WHEN c.disposition = 'ANSWERED' AND c.dstchannel <> '' THEN 1 ELSE 0 END) AS answered_flag
    `;
  }

  private bucketHaving(filters: CdrFilters): { having: string; replacements: Record<string, unknown> } {
    if (!filters.bucket || filters.bucketValue === undefined || filters.bucketValue === '') {
      return { having: '', replacements: {} };
    }
    const v = filters.bucketValue;
    switch (filters.bucket) {
      case 'hour':
        return { having: 'HOUR(MIN(c.calldate)) = :bucketVal', replacements: { bucketVal: parseInt(v, 10) } };
      case 'day':
        return { having: 'DATE(MIN(c.calldate)) = :bucketVal', replacements: { bucketVal: v } };
      case 'disposition':
        return {
          having: `SUBSTRING_INDEX(GROUP_CONCAT(c.disposition ORDER BY c.calldate DESC SEPARATOR '||'), '||', 1) = :bucketVal`,
          replacements: { bucketVal: v },
        };
      default:
        return { having: '', replacements: {} };
    }
  }

  private async getRecordingBaseUrl(): Promise<{ url: string; path: string }> {
    const cfg = await this.systemSettings.getServerConfigRaw();
    const baseUrl = (cfg.records_base_url || '').replace(/\/$/, '');
    const basePath = cfg.records_base_path || '/usr/records';
    return { url: baseUrl, path: basePath };
  }

  /** Same-origin stream path (v3 play.php — file served via API, not RECORDS_BASE_URL). */
  recordingStreamPath(uniqueid: string): string {
    return `/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`;
  }

  private safeRecordFilePath(basePath: string, record: string): string | null {
    const rel = record.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!rel || rel.includes('..')) return null;
    const baseResolved = path.resolve(basePath);
    const fileResolved = path.resolve(baseResolved, `${rel}.mp3`);
    if (!fileResolved.startsWith(baseResolved)) return null;
    return fs.existsSync(fileResolved) ? fileResolved : null;
  }

  async resolveRecordingFile(vpbxUserUid: number, uniqueid: string): Promise<{
    filePath: string;
    uniqueid: string;
    record: string;
  }> {
    const tenant = tenantLegFilter(vpbxUserUid);
    const sql = `
      SELECT record, uniqueid
      FROM cdr c
      WHERE ${tenant.sql}
        AND (c.uniqueid = :uniqueid OR c.linkedid = :uniqueid)
      ORDER BY STR_TO_DATE(c.calldate, '%Y-%m-%d %H:%i:%s') DESC
      LIMIT 1
    `;
    const [row] = await this.sequelize.query(sql, {
      replacements: { ...tenant.replacements, uniqueid },
      type: QueryTypes.SELECT,
    }) as any[];

    if (!row?.record) {
      throw new NotFoundException('Recording not found');
    }

    const { path: basePath } = await this.getRecordingBaseUrl();
    const filePath = this.safeRecordFilePath(basePath, row.record as string);
    if (!filePath) {
      throw new NotFoundException('Recording file not found');
    }

    return {
      filePath,
      uniqueid: row.uniqueid as string,
      record: row.record as string,
    };
  }

  /** Absolute stream URL (uniqueid often contains ".", so relative "play" breaks). */
  recordingPlayStreamPath(uniqueid: string, variant: 'public' | 'auth'): string {
    const id = encodeURIComponent(String(uniqueid));
    const prefix =
      variant === 'public' ? '/api/public/reports/cdr/recording' : '/api/reports/cdr/recording';
    return `${prefix}/${id}/play`;
  }

  /** Minimal HTML player (v3 play.php) — popup opens this page, not raw MP3. */
  renderRecordingPlayerHtml(streamSrc: string): string {
    const escapeAttr = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const src = escapeAttr(streamSrc);
    const downloadHref = escapeAttr(
      streamSrc.includes('?') ? `${streamSrc}&download=1` : `${streamSrc}?download=1`,
    );
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Запись звонка</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #111;
      color: #eee;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
        max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }
    .player {
      width: 100%;
      max-width: 520px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    audio {
      width: 100%;
      min-height: 48px;
    }
    .download {
      text-align: center;
      font-size: clamp(13px, 3.5vw, 15px);
    }
    .download a {
      color: #7eb8ff;
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 6px;
      display: inline-block;
    }
    .download a:hover { text-decoration: underline; }
    .download a:focus-visible {
      outline: 2px solid #7eb8ff;
      outline-offset: 2px;
    }
    @media (max-width: 480px) {
      body { padding: 12px; }
      .player { gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="player">
    <audio controls autoplay preload="metadata" src="${src}"></audio>
    <p class="download"><a href="${downloadHref}">Скачать запись</a></p>
  </div>
</body>
</html>`;
  }

  async streamRecording(
    vpbxUserUid: number,
    uniqueid: string,
    res: Response,
    req?: Request,
  ): Promise<void> {
    const { filePath } = await this.resolveRecordingFile(vpbxUserUid, uniqueid);
    let fileSize: number;
    try {
      fileSize = (await fs.promises.stat(filePath)).size;
    } catch {
      throw new NotFoundException('Recording file not found');
    }

    const download = req?.query?.download === '1' || req?.query?.download === 'true';
    const safeName = String(uniqueid).replace(/[^\w.-]+/g, '_');
    const disposition = download
      ? `attachment; filename="${safeName}.mp3"`
      : 'inline';

    res.setHeader('Content-Type', 'audio/mpeg');
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

  private async enrichRows(rows: any[], vpbxUserUid: number): Promise<CdrCallSummary[]> {
    const { path: basePath } = await this.getRecordingBaseUrl();

    return rows.map((row) => {
      const direction = classifyDirection(row, vpbxUserUid);
      const srcExt =
        extractExtension(row.channel, vpbxUserUid) ||
        extractExtension(row.usrc, vpbxUserUid) ||
        row.usrc;
      const dstExt =
        extractExtension(row.dstchannel, vpbxUserUid) ||
        extractExtension(row.dst, vpbxUserUid) ||
        row.dst;
      const trunkSlug =
        extractTrunkSlug(row.channel, vpbxUserUid) ||
        extractTrunkSlug(row.dstchannel, vpbxUserUid);

      let srcDisplay = srcExt || row.usrc || row.src || '';
      let dstDisplay = dstExt || row.dst || '';
      if (trunkSlug && direction === 'out') {
        dstDisplay = trunkSlug;
      }
      if (row.dialednum && direction === 'in') {
        dstDisplay = dstDisplay || row.dialednum;
      }

      const record = row.record as string | null;
      let recordingUrl: string | null = null;
      let hasRecording = false;
      if (record) {
        const filePath = this.safeRecordFilePath(basePath, record);
        if (filePath) {
          hasRecording = true;
          recordingUrl = this.recordingStreamPath(row.uniqueid as string);
        }
      }

      return {
        linkedid: row.linkedid,
        uniqueid: row.uniqueid,
        calldate: row.calldate,
        clid: row.clid,
        src: row.src || row.usrc,
        usrc: row.usrc,
        dst: row.dst,
        dialednum: row.dialednum,
        disposition: row.disposition,
        dstchannel: shortenChannel(row.dstchannel),
        duration: Number(row.duration) || 0,
        billsec: Number(row.billsec) || 0,
        record,
        transid: row.transid,
        dcontext: row.dcontext,
        legCount: Number(row.leg_count) || 1,
        answered: Number(row.answered_flag) === 1 || isAnswered(row.disposition, row.dstchannel),
        direction,
        srcDisplay,
        dstDisplay,
        recordingUrl,
        hasRecording,
      };
    });
  }

  async findCalls(vpbxUserUid: number, filters: CdrFilters) {
    const { where, replacements } = this.applyFilters(vpbxUserUid, filters);
    const { having, replacements: havingRepl } = this.bucketHaving(filters);
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const havingClause = having ? `HAVING ${having}` : '';

    const countSql = `
      SELECT COUNT(*) AS cnt FROM (
        SELECT c.linkedid
        FROM cdr c
        WHERE ${where}
        GROUP BY c.linkedid
        ${havingClause}
      ) AS grouped
    `;

    const countRows = await this.sequelize.query(countSql, {
      replacements: { ...replacements, ...havingRepl },
      type: QueryTypes.SELECT,
    });
    const count = Number((countRows[0] as any)?.cnt) || 0;

    const listSql = `
      SELECT ${this.summarySelect()}
      FROM cdr c
      WHERE ${where}
      GROUP BY c.linkedid
      ${havingClause}
      ORDER BY STR_TO_DATE(MIN(c.calldate), '%Y-%m-%d %H:%i:%s') DESC
      LIMIT :limit OFFSET :offset
    `;

    const rows = await this.sequelize.query(listSql, {
      replacements: { ...replacements, ...havingRepl, limit, offset },
      type: QueryTypes.SELECT,
    });

    const enriched = await this.enrichRows(rows as any[], vpbxUserUid);
    return { rows: enriched, count };
  }

  async findLegs(vpbxUserUid: number, linkedid: string) {
    const tenant = tenantLegFilter(vpbxUserUid);
    const sql = `
      SELECT calldate, usrc, src, clid, dst, channel, dstchannel, disposition,
             duration, billsec, uniqueid, transid, record, dcontext, lastapp
      FROM cdr c
      WHERE ${tenant.sql}
        AND c.lastapp <> 'Transferred Call'
        AND (c.linkedid = :linkedid OR c.uniqueid = :linkedid OR c.transid = :linkedid)
      ORDER BY STR_TO_DATE(c.calldate, '%Y-%m-%d %H:%i:%s') ASC
    `;
    const rows = await this.sequelize.query(sql, {
      replacements: { ...tenant.replacements, linkedid },
      type: QueryTypes.SELECT,
    });
    return (rows as any[]).map((row) => ({
      ...row,
      dstchannel: shortenChannel(row.dstchannel),
      srcDisplay:
        extractExtension(row.channel, vpbxUserUid) ||
        extractExtension(row.usrc, vpbxUserUid) ||
        row.usrc,
      dstDisplay:
        extractExtension(row.dstchannel, vpbxUserUid) ||
        extractExtension(row.dst, vpbxUserUid) ||
        row.dst,
      answered: isAnswered(row.disposition, row.dstchannel),
    }));
  }

  async getStats(vpbxUserUid: number, filters: CdrFilters) {
    const { where, replacements } = this.applyFilters(vpbxUserUid, filters);
    const sql = `
      SELECT
        COUNT(DISTINCT c.linkedid) AS totalCalls,
        SUM(CASE WHEN c.disposition = 'ANSWERED' AND c.dstchannel <> '' THEN 1 ELSE 0 END) AS answeredLegs,
        COUNT(*) AS totalLegs,
        AVG(c.billsec) AS avgBillsec,
        AVG(CASE WHEN c.disposition = 'ANSWERED' AND c.billsec > 0 THEN c.duration - c.billsec ELSE NULL END) AS avgPdd
      FROM cdr c
      WHERE ${where}
    `;
    const [row] = await this.sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    }) as any[];

    const totalCalls = Number(row?.totalCalls) || 0;
    const answeredLegs = Number(row?.answeredLegs) || 0;
    const totalLegs = Number(row?.totalLegs) || 0;

    const dispSql = `
      SELECT disposition, COUNT(DISTINCT linkedid) AS cnt
      FROM (
        SELECT c.linkedid,
          SUBSTRING_INDEX(GROUP_CONCAT(c.disposition ORDER BY c.calldate DESC SEPARATOR '||'), '||', 1) AS disposition
        FROM cdr c
        WHERE ${where}
        GROUP BY c.linkedid
      ) t
      GROUP BY disposition
    `;
    const dispRows = await this.sequelize.query(dispSql, {
      replacements,
      type: QueryTypes.SELECT,
    }) as any[];

    const byDisposition: Record<string, number> = {};
    for (const d of dispRows) {
      byDisposition[d.disposition] = Number(d.cnt);
    }

    return {
      totalCalls,
      asr: totalLegs > 0 ? Math.round((answeredLegs / totalLegs) * 100) : 0,
      avgBillsec: Math.round(Number(row?.avgBillsec) || 0),
      avgPdd: Math.round(Number(row?.avgPdd) || 0),
      byDisposition,
    };
  }

  async getByHour(vpbxUserUid: number, filters: CdrFilters) {
    const { where, replacements } = this.applyFilters(vpbxUserUid, filters);
    const rows = await this.sequelize.query(`
      SELECT hr AS hour, COUNT(*) AS calls,
        SUM(ans) AS answered,
        COUNT(*) - SUM(ans) AS missed
      FROM (
        SELECT c.linkedid, HOUR(MIN(c.calldate)) AS hr,
          MAX(CASE WHEN c.disposition='ANSWERED' AND c.dstchannel<>'' THEN 1 ELSE 0 END) AS ans
        FROM cdr c
        WHERE ${where}
        GROUP BY c.linkedid, HOUR(c.calldate)
      ) t
      GROUP BY hr
      ORDER BY hr
    `, { replacements, type: QueryTypes.SELECT });
    return rows;
  }

  async getByDay(vpbxUserUid: number, filters: CdrFilters) {
    const { where, replacements } = this.applyFilters(vpbxUserUid, filters);
    const sql = `
      SELECT DATE(MIN(c.calldate)) AS day,
        COUNT(DISTINCT c.linkedid) AS calls,
        SUM(c.billsec) AS totalBillsec,
        AVG(c.billsec) AS avgBillsec,
        MAX(CASE WHEN c.disposition='ANSWERED' AND c.dstchannel<>'' THEN 1 ELSE 0 END) AS ans_flag
      FROM cdr c
      WHERE ${where}
      GROUP BY c.linkedid, DATE(c.calldate)
    `;
    const rows = await this.sequelize.query(`
      SELECT day, COUNT(*) AS calls,
        SUM(totalBillsec) AS totalBillsec,
        ROUND(AVG(avgBillsec)) AS avgBillsec,
        SUM(ans_flag) AS answered,
        COUNT(*) - SUM(ans_flag) AS missed,
        ROUND(SUM(ans_flag) / COUNT(*) * 100) AS asr
      FROM (
        SELECT DATE(MIN(c.calldate)) AS day, c.linkedid,
          MAX(c.billsec) AS totalBillsec,
          AVG(c.billsec) AS avgBillsec,
          MAX(CASE WHEN c.disposition='ANSWERED' AND c.dstchannel<>'' THEN 1 ELSE 0 END) AS ans_flag
        FROM cdr c
        WHERE ${where}
        GROUP BY c.linkedid, DATE(c.calldate)
      ) t
      GROUP BY day
      ORDER BY day
    `, { replacements, type: QueryTypes.SELECT });
    return rows;
  }

  async getByExtension(vpbxUserUid: number, filters: CdrFilters) {
    const endpoints = await this.endpointModel.findAll({
      where: { tenantid: String(vpbxUserUid) },
      attributes: ['id', 'callerid'],
    });
    const extMap = new Map<string, string>();
    for (const ep of endpoints) {
      if (ep.id.startsWith('e')) {
        const m = ep.id.match(/^e(.+)_\d+$/);
        if (m) extMap.set(m[1], ep.callerid || m[1]);
      }
    }

    const { where, replacements } = this.applyFilters(vpbxUserUid, filters);
    const extLikeSuffix = `_%_${vpbxUserUid}`;
    const rows = await this.sequelize.query(`
      SELECT ext, COUNT(*) AS total,
        SUM(inbound) AS inbound,
        SUM(outbound) AS outbound,
        SUM(answered) AS answered
      FROM (
        SELECT
          CASE
            WHEN CHAR_LENGTH(c.usrc) <= 4 THEN c.usrc
            WHEN c.usrc LIKE CONCAT('e%', :extLikeSuffix) THEN SUBSTRING(c.usrc, 2, LOCATE('_', c.usrc) - 2)
            ELSE NULL
          END AS ext,
          CASE WHEN c.dialednum <> '' AND c.dialednum IS NOT NULL THEN 1 ELSE 0 END AS inbound,
          CASE WHEN c.dcontext LIKE :outCtx THEN 1 ELSE 0 END AS outbound,
          CASE WHEN c.disposition='ANSWERED' AND c.dstchannel<>'' THEN 1 ELSE 0 END AS answered
        FROM cdr c
        WHERE ${where}
      ) legs
      WHERE ext IS NOT NULL
      GROUP BY ext
      ORDER BY total DESC
      LIMIT 20
    `, {
      replacements: { ...replacements, outCtx: `sip-out${vpbxUserUid}%`, extLikeSuffix },
      type: QueryTypes.SELECT,
    }) as any[];

    return rows.map((r) => ({
      extension: r.ext,
      displayName: extMap.get(r.ext) || r.ext,
      total: Number(r.total),
      inbound: Number(r.inbound),
      outbound: Number(r.outbound),
      answered: Number(r.answered),
      asr: Number(r.total) > 0 ? Math.round((Number(r.answered) / Number(r.total)) * 100) : 0,
    }));
  }

  async getByTrunk(vpbxUserUid: number, filters: CdrFilters) {
    const { where, replacements } = this.applyFilters(vpbxUserUid, filters);
    const rows = await this.sequelize.query(`
      SELECT COALESCE(dialednum, 'unknown') AS trunk,
        COUNT(DISTINCT linkedid) AS calls,
        SUM(billsec) AS totalBillsec
      FROM (
        SELECT c.linkedid, MAX(c.dialednum) AS dialednum, MAX(c.billsec) AS billsec
        FROM cdr c
        WHERE ${where} AND c.dialednum IS NOT NULL AND c.dialednum <> ''
        GROUP BY c.linkedid
      ) t
      GROUP BY trunk
      ORDER BY calls DESC
      LIMIT 20
    `, { replacements, type: QueryTypes.SELECT });
    return rows;
  }

  async getByDisposition(vpbxUserUid: number, filters: CdrFilters) {
    const stats = await this.getStats(vpbxUserUid, filters);
    return Object.entries(stats.byDisposition).map(([disposition, count]) => ({
      disposition,
      count,
    }));
  }

  async getHeatmap(vpbxUserUid: number, filters: CdrFilters) {
    const { where, replacements } = this.applyFilters(vpbxUserUid, filters);
    const rows = await this.sequelize.query(`
      SELECT DAYOFWEEK(MIN(c.calldate)) AS dow, HOUR(MIN(c.calldate)) AS hour,
        COUNT(DISTINCT c.linkedid) AS calls
      FROM cdr c
      WHERE ${where}
      GROUP BY c.linkedid, DAYOFWEEK(c.calldate), HOUR(c.calldate)
    `, { replacements, type: QueryTypes.SELECT }) as any[];

    const matrix: Record<string, number> = {};
    for (const r of rows) {
      const key = `${r.dow}-${r.hour}`;
      matrix[key] = (matrix[key] || 0) + Number(r.calls);
    }
    const result: { dow: number; hour: number; calls: number }[] = [];
    for (const [key, calls] of Object.entries(matrix)) {
      const [dow, hour] = key.split('-').map(Number);
      result.push({ dow, hour, calls });
    }
    return result;
  }

  async findByUniqueid(vpbxUserUid: number, uniqueid: string) {
    const tenant = tenantLegFilter(vpbxUserUid);
    const sql = `
      SELECT record, uniqueid, linkedid, userfield
      FROM cdr c
      WHERE ${tenant.sql}
        AND (c.uniqueid = :uniqueid OR c.linkedid = :uniqueid)
      ORDER BY STR_TO_DATE(c.calldate, '%Y-%m-%d %H:%i:%s') DESC
      LIMIT 1
    `;
    const [row] = await this.sequelize.query(sql, {
      replacements: { ...tenant.replacements, uniqueid },
      type: QueryTypes.SELECT,
    }) as any[];

    if (!row) {
      throw new NotFoundException('CDR record not found');
    }

    const { path: basePath } = await this.getRecordingBaseUrl();
    const record = row.record as string | null;
    let recordingUrl: string | null = null;
    let exists = false;

    if (record) {
      const filePath = this.safeRecordFilePath(basePath, record);
      exists = Boolean(filePath);
      if (exists) {
        recordingUrl = this.recordingStreamPath(row.uniqueid as string);
      }
    }

    return { record, uniqueid: row.uniqueid, linkedid: row.linkedid, recordingUrl, exists };
  }

  async exportCalls(vpbxUserUid: number, filters: CdrFilters): Promise<CdrCallSummary[]> {
    const result = await this.findCalls(vpbxUserUid, {
      ...filters,
      limit: 10000,
      offset: 0,
    });
    return result.rows;
  }
}
