export function attemptAdmissionValues(result: Record<string, unknown> | null | undefined) {
  const snapshot = result?.snapshot as { version?: unknown; revision?: unknown; variables?: unknown } | undefined;
  if (result?._evidence_version !== 1 || snapshot?.version !== 1 || !Number.isInteger(snapshot.revision)
    || !Array.isArray(snapshot.variables)) return null;
  return { revision: snapshot.revision as number,
    variables: snapshot.variables.filter((item): item is { name: string; value: string | null } => item
      && typeof item === 'object' && typeof item.name === 'string' && (typeof item.value === 'string' || item.value === null)),
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function observedScenarioSteps(snapshot: unknown, evidence: unknown) {
  const source = object(snapshot), facts = object(object(evidence)?.steps);
  if (!Array.isArray(source?.steps)) return [];
  return source.steps.flatMap((raw, index) => {
    const step = object(raw);
    if (!step || typeof step.type !== 'string') return [];
    const observation = typeof step.id === 'string' ? object(facts?.[step.id]) : null;
    const status = step.status === 'skipped' ? 'skipped' : observation && ['entered', 'completed', 'failed', 'no_input', 'invalid_input'].includes(String(observation.status))
      ? String(observation.status) : 'not_observed';
    return [{ id: typeof step.id === 'string' ? step.id : String(index), position: index + 1, type: step.type, status,
      text: typeof step.text === 'string' ? step.text : null,
      detail: typeof observation?.detail === 'string' ? observation.detail : null,
      digits: typeof observation?.digits === 'string' ? observation.digits : null }];
  });
}
