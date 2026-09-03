import type { ConditionSourceKind } from '../../types/dialplan-condition.types';
import type { IRouteActionCondition } from '../../types/route.types';

export type WalkHostKind = 'route' | 'ivr';

/** Wider than ActionType so Wave 0 can encode `callback` before 14-08 extends the union. */
export interface WalkAction {
  id: string;
  type: string;
  params?: Record<string, unknown>;
  condition?: IRouteActionCondition;
}

export interface WalkMenuItem {
  digit: string;
  actions: WalkAction[];
}

export interface ExactRouteCandidate {
  uid: number;
  name?: string;
  extensions: string[];
  /** 1 = active (dialplan-emitted), 0 = inactive. */
  active: number;
}

export type ExactRouteResolveResult =
  | { kind: 'enter'; route: ExactRouteCandidate }
  | { kind: 'ambiguous'; matches: ExactRouteCandidate[] }
  | { kind: 'pattern_only'; match: ExactRouteCandidate }
  | { kind: 'inactive'; route: ExactRouteCandidate }
  | { kind: 'non_route_context' };

export interface WalkResolvedIvr {
  uid: number;
  name?: string;
  menu_items: WalkMenuItem[];
}

export type WalkResolveIvr = (ivrUid: number) => WalkResolvedIvr | undefined;
export type WalkResolveRoutesInContext = (contextName: string) => ExactRouteCandidate[];

/** ConditionSource kind → preset value supplied by the dry-run form. */
export type WalkScenarioValues = Partial<Record<ConditionSourceKind | string, string>>;

export interface WalkDialplanOptions {
  host: WalkHostKind;
  actions?: WalkAction[];
  menu_items?: WalkMenuItem[];
  scenario?: WalkScenarioValues;
  /** Digit chosen on the IVR host (and on each entered IVR segment unless overridden). */
  ivrChoice?: string;
  resolveIvr?: WalkResolveIvr;
  resolveRoutesInContext?: WalkResolveRoutesInContext;
}

export interface WalkNode {
  order: string;
  actionId: string;
  type: string;
}

export interface WalkSegment {
  index: number;
  entityKind: WalkHostKind;
  entityUid?: number;
  entityName?: string;
  nodes: WalkNode[];
}

export interface WalkBreadcrumb {
  entityKind: WalkHostKind;
  entityUid?: number;
  entityName?: string;
  /** Marked as soon as a previously visited entity is re-entered (D-45). */
  loop?: boolean;
  repeatCount?: number;
}

export type WalkOutcomeKind =
  | 'congestion'
  | 'callback_requested'
  | 'addressed'
  | 'terminal'
  | 'incomplete'
  | 'stub';

export interface WalkOutcome {
  kind: WalkOutcomeKind;
  reason?: ExactRouteResolveResult['kind'];
  actionType?: string;
}

export interface WalkReask {
  source: ConditionSourceKind | string;
  keys: string[];
}

export interface WalkIvrInputs {
  /** Always includes `t` and `i` even when those handlers are absent (D-43). */
  available: string[];
}

export interface WalkDialplanResult {
  segments: WalkSegment[];
  breadcrumbs: WalkBreadcrumb[];
  hopsUsed: number;
  hopLimit: number;
  outcome: WalkOutcome;
  reask?: WalkReask;
  ivrInputs?: WalkIvrInputs;
}
