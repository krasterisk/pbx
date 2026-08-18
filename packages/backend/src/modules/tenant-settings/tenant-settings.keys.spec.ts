import {
  TENANT_SETTING_KEYS,
  GLOBAL_SETTING_KEYS,
  assertDisjointKeySets,
} from './tenant-settings.keys';

describe('TENANT_SETTING_KEYS (D-19, D-17)', () => {
  it('does not intersect GLOBAL_SETTING_KEYS', () => {
    expect(Object.keys(TENANT_SETTING_KEYS).filter((k) => GLOBAL_SETTING_KEYS.has(k))).toEqual([]);
  });

  it('assertDisjointKeySets does not throw when sets are disjoint', () => {
    expect(() => assertDisjointKeySets()).not.toThrow();
  });

  it('every whitelist key has type, default, and category', () => {
    for (const desc of Object.values(TENANT_SETTING_KEYS)) {
      expect(desc).toEqual(
        expect.objectContaining({
          type: expect.stringMatching(/^(boolean|number|string|json)$/),
          category: expect.any(String),
        }),
      );
      expect(desc).toHaveProperty('default');
    }
  });

  it('includes both D-17 visibility flags with boolean default true (LOCKED ON)', () => {
    expect(TENANT_SETTING_KEYS['routes.show_raw_dialplan']).toEqual(
      expect.objectContaining({ type: 'boolean', default: true, category: 'routes' }),
    );
    expect(TENANT_SETTING_KEYS['routes.show_flowchart']).toEqual(
      expect.objectContaining({ type: 'boolean', default: true, category: 'routes' }),
    );
  });
});
