/** A tab-local, short-lived destination, never an authentication credential. */
export const LOGIN_RETURN_KEY = 'krasterisk.login.return';
const MAX_AGE_MS = 15 * 60 * 1000;
export type LoginReturnIdentity = { uniqueid?: string | number; vpbx_user_uid?: string | number | null };

function identityKey(user?: LoginReturnIdentity | null): string | null {
  return user?.uniqueid == null ? null : `${user.uniqueid}:${user.vpbx_user_uid ?? ''}`;
}

function hasUnsafeCharacter(value: string, allowSpace = false): boolean {
  return Array.from(value).some((character) => character === '\\'
    || character.charCodeAt(0) <= (allowSpace ? 31 : 32) || character.charCodeAt(0) === 127);
}

/** Browser callers pass BASE_URL; Router callers already have a basename-free path. */
export function normalizeLoginReturnPath(input: unknown, basePath = '/'): string | null {
  if (typeof input !== 'string' || input.length > 2048 || !input.startsWith('/') || input.startsWith('//')) return null;
  if (hasUnsafeCharacter(input)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(input); } catch { return null; }
  // A valid encoded literal percent need not itself be another escape sequence.
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep the valid first decoding. */ }
  if (hasUnsafeCharacter(decoded, true) || decoded.startsWith('//')) return null;
  const decodedPath = decoded.split(/[?#]/)[0];
  if (/(^|\/)\.{1,2}(\/|$)/.test(decodedPath) || /%2f|%5c/i.test(input.split(/[?#]/)[0])) return null;
  const base = basePath.replace(/\/+$/, '');
  if (base && (!base.startsWith('/') || base.startsWith('//') || /[\\?#\s]/.test(base))) return null;
  const url = new URL(input, 'https://local.invalid');
  let pathname = url.pathname;
  if (base) {
    if (pathname !== base && !pathname.startsWith(base + '/')) return null;
    pathname = pathname.slice(base.length) || '/';
  }
  const forbidden = /^\/(login|register|activate|reset(?:-password)?|forgot(?:-password)?|platform|superadmin|standalone|conf)(\/|$)/i;
  let localDecoded: string;
  try { localDecoded = decodeURIComponent(pathname); } catch { return null; }
  if (forbidden.test(localDecoded)) return null;
  if ([...url.searchParams.keys()].some((key) => {
    let decodedKey = key;
    try { decodedKey = decodeURIComponent(key); } catch { /* A literal percent in a parameter name. */ }
    return /token|password|secret|authorization|api[_-]?key/i.test(decodedKey);
  })) return null;
  if (/(?:^#|[&?])[^=&]*(?:token|password|secret|authorization|api[_-]?key)[^=&]*=/i.test(decoded.slice(decoded.indexOf('#')))) return null;
  return pathname + url.search + url.hash;
}

export function clearLoginReturn(): void {
  try { sessionStorage.removeItem(LOGIN_RETURN_KEY); } catch { /* Storage may be disabled. */ }
}

export function rememberLoginReturn(path: string, user?: LoginReturnIdentity | null, basePath = '/', now = Date.now()): void {
  const normalized = normalizeLoginReturnPath(path, basePath);
  if (!normalized) return;
  try {
    sessionStorage.setItem(LOGIN_RETURN_KEY, JSON.stringify({ version: 1, path: normalized, createdAt: now, identity: identityKey(user) }));
  } catch { /* Login must remain usable without session storage. */ }
}

/** Consume even an invalid entry, so it cannot hijack a later navigation/login. */
export function consumeLoginReturn(user: LoginReturnIdentity, now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(LOGIN_RETURN_KEY);
    clearLoginReturn();
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry.version !== 1 || typeof entry.createdAt !== 'number' || !Number.isFinite(entry.createdAt)
      || now < entry.createdAt || now - entry.createdAt > MAX_AGE_MS) return null;
    if (entry.identity !== null && entry.identity !== identityKey(user)) return null;
    return normalizeLoginReturnPath(entry.path);
  } catch { return null; }
}
