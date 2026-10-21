/** Authentication redirects must stay inside the application's router basename. */
export function getLoginRedirectPath(basePath: string = import.meta.env.BASE_URL): string {
  const base = (basePath || '/').trim();
  const unsafe = Array.from(base).some((character) => character.charCodeAt(0) <= 32) || /[\\?#]/.test(base);
  const prefix = base.startsWith('/') && !base.startsWith('//') && !unsafe
    ? base.replace(/\/+$/, '') : '';
  return `${prefix}/login`;
}
