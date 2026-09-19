import { DomainError } from './voice-engine';

const TOOLS = new Set(['end_call', 'transfer', 'get_session_context']);

export function executeVoiceTool(input: {
  action: string;
  operationKey: string;
  targetId?: string;
  allowlist: readonly string[];
  seen: Map<string, { action: string; state: 'requested' | 'confirmed' | 'failed' }>;
  preview: boolean;
}): { state: 'requested' | 'confirmed' | 'failed'; replay: boolean } {
  if (input.preview) throw new DomainError('preview_no_side_effect', 403);
  if (!TOOLS.has(input.action)) throw new DomainError('tool_forbidden', 403);
  if (!input.operationKey) throw new DomainError('operation_key_required', 422);
  const prior = input.seen.get(input.operationKey);
  if (prior) return { state: prior.state, replay: true };
  if (input.action === 'transfer') {
    if (!input.targetId || !input.allowlist.includes(input.targetId)) {
      throw new DomainError('transfer_target_denied', 403);
    }
  }
  const row = { action: input.action, state: 'requested' as const };
  input.seen.set(input.operationKey, row);
  return { state: 'requested', replay: false };
}

export function confirmVoiceTool(
  seen: Map<string, { action: string; state: 'requested' | 'confirmed' | 'failed' }>,
  operationKey: string,
  observed: 'confirmed' | 'failed',
): void {
  const row = seen.get(operationKey);
  if (!row) throw new DomainError('operation_not_found', 404);
  if (row.state !== 'requested') return;
  row.state = observed;
}
