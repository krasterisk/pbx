/** Keep assistive pronunciation in sync with the supported interface language. */
export function syncDocumentLanguage(language: string | undefined): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language?.toLowerCase().startsWith('en') ? 'en' : 'ru';
}
