import type { ConditionSourceKind, IRouteAction } from '@krasterisk/shared';

export type DryRunSourceKind = ConditionSourceKind | 'schedule';

export interface DryRunSourceControl {
  kind: DryRunSourceKind;
  name?: string;
  device?: string;
}

function sourceKey(control: DryRunSourceControl): string {
  if (control.kind === 'variable') return `variable:${control.name ?? ''}`;
  if (control.kind === 'device_state') return `device_state:${control.device ?? ''}`;
  return control.kind;
}

function pushUnique(out: DryRunSourceControl[], seen: Set<string>, control: DryRunSourceControl) {
  const key = sourceKey(control);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(control);
}

/** One control per condition source the draft chain actually reads (D-30). */
export function collectConditionSources(actions: IRouteAction[] | undefined): DryRunSourceControl[] {
  const seen = new Set<string>();
  const out: DryRunSourceControl[] = [];

  for (const action of actions ?? []) {
    const condition = action.condition;
    if (!condition) continue;

    if (condition.source) {
      pushUnique(out, seen, {
        kind: condition.source,
        name: condition.name,
        device: condition.device,
      });
    } else if (condition.dialstatus) {
      pushUnique(out, seen, { kind: 'dialstatus' });
    }

    if (typeof condition.time_group_uid === 'number') {
      pushUnique(out, seen, { kind: 'schedule' });
    }
  }

  return out;
}
