import { compileIvrFromSlots, type IvrSetupDraft } from './ivr-setup-draft';

export type SetupDomain = 'ivr' | 'route' | 'queue' | 'endpoints' | 'call_group';

export interface SetupDestSlot {
  kind: string;
  target?: string;
}

export interface SetupCalendarSlot {
  name?: string;
  timeStart?: string;
  timeEnd?: string;
  days?: string;
}

export interface SetupSlots {
  name?: string;
  greeting?: string;
  digits?: Record<string, SetupDestSlot>;
  timeout?: SetupDestSlot;
  did?: string;
  contextUid?: number;
  ivrUid?: number;
  extension?: string;
  calendar?: SetupCalendarSlot | null;
}

export interface SetupBrief {
  domain: SetupDomain | null;
  missing: string[];
  slots: SetupSlots;
}

export type CompiledSetup =
  | { kind: 'plan'; domain: SetupDomain; draft: IvrSetupDraft }
  | { kind: 'clarify'; domain: SetupDomain | null; question: string }
  | { kind: 'passthrough'; domain: SetupDomain };

export const SETUP_BRIEF_SYSTEM = [
  'Extract a PBX setup brief.',
  'Reply with JSON only:',
  '{"domain":"ivr|route|queue|endpoints|call_group"|null,"missing":string[],"slots":{}}.',
  'setup brief rules:',
  '- ivr slots: name, greeting, digits (map of digit to {kind,target}), timeout {kind,target}.',
  '- route slots: did, contextUid, ivrUid, optional calendar {name,timeStart,timeEnd,days}.',
  '- queue / endpoints / call_group: one entity. Put the public name in slots.name.',
  '- missing lists the single most important absent slot. Do not invent uids.',
].join('\n');

const DOMAINS = new Set<SetupDomain>(['ivr', 'route', 'queue', 'endpoints', 'call_group']);

export function parseSetupBrief(raw: string): SetupBrief | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(body.slice(start, end + 1));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    parsed = value as Record<string, unknown>;
  } catch {
    return null;
  }
  const domainRaw = parsed.domain;
  const domain = typeof domainRaw === 'string' && DOMAINS.has(domainRaw as SetupDomain)
    ? domainRaw as SetupDomain
    : null;
  if (typeof domainRaw === 'string' && domainRaw.trim() && !domain) return null;
  const missing = Array.isArray(parsed.missing)
    ? parsed.missing.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const slots = parseSlots(parsed.slots);
  return { domain, missing, slots };
}

export function compileSetupBrief(brief: SetupBrief): CompiledSetup {
  if (brief.missing.length > 0) {
    return { kind: 'clarify', domain: brief.domain, question: missingQuestion(brief.missing[0]) };
  }
  if (!brief.domain) {
    return {
      kind: 'clarify',
      domain: null,
      question: 'Что настроить: голосовое меню, маршрут, очередь или абонента?',
    };
  }
  if (brief.domain === 'ivr') {
    const draft = compileIvrFromSlots({
      name: brief.slots.name,
      greeting: brief.slots.greeting,
      digits: brief.slots.digits,
      timeout: brief.slots.timeout,
    });
    if (!draft) {
      return { kind: 'clarify', domain: 'ivr', question: missingQuestion('текст приветствия или цифры меню') };
    }
    return { kind: 'plan', domain: 'ivr', draft };
  }
  if (brief.domain === 'route') {
    const route = compileRouteBrief(brief.slots);
    if (route.kind === 'clarify') return { kind: 'clarify', domain: 'route', question: route.question };
    return { kind: 'plan', domain: 'route', draft: route.draft };
  }
  return { kind: 'passthrough', domain: brief.domain };
}

function missingQuestion(slot: string): string {
  return `Не хватает одного факта: ${slot}. Напишите его, и я соберу карточку.`;
}

