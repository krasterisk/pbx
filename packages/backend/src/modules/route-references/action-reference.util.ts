export type ActionReferenceKind =
  | 'ivr'
  | 'queue'
  | 'group'
  | 'voicerobot'
  | 'integration'
  | 'directory';

export const ACTION_REFERENCE_KINDS: readonly ActionReferenceKind[] = [
  'ivr',
  'queue',
  'group',
  'voicerobot',
  'integration',
  'directory',
] as const;

export function isActionReferenceKind(value: string): value is ActionReferenceKind {
  return (ACTION_REFERENCE_KINDS as readonly string[]).includes(value);
}

export type ActionReferenceHost = 'route' | 'ivr' | 'binding';

export interface ActionReference {
  routeUid: number;
  actionOrBindingId: string;
  location: string;
  host?: ActionReferenceHost;
  routeName?: string;
  extensions?: string[];
  routeActive?: number;
  actionType?: string;
  actionIndex?: number;
  ivrUid?: number;
  ivrName?: string;
  menuDigit?: string;
}

export interface ActionReferenceScanRoute {
  uid: number;
  name?: string;
  extensions?: unknown;
  active?: number;
  actions?: unknown;
}

export interface ActionReferenceScanIvr {
  uid: number;
  name?: string;
  menu_items?: unknown;
}

export interface ActionReferenceScanBinding {
  uid: number;
  route_uid: number;
  directory_uid?: number;
  behavior_params?: unknown;
  actions?: unknown;
}

const DIRECTORY_KEYS = new Set(['directoryUid', 'directory_uid']);
const FIELD_KEYS = new Set(['fieldUid', 'valueFieldUid']);

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

