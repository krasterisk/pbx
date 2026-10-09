import type { ContextsService } from './contexts.service';
import type { AiMutationContext } from '../ai-platform/ai-mutation.contract';

export async function selectConfigurationContext(service: ContextsService, input: string | undefined, kind: 'endpoints' | 'trunks', ctx: AiMutationContext): Promise<string | null> {
  const contexts = await service.findAll(ctx.vpbxUserUid);
  if (input?.trim()) {
    const chosen = input.trim();
    return contexts.some((context) => context.name === chosen) || ctx.planned?.contexts?.some((context) => context.name === chosen) ? chosen : null;
  }
  let selected = contexts.find((context) => context[`is_default_for_${kind}`])?.name ?? null;
  for (const pending of ctx.planned?.contexts ?? []) {
    const name = pending.name ?? contexts.find((context) => context.uid === pending.uid)?.name;
    const flag = pending[`is_default_for_${kind}`];
    if (name && flag === true) selected = name;
    if (name === selected && flag === false) selected = null;
  }
  return selected;
}
