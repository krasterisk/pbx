import { HTTP_RESULT_VAR } from '@krasterisk/shared';

export const CURL_TIMEOUT_SEC = 5;

const ASTERISK_VAR = /^\$\{[A-Za-z0-9_().]+\}$/;
const DIALPLAN_UNSAFE = /[(),?\[\]{}$\\";\n\r]/g;

export interface BuildCurlCallCtx {
  baseUrl?: string;
  apiKey?: string;
  vpbxUserUid?: number;
  resultVar?: string;
  timeoutSec?: number;
}

function sanitizeDialplanInput(input?: string): string {
  if (!input) return '';
  return input.replace(DIALPLAN_UNSAFE, '').trim();
}

function resolveBaseUrl(ctx: BuildCurlCallCtx): string {
  return (
    ctx.baseUrl
    || process.env.DIALPLAN_BACKEND_URL
    || `http://127.0.0.1:${process.env.BACKEND_PORT || 5010}/api`
  );
}

function resolveApiKey(ctx: BuildCurlCallCtx): string {
  return ctx.apiKey ?? process.env.DIALPLAN_API_KEY ?? '';
}

export function encodeCurlPayloadValue(value: string): string {
  if (ASTERISK_VAR.test(value)) {
    return `\${URIENCODE(${value})}`;
  }
  return encodeURIComponent(value);
}

export function extractCurlInvocation(dialplan: string): string {
  const match = dialplan.match(/\$\{CURL\([^]*?\)\}/);
  return match?.[0] ?? '';
}

export function decodeCurlPostData(curlInvocation: string): Record<string, string> {
  const inner = curlInvocation.replace(/^\$\{CURL\(/, '').replace(/\)\}$/, '');
  const comma = inner.indexOf(',');
  const post = comma === -1 ? '' : inner.slice(comma + 1);
  const out: Record<string, string> = {};
  for (const part of post.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawVal = eq === -1 ? '' : part.slice(eq + 1);
    const key = decodeURIComponent(rawKey);
    if (ASTERISK_VAR.test(rawVal) || rawVal.startsWith('${URIENCODE(')) {
      out[key] = rawVal;
    } else {
      out[key] = decodeURIComponent(rawVal);
    }
  }
  return out;
}

/**
 * Build a timed CURL() assignment for an internal dialplan endpoint.
 * Result is stored in HTTP_RESULT_VAR (ConditionSource `http_result`).
 */
export function buildCurlCall(
  path: string,
  payload: Record<string, string>,
  ctx: BuildCurlCallCtx = {},
): string {
  const resultVar = ctx.resultVar ?? HTTP_RESULT_VAR;
  const timeoutSec = ctx.timeoutSec ?? CURL_TIMEOUT_SEC;
  const safePath = path.replace(/^\/+/, '').replace(/[^a-z0-9/-]/gi, '');
  const url = `${resolveBaseUrl(ctx)}/internal/dialplan/${safePath}`;
  const parts: string[] = [];

  for (const [rawKey, rawVal] of Object.entries(payload)) {
    if (rawKey === 'api_key') continue;
    const key = sanitizeDialplanInput(rawKey);
    if (!key) continue;
    const encoded = encodeCurlPayloadValue(String(rawVal ?? ''));
    const safeEncoded = ASTERISK_VAR.test(String(rawVal ?? '')) || encoded.startsWith('${URIENCODE(')
      ? encoded
      : sanitizeDialplanInput(encoded);
    parts.push(`${key}=${safeEncoded}`);
  }

  if (ctx.vpbxUserUid != null) {
    parts.push(`vpbx_user_uid=${encodeURIComponent(String(ctx.vpbxUserUid))}`);
  }

  const apiKey = resolveApiKey(ctx);
  if (apiKey) {
    parts.push(`api_key=${encodeURIComponent(apiKey)}`);
  }

  return [
    `Set(CURLOPT(httptimeout)=${timeoutSec})`,
    `Set(${resultVar}=\${CURL(${url},${parts.join('&')})})`,
  ].join('\nsame => n,');
}
