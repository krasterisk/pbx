import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';

type Dict = Record<string, unknown>;

function walkTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name)
      && !/\.test\.(ts|tsx)$/.test(entry.name)
      && !/\.spec\.(ts|tsx)$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

function getByPath(root: unknown, dotted: string): unknown {
  let cur: unknown = root;
  for (const part of dotted.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Dict)[part];
  }
  return cur;
}

describe('Call Center i18n coverage (U0.2)', () => {
  const srcRoot = path.resolve(__dirname, '../../..');
  const roots = [
    path.join(srcRoot, 'features/callcenter'),
    path.join(srcRoot, 'features/cc-dashboard'),
    ...fs
      .readdirSync(path.join(srcRoot, 'pages'))
      .filter((name) => name.startsWith('CallCenter'))
      .map((name) => path.join(srcRoot, 'pages', name)),
  ];

  const files = roots.flatMap(walkTsFiles);
  const keys = new Set<string>();
  const keyRegex = /\bt\(\s*['"]((?:callcenter|common)\.[a-zA-Z0-9_.]+)['"]/g;
  const mapKeyRegex = /\b(?:key|labelKey|titleKey):\s*['"](callcenter\.[a-zA-Z0-9_.]+)['"]/g;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(keyRegex)) {
      keys.add(match[1]);
    }
    for (const match of content.matchAll(mapKeyRegex)) {
      keys.add(match[1]);
    }
  }

  it('finds callcenter translation keys across features and pages', () => {
    expect(keys.size).toBeGreaterThan(50);
  });

  it('has non-empty Russian and English translations for every static callcenter.* and common.* key', () => {
    const missingRu: string[] = [];
    const missingEn: string[] = [];
    for (const key of [...keys].sort()) {
      const ruVal = getByPath(ru, key);
      const enVal = getByPath(en, key);
      if (typeof ruVal !== 'string' || ruVal.trim() === '') {
        missingRu.push(key);
      }
      if (typeof enVal !== 'string' || enVal.trim() === '') {
        missingEn.push(key);
      }
    }
    expect({ missingRu, missingEn }).toEqual({ missingRu: [], missingEn: [] });
  });
});
