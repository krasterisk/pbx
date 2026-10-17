import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { z } from 'zod';
import { AutodialReportsService, type AutodialReportRange } from './autodial-reports.service';
import { autodialSqlDate } from './autodial-sql-time.util';

export const autodialAnalyticsSchema = z.strictObject({ from: z.iso.date(), to: z.iso.date(),
  campaign_uids: z.array(z.number().int().positive()).max(50).optional(),
  dimension: z.enum(['attempt', 'hour', 'heatmap', 'segment', 'hangup', 'operator', 'business_outcome', 'disposition']),
  field_uid: z.number().int().positive().optional(), value: z.string().max(10000).optional() });
type AnalyticsInput = z.infer<typeof autodialAnalyticsSchema>;
export interface AutodialBreakdownRow { value: string; dials: number; answered: number; success: number; talk_sec: number; contact_rate: number }
interface AggregateRow { value: string | number | null; dials: string | number; answered: string | number; success: string | number; talk_sec: string | number }
const hourFormatters = new Map<string, Intl.DateTimeFormat>();

export function autodialHourGroup(epochBucket: number, timezone: string, heatmap: boolean): string {
  let formatter = hourFormatters.get(timezone);
  if (!formatter) { if (hourFormatters.size > 64) hourFormatters.clear();
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }); hourFormatters.set(timezone, formatter); }
  const parts = Object.fromEntries(formatter
    .formatToParts(new Date(epochBucket * 900000)).map((part) => [part.type, part.value]));
  const weekday = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`).getUTCDay();
  return heatmap ? `${weekday}:${parts.hour}` : parts.hour;
}

@Injectable()
export class AutodialAnalyticsService {
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly reports: AutodialReportsService) {}
  private parse(input: unknown): AnalyticsInput {
    const parsed = autodialAnalyticsSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'AC_REPORT_FILTER', message: 'Invalid report dimension, period or field' });
    return parsed.data;
  }
  private async queryParts(tenant: number, input: AnalyticsInput) {
    const range: AutodialReportRange = { from: input.from, to: input.to, campaignUids: input.campaign_uids };
    const window = await this.reports.reportWindow(tenant, range), timezone = await this.reports.reportingTimezone(tenant);
    const pg = this.db.getDialect() === 'postgres';
    const replacements: Record<string, unknown> = { tenant, from: autodialSqlDate(window.from, this.db), to: autodialSqlDate(window.to, this.db) };
    const clauses = ['a.vpbx_user_uid = :tenant', 'a.started_at >= :from', 'a.started_at < :to'];
    if (input.campaign_uids?.length) { clauses.push('a.campaign_uid IN (:campaigns)'); replacements.campaigns = input.campaign_uids; }
    const json = (column: string, path: string) => pg ? `${column} ->> :${path}` : `JSON_UNQUOTE(JSON_EXTRACT(${column}, :${path}))`;
    const bucket = pg ? 'FLOOR(EXTRACT(EPOCH FROM a.started_at) / 900)' : 'FLOOR(UNIX_TIMESTAMP(a.started_at) / 900)';
    let expression = '';
    switch (input.dimension) {
      case 'attempt': expression = `CAST(a.attempt_no AS ${pg ? 'TEXT' : 'CHAR'})`; break;
      case 'hour': case 'heatmap': expression = bucket; break;
      case 'hangup': expression = "CONCAT(COALESCE(a.trunk_id, ''), ' · ', COALESCE(a.hangup_cause, '—'))"; break;
      case 'operator': expression = "COALESCE(NULLIF(a.agent_interface, ''), '—')"; break;
      case 'disposition': expression = 'a.disposition'; break;
      case 'business_outcome': replacements.outcomePath = pg ? 'business_outcome' : '$.business_outcome';
        expression = `COALESCE(${json('a.scenario_result', 'outcomePath')}, '—')`; break;
      case 'segment': {
        if (!input.field_uid) throw new BadRequestException({ code: 'AC_REPORT_FIELD_REQUIRED' });
        const [field] = await this.db.query<{ uid: number; base_uid: number; field_key: string }>(
          `SELECT f.uid, f.base_uid, f.${pg ? '"key"' : '`key`'} AS field_key FROM ac_base_fields f
           JOIN ac_bases b ON b.uid = f.base_uid WHERE f.uid = :field AND b.vpbx_user_uid = :tenant`,
          { replacements: { tenant, field: input.field_uid }, type: QueryTypes.SELECT });
        if (!field || !/^[a-z][a-z0-9_]{0,62}$/.test(field.field_key)) throw new NotFoundException({ code: 'AC_FIELD_NOT_FOUND' });
        replacements.fieldUidPath = pg ? String(field.uid) : `$."${field.uid}"`;
        replacements.fieldKeyPath = pg ? field.field_key : `$."${field.field_key}"`;
        replacements.base = field.base_uid; clauses.push('c.base_uid = :base');
        const column = pg ? 'c."values"' : 'c.`values`';
        expression = `COALESCE(${json(column, 'fieldUidPath')}, ${json(column, 'fieldKeyPath')}, '—')`; break;
      }
    }
    if (input.value !== undefined) {
      if (input.dimension === 'hour' || input.dimension === 'heatmap') {
        const buckets: number[] = [];
        for (let bucketNo = Math.floor(window.from.getTime() / 900000); bucketNo * 900000 < window.to.getTime(); bucketNo++)
          if (autodialHourGroup(bucketNo, timezone, input.dimension === 'heatmap') === input.value) buckets.push(bucketNo);
        if (buckets.length) { clauses.push(`${bucket} IN (:buckets)`); replacements.buckets = buckets; } else clauses.push('1 = 0');
      } else { clauses.push(`${expression} = :value`); replacements.value = input.value; }
    }
    const source = `FROM ac_attempts a JOIN ac_tasks t ON t.uid = a.task_uid AND t.vpbx_user_uid = a.vpbx_user_uid
      LEFT JOIN ac_contacts c ON c.uid = t.contact_uid AND c.vpbx_user_uid = a.vpbx_user_uid WHERE ${clauses.join(' AND ')}`;
    return { expression, replacements, source, timezone, range };
  }

  async breakdown(tenant: number, raw: unknown) {
    const input = this.parse(raw), { expression, replacements, source, timezone } = await this.queryParts(tenant, input);
    const timeDimension = input.dimension === 'hour' || input.dimension === 'heatmap';
    const rows = await this.db.query<AggregateRow>(`SELECT ${expression} AS value, COUNT(*) AS dials,
      SUM(CASE WHEN a.answered_at IS NOT NULL THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN a.disposition = 'success' THEN 1 ELSE 0 END) AS success, COALESCE(SUM(a.talk_sec), 0) AS talk_sec
      ${source} GROUP BY ${expression} ORDER BY dials DESC LIMIT ${timeDimension ? 40000 : 2001}`,
      { replacements, type: QueryTypes.SELECT });
    const groups = new Map<string, AutodialBreakdownRow>();
    for (const row of rows.slice(0, timeDimension ? 40000 : 2000)) {
      const value = timeDimension ? autodialHourGroup(Number(row.value), timezone, input.dimension === 'heatmap') : String(row.value ?? '—');
      const group = groups.get(value) ?? { value, dials: 0, answered: 0, success: 0, talk_sec: 0, contact_rate: 0 };
      group.dials += Number(row.dials); group.answered += Number(row.answered); group.success += Number(row.success); group.talk_sec += Number(row.talk_sec);
      group.contact_rate = group.dials ? Math.round(group.answered / group.dials * 10000) / 100 : 0;
      groups.set(value, group);
    }
    const result = [...groups.values()]; if (timeDimension) result.sort((a, b) => a.value.localeCompare(b.value));
    return { dimension: input.dimension, timezone, from: input.from, to: input.to, truncated: !timeDimension && rows.length > 2000, rows: result };
  }

  async detail(tenant: number, raw: unknown) {
    const input = this.parse(raw), { source, replacements, range, timezone } = await this.queryParts(tenant, input);
    const ids = await this.db.query<{ uid: number }>(`SELECT a.uid ${source} ORDER BY a.uid DESC LIMIT 10001`, { replacements, type: QueryTypes.SELECT });
    const rows = ids.length ? await this.reports.detail(tenant, { ...range, attemptUids: ids.slice(0, 10000).map((row) => row.uid) }) : [];
    return { rows, timezone, truncated: ids.length > rows.length, limit: 10000 };
  }

  async selectedContactIds(tenant: number, raw: unknown) {
    const input = this.parse(raw);
    if (input.campaign_uids?.length !== 1) throw new BadRequestException({ code: 'AC_SELECTION_ONE_CAMPAIGN' });
    const { source, replacements } = await this.queryParts(tenant, input);
    const rows = await this.db.query<{ uid: number }>(`SELECT DISTINCT c.uid ${source} AND c.uid IS NOT NULL ORDER BY c.uid LIMIT 5001`,
      { replacements, type: QueryTypes.SELECT });
    if (!rows.length || rows.length > 5000) throw new BadRequestException({ code: 'AC_SELECTION_SIZE', limit: 5000 });
    return rows.map((row) => Number(row.uid));
  }
}
