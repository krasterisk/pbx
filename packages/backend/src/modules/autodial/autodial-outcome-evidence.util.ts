import { autodialCompletionOutcomeSchema, autodialOutcomeDefinitionSchema } from '@krasterisk/shared';

export function frozenAutodialOutcome(snapshot: unknown, code: unknown) {
  if (!snapshot || typeof snapshot !== 'object' || typeof code !== 'string') return null;
  const steps = (snapshot as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return null;
  const meanings = steps.flatMap((step) => {
    if (!step || typeof step !== 'object') return [];
    const definition = autodialOutcomeDefinitionSchema.safeParse(step.outcomeDefinitions?.[code]);
    if (definition.success) return [definition.data];
    for (const candidate of [step.completionOutcome, step.connectionOutcome]) {
      const completion = autodialCompletionOutcomeSchema.safeParse(candidate);
      if (completion.success && completion.data.code === code) {
        const { code: _code, ...metadata } = completion.data; return [metadata];
      }
    }
    return [];
  });
  // Ambiguous legacy/manual metadata stays unknown instead of selecting a label.
  if (!meanings.length || new Set(meanings.map((value) => JSON.stringify(value))).size > 1) return null;
  return meanings[0];
}

export function stampAutodialOutcome(result: Record<string, unknown>, snapshot: unknown) {
  const meaning = frozenAutodialOutcome(snapshot, result.business_outcome);
  result.business_outcome_label = meaning?.label ?? null;
  result.business_outcome_category = meaning?.category ?? null;
  result.business_goal_relation = meaning?.goal_relation ?? 'unknown';
}
