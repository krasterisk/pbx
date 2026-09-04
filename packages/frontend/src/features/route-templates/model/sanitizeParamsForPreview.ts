import { parseTemplateSlotMarker, type ITemplateSlot } from '@krasterisk/shared';
import { normalizeTenantDisplayValue } from '@/features/dialplan-apps/model/normalizeTenantDisplayValue';

export function sanitizeParamsForPreview<T>(params: T, slots: ITemplateSlot[]): T {
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  return replaceMarkers(structuredClone(params), byId) as T;
}

function replaceMarkers(value: unknown, byId: Map<string, ITemplateSlot>): unknown {
  if (typeof value === 'string') {
    const id = parseTemplateSlotMarker(value);
    if (!id) return value;
    const slot = byId.get(id);
    const label = slot?.label?.trim();
    if (!label) return id;
    return slot?.kind === 'queue' ? normalizeTenantDisplayValue(label) : label;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceMarkers(item, byId));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      next[key] = replaceMarkers(child, byId);
    }
    return next;
  }
  return value;
}
