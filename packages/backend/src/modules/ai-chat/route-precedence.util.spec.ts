import { checkRoutePrecedence } from './route-precedence.util';

describe('checkRoutePrecedence', () => {
  it('reports unsafe when a catch-all sits above a specific numeric pattern', () => {
    const result = checkRoutePrecedence(['_X.', '_2XX']);
    expect(result).toEqual({
      safe: false,
      catchAll: '_X.',
      shadowed: '_2XX',
    });
  });

  it('reports unsafe when a catch-all sits above a short emergency pattern', () => {
    const result = checkRoutePrecedence(['_X.', '112']);
    expect(result).toEqual({
      safe: false,
      catchAll: '_X.',
      shadowed: '112',
    });
  });

  it('reports safe when the catch-all is last', () => {
    expect(checkRoutePrecedence(['_2XX', '112', '_X.'])).toEqual({ safe: true });
  });
});
