import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import type { ITimeGroupInterval } from '@krasterisk/shared';
import { TimeGroupsService } from './time-groups.service';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
const DEFAULT_TIMEZONE = 'Europe/Moscow';

/**
 * TimeGroupsAiAdapter — read-only schedule tools (D-15).
 * Evaluation reuses the same interval fields the routing path emits to ExecIfTime,
 * applied in the tenant's configured zone rather than the server's.
 */
@Injectable()
export class TimeGroupsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(TimeGroupsAiAdapter.name);
  readonly domain = 'time-groups';

  constructor(
    private readonly timeGroupsService: TimeGroupsService,
    private readonly registry: AiAdapterRegistryService,
    @Optional() private readonly tenantSettings?: TenantSettingsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('TimeGroupsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListTimeGroups(), this.toolEvaluateTimeGroup()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Расписания (time groups)
- Расписание задаёт интервалы, в которых действие маршрута выполняется. Вне интервала действие пропускается.
- Интервалы те же, что уходят в ExecIfTime: время, дни недели, дни месяца, месяцы.
- Оценка всегда в часовом поясе тенанта. Не складывай интервалы в уме и не бери пояс сервера.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const rows = await this.timeGroupsService.findAll(vpbxUserUid);
    if (rows.length === 0) return '';
    const names = rows.map((row) => row.name).join(', ');
    return `Расписания: ${names}`;
  }

  private toolListTimeGroups(): AiToolDefinition {
    return {
      name: 'list_time_groups',
      description:
        'Список расписаний тенанта с интервалами в читаемом виде. Без изменений. Оценка «сейчас внутри/снаружи» — evaluate_time_group.',
      inputSchema: {},
      entityType: 'time_group',
      handler: async (_args, uid) => {
        const rows = await this.timeGroupsService.findAll(uid);
        return {
          schedules: rows.map((row) => ({
            uid: row.uid,
            name: row.name,
            comment: row.comment ?? '',
            intervals: (row.intervals ?? []).map((interval) => formatReadableInterval(interval)),
          })),
        };
      },
    };
  }

  private toolEvaluateTimeGroup(): AiToolDefinition {
    return {
      name: 'evaluate_time_group',
      description:
        'Отвечает, находится ли названное расписание внутри своих интервалов в поясе тенанта, и когда состояние следующее изменится.',
      inputSchema: {
        name: { type: 'string', description: 'Имя расписания из list_time_groups' },
        at: { type: 'string', description: 'ISO-момент для оценки; по умолчанию сейчас' },
      },
      entityType: 'time_group',
      handler: async (args, uid) => {
        const name = String(args.name ?? '').trim();
        const rows = await this.timeGroupsService.findAll(uid);
        const found = rows.find((row) => row.name === name || String(row.uid) === name);
        if (!found) {
          return { error: 'Schedule not found', name };
        }
        const timeZone = await this.resolveTimezone(uid);
        const at = args.at ? new Date(String(args.at)) : new Date();
        return evaluateSchedule(found.intervals ?? [], at, timeZone);
      },
    };
  }

  private async resolveTimezone(vpbxUserUid: number): Promise<string> {
    if (!this.tenantSettings) return DEFAULT_TIMEZONE;
    const all = await this.tenantSettings.getAll(vpbxUserUid);
    const tz = all.timezone ?? all.time_zone;
    return typeof tz === 'string' && tz.trim() ? tz.trim() : DEFAULT_TIMEZONE;
  }
}

export function evaluateSchedule(
  intervals: ITimeGroupInterval[],
  at: Date,
  timeZone: string,
): { inside: boolean; next_boundary: string | null; timezone: string } {
  const inside = isInside(intervals, at, timeZone);
  let nextBoundary: string | null = null;
  const limit = 8 * 24 * 60;
  for (let step = 1; step <= limit; step++) {
    const candidate = new Date(at.getTime() + step * 60_000);
    if (isInside(intervals, candidate, timeZone) !== inside) {
      nextBoundary = formatBoundary(candidate, timeZone);
      break;
    }
  }
  return { inside, next_boundary: nextBoundary, timezone: timeZone };
}

function isInside(intervals: ITimeGroupInterval[], at: Date, timeZone: string): boolean {
  const wall = zonedWall(at, timeZone);
  return intervals.some((interval) => intervalMatches(interval, wall));
}

function intervalMatches(
  interval: ITimeGroupInterval,
  wall: ReturnType<typeof zonedWall>,
): boolean {
  if (!expandTokens(interval.days_of_week, WEEKDAYS).has(wall.weekday)) return false;
  if (!expandTokens(interval.months, MONTHS).has(wall.month)) return false;
  const days = expandDom(interval.days_of_month);
  if (days && !days.has(wall.day)) return false;

  const start = parseHm(interval.time_start);
  const end = parseHm(interval.time_end);
  if (start <= end) {
    return wall.minutes >= start && wall.minutes < end;
  }
  return wall.minutes >= start || wall.minutes < end;
}

function formatReadableInterval(interval: ITimeGroupInterval): string {
  const parts = [`${interval.time_start}–${interval.time_end}`];
  if (interval.days_of_week && interval.days_of_week !== '*') parts.push(interval.days_of_week);
  if (interval.days_of_month && interval.days_of_month !== '*') parts.push(`dom ${interval.days_of_month}`);
  if (interval.months && interval.months !== '*') parts.push(interval.months);
  return parts.join(', ');
}

function formatBoundary(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('weekday')} ${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} ${timeZone}`;
}

function zonedWall(date: Date, timeZone: string): {
  weekday: string;
  month: string;
  day: number;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: get('weekday').slice(0, 3).toLowerCase(),
    month: get('month').slice(0, 3).toLowerCase(),
    day: Number(get('day')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function expandTokens(spec: string | undefined, universe: readonly string[]): Set<string> {
  if (!spec || spec === '*') return new Set(universe);
  const out = new Set<string>();
  for (const part of spec.split(',')) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed.includes('-')) {
      const [from, to] = trimmed.split('-');
      const start = universe.indexOf(from);
      const end = universe.indexOf(to);
      if (start >= 0 && end >= 0) {
        for (let i = start; i <= end; i++) out.add(universe[i]);
      }
    } else if (trimmed) {
      out.add(trimmed);
    }
  }
  return out;
}

function expandDom(spec: string | undefined): Set<number> | null {
  if (!spec || spec === '*') return null;
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [from, to] = trimmed.split('-').map(Number);
      for (let i = from; i <= to; i++) out.add(i);
    } else if (trimmed) {
      out.add(Number(trimmed));
    }
  }
  return out;
}

function parseHm(hhmm: string | undefined): number {
  if (!hhmm) return 0;
  const [hours, minutes] = hhmm.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
