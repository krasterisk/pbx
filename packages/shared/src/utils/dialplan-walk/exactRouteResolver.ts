import type { ExactRouteCandidate, ExactRouteResolveResult } from './types';

/** D-46: pattern extensions are leading-underscore only — no Asterisk pattern engine. */
export function isAsteriskPatternExtension(extension: string): boolean {
  return extension.startsWith('_');
}

/**
 * exact_only toroute resolver (D-46). Wave 0 stub — 14-04 greens the spec.
 */
export function resolveExactRoute(
  _contextName: string,
  _extension: string,
  _routesInContext: ExactRouteCandidate[],
): ExactRouteResolveResult {
  return { kind: 'ambiguous', matches: [] };
}
