import { createHash } from 'node:crypto';
import { DomainError } from './tool-gateway';

const PRIVATE = /^(127\.|10\.|192\.168\.|169\.254\.|0\.|localhost|::1)/i;

export function assertMcpDestination(destination: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(destination);
  } catch {
    throw new DomainError('destination_invalid', 400);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new DomainError('destination_invalid', 400);
  }
  if (PRIVATE.test(parsed.hostname)) throw new DomainError('ssrf_denied', 403);
  return parsed;
}

export function handleMcpJsonRpc(body: {
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}): { refused?: string; result?: unknown } {
  if (body.method === 'sampling/createMessage' || body.method === 'roots/list') {
    return { refused: 'unsupported_mcp_request' };
  }
  if (body.method === 'tools/call' && body.params?.name === 'admin.mutate_pbx') {
    throw new DomainError('phone_principal_denied', 403);
  }
  if (body.method === 'tools/list') {
    return {
      result: {
        tools: [{ name: 'kb.search', description: 'search', annotations: { readOnlyHint: true } }],
      },
    };
  }
  return { result: { ok: true } };
}

export type EvalItem = { id: string; query: string; answerable: boolean; relevant: string[] };

export function recallAtK(items: EvalItem[], retrieve: (query: string) => string[], k = 5): number {
  const answerable = items.filter(item => item.answerable);
  if (!answerable.length) return 0;
  const hits = answerable.filter(item => {
    const got = new Set(retrieve(item.query).slice(0, k));
    return item.relevant.some(id => got.has(id));
  }).length;
  return hits / answerable.length;
}

export function evalDigest(items: EvalItem[]): string {
  return createHash('sha256').update(JSON.stringify(items.map(item => item.id))).digest('hex');
}
