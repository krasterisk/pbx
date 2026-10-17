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

const supervisor = (locale: unknown) => (locale as { callcenter: { supervisor: Dict } }).callcenter.supervisor;

describe('supervisor cockpit locales (attention feed, queue tiles, live-call columns)', () => {
  const sections = ['attention', 'queueTile', 'intraday'] as const;

  it.each(sections)('%s has the same keys in ru and en, all non-empty', (section) => {
    const ruEntries = flatten(supervisor(ru)[section]);
    const enEntries = flatten(supervisor(en)[section]);
    expect(ruEntries.map(([k]) => k)).toEqual(enEntries.map(([k]) => k));
    expect(ruEntries.length).toBeGreaterThan(0);
    for (const [, text] of [...ruEntries, ...enEntries]) expect(text.trim()).not.toBe('');
  });

  it.each(sections)('%s keeps the same interpolation placeholders in both languages', (section) => {
    const enByKey = new Map(flatten(supervisor(en)[section]));
    for (const [key, ruText] of flatten(supervisor(ru)[section])) {
      expect(placeholders(ruText)).toEqual(placeholders(enByKey.get(key) as string));
    }
  });

  it('the Wait / Talk column headings exist in both languages', () => {
    expect(supervisor(ru).waitCol).toBeTruthy();
    expect(supervisor(ru).talkCol).toBeTruthy();
    expect(supervisor(en).waitCol).toBe('Wait');
    expect(supervisor(en).talkCol).toBe('Talk');
  });
});
