import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Transaction } from 'sequelize';
import {
  summarizeCallGroups,
  callConnectionResult,
  type CallAggregate,
  type CallRecord,
  type CallsPage,
  type CallsOverview,
  type CallsAttention,
  type CallBreakdown,
  type CallBreakdownRow,
  type CallsQuery,
  type CallsFacets,
} from '@krasterisk/shared';
import type { JwtPayloadUser } from '../../auth/auth.service';
import {
  DashboardAccessService,
  type DashboardContext,
} from '../../dashboard/dashboard-access.service';
import { DashboardReadStore } from '../../dashboard/dashboard-read-store.service';
import { DashboardCloudService } from '../../dashboard/dashboard-cloud.service';
import { callsPeriod, callsWhere } from './calls-query';
import { readOrganizationWeekStart } from '../../../shared/organization-calendar';
import { callExportTime } from './calls-export';
import { callsCalendar, presentCalendar, calendarBuckets, type CalendarCounts } from './calls-calendar';
import type { CallFact } from '../../calls/call-record';
import { CALL_FACTS_VERSION } from '../../calls/call-record';
import { InjectModel } from '@nestjs/sequelize';
import { UserLevel } from '../../users/user.model';
import { DashboardCacheService } from '../../dashboard/dashboard-cache.service';
import {
  matchCallAttention,
  type ContactFact,
} from '../../calls/call-attention';
import { ActionLog } from '../../logger/action-log.model';
import { CallSemanticIndexService } from './call-semantic-index.service';
import { CdrService } from '../cdr/cdr.service';
import { DASHBOARD_SEMANTICS_VERSION } from '../../dashboard/dashboard-classifier';

interface FactRow {
  payload: string;
  started_at: number | string;
  call_key: string;
}
interface GroupRow {
  direction: CallAggregate['direction'];
  outcome: CallAggregate['outcome'];
  amount: number | string;
  connected_total: number | string;
  connected_sample: number | string;
  estimated_sample?: number | string;
}
interface HistoryCheckpoint {
  source_key: string;
  bootstrap_complete: number;
  initialized_from?: number;
}
const FROM =
  'FROM dashboard_calls c JOIN call_facts f ON f.call_key=c.call_key AND f.tenant=c.tenant';
