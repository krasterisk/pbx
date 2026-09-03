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
): ExactRouteResolveResult {
  if (routesInContext.length === 0) {
    return { kind: 'non_route_context' };
  }

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
