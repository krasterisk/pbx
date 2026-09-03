import { resolveExactRoute, isAsteriskPatternExtension } from './exactRouteResolver';
import type { ExactRouteCandidate } from './types';

function route(
  uid: number,
  extensions: string[],
  extras: Partial<ExactRouteCandidate> = {},
): ExactRouteCandidate {
  return { uid, name: `route-${uid}`, extensions, active: 1, ...extras };
}

describe('resolveExactRoute (D-46 exact_only)', () => {
  it('enters when exactly one route has a non-pattern extension match', () => {
    const routes = [route(10, ['100']), route(11, ['_X.'])];
    const result = resolveExactRoute('from-internal', '100', routes);

    expect(result.kind).toBe('enter');
    if (result.kind === 'enter') {
      expect(result.route.uid).toBe(10);
    }
  });

  it('returns ambiguous when two routes share the same exact extension', () => {
    const routes = [route(10, ['100']), route(11, ['100', '200'])];
    const result = resolveExactRoute('from-internal', '100', routes);

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.matches.map((match) => match.uid).sort()).toEqual([10, 11]);
    }
  });

  it('returns pattern_only when the only candidate is a leading-underscore extension', () => {
    expect(isAsteriskPatternExtension('_X.')).toBe(true);
    expect(isAsteriskPatternExtension('100')).toBe(false);

    const routes = [route(12, ['_X.'])];
    const result = resolveExactRoute('from-internal', '100', routes);

    expect(result.kind).toBe('pattern_only');
    if (result.kind === 'pattern_only') {
      expect(result.match.uid).toBe(12);
    }
  });

  it('returns inactive when the single exact match is not active', () => {
    const routes = [route(13, ['100'], { active: 0, name: 'night' })];
    const result = resolveExactRoute('from-internal', '100', routes);

    expect(result.kind).toBe('inactive');
    if (result.kind === 'inactive') {
      expect(result.route.uid).toBe(13);
      expect(result.route.active).toBe(0);
    }
  });

  it('returns non_route_context when the context has no routes', () => {
    const result = resolveExactRoute('raw-handwritten', '100', []);
    expect(result.kind).toBe('non_route_context');
  });
});
