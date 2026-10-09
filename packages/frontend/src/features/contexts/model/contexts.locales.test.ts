import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';

describe('context default translations', () => {
  it('resolves default labels and purpose column in both languages', async () => {
    const instance = createInstance();
    await instance.init({ resources: { ru: { translation: ru }, en: { translation: en } }, fallbackLng: 'ru' });
    for (const language of ['ru', 'en']) {
      await instance.changeLanguage(language);
      for (const key of ['contexts.defaultForTrunks', 'contexts.defaultForEndpoints', 'contexts.purpose', 'contexts.defaultContextHint']) {
        expect(instance.exists(key, { lng: language, fallbackLng: [] }), `${language}: ${key}`).toBe(true);
        expect(instance.t(key)).not.toBe(key);
      }
    }
    expect(instance.t('contexts.defaultForTrunks', { lng: 'ru' })).toBe('Основной для транков');
    expect(instance.t('contexts.defaultForEndpoints', { lng: 'ru' })).toBe('Основной для абонентов');
  });
});
