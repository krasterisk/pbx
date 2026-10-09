import { parseRouteDialPattern, routeDialPatternKey } from '../../routeDialPattern';
import type { ExactRouteCandidate, ExactRouteResolveResult } from './types';

/** D-46: pattern extensions are leading-underscore only — no Asterisk pattern engine. */
export function isAsteriskPatternExtension(extension: string): boolean {
  return extension.startsWith('_');
}

function hasExactExtension(route: ExactRouteCandidate, extension: string): boolean {
  return (route.extensions ?? []).some(
    (ext) => ext === extension && !isAsteriskPatternExtension(ext),
  );
}

function hasPatternExtension(route: ExactRouteCandidate): boolean {
  return (route.extensions ?? []).some((ext) => isAsteriskPatternExtension(ext));
}

/**
 * exact_only toroute resolver (D-46).
 * Enters only when exactly one active route has a non-pattern extension match.
 */
export function resolveExactRoute(
  _contextName: string,
  extension: string,
  routesInContext: ExactRouteCandidate[],
  callerNumber?: string,
): ExactRouteResolveResult {
  if (routesInContext.length === 0) {
    return { kind: 'non_route_context' };
  }

  const qualified = routesInContext.filter((route) => route.active === 1 && (route.extensions ?? []).some((value) => {
    const rule = parseRouteDialPattern(value); return routeDialPatternKey(rule.extension) === routeDialPatternKey(extension) && rule.callerId !== undefined;
  }));
  if (qualified.length && callerNumber === undefined) return { kind: 'caller_id_required' };
  const selected = qualified.filter((route) => (route.extensions ?? []).some((value) => { const rule = parseRouteDialPattern(value); return routeDialPatternKey(rule.extension) === routeDialPatternKey(extension) && rule.callerId !== undefined && !rule.callerId.startsWith('_') && routeDialPatternKey(rule.callerId) === routeDialPatternKey(callerNumber ?? ''); }));
  if (selected.length > 1) return { kind: 'ambiguous', matches: selected };
  if (selected.length === 1) return { kind: 'enter', route: selected[0] };
  if (qualified.some((route) => (route.extensions ?? []).some((value) => { const rule = parseRouteDialPattern(value); return routeDialPatternKey(rule.extension) === routeDialPatternKey(extension) && rule.callerId?.startsWith('_'); }))) return { kind: 'caller_id_pattern' };
  const exact = routesInContext.filter((route) => hasExactExtension(route, extension));

  if (exact.length > 1) {
    return { kind: 'ambiguous', matches: exact };
  }

  if (exact.length === 1) {
    if (exact[0].active !== 1) {
      return { kind: 'inactive', route: exact[0] };
    }
    return { kind: 'enter', route: exact[0] };
  }

  const pattern = routesInContext.filter(hasPatternExtension);
  if (pattern.length >= 1) {
    return { kind: 'pattern_only', match: pattern[0] };
  }

  return { kind: 'non_route_context' };
}