export function nodeMatches(
  node: unknown,
  directoryUid: number | string,
  fieldUid: number | undefined,
): boolean {
  if (node == null) return false;
  if (Array.isArray(node)) {
    return node.some((item) => nodeMatches(item, directoryUid, fieldUid));
  }
  const rec = asRecord(node);
  if (!rec) return false;

  let dirHit = false;
  let fieldHit = false;
  for (const [key, value] of Object.entries(rec)) {
    if (DIRECTORY_KEYS.has(key) && sameUid(value, directoryUid)) dirHit = true;
    if (fieldUid != null && FIELD_KEYS.has(key) && sameUid(value, fieldUid)) fieldHit = true;
  }

  if (fieldUid != null) {
    if (fieldHit) return true;
  } else if (dirHit) {
    return true;
  }

  return Object.values(rec).some((child) => nodeMatches(child, directoryUid, fieldUid));
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function pushUnique(hits: ActionReference[], hit: ActionReference): void {
  if (hits.some((existing) =>
    existing.routeUid === hit.routeUid
    && existing.actionOrBindingId === hit.actionOrBindingId
    && existing.location === hit.location
  )) {
    return;
  }
  hits.push(hit);
}

function actionMatchesKind(
  rec: Record<string, unknown>,
  params: Record<string, unknown> | null,
  kind: ActionReferenceKind,
  uid: number | string,
  fieldUid?: number,
): boolean {
  if (kind === 'ivr') {
    return rec.type === 'toivr' && sameUid(params?.ivr_uid, uid);
  }
  if (kind === 'queue') {
    return rec.type === 'toqueue' && sameUid(targetValue(params), uid);
  }
  if (kind === 'group') {
    return rec.type === 'togroup' && sameUid(targetValue(params), uid);
  }
  if (kind === 'voicerobot') {
    return rec.type === 'voicerobot' && sameUid(params?.robot_uid, uid);
  }
  if (kind === 'integration') {
    return rec.type === 'notify' && sameUid(params?.integration_uid, uid);
  }
  if (kind === 'directory') {
    return nodeMatches(rec, uid, fieldUid);
  }
  return false;
}

function scanRouteActions(
  routes: ActionReferenceScanRoute[],
  kind: ActionReferenceKind,
  uid: number | string,
  fieldUid: number | undefined,
  hits: ActionReference[],
): void {
  for (const route of routes) {
    if (!Array.isArray(route.actions)) continue;
    route.actions.forEach((action, index) => {
      const rec = asRecord(action);
      if (!rec) return;
      const params = asRecord(rec.params);
      if (!actionMatchesKind(rec, params, kind, uid, fieldUid)) return;
      const id = actionId(action, String(index));
      pushUnique(hits, {
        routeUid: route.uid,
        actionOrBindingId: id,
        location: `Route ${route.uid} action ${id}`,
        host: 'route',
        routeName: typeof route.name === 'string' ? route.name.trim() : undefined,
        extensions: asStringList(route.extensions),
        routeActive: typeof route.active === 'number' ? route.active : undefined,
        actionType: typeof rec.type === 'string' ? rec.type : undefined,
        actionIndex: index + 1,
      });
    });
  }
}

function scanIvrMenus(
  ivrs: ActionReferenceScanIvr[],
  kind: ActionReferenceKind,
  uid: number | string,
  fieldUid: number | undefined,
  hits: ActionReference[],
): void {
  for (const ivr of ivrs) {
    const items = Array.isArray(ivr.menu_items) ? ivr.menu_items : [];
    for (const item of items) {
      const rec = asRecord(item);
      if (!rec) continue;
      const digit = String(rec.digit ?? '').trim();
      const actions = Array.isArray(rec.actions) ? rec.actions : [];
      actions.forEach((action, index) => {
        const actionRec = asRecord(action);
        if (!actionRec) return;
        const params = asRecord(actionRec.params);
        if (!actionMatchesKind(actionRec, params, kind, uid, fieldUid)) return;
        const id = actionId(action, String(index));
        pushUnique(hits, {
          routeUid: 0,
          actionOrBindingId: id,
          location: `IVR ${ivr.uid} digit ${digit || '?'} action ${id}`,
          host: 'ivr',
          ivrUid: ivr.uid,
          ivrName: typeof ivr.name === 'string' ? ivr.name.trim() : undefined,
          menuDigit: digit || undefined,
          actionType: typeof actionRec.type === 'string' ? actionRec.type : undefined,
          actionIndex: index + 1,
        });
      });
    }
  }
}

function scanBindings(
  bindings: ActionReferenceScanBinding[],
  uid: number | string,
  fieldUid: number | undefined,
  hits: ActionReference[],
): void {
  for (const binding of bindings) {
    const bindingLocation = `Route ${binding.route_uid} binding ${binding.uid}`;
    const bindingRowMatches = fieldUid == null
      ? sameUid(binding.directory_uid, uid)
      : sameUid(binding.directory_uid, uid)
        && nodeMatches(binding.behavior_params, uid, fieldUid);

    if (bindingRowMatches) {
      pushUnique(hits, {
        routeUid: binding.route_uid,
        actionOrBindingId: String(binding.uid),
        location: bindingLocation,
        host: 'binding',
      });
    }

    if (!Array.isArray(binding.actions)) continue;
    binding.actions.forEach((action, index) => {
      if (!nodeMatches(action, uid, fieldUid)) return;
      const rec = asRecord(action);
      const id = actionId(action, String(index));
      pushUnique(hits, {
        routeUid: binding.route_uid,
        actionOrBindingId: id,
        location: `${bindingLocation} action ${id}`,
        host: 'binding',
        actionType: typeof rec?.type === 'string' ? rec.type : undefined,
        actionIndex: index + 1,
      });
    });
  }
}

/**
 * D-48: scan route `actions` JSON (and directory bindings) for entity references.
 * Does not read `raw_dialplan` — callers must surface that caveat separately.
 */
export function collectActionReferences(
  kind: ActionReferenceKind,
  uid: number | string,
  routes: ActionReferenceScanRoute[],
  bindings?: ActionReferenceScanBinding[],
  fieldUid?: number,
  ivrs?: ActionReferenceScanIvr[],
): ActionReference[] {
  const hits: ActionReference[] = [];
  scanRouteActions(routes, kind, uid, fieldUid, hits);
  if (kind === 'directory' && bindings?.length) {
    scanBindings(bindings, uid, fieldUid, hits);
  }
  if (ivrs?.length) {
    scanIvrMenus(ivrs, kind, uid, fieldUid, hits);
  }
  return hits;
}
