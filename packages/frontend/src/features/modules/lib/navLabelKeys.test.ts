import { describe, expect, it } from 'vitest';
import { en } from '@/shared/config/locales/en';
import { ru } from '@/shared/config/locales/ru';
import { BASELINE_MODULES } from './moduleRegistry';

/**
 * The module navbar calls t(labelKey) with no fallback. A locale cleanup that
 * drops a nav string leaves the raw key on screen (nav.modules, nav.auditLog).
 */
function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

describe('navbar label keys', () => {
  const keys = [...new Set(
    BASELINE_MODULES.flatMap((module) => [
      module.labelKey,
      ...module.pages.map((page) => page.labelKey),
    ]),
  )];

  it.each(['ru', 'en'] as const)('resolves every sidebar label in %s', (lang) => {
    const dict = lang === 'ru' ? ru : en;
    const missing = keys.filter((key) => typeof resolve(dict, key) !== 'string');
    expect(missing).toEqual([]);
  });
});
