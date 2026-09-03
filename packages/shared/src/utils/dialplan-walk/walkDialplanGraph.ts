import { DEFAULT_HOP_LIMIT, resolveHopDecision } from '../dialplan-hops';
import type { IRouteActionCondition } from '../../types/route.types';
import type { ValueSource } from '../../types/dialplan-params.types';
import { resolveExactRoute } from './exactRouteResolver';
import type {
  WalkAction,
  WalkBreadcrumb,
  WalkDialplanOptions,
  WalkDialplanResult,
  WalkHostKind,
  WalkMenuItem,
  WalkOutcome,
  WalkReask,
  WalkResolvedIvr,
  WalkSegment,
} from './types';

/** UI-SPEC: «Итог: абонент заказал обратный звонок» (D-38). */
export const CALLBACK_REQUESTED_LABEL = 'Итог: абонент заказал обратный звонок';

/** D-46: specific reason strings — never a generic "failed". */
export const TOROUTE_REASON_MESSAGES = {
  ambiguous: 'неоднозначность',
  pattern_only: 'паттерн',
  non_route_context: 'не-маршрутный контекст',
  inactive: 'Цель перехода выключена',
} as const;

const TERMINAL_TYPES = new Set([
  'toqueue',
  'togroup',
  'toexten',
  'totrunk',
  'tolist',
  'voicemail',
  'confbridge',
  'voicerobot',
  'hangup',
]);

function entityKey(kind: WalkHostKind, uid?: number): string {
  return `${kind}:${uid ?? 'draft'}`;
}

function matchOp(actual: string, op: string, expected: string): boolean {
  switch (op) {
    case 'ne':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'matches':
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    case 'eq':
    default:
      return actual === expected;
  }
}

function evaluateCondition(
  condition: IRouteActionCondition | undefined,
  scenario: Record<string, string> | undefined,
): 'run' | 'skip' | 'reask' {
  if (!condition) return 'run';

  if (condition.source) {
    const value = scenario?.[condition.source];
    if (value === undefined || value === '') {
      return 'reask';
    }
    if (condition.source === 'variable' || condition.source === 'http_result') {
      return matchOp(value, condition.op ?? 'eq', condition.value ?? '') ? 'run' : 'skip';
    }
    const wanted = condition.values ?? [];
    if (wanted.length === 0 || wanted.includes(value)) return 'run';
    return 'skip';
  }

  if (condition.dialstatus) {
    const value = scenario?.dialstatus;
    if (value === undefined || value === '') return 'reask';
    const wanted = Array.isArray(condition.dialstatus)
      ? condition.dialstatus
      : [condition.dialstatus];
    if (wanted.filter(Boolean).length === 0 || wanted.includes(value as never)) return 'run';
    return 'skip';
  }

  return 'run';
}

function reaskFromCondition(condition: IRouteActionCondition | undefined): WalkReask {
  const source = condition?.source ?? 'dialstatus';
  return { source, keys: [source] };
}

function asValueSource(raw: unknown): ValueSource | string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null && 'source' in raw) {
    return raw as ValueSource;
  }
  return undefined;
}

function resolveExtensionValue(
  raw: unknown,
  callerNumber: string | undefined,
  scenario: Record<string, string> | undefined,
): { value?: string; unresolved?: 'variable' | 'directory' } {
  const src = asValueSource(raw);
  if (src === undefined) return {};
  if (typeof src === 'string') return { value: src };
  if (src.source === 'fixed') return { value: src.value };
  if (src.source === 'current_caller' || src.source === 'original_caller' || src.source === 'route_pattern') {
    return callerNumber !== undefined ? { value: callerNumber } : {};
  }
  if (src.source === 'variable') {
    const value = scenario?.[src.name] ?? scenario?.variable;
    if (value === undefined || value === '') return { unresolved: 'variable' };
    return { value };
  }
  if (src.source === 'directory') {
    return { unresolved: 'directory' };
  }
  return {};
}

/**
 * Cross-entity dry-run walker (D-43…D-47, D-38).
 * Hop accounting MUST import DEFAULT_HOP_LIMIT from the shared hop module.
 */
