import { describe, it, expect } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';

type Dict = Record<string, unknown>;

function flatten(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Dict).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
const dashboard = (locale: unknown) => (locale as { callcenter: { dashboard: Dict } }).callcenter.dashboard;

describe('call-center dashboard locales', () => {
  const ruEntries = flatten(dashboard(ru));
  const enEntries = flatten(dashboard(en));

  it('has the same keys in ru and en, all non-empty', () => {
    expect(ruEntries.map(([k]) => k)).toEqual(enEntries.map(([k]) => k));
    expect(ruEntries.length).toBeGreaterThan(30);
    for (const [, text] of [...ruEntries, ...enEntries]) expect(text.trim()).not.toBe('');
  });

  it('keeps the same interpolation placeholders in both languages', () => {
    const enByKey = new Map(enEntries);
    for (const [key, ruText] of ruEntries) expect(placeholders(ruText)).toEqual(placeholders(enByKey.get(key) as string));
  });

  it('has a label for every period preset', () => {
    for (const preset of ['today', 'yesterday', '7d', '30d', 'custom']) {
      expect((dashboard(ru).period as Dict)[preset]).toBeTruthy();
      expect((dashboard(en).period as Dict)[preset]).toBeTruthy();
    }
  });
});