function compileRouteBrief(slots: SetupSlots):
  | { kind: 'plan'; draft: IvrSetupDraft }
  | { kind: 'clarify'; question: string } {
  const did = slots.did?.trim();
  const contextUid = finiteUid(slots.contextUid);
  const ivrUid = finiteUid(slots.ivrUid);
  if (!did) return { kind: 'clarify', question: missingQuestion('номер маршрута (DID)') };
  if (contextUid == null) return { kind: 'clarify', question: missingQuestion('контекст входа') };
  if (ivrUid == null) return { kind: 'clarify', question: missingQuestion('какое голосовое меню принимает звонок') };

  const calendar = normalizeCalendar(slots.calendar);
  if (slots.calendar && !calendar) {
    return { kind: 'clarify', question: missingQuestion('интервал календаря (начало, конец, дни)') };
  }

  const steps: IvrSetupDraft['steps'] = [];
  if (calendar) {
    steps.push({
      id: 'tg',
      tool: 'create_time_group',
      args: {
        name: calendar.name,
        intervals: [{
          time_start: calendar.timeStart,
          time_end: calendar.timeEnd,
          days_of_week: calendar.days,
        }],
      },
      label: `Календарь ${calendar.name}`,
    });
  }
  const action: Record<string, unknown> = {
    type: 'toivr',
    params: { ivr_uid: ivrUid },
  };
  if (calendar) action.condition = { time_group_uid: 'steps.tg.result.uid' };
  steps.push({
    id: 'r',
    tool: 'create_route',
    dependsOn: calendar ? ['tg'] : undefined,
    args: {
      context_uid: contextUid,
      extensions: [did],
      actions: [action],
    },
    label: `Маршрут ${did}`,
  });
  return { kind: 'plan', draft: { title: `Маршрут ${did}`, steps } };
}

function normalizeCalendar(raw: SetupCalendarSlot | null | undefined): {
  name: string;
  timeStart: string;
  timeEnd: string;
  days: string;
} | null {
  if (!raw) return null;
  const timeStart = normalizeClock(raw.timeStart);
  const timeEnd = normalizeClock(raw.timeEnd);
  const days = normalizeDays(raw.days);
  if (!timeStart || !timeEnd || !days) return null;
  const name = raw.name?.trim() || 'Расписание';
  return { name, timeStart, timeEnd, days };
}

export function normalizeClock(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

export function normalizeDays(value: string | undefined): string | null {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  if (token === 'mon-fri' || token === 'будни' || token === 'weekdays' || token === 'пн-пт') return 'mon-fri';
  if (token === 'sat' || token === 'суббота') return 'sat';
  if (token === 'sun' || token === 'воскресенье') return 'sun';
  if (/^[a-z]{3}(?:-[a-z]{3})?$/.test(token)) return token;
  return null;
}

function finiteUid(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function parseSlots(raw: unknown): SetupSlots {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const slots = raw as Record<string, unknown>;
  const digits = parseDigits(slots.digits);
  const timeout = parseDest(slots.timeout);
  const calendar = parseCalendar(slots.calendar);
  return {
    name: stringSlot(slots.name),
    greeting: stringSlot(slots.greeting),
    digits,
    timeout,
    did: stringSlot(slots.did),
    contextUid: finiteUid(slots.contextUid) ?? undefined,
    ivrUid: finiteUid(slots.ivrUid) ?? undefined,
    extension: stringSlot(slots.extension),
    calendar,
  };
}

function parseDigits(raw: unknown): Record<string, SetupDestSlot> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const digits: Record<string, SetupDestSlot> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const dest = parseDest(value);
    if (dest) digits[key.trim()] = dest;
  }
  return Object.keys(digits).length ? digits : undefined;
}

function parseDest(raw: unknown): SetupDestSlot | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const dest = raw as Record<string, unknown>;
  const kind = stringSlot(dest.kind);
  if (!kind) return undefined;
  return { kind, target: stringSlot(dest.target) };
}

function parseCalendar(raw: unknown): SetupCalendarSlot | null | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const calendar = raw as Record<string, unknown>;
  return {
    name: stringSlot(calendar.name),
    timeStart: stringSlot(calendar.timeStart),
    timeEnd: stringSlot(calendar.timeEnd),
    days: stringSlot(calendar.days),
  };
}

function stringSlot(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
