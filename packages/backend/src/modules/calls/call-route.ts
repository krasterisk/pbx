import type {
  CallJourneyStep,
  CallRoute,
  CallRouteNode,
} from '@krasterisk/shared';

/** A presentation graph of proven stages; no invented dialplan paths or hangup actor. */
export function buildCallRoute(journey: CallJourneyStep[]): CallRoute {
  const nodes: CallRouteNode[] = [];
  for (const step of journey) {
    const previous = nodes.at(-1);
    const attempts = step.kind === 'attempt' || step.kind === 'queue';
    if (
      attempts &&
      previous?.kind === 'attempts' &&
      previous.steps.some(
        (s) =>
          Date.parse(s.at) <= Date.parse(step.at) &&
          Date.parse(s.until || s.at) > Date.parse(step.at),
      )
    ) {
      if (
        !previous.steps.some(
          (s) =>
            s.target?.kind === step.target?.kind &&
            s.target?.id === step.target?.id &&
            s.at === step.at &&
            s.result === step.result,
        )
      )
        previous.steps.push(step);
      previous.possibleParallel = previous.steps.length > 1;
    } else
      nodes.push({
        id: step.id,
        kind: attempts ? 'attempts' : step.kind,
        steps: [step],
        possibleParallel: false,
      });
  }
  // A transfer's destination is successful only when a subsequent CEL conversation
  // proves that exact employee; Dial disposition alone is insufficient.
  for (const node of nodes.filter((n) => n.kind === 'transfer')) {
    const step = node.steps[0];
    if (step.target?.kind !== 'employee') continue;
    const position = journey.indexOf(step);
    const remaining = journey.slice(position + 1);
    const nextTransfer = remaining.findIndex((s) => s.kind === 'transfer');
    const candidates =
      nextTransfer < 0 ? remaining : remaining.slice(0, nextTransfer);
    const conversation = candidates.find(
      (s) =>
        s.kind === 'conversation' &&
        s.evidence === 'cel' &&
        s.target?.kind === 'employee' &&
        s.target.id === step.target!.id &&
        Date.parse(s.at) >= Date.parse(step.at),
    );
    if (conversation) node.steps = [{ ...step, result: 'answered' }];
  }
  return { nodes, coverage: 'partial' };
}
