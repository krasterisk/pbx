import { describe, expect, it } from 'vitest';
import { syncDocumentLanguage } from './documentLanguage';

describe('assistive document language', () => {
  it('follows repeated interface language switches, including regional variants', () => {
    for (const [language, expected] of [['en-US', 'en'], ['ru-RU', 'ru'], ['en', 'en'], [undefined, 'ru']]) {
      syncDocumentLanguage(language);
      expect(document.documentElement.lang).toBe(expected);
    }
  });
});
