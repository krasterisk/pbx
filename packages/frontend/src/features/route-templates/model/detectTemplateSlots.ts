import {
  templateSlotMarker,
  type IRouteAction,
  type ITemplateSlot,
  type TemplateSlotKind,
} from '@krasterisk/shared';

export interface SlotCandidate {
  id: string;
  kind: TemplateSlotKind;
  label: string;
  actionId: string;
  path: Array<string | number>;
  value: string;
}

function pushCandidate(
  out: SlotCandidate[],
  action: IRouteAction,
  kind: TemplateSlotKind,
  path: Array<string | number>,
  value: unknown,
): void {
  const text = String(value ?? '').trim();
  if (!text || text.startsWith('__slot:')) return;
  out.push({
    id: `${kind}-${action.id}-${path.join('.')}`,
    kind,
    label: text,
    actionId: action.id,
    path,
    value: text,
  });
}

function readPath(root: unknown, path: Array<string | number>): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function writePath(root: Record<string, unknown>, path: Array<string | number>, value: string): Record<string, unknown> {
  const next = structuredClone(root);
  let cursor: Record<string | number, unknown> = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const child = cursor[key];
    if (child == null || typeof child !== 'object') return next;
    cursor = child as Record<string | number, unknown>;
  }
  cursor[path[path.length - 1]] = value;
  return next;
}

export function detectTemplateSlots(actions: IRouteAction[]): SlotCandidate[] {
  const out: SlotCandidate[] = [];

  for (const action of actions) {
    const params = (action.params ?? {}) as Record<string, unknown>;

    if (action.type === 'toqueue') {
      const target = params.target as { source?: string; value?: string; directoryUid?: number } | undefined;
      if (target?.source === 'fixed') {
        pushCandidate(out, action, 'queue', ['target', 'value'], target.value);
      }
      if (target?.source === 'directory' && target.directoryUid) {
        pushCandidate(out, action, 'directory', ['target', 'directoryUid'], target.directoryUid);
      }
      pushCandidate(out, action, 'recording', ['announceoverride'], params.announceoverride);
    }

    if (action.type === 'togroup') {
      pushCandidate(out, action, 'group', ['group'], params.group);
    }

    if (action.type === 'toivr') {
      pushCandidate(out, action, 'ivr', ['ivr_uid'], params.ivr_uid);
    }

    if (action.type === 'totrunk') {
      pushCandidate(out, action, 'trunk', ['trunk'], params.trunk);
      const trunks = params.trunks;
      if (Array.isArray(trunks)) {
        trunks.forEach((row, index) => {
          const trunk = (row as { trunk?: string; name?: string })?.trunk
            ?? (row as { name?: string })?.name
            ?? row;
          pushCandidate(out, action, 'trunk', ['trunks', index, 'trunk'], trunk);
        });
      }
      const callerId = params.callerId as { mode?: string; directoryUid?: number } | undefined;
      if (callerId?.mode === 'directory' && callerId.directoryUid) {
        pushCandidate(out, action, 'directory', ['callerId', 'directoryUid'], callerId.directoryUid);
      }
    }

    if (action.type === 'playback') {
      pushCandidate(out, action, 'recording', ['files'], params.files);
    }

    if (action.type === 'directory_lookup' || action.type === 'callerid') {
      pushCandidate(out, action, 'directory', ['directoryUid'], params.directoryUid);
    }
  }

  return out;
}

export function buildTemplatePayload(
  actions: IRouteAction[],
  selectedIds: string[],
  candidates: SlotCandidate[],
): { actions: IRouteAction[]; slots: ITemplateSlot[] } {
  const selected = candidates.filter((item) => selectedIds.includes(item.id));
  const byAction = new Map<string, SlotCandidate[]>();
  for (const item of selected) {
    const list = byAction.get(item.actionId) ?? [];
    list.push(item);
    byAction.set(item.actionId, list);
  }

  const nextActions = actions.map((action) => {
    const hits = byAction.get(action.id);
    if (!hits?.length) return structuredClone(action);
    let params = structuredClone(action.params ?? {}) as Record<string, unknown>;
    for (const hit of hits) {
      if (readPath(params, hit.path) == null) continue;
      params = writePath(params, hit.path, templateSlotMarker(hit.id));
    }
    return { ...structuredClone(action), params };
  });

  const slots: ITemplateSlot[] = selected.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
  }));

  return { actions: nextActions, slots };
}
