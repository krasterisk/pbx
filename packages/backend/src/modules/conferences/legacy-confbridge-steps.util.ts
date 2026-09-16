export interface LegacyConfbridgeClassification {
  applicable: boolean;
  staticSource: boolean;
  numberKnown: boolean | null;
  hasDeadKey: boolean;
}

type LegacyStep = {
  type?: unknown;
  params?: Record<string, unknown> | null;
};

function roomOf(step: LegacyStep): { source?: string; value?: string } {
  const room = step.params?.room;
  if (room && typeof room === 'object' && !Array.isArray(room)) {
    const src = room as { source?: unknown; value?: unknown };
    return {
      source: typeof src.source === 'string' ? src.source : undefined,
      value: typeof src.value === 'string' ? src.value : undefined,
    };
  }
  if (typeof room === 'string') {
    return { source: 'fixed', value: room };
  }
  return {};
}

export function classifyLegacyConfbridgeStep(
  step: LegacyStep,
  tenantRoomNumbers: Set<string>,
): LegacyConfbridgeClassification {
  if (step?.type !== 'confbridge') {
    return {
      applicable: false,
      staticSource: false,
      numberKnown: null,
      hasDeadKey: false,
    };
  }
  const room = roomOf(step);
  const staticSource = room.source === 'fixed';
  const hasDeadKey = Boolean(
    step.params && Object.prototype.hasOwnProperty.call(step.params, 'options'),
  );
  const numberKnown = staticSource
    ? tenantRoomNumbers.has(String(room.value ?? ''))
    : null;
  return { applicable: true, staticSource, numberKnown, hasDeadKey };
}

export function stripLegacyConfbridgeKeys(
  params: Record<string, unknown>,
): { params: Record<string, unknown>; changed: boolean } {
  if (!Object.prototype.hasOwnProperty.call(params, 'options')) {
    return { params: { ...params }, changed: false };
  }
  const next = { ...params };
  delete next.options;
  return { params: next, changed: true };
}