export function walkDialplanGraph(options: WalkDialplanOptions): WalkDialplanResult {
  const hopLimit = DEFAULT_HOP_LIMIT;
  let hopsUsed = 0;
  const segments: WalkSegment[] = [];
  const breadcrumbs: WalkBreadcrumb[] = [];
  const visitCounts = new Map<string, number>();
  let outcome: WalkOutcome = { kind: 'incomplete' };
  let reask: WalkReask | undefined;
  let stopped = false;

  const scenario = options.scenario as Record<string, string> | undefined;

  function pushBreadcrumb(kind: WalkHostKind, uid?: number, name?: string): void {
    const key = entityKey(kind, uid);
    const next = (visitCounts.get(key) ?? 0) + 1;
    visitCounts.set(key, next);
    breadcrumbs.push({
      entityKind: kind,
      entityUid: uid,
      entityName: name,
      ...(next > 1 ? { loop: true, repeatCount: next } : {}),
    });
  }

  function tryHop(): boolean {
    if (resolveHopDecision(hopsUsed, hopLimit) === 'exceed') {
      outcome = { kind: 'congestion' };
      stopped = true;
      return false;
    }
    hopsUsed += 1;
    return true;
  }

  function startSegment(kind: WalkHostKind, uid?: number, name?: string): WalkSegment {
    pushBreadcrumb(kind, uid, name);
    const segment: WalkSegment = {
      index: segments.length,
      entityKind: kind,
      entityUid: uid,
      entityName: name,
      nodes: [],
    };
    segments.push(segment);
    return segment;
  }

  function walkChain(actions: WalkAction[], segment: WalkSegment): void {
    let i = 0;
    while (i < actions.length && !stopped) {
      const action = actions[i];
      const cond = evaluateCondition(action.condition, scenario);
      if (cond === 'reask') {
        segment.nodes.push({
          order: `${segment.index + 1}.${segment.nodes.length + 1}`,
          actionId: action.id,
          type: action.type,
        });
        reask = reaskFromCondition(action.condition);
        outcome = { kind: 'incomplete' };
        stopped = true;
        return;
      }
      if (cond === 'skip') {
        i += 1;
        continue;
      }

      segment.nodes.push({
        order: `${segment.index + 1}.${segment.nodes.length + 1}`,
        actionId: action.id,
        type: action.type,
      });

      if (action.type === 'callback') {
        outcome = {
          kind: 'callback_requested',
          actionType: 'callback',
          label: CALLBACK_REQUESTED_LABEL,
        };
        stopped = true;
        return;
      }

      if (action.type === 'goto') {
        if (!tryHop()) return;
        const label = String(action.params?.label_name ?? '');
        const target = actions.findIndex(
          (candidate) =>
            candidate.type === 'label' && String(candidate.params?.label_name ?? '') === label,
        );
        if (target < 0) {
          outcome = { kind: 'incomplete', actionType: 'goto' };
          stopped = true;
          return;
        }
        i = target;
        continue;
      }

      if (action.type === 'toivr') {
        if (!tryHop()) return;
        const ivrUid = Number(action.params?.ivr_uid);
        const ivr = options.resolveIvr?.(ivrUid);
        if (!ivr) {
          outcome = {
            kind: 'addressed',
            actionType: 'toivr',
            message: 'Цель перехода не найдена',
          };
          stopped = true;
          return;
        }
        enterIvr(ivr);
        return;
      }

      if (action.type === 'toroute') {
        if (!tryHop()) return;
        const contextName = String(action.params?.context ?? '');
        const resolved = resolveExtensionValue(
          action.params?.extension,
          options.callerNumber,
          scenario,
        );
        if (resolved.unresolved) {
          outcome = {
            kind: 'incomplete',
            actionType: 'toroute',
            message: resolved.unresolved === 'directory'
              ? 'Дальше не проверить'
              : 'Дальше не проверить',
          };
          stopped = true;
          return;
        }
        if (resolved.value === undefined) {
          outcome = { kind: 'incomplete', actionType: 'toroute', message: 'Дальше не проверить' };
          stopped = true;
          return;
        }
        const candidates = options.resolveRoutesInContext?.(contextName) ?? [];
        const resolvedRoute = resolveExactRoute(contextName, resolved.value, candidates);
        if (resolvedRoute.kind !== 'enter') {
          const reason = resolvedRoute.kind;
          outcome = {
            kind: 'addressed',
            actionType: 'toroute',
            reason,
            message: TOROUTE_REASON_MESSAGES[reason],
          };
          stopped = true;
          return;
        }
        const loaded = options.resolveRoute?.(resolvedRoute.route.uid);
        if (!loaded) {
          outcome = {
            kind: 'addressed',
            actionType: 'toroute',
            message: 'Цель перехода не найдена',
          };
          stopped = true;
          return;
        }
        const next = startSegment('route', loaded.uid, loaded.name);
        walkChain(loaded.actions, next);
        return;
      }

      if (TERMINAL_TYPES.has(action.type)) {
        outcome = { kind: 'terminal', actionType: action.type };
        stopped = true;
        return;
      }

      i += 1;
    }
  }

  function enterIvr(ivr: WalkResolvedIvr): void {
    const next = startSegment('ivr', ivr.uid, ivr.name);
    const choice = options.ivrChoice;
    if (choice === undefined || choice === '') {
      outcome = { kind: 'incomplete' };
      stopped = true;
      return;
    }
    const item = (ivr.menu_items ?? []).find((entry) => entry.digit === choice);
    if (!item) {
      outcome = { kind: 'incomplete' };
      stopped = true;
      return;
    }
    walkChain(item.actions, next);
  }

  function hostIvrInputs(menuItems: WalkMenuItem[]) {
    const digits = (menuItems ?? []).map((item) => item.digit);
    return { available: Array.from(new Set(['t', 'i', ...digits])) };
  }

  if (options.host === 'ivr') {
    const menuItems = options.menu_items ?? [];
    const ivrInputs = hostIvrInputs(menuItems);
    const segment = startSegment('ivr');
    if (options.ivrChoice) {
      const item = menuItems.find((entry) => entry.digit === options.ivrChoice);
      if (item) {
        walkChain(item.actions, segment);
      }
    }
    return {
      segments,
      breadcrumbs,
      hopsUsed,
      hopLimit,
      outcome,
      ...(reask ? { reask } : {}),
      ivrInputs,
    };
  }

  const segment = startSegment('route');
  walkChain(options.actions ?? [], segment);

  return {
    segments,
    breadcrumbs,
    hopsUsed,
    hopLimit,
    outcome,
    ...(reask ? { reask } : {}),
  };
}