@Injectable()
export class CallsService {
  private readonly overviewCache = new DashboardCacheService();
  private historyKeys(): string[] {
    return [
      `projection:${this.store.nodeId}`, `cdr:${this.store.nodeId}`,
      `call-facts:v${CALL_FACTS_VERSION}:${this.store.nodeId}`,
      `call-facts:v3:${this.store.nodeId}`,
      `semantics:v${DASHBOARD_SEMANTICS_VERSION}:${this.store.nodeId}`,
    ];
  }
  private async historyComplete(checkpoints: HistoryCheckpoint[], tenant: number, period: {from: number; to: number}, query: CallsQuery, transaction: Transaction): Promise<boolean> {
    const done = (key: string) => checkpoints.some(row => row.source_key === key && Number(row.bootstrap_complete) === 1);
    const cdr = checkpoints.find(row => row.source_key === `cdr:${this.store.nodeId}`);
    if (!cdr || Number(cdr.bootstrap_complete) !== 1 || Number(cdr.initialized_from) !== 0) return false;
    if (done(`projection:${this.store.nodeId}`) && done(`call-facts:v${CALL_FACTS_VERSION}:${this.store.nodeId}`)) return true;
    // v4 adds group/search indexing. A complete v3 journal remains usable while
    // that index is rebuilt; queries depending on the new index must wait.
    const indexedSearch = query.search?.trim() && !/^[+\d\s().-]+$/.test(query.search.trim());
    if (CALL_FACTS_VERSION !== 4 || query.groups?.length || indexedSearch ||
        !done(`call-facts:v3:${this.store.nodeId}`) ||
        !done(`semantics:v${DASHBOARD_SEMANTICS_VERSION}:${this.store.nodeId}`)) return false;
    // Check the entire tenant period before user filters, so missing facts cannot
    // disappear behind a filter and produce misleading complete totals.
    const pending = await this.store.select<{call_key: string}>(
      `SELECT c.call_key FROM dashboard_calls c LEFT JOIN call_facts f ON f.call_key=c.call_key AND f.tenant=c.tenant
       WHERE c.tenant= :tenant AND c.node_id= :node AND c.started_at>= :from AND c.started_at< :to
       AND (f.call_key IS NULL OR f.schema_version<3) LIMIT 1`,
      {tenant, node:this.store.nodeId, ...period}, transaction,
    );
    return pending.length === 0;
  }
  constructor(
    private readonly access: DashboardAccessService,
    private readonly store: DashboardReadStore,
    private readonly cloud: DashboardCloudService,
    @InjectModel(ActionLog) private readonly audit: typeof ActionLog,
    @Optional() private readonly semanticIndex?:CallSemanticIndexService,
    @Optional() private readonly cdr?: CdrService,
  ) {}
  private async auditRead(
    ctx: DashboardContext,
    action: string,
    id?: string,
  ): Promise<void> {
    // Persist directly: LoggerService.logAction also sends Telegram notifications.
    await this.audit.create({
      user_id: ctx.user.sub,
      user_uid: ctx.tenant,
      action,
      entity_type: 'call',
      entity_id: null,
      details: JSON.stringify({ callId: id || null }),
      status: 'success',
    });
  }
  private analyticsAllowed(ctx: DashboardContext): boolean {
    return [...ctx.pages].some((page) =>
      /^speech[-_]analytics[-_]conversations$/.test(page),
    );
  }
  private present(row: FactRow, ctx: DashboardContext): CallRecord {
    const fact = JSON.parse(row.payload) as CallFact;
    const { linkedid: _linkedid, uniqueids: _uniqueids, ...record } = fact;
    if (!this.analyticsAllowed(ctx)) record.analytics = null;
    else
      record.analytics ||= {
        state: 'none',
        recordingId: null,
        runId: null,
        projectId: null,
      };
    return record;
  }
  private async availableMaterials(records: CallRecord[], tenant: number): Promise<CallRecord[]> {
    if (!this.cdr) return records;
    const available = await this.cdr.availableCallRecordings(tenant,records.flatMap(call => call.recordings.map(recording => recording.id)));
    return records.map(call => ({...call,recordings:call.recordings.filter(recording => available.has(recording.id))}));
  }
  private async context(user: JwtPayloadUser, query: CallsQuery) {
    const ctx = await this.access.resolve(user, 'cdr');
    if (query.analytics && !this.analyticsAllowed(ctx))
      throw new ForbiddenException('Analytics access required');
    const timezone = await this.cloud.timezone(ctx.tenant);
    const period = callsPeriod(query, timezone);
    return {
      ctx,
      timezone,
      period,
      filter: callsWhere(ctx.tenant, query, period, ctx.scope, this.store.sequelize.getDialect?.() || 'mysql'),
    };
  }
  async list(user: JwtPayloadUser, query: CallsQuery): Promise<CallsPage> {
    const { ctx, timezone, filter, period } = await this.context(user, query);
    const limit = Math.max(1, Math.min(100, query.limit || 50));
    let pageSql = filter.sql;
    const pageArgs = { ...filter.args };
    if (query.cursor) {
      try {
        const cursor = JSON.parse(
          Buffer.from(query.cursor, 'base64url').toString(),
        ) as {
          at: number;
          id: string;
        };
        if (
          !Number.isSafeInteger(cursor.at) ||
          !/^[a-f0-9]{64}$/.test(cursor.id)
        )
          throw new Error('Invalid cursor');
        pageSql +=
          ' AND (c.started_at < :cursorAt OR (c.started_at=:cursorAt AND c.call_key < :cursorId))';
        Object.assign(pageArgs, { cursorAt: cursor.at, cursorId: cursor.id });
      } catch {
        throw new BadRequestException('Invalid call cursor');
      }
    }
    try {
      const result = await this.store.sequelize.transaction<CallsPage>(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
        async (transaction) => {
          const checkpoints = await this.store.select<{
            source_key: string;
            cursor_value: number;
            bootstrap_complete: number;
            updated_at: number;
            initialized_from: number;
          }>(
            'SELECT source_key,cursor_value,bootstrap_complete,updated_at,initialized_from FROM dashboard_checkpoints WHERE source_key IN (:keys)',
            {
              keys: [
                ...this.historyKeys(),
                `revision:${ctx.tenant}`,
              ],
            },
            transaction,
          );
          const source = checkpoints.find(
            (row) => row.source_key === `projection:${this.store.nodeId}`,
          );
          const revision = checkpoints.find(
            (row) => row.source_key === `revision:${ctx.tenant}`,
          );
          const groups = await this.store.select<GroupRow>(
            `SELECT c.direction,f.outcome,COUNT(*) AS amount,
          COALESCE(SUM(CASE WHEN f.outcome='human' THEN f.connected_sec ELSE 0 END),0) AS connected_total,
          SUM(CASE WHEN f.outcome='human' AND f.connected_sec IS NOT NULL THEN 1 ELSE 0 END) AS connected_sample,
          SUM(CASE WHEN f.outcome='human' AND f.connected_sec IS NOT NULL AND f.timing_source='cdr' THEN 1 ELSE 0 END) AS estimated_sample
          ${FROM} WHERE ${filter.sql} GROUP BY c.direction,f.outcome`,
            filter.args,
            transaction,
          );
          const summary = summarizeCallGroups(
            groups.map((group) => ({
              direction: group.direction,
              outcome: group.outcome,
              count: Number(group.amount),
              connectedTotal: Number(group.connected_total),
              connectedSample: Number(group.connected_sample),
              estimatedConnectedSample: Number(group.estimated_sample) || 0,
            })),
          );
          const rows = await this.store.select<FactRow>(
            `SELECT c.call_key,c.started_at,f.payload ${FROM} WHERE ${pageSql} ORDER BY c.started_at DESC,c.call_key DESC LIMIT :limit`,
            { ...pageArgs, limit: limit + 1 },
            transaction,
          );
          const page = rows.slice(0, limit);
          const last = page[page.length - 1];
          const complete = await this.historyComplete(checkpoints, ctx.tenant, period, query, transaction);
          const updatedAt = Math.max(...checkpoints.map(row => Number(row.updated_at) || 0));
          const fresh = source && Date.now() - updatedAt < 90000;
          return {
            period: { from: new Date(period.from).toISOString(), to: new Date(period.to).toISOString() },
            rows: page.map((row) => this.present(row, ctx)),
            transcriptSearchAllowed: this.analyticsAllowed(ctx),
            transcriptSemanticAllowed:this.analyticsAllowed(ctx)&&this.semanticIndex?.previewEnabled()===true,
            total: summary.total,
            summary,
            timezone,
            nextCursor:
              rows.length > limit && last
                ? Buffer.from(
                    JSON.stringify({
                      at: Number(last.started_at),
                      id: last.call_key,
                    }),
                  ).toString('base64url')
                : null,
            dataAsOf: source
              ? new Date(updatedAt).toISOString()
              : null,
            projectionVersion: `${CALL_FACTS_VERSION}:${revision?.cursor_value || 0}`,
            source: {
              state: !source
                ? 'unavailable'
                : complete && fresh
                  ? 'ok'
                  : 'stale',
              message: !source
                ? 'projectionNotInitialized'
                : !complete
                  ? 'historyBackfillInProgress'
                  : !fresh
                    ? 'historyStale'
                    : null,
              progress: null,
            },
          };
        },
      );
      // Release the snapshot connection before filesystem/configuration availability checks.
      result.rows = await this.availableMaterials(result.rows,ctx.tenant);
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Call history is temporarily unavailable',
        { cause: error },
      );
    }
  }
  async overview(
    user: JwtPayloadUser,
    query: CallsQuery,
  ): Promise<CallsOverview> {
    const { ctx, timezone, period } = await this.context(user, query);
    const duration = period.to - period.from;
    if (duration > 366 * 86400000 || period.from - duration < 0)
      throw new BadRequestException(
        'Overview requires a period of at most 366 days',
      );
    const previousFrom = period.from - duration;
    const filter = callsWhere(
      ctx.tenant,
      query,
      { from: previousFrom, to: period.to },
      ctx.scope,
      this.store.sequelize.getDialect?.() || 'mysql',
    );
    const bucketMs = Math.max(
      3600000,
      Math.ceil(duration / (90 * 3600000)) * 3600000,
    );
    try {
      return await this.store.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
        async (transaction) => {
          const checkpoints = await this.store.select<{
            source_key: string;
            bootstrap_complete: number;
            initialized_from: number;
            updated_at: number;
            cursor_value: number;
          }>(
            'SELECT source_key,bootstrap_complete,initialized_from,updated_at,cursor_value FROM dashboard_checkpoints WHERE source_key IN (:keys)',
            {
              keys: [
                ...this.historyKeys(),
                `revision:${ctx.tenant}`,
              ],
            },
            transaction,
          );
          const source = checkpoints.find(
            (r) => r.source_key === `projection:${this.store.nodeId}`,
          );
          const ready = await this.historyComplete(checkpoints, ctx.tenant, {from: previousFrom, to: period.to}, query, transaction);
          const updatedAt = Math.max(...checkpoints.map(row => Number(row.updated_at) || 0));
          const fresh = source && Date.now() - updatedAt < 90000;
          const complete = ready;
          const cacheKey = JSON.stringify([
            'calendar-v1',
            ctx.tenant,
            ctx.user.sub,
            ctx.permissionVersion,
            timezone,
            period,
            filter.sql,
            filter.args,
            checkpoints,
          ]);
          return this.overviewCache.get(cacheKey, 5000, async () => {
            const groups = await this.store.select<
              GroupRow & { bucket: number | string }
            >(
              `SELECT FLOOR(1.0 * (c.started_at - :currentFrom) / :bucketMs) AS bucket,c.direction,f.outcome,
              COUNT(*) AS amount,
              COALESCE(SUM(CASE WHEN f.outcome='human' THEN f.connected_sec ELSE 0 END),0) AS connected_total,
              SUM(CASE WHEN f.outcome='human' AND f.connected_sec IS NOT NULL THEN 1 ELSE 0 END) AS connected_sample,
              SUM(CASE WHEN f.outcome='human' AND f.connected_sec IS NOT NULL AND f.timing_source='cdr' THEN 1 ELSE 0 END) AS estimated_sample
              ${FROM} WHERE ${filter.sql} GROUP BY FLOOR(1.0 * (c.started_at - :currentFrom) / :bucketMs),c.direction,f.outcome`,
              { ...filter.args, currentFrom: period.from, bucketMs },
              transaction,
            );
            const summarize = (rows: GroupRow[]) =>
              summarizeCallGroups(
                rows.map((g) => ({
                  direction: g.direction,
                  outcome: g.outcome,
                  count: Number(g.amount),
                  connectedTotal: Number(g.connected_total),
                  connectedSample: Number(g.connected_sample),
                  estimatedConnectedSample: Number(g.estimated_sample) || 0,
                })),
              );
            const calendar = callsCalendar(period, timezone);
            const localHourSql = `FLOOR(1.0 * (c.started_at + (${calendar.offsetSql})) / 3600000)`;
            const hours = await this.store.select<CalendarCounts>(
              `SELECT ${localHourSql} AS local_hour,(${calendar.offsetSql}) AS utc_offset,
               COUNT(*) AS total,
               SUM(CASE WHEN f.outcome='human' THEN 1 ELSE 0 END) AS human,
               SUM(CASE WHEN f.outcome='robot' THEN 1 ELSE 0 END) AS robot,
               SUM(CASE WHEN f.outcome='missed' THEN 1 ELSE 0 END) AS missed,
               SUM(CASE WHEN f.outcome='unknown' THEN 1 ELSE 0 END) AS unknown
               ${FROM} WHERE ${filter.sql} AND c.started_at >= :currentFrom GROUP BY 1,2`,
              { ...filter.args, ...calendar.args, currentFrom: period.from },
              transaction,
            );
            const days = presentCalendar(calendar.slots, hours);
            return {
              calendar: { days, bucketUnit: duration > 3 * 86400000 ? 'day' as const : 'hour' as const },
              breakdowns: await this.breakdowns(
                ctx,
                filter,
                period,
                transaction,
              ),
              summary: summarize(groups.filter((g) => Number(g.bucket) >= 0)),
              previous: summarize(groups.filter((g) => Number(g.bucket) < 0)),
              period: {
                from: new Date(period.from).toISOString(),
                to: new Date(period.to).toISOString(),
              },
              previousPeriod: {
                from: new Date(previousFrom).toISOString(),
                to: new Date(period.from).toISOString(),
              },
              buckets: calendarBuckets(days, duration),
              timezone,
              dataAsOf: source
                ? new Date(updatedAt).toISOString()
                : null,
              projectionVersion: `${CALL_FACTS_VERSION}:${checkpoints.find((r) => r.source_key === `revision:${ctx.tenant}`)?.cursor_value || 0}`,
              source: {
                state: !source
                  ? 'unavailable'
                  : complete && fresh
                    ? 'ok'
                    : 'stale',
                message: !source
                  ? 'projectionNotInitialized'
                  : !complete
                    ? 'historyBackfillInProgress'
                    : !fresh
                      ? 'historyStale'
                      : null,
                progress: null,
              },
            };
          });
        },
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        'Call overview is temporarily unavailable',
        { cause: error },
      );
    }
  }
  private async breakdowns(
    ctx: DashboardContext,
    filter: ReturnType<typeof callsWhere>,
    period: { from: number; to: number },
    transaction: Transaction,
  ): Promise<CallBreakdown[]> {
    const result: CallBreakdown[] = [];
    const fields = `SUM(CASE WHEN c.started_at >= :currentFrom THEN 1 ELSE 0 END) AS amount,
      SUM(CASE WHEN c.started_at < :currentFrom THEN 1 ELSE 0 END) AS previous_total,
      SUM(CASE WHEN c.started_at >= :currentFrom AND f.outcome='human' THEN 1 ELSE 0 END) AS human,
      SUM(CASE WHEN c.started_at >= :currentFrom AND f.outcome='missed' THEN 1 ELSE 0 END) AS missed,
      SUM(CASE WHEN c.started_at >= :currentFrom AND f.outcome='unknown' THEN 1 ELSE 0 END) AS unknown`;
    type Row = {
      value?: string;
      label?: string;
      amount: number | string;
      previous_total: number | string;
      human: number | string;
      missed: number | string;
      unknown: number | string;
    };
    const present = (r?: Row): CallBreakdownRow => ({
      value: r?.value ?? null,
      label: r?.label ?? null,
      total: Number(r?.amount) || 0,
      previousTotal: Number(r?.previous_total) || 0,
      human: Number(r?.human) || 0,
      missed: Number(r?.missed) || 0,
      unknown: Number(r?.unknown) || 0,
    });
    for (const dimension of [
      'employee',
      'department',
      'companyNumber',
    ] as const) {
      const args = {
        ...filter.args,
        currentFrom: period.from,
        dimensionKind: dimension,
      };
      const rows = await this.store.select<Row>(
        `SELECT d.value,MIN(CASE WHEN c.started_at >= :currentFrom THEN d.label ELSE NULL END) AS label,${fields}
         ${FROM} JOIN call_dimensions d ON d.call_key=c.call_key AND d.tenant=c.tenant
         WHERE ${filter.sql} AND d.kind=:dimensionKind GROUP BY d.value
         HAVING SUM(CASE WHEN c.started_at >= :currentFrom THEN 1 ELSE 0 END)>0
         ORDER BY amount DESC,d.value LIMIT 51`,
        args,
        transaction,
      );
      const [unassigned] = await this.store.select<Row>(
        `SELECT ${fields} ${FROM} WHERE ${filter.sql} AND NOT EXISTS
         (SELECT 1 FROM call_dimensions d WHERE d.call_key=c.call_key AND d.tenant=c.tenant AND d.kind=:dimensionKind)`,
        args,
        transaction,
      );
      result.push({
        dimension,
        rows: rows
          .slice(0, 50)
          .filter((r) => r.value !== undefined)
          .map(present),
        unassigned: present(unassigned),
        truncated: rows.length > 50,
      });
    }
    return result;
  }
  async attention(
    user: JwtPayloadUser,
    query: CallsQuery,
    exportAll = false,
  ): Promise<CallsAttention> {
    const { ctx, timezone, period, filter } = await this.context(user, query);
    if (exportAll) await this.auditRead(ctx, 'call_attention_export');
    if (period.to - period.from > 31 * 86400000)
      throw new BadRequestException(
        'Attention requires a period of at most 31 days',
      );
    const snapshotAt = Date.now();
    return this.store.sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => {
        const windowHours = await this.readContactWindow(
          ctx.tenant,
          transaction,
        );
        const candidateFilter = callsWhere(
          ctx.tenant,
          {},
          {
            from: period.from,
            to: Math.min(snapshotAt + 1, period.to + windowHours * 3600000),
          },
          ctx.scope,
      this.store.sequelize.getDialect?.() || 'mysql',
        );
        const columns =
          'c.call_key,c.started_at,c.ended_at,c.direction,c.origin,f.outcome,f.caller_number,f.recipient_number,f.company_number';
        const sources = await this.store.select<ContactFact>(
          `SELECT ${columns} ${FROM} WHERE ${filter.sql} AND c.direction='in' AND c.origin<>'autodial' AND f.outcome IN ('missed','voicemail') ORDER BY c.started_at,c.call_key LIMIT 10001`,
          filter.args,
          transaction,
        );
        if (sources.length > 10000)
          throw new BadRequestException(
            'Too many attention calls; narrow the period or filters',
          );
        const candidates = sources.length
          ? await this.store.select<ContactFact>(
              `SELECT ${columns} ${FROM} WHERE ${candidateFilter.sql} AND c.direction IN ('in','out') AND c.origin<>'autodial' ORDER BY c.started_at,c.call_key LIMIT 10001`,
              candidateFilter.args,
              transaction,
            )
          : [];
        const checkpoints = await this.store.select<{
          source_key: string;
          bootstrap_complete: number;
          initialized_from: number;
          updated_at: number;
        }>(
          'SELECT source_key,bootstrap_complete,initialized_from,updated_at FROM dashboard_checkpoints WHERE source_key IN (:keys)',
          {
            keys: [
              ...this.historyKeys(), `revision:${ctx.tenant}`,
            ],
          },
          transaction,
        );
        const projection = checkpoints.find(
          (r) => r.source_key === `projection:${this.store.nodeId}`,
        );
        const ready = await this.historyComplete(checkpoints, ctx.tenant,
          {from: period.from, to: Math.min(snapshotAt + 1, period.to + windowHours * 3600000)}, query, transaction);
        const updatedAt = Math.max(...checkpoints.map(row => Number(row.updated_at) || 0));
        const fresh = projection && snapshotAt - updatedAt < 90000;
        const complete = !!(ready && fresh && candidates.length <= 10000);
        const matched = matchCallAttention(
          sources,
          candidates.slice(0, 10000),
          snapshotAt,
          complete && !ctx.scope,
          windowHours,
        );
        const visible = matched.rows.filter(
          (r) =>
            query.attentionView === 'all' ||
            !['customerReturned', 'outboundConnected'].includes(r.state),
        );
        const limit = Math.max(1, Math.min(100, query.limit || 20));
        return {
          policy: {
            windowHours,
            outcomes: ['missed', 'voicemail'],
            matching: 'numberAndCompany',
            businessResolution: false,
          },
          snapshotAt: new Date(snapshotAt).toISOString(),
          timezone,
          scopeLimited: !!ctx.scope,
          coverage: complete ? 'complete' : 'partial',
          source: {
            state: !projection
              ? 'unavailable'
              : ready && fresh
                ? 'ok'
                : 'stale',
            message: !projection
              ? 'projectionNotInitialized'
              : !ready
                ? 'historyBackfillInProgress'
                : !fresh
                  ? 'historyStale'
                  : null,
            progress: null,
          },
          totals: matched.totals,
          rows: exportAll ? visible : visible.slice(0, limit),
          truncated: !exportAll && visible.length > limit,
        };
      },
    );
  }
  private policyColumn(): string {
    return this.store.sequelize.getDialect?.() === 'postgres'
      ? '"key"'
      : '`key`';
  }
  private async readContactWindow(
    tenant: number,
    transaction?: Transaction,
  ): Promise<number> {
    const [row] = await this.store.select<{ value: string }>(
      `SELECT value FROM tenant_settings WHERE vpbx_user_uid=:tenant AND ${this.policyColumn()}=:policyKey ORDER BY id DESC LIMIT 1`,
      { tenant, policyKey: 'reports.calls.contact_window_hours' },
      transaction,
    );
    if (!row?.value) return 24;
    const value = Number(row.value);
    if (!Number.isInteger(value) || value < 1 || value > 168)
      throw new ServiceUnavailableException('Invalid call contact policy');
    return value;
  }
  async contactPolicy(
    user: JwtPayloadUser,
  ): Promise<{ windowHours: number; canEdit: boolean }> {
    const ctx = await this.access.resolve(user, 'cdr');
    return {
      windowHours: await this.readContactWindow(ctx.tenant),
      canEdit: [UserLevel.ADMIN, UserLevel.SUPERADMIN].includes(ctx.user.level),
    };
  }
  async setContactPolicy(
    user: JwtPayloadUser,
    windowHours: number,
  ): Promise<{ windowHours: number; canEdit: boolean }> {
    const ctx = await this.access.resolve(user, 'cdr');
    if (![UserLevel.ADMIN, UserLevel.SUPERADMIN].includes(ctx.user.level))
      throw new ForbiddenException('Company administrator required');
    if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > 168)
      throw new BadRequestException('Contact window must be1..168 hours');
    // No unique tenant/key index in the legacy schema. Serializable read/write
    // prevents concurrent first inserts from silently creating competing policies.
    await this.store.sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
      async (transaction) => {
        const args = {
          tenant: ctx.tenant,
          policyKey: 'reports.calls.contact_window_hours',
          value: String(windowHours),
        };
        const rows = await this.store.select<{ id: number; value: string }>(
          `SELECT id,value FROM tenant_settings WHERE vpbx_user_uid=:tenant AND ${this.policyColumn()}=:policyKey FOR UPDATE`,
          args,
          transaction,
        );
        if (rows.length)
          await this.store.execute(
            `UPDATE tenant_settings SET value=:value WHERE vpbx_user_uid=:tenant AND ${this.policyColumn()}=:policyKey`,
            args,
            transaction,
          );
        else
          await this.store.execute(
            `INSERT INTO tenant_settings (vpbx_user_uid,${this.policyColumn()},value,category) VALUES (:tenant,:policyKey,:value,'reports')`,
            args,
            transaction,
          );
        await this.audit.create(
          {
            user_id: ctx.user.sub,
            user_uid: ctx.tenant,
            action: 'call_policy_update',
            entity_type: 'call',
            entity_id: null,
            details: JSON.stringify({
              previous: rows[0]?.value ?? '24',
              windowHours,
            }),
            status: 'success',
          },
          { transaction },
        );
      },
    );
    return { windowHours, canEdit: true };
  }
  async aiActor(tenant: number, userId: number): Promise<JwtPayloadUser> {
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !Number.isSafeInteger(tenant) ||
      tenant < 0
    )
      throw new ForbiddenException('User context is required');
    const [row] = await this.store.select<{
      uniqueid: number;
      login: string;
      name: string;
      level: number;
      role: number;
    }>(
      'SELECT uniqueid,login,name,level,role FROM users WHERE uniqueid=:id AND vpbx_user_uid=:tenant LIMIT 1',
      { id: userId, tenant },
    );
    if (!row) throw new ForbiddenException('User context is required');
    return {
      sub: Number(row.uniqueid),
      login: row.login,
      name: row.name,
      level: Number(row.level),
      role: Number(row.role),
      vpbx_user_uid: tenant,
    };
  }
  async auditResearch(
    user: JwtPayloadUser,
    action: 'call_search' | 'call_aggregate' | 'call_attention',
  ): Promise<void> {
    const ctx = await this.access.resolve(user, 'cdr');
    await this.auditRead(ctx, action);
  }
  async detail(
    user: JwtPayloadUser,
    id: string,
  ): Promise<{ call: CallRecord; timezone: string }> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new NotFoundException();
    const { ctx, timezone, filter } = await this.context(user, {
      dateFrom: '',
      dateTo: '',
    });
    const [row] = await this.store.select<FactRow>(
      `SELECT c.call_key,c.started_at,f.payload ${FROM} WHERE ${filter.sql} AND c.call_key=:id`,
      { ...filter.args, id },
    );
    if (!row) throw new NotFoundException();
    await this.auditRead(ctx, 'call_view', id);
    return { call: (await this.availableMaterials([this.present(row, ctx)],ctx.tenant))[0], timezone };
  }
  async aiTimezone(user: JwtPayloadUser): Promise<string> {
    const ctx = await this.access.resolve(user, 'cdr');
    return this.cloud.timezone(ctx.tenant);
  }
  async aiWeekStart(user: JwtPayloadUser) {
    const ctx = await this.access.resolve(user, 'cdr');
    return readOrganizationWeekStart(this.store.sequelize, ctx.tenant);
  }
  async aiOwnEmployee(user: JwtPayloadUser): Promise<string | null> {
    const ctx = await this.access.resolve(user, 'cdr');
    const [row] = await this.store.select<{exten:string|null}>(
      'SELECT exten FROM users WHERE uniqueid=:id AND vpbx_user_uid=:tenant LIMIT 1',
      {id:ctx.user.sub,tenant:ctx.tenant},
    );
    return typeof row?.exten === 'string' && row.exten.trim() ? row.exten.trim() : null;
  }
  async facets(user: JwtPayloadUser, query: CallsQuery): Promise<CallsFacets> {
    const { ctx, timezone } = await this.context(user, query);
    const dimensions = {
      employee: 'employees',
      department: 'departments',
      companyNumber: 'companyNumbers',
      queue: 'queues',
      group: 'groups',
      robot: 'robots',
      trunk: 'trunks',
    } as const;
    const options = {} as CallsFacets['options'];
    const truncated: CallsFacets['truncated'] = {};
    try {
      return await this.store.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
        async (transaction) => {
          for (const kind of Object.keys(dimensions) as Array<keyof typeof dimensions>) {
            // Disjunctive facets: retain other groups and ACL; omit only this group's
            // own selection so a user can add another value without clearing it.
            const facetQuery = { ...query, [dimensions[kind]]: undefined };
            if (kind === 'employee') facetQuery.extension = undefined;
            if (kind === 'department') facetQuery.department = undefined;
            if (kind === 'companyNumber') facetQuery.companyNumber = undefined;
            const filter = callsWhere(
              ctx.tenant,
              facetQuery,
              callsPeriod(facetQuery, timezone),
              ctx.scope,
      this.store.sequelize.getDialect?.() || 'mysql',
            );
            const directoryTerm = query.directorySearch?.trim().toLowerCase();
            if (kind === 'group') {
              // The directory defines selectable groups; history supplies only
              // authorized counts. A new group must be usable before its first call.
              const configured = await this.store.select<{ value: string; label: string }>(
                'SELECT exten AS value,name AS label FROM call_groups WHERE vpbx_user_uid=:tenant',
                { tenant: ctx.tenant },
                transaction,
              );
              const observed = await this.store.select<{
                value: string; label: string; amount: string | number;
              }>(
                `SELECT d.value,MIN(d.label) AS label,COUNT(DISTINCT c.call_key) AS amount ${FROM}
                 JOIN call_dimensions d ON d.call_key=c.call_key AND d.tenant=c.tenant
                 WHERE ${filter.sql} AND d.kind=:dimension GROUP BY d.value`,
                { ...filter.args, dimension: kind },
                transaction,
              );
              const groups = new Map(observed.map(row => [String(row.value), {
                value: String(row.value), label: row.label, count: Number(row.amount),
              }]));
              for (const row of configured) {
                const value = String(row.value);
                groups.set(value, { value, label: row.label, count: groups.get(value)?.count ?? 0 });
              }
              // Normalize in JS so Cyrillic search also works on database locales
              // whose LOWER() only handles ASCII. Search precedes response limiting.
              const matches = [...groups.values()].filter(row => !directoryTerm ||
                row.label.toLowerCase().includes(directoryTerm) || row.value.toLowerCase().includes(directoryTerm))
                .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
              options.group = matches.slice(0, 200);
              truncated.group = matches.length > 200;
              continue;
            }
            const match =
              "d.search_label LIKE :directoryTerm ESCAPE '!' OR LOWER(d.value) LIKE :directoryTerm ESCAPE '!'";
            // Search entity labels inside the authorized cohort, but count every
            // occurrence of that entity, including its older historical names.
            const directorySql = directoryTerm
              ? ` HAVING MAX(CASE WHEN ${match} THEN 1 ELSE 0 END)=1`
              : '';
            const directoryLabel = directoryTerm
              ? `MIN(CASE WHEN ${match} THEN d.label ELSE NULL END)`
              : 'MIN(d.label)';
            const rows = await this.store.select<{
              value: string;
              label: string;
              amount: string | number;
            }>(
              `SELECT d.value,${directoryLabel} AS label,COUNT(DISTINCT c.call_key) AS amount ${FROM}
             JOIN call_dimensions d ON d.call_key=c.call_key AND d.tenant=c.tenant
             WHERE ${filter.sql} AND d.kind=:dimension GROUP BY d.value${directorySql} ORDER BY amount DESC,d.value LIMIT 201`,
              {
                ...filter.args,
                dimension: kind,
                directoryTerm: `%${(directoryTerm || '').replace(/[!%_]/g, '!$&')}%`,
              },
              transaction,
            );
            options[kind] = rows.slice(0, 200).map((row) => ({
              value: row.value,
              label: row.label,
              count: Number(row.amount),
            }));
            truncated[kind] = rows.length > 200;
          }
          const [checkpoint] = await this.store.select<{ updated_at: number }>(
            'SELECT updated_at FROM dashboard_checkpoints WHERE source_key=:key',
            { key: `projection:${this.store.nodeId}` },
            transaction,
          );
          return {
            options,
            truncated,
            contextKey: `${ctx.tenant}:${ctx.user.sub}:${ctx.permissionVersion}`,
            analyticsAllowed: this.analyticsAllowed(ctx),
            dataAsOf: checkpoint
              ? new Date(Number(checkpoint.updated_at)).toISOString()
              : null,
          };
        },
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        'Call filters are temporarily unavailable',
        { cause: error },
      );
    }
  }
  async authorizeRecording(
    user: JwtPayloadUser,
    id: string,
    recordingId: string,
  ): Promise<void> {
    const detail = await this.detail(user, id);
    if (
      !detail.call.recordings.some((recording) => recording.id === recordingId)
    )
      throw new NotFoundException();
    const ctx = await this.access.resolve(user, 'cdr');
    await this.auditRead(ctx, 'call_recording_play', id);
  }
  async exportCsv(user: JwtPayloadUser, query: CallsQuery, write: (chunk:string)=>Promise<boolean>): Promise<void> {
    let header=true;
    await this.exportRows(user,query,async values=>{
      const chunk=(header?'\uFEFF':'')+values.map(callCsvCell).join(';')+'\r\n'; header=false; return write(chunk);
    });
  }
  async exportRows(
    user: JwtPayloadUser,
    query: CallsQuery,
    write: (values: unknown[]) => Promise<boolean>,
  ): Promise<void> {
    const { ctx, timezone, filter } = await this.context(user, query);
    await this.auditRead(ctx, 'call_export');
    const outcomes: Record<CallRecord['outcome'], string> = {
      human: 'Принят сотрудником',
      robot: 'Обработан роботом',
      voicemail: 'Оставлено голосовое',
      menu: 'Завершён в меню',
      missed: 'Не ответили',
      error: 'Ошибка соединения',
      unknown: 'Исход не определён',
      active: 'Идёт сейчас',
    };
    const directions = {
      in: 'Входящий',
      out: 'Исходящий',
      internal: 'Внутренний',
      external: 'Внешний, направление не определено',
    };
    if (
      !(await write(
        [
            'Начало',
            'От',
            'Кому',
            'Номер компании',
            'Направление',
            'Результат',
            'Соединение, сек',
            'Общая длительность, сек',
            'Точность времени соединения',
            'Голосовое',
          ],
      ))
    )
      return;
    await this.store.sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => {
        let cursor: { at: number; id: string } | null = null;
        for (;;) {
          const cursorSql = cursor
            ? ' AND (c.started_at < :cursorAt OR (c.started_at=:cursorAt AND c.call_key < :cursorId))'
            : '';
          const rows: FactRow[] = await this.store.select<FactRow>(
            `SELECT c.call_key,c.started_at,f.payload ${FROM} WHERE ${filter.sql}${cursorSql} ORDER BY c.started_at DESC,c.call_key DESC LIMIT 500`,
            {
              ...filter.args,
              ...(cursor ? { cursorAt: cursor.at, cursorId: cursor.id } : {}),
            },
            transaction,
          );
          for (const row of rows) {
            const call = this.present(row, ctx);
            const values = [
              callExportTime(call.startedAt, timezone),
              call.caller.name || call.caller.number,
              call.recipient.name || call.recipient.number,
              call.companyNumber,
              directions[call.direction],
              callConnectionResult(call) ? ({busy:'Занят',noAnswer:'Нет ответа',unavailable:'Недоступен'}[callConnectionResult(call)!]) : outcomes[call.outcome],
              call.connectedSec,
              call.durationSec,
              call.timingSource === 'cdr'
                ? 'Приблизительно'
                : call.timingSource === 'cel'
                  ? 'Подтверждено'
                  : 'Не определено',
              call.hasVoicemail ? 'Да' : 'Нет',
            ];
            if (!(await write(values)))
              return;
          }
          if (rows.length < 500) return;
          const last = rows[rows.length - 1];
          cursor = { at: Number(last.started_at), id: last.call_key };
        }
      },
    );
  }
}
export function callCsvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
