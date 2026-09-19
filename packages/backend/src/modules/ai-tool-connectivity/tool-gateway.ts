import { createHash, randomUUID } from 'node:crypto';

export class DomainError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ? `${code}: ${message}` : code);
  }
}

export type ToolCall = {
  tenantUid: number;
  robotVersionId: string;
  toolRevisionId: string;
  sideEffect: 'none' | 'read' | 'mutate';
  policy: 'deny_mutate' | 'sandbox' | 'approved';
  simulated: boolean;
};

export function authorizeToolCall(call: ToolCall): { allowed: boolean; mode: 'simulated' | 'sandbox' | 'live' } {
  if (call.sideEffect === 'mutate' && call.policy === 'deny_mutate') {
    throw new DomainError('unsafe_binding', 403);
  }
  if (call.simulated) return { allowed: true, mode: 'simulated' };
  if (call.sideEffect === 'mutate' && call.policy === 'sandbox') return { allowed: true, mode: 'sandbox' };
  if (call.sideEffect === 'mutate' && call.policy !== 'approved') throw new DomainError('unsafe_binding', 403);
  return { allowed: true, mode: 'live' };
}

export function schemaDigest(schema: unknown): string {
  return createHash('sha256').update(JSON.stringify(schema)).digest('hex');
}

export function newToolId(): string {
  return randomUUID();
}
