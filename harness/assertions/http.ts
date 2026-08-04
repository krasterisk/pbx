/**
 * Shared HTTP helpers for black-box API scenarios (D-H02).
 * Throws on non-ok responses with status and body text for debugging.
 */
const DEFAULT_API_URL = 'http://localhost:5010';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

export interface ApiFetchOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  text: string;
  data: T;
}

function apiUrl(): string {
  return (process.env.HARNESS_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
}

function buildUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiUrl()}${normalized}`;
}

/** Low-level request — never throws on HTTP status. */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', token, body } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => '');
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = text as unknown as T;
  }

  return { ok: res.ok, status: res.status, text, data };
}

/** Asserts ok status; throws Error with status and body on failure. */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<{ status: number; data: T }> {
  const res = await apiRequest<T>(path, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${options.method ?? 'GET'} ${path}: ${res.text}`);
  }
  return { status: res.status, data: res.data };
}
