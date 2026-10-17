import { helpdeskChatRu, helpdeskChatEn } from './locales/helpdeskChat';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { ru } from './locales/ru';
import { en } from './locales/en';
import { trunkRegistrationRu, trunkRegistrationEn } from './locales/trunkRegistration';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: { ...ru, helpdeskChat: helpdeskChatRu, trunks: { ...ru.trunks, ...trunkRegistrationRu } } },
      en: { translation: { ...en, helpdeskChat: helpdeskChatEn, trunks: { ...en.trunks, ...trunkRegistrationEn } } },
    },
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

// Refresh the existing i18next instance when Vite replaces a locale module.
// React components can otherwise keep using the dictionary from initial startup.
if (import.meta.hot) {
  import.meta.hot.accept(['./locales/ru', './locales/en'], (modules) => {
    const [ruModule, enModule] = modules;
    if (ruModule) i18n.addResourceBundle('ru', 'translation', ruModule.ru, true, true);
    if (enModule) i18n.addResourceBundle('en', 'translation', enModule.en, true, true);
    void i18n.changeLanguage(i18n.language);
  });
  import.meta.hot.accept('./locales/trunkRegistration', (module) => {
    if (!module) return;
    i18n.addResourceBundle('ru', 'translation', { trunks: module.trunkRegistrationRu }, true, true);
    i18n.addResourceBundle('en', 'translation', { trunks: module.trunkRegistrationEn }, true, true);
    void i18n.changeLanguage(i18n.language);
  });
}

export default i18n;
