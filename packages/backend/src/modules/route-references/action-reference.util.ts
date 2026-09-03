export type ActionReferenceKind =
  | 'ivr'
  | 'queue'
  | 'group'
  | 'voicerobot'
  | 'integration'
  | 'directory';

export interface ActionReference {
  routeUid: number;
  actionOrBindingId: string;
  location: string;
}

export interface ActionReferenceScanRoute {
  uid: number;
  actions?: unknown;
}

export interface ActionReferenceScanBinding {
  uid: number;
  route_uid: number;
  directory_uid?: number;
  behavior_params?: unknown;
  actions?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function actionId(action: unknown, fallback: string): string {
  const rec = asRecord(action);
  if (rec && typeof rec.id === 'string' && rec.id.length > 0) return rec.id;
  return fallback;
}

function targetValue(params: Record<string, unknown> | null): unknown {
  if (!params) return undefined;
  const target = params.target;
  if (typeof target === 'string' || typeof target === 'number') return target;
  const rec = asRecord(target);
  if (rec && rec.value != null) return rec.value;
  return params.queue ?? params.group;
}

function sameUid(left: unknown, right: number | string): boolean {
  return left === right || String(left) === String(right);
}

/**
 * Wave 0 stub (D-48): greens toivr + toqueue only. 14-02 generalizes the rest.
 */
export function collectActionReferences(
  kind: ActionReferenceKind,
  uid: number | string,
  routes: ActionReferenceScanRoute[],
  _bindings?: ActionReferenceScanBinding[],
  _fieldUid?: number,
): ActionReference[] {
  const hits: ActionReference[] = [];

  for (const route of routes) {
    if (!Array.isArray(route.actions)) continue;
    route.actions.forEach((action, index) => {
      const rec = asRecord(action);
      if (!rec) return;
      const params = asRecord(rec.params);
      const id = actionId(action, String(index));
      let matched = false;

      if (kind === 'ivr' && rec.type === 'toivr' && sameUid(params?.ivr_uid, uid)) {
        matched = true;
      }
      if (kind === 'queue' && rec.type === 'toqueue' && sameUid(targetValue(params), uid)) {
        matched = true;
      }

      if (!matched) return;
      hits.push({
        routeUid: route.uid,
        actionOrBindingId: id,
        location: `Route ${route.uid} action ${id}`,
      });
    });
  }

  return hits;
}
