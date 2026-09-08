import { describe, it, expect } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';

function keysOf(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return [prefix];
  return entries.flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
}

describe('directory locales', () => {
  it('keeps the same user-facing directory keys in ru and en', () => {
    expect(keysOf(ru.directories)).toEqual(keysOf(en.directories));
  });

  it('names the field display name without calling it a CSV header', () => {
    expect(ru.directories.fieldLabel).toBe('Название поля');
    expect(en.directories.fieldLabel).toBe('Display name');
    expect(ru.directories.fieldKeyHint).not.toMatch(/CSV/i);
    expect(en.directories.fieldKeyHint).not.toMatch(/CSV/i);
    expect(ru.directories.recordsHint).not.toMatch(/CSV/i);
    expect(en.directories.recordsHint).not.toMatch(/CSV/i);
  });

  it('keeps CSV wording inside the import section', () => {
    expect(ru.directories.csv.confirmReplace).toBe('Заменить записи');
    expect(en.directories.csv.confirmReplace).toBe('Replace records');
    expect(ru.directories.csv.replaceWarning).toMatch(/заменит/i);
    expect(en.directories.csv.replaceWarning).toMatch(/replaces/i);
    expect(ru.directories.tabs.records).toBe('Записи');
    expect(en.directories.tabs.records).toBe('Records');
  });

  it('explains the extra CSV columns in plain language', () => {
    expect(ru.directories.csv.hint).not.toMatch(/плюс comment/i);
    expect(en.directories.csv.hint).not.toMatch(/plus comment/i);
    expect(ru.directories.csv.help).toMatch(/одна запись/i);
    expect(en.directories.csv.help).toMatch(/one record/i);
    expect(ru.directories.csv.hint).toMatch(/_/);
    expect(en.directories.csv.hint).toMatch(/_/);
    expect(ru.directories.lookupPatternHint).toMatch(/_/);
    expect(en.directories.lookupPatternHint).toMatch(/_/);
    expect(ru.directories.normalizationRu8).toMatch(/8/);
    expect(en.directories.normalizationRu8).toMatch(/8/);
  });

  it('keeps directory labels free of Asterisk and em dashes', () => {
    const walk = (value: unknown): string[] => {
      if (typeof value === 'string') return [value];
      if (!value || typeof value !== 'object') return [];
      return Object.values(value as Record<string, unknown>).flatMap(walk);
    };
    const ruText = walk(ru.directories).join('\n');
    const enText = walk(en.directories).join('\n');
    expect(ruText).not.toMatch(/Asterisk/i);
    expect(enText).not.toMatch(/Asterisk/i);
    expect(ruText).not.toMatch(/—/);
    expect(enText).not.toMatch(/—/);
  });
});
