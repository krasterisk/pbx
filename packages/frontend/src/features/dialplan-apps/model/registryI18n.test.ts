import { describe, it, expect } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';
import { dialplanAppsRegistry } from './registry';
import type { FieldSchema } from './schema.types';

/**
 * Every schema renders through `t(key, fallback)`, so a missing key degrades
 * silently to the Russian fallback instead of failing. This suite is the only
 * thing standing between a new field and an untranslated UI.
 */

const identity = (key: string, fallback?: string) => fallback ?? key;

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

/** Literal option labels such as 'GET' are values, not locale paths. */
function isLocaleKey(key: string): boolean {
  return key.includes('.') && /^[a-z]/.test(key);
}

function collectKeys(schema: FieldSchema[]): string[] {
  const keys: string[] = [];
  for (const field of schema) {
    keys.push(field.labelKey);
    if (field.hintKey) keys.push(field.hintKey);
    for (const option of field.options ?? []) {
      keys.push(option.labelKey);
      if (option.descriptionKey) keys.push(option.descriptionKey);
    }
  }
  return keys.filter(isLocaleKey);
}

const entries = Object.values(dialplanAppsRegistry);

function keysFor(config: (typeof entries)[number]): string[] {
  const schema = typeof config.schema === 'function' ? [] : (config.schema ?? []);
  const keys = [config.labelKey, ...collectKeys(schema as FieldSchema[])];
  if (config.primarySection) {
    keys.push(config.primarySection.titleKey);
    if (config.primarySection.tooltipKey) keys.push(config.primarySection.tooltipKey);
  }
  if (config.paramsSection?.tooltipKey) keys.push(config.paramsSection.tooltipKey);
  return keys.filter(isLocaleKey);
}

describe('dialplan registry i18n coverage', () => {
  it.each(entries.map((config) => [config.type, config] as const))(
    '%s declares only keys that exist in ru',
    (_type, config) => {
      const missing = keysFor(config).filter((key) => typeof resolve(ru, key) !== 'string');
      expect(missing).toEqual([]);
    },
  );

  it.each(entries.map((config) => [config.type, config] as const))(
    '%s declares only keys that exist in en',
    (_type, config) => {
      const missing = keysFor(config).filter((key) => typeof resolve(en, key) !== 'string');
      expect(missing).toEqual([]);
    },
  );

  it('every action type has a label in both locales', () => {
    const missing = entries
      .map((config) => config.labelKey)
      .filter((key) => typeof resolve(ru, key) !== 'string' || typeof resolve(en, key) !== 'string');
    expect(missing).toEqual([]);
  });

  it('summaries never fall back to a raw locale key', () => {
    const raw = entries
      .filter((config) => typeof config.summarize === 'function')
      .map((config) => [config.type, config.summarize(config.defaultParams ?? {}, identity)] as const)
      .filter(([, summary]) => /^[a-z]+(\.[a-zA-Z]+)+$/.test(summary.trim()));
    expect(raw).toEqual([]);
  });
});
