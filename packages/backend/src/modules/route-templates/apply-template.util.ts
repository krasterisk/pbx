import { randomUUID } from 'crypto';
import type { IRouteAction, ITemplateSlot, ITemplateSlotValue } from '@krasterisk/shared';
import { parseTemplateSlotMarker } from '@krasterisk/shared';

export function applyTemplateActions(
  actions: IRouteAction[],
  slots: ITemplateSlot[],
  slotValues: Record<string, ITemplateSlotValue>,
): IRouteAction[] {
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  return actions.map((action) => {
    const cloned = structuredClone(action) as IRouteAction;
    cloned.id = randomUUID();
    cloned.params = replaceMarkers(cloned.params, byId, slotValues) as IRouteAction['params'];
    return cloned;
  });
}

function replaceMarkers(
  value: unknown,
  slots: Map<string, ITemplateSlot>,
  slotValues: Record<string, ITemplateSlotValue>,
): unknown {
  if (typeof value === 'string') {
    const slotId = parseTemplateSlotMarker(value);
    if (!slotId) return value;
    const slot = slots.get(slotId);
    const filled = slotValues[slotId];
    if (!slot || !filled) return value;
    return resolveSlotFill(slot, filled);
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceMarkers(item, slots, slotValues));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = replaceMarkers(child, slots, slotValues);
    }
    return next;
  }
  return value;
}

export function resolveSlotFill(slot: ITemplateSlot, value: ITemplateSlotValue): string {
  if (slot.kind === 'ivr' || slot.kind === 'directory') {
    return String(value.uid);
  }
  return String(value.name ?? value.uid);
}
