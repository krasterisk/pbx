export interface DirectoryReference {
  routeUid: number;
  actionOrBindingId: string;
  location: string;
}

export interface ReferenceScanBinding {
  uid: number;
  route_uid: number;
  directory_uid: number;
  behavior_params?: unknown;
  actions?: unknown;
}

export interface ReferenceScanRoute {
  uid: number;
  actions?: unknown;
}

const DIRECTORY_KEYS = new Set(['directoryUid', 'directory_uid']);
const FIELD_KEYS = new Set(['fieldUid', 'valueFieldUid']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nodeMatches(
  node: unknown,
  directoryUid: number,
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
    if (DIRECTORY_KEYS.has(key) && value === directoryUid) dirHit = true;
    if (fieldUid != null && FIELD_KEYS.has(key) && value === fieldUid) fieldHit = true;
  }

  if (fieldUid != null) {
    if (fieldHit) return true;
  } else if (dirHit) {
    return true;
  }

  return Object.values(rec).some((child) => nodeMatches(child, directoryUid, fieldUid));
}

function actionId(action: unknown, fallback: string): string {
  const rec = asRecord(action);
  if (rec && typeof rec.id === 'string' && rec.id.length > 0) return rec.id;
  return fallback;
}

function pushUnique(hits: DirectoryReference[], hit: DirectoryReference): void {
  if (hits.some((existing) =>
    existing.routeUid === hit.routeUid
    && existing.actionOrBindingId === hit.actionOrBindingId
    && existing.location === hit.location
  )) {
    return;
  }
  hits.push(hit);
}

function scanActions(
  actions: unknown,
  directoryUid: number,
  fieldUid: number | undefined,
  routeUid: number,
  locationPrefix: string,
  hits: DirectoryReference[],
): void {
  if (!Array.isArray(actions)) return;
  actions.forEach((action, index) => {
    if (!nodeMatches(action, directoryUid, fieldUid)) return;
    const id = actionId(action, String(index));
    pushUnique(hits, {
      routeUid,
      actionOrBindingId: id,
      location: `${locationPrefix} action ${id}`,
    });
  });
}

export function collectDirectoryReferences(
  directoryUid: number,
  fieldUid: number | undefined,
  bindings: ReferenceScanBinding[],
  routes: ReferenceScanRoute[],
): DirectoryReference[] {
  const hits: DirectoryReference[] = [];

  for (const binding of bindings) {
    const bindingLocation = `Route ${binding.route_uid} binding ${binding.uid}`;
    const bindingRowMatches = fieldUid == null
      ? binding.directory_uid === directoryUid
      : binding.directory_uid === directoryUid
        && nodeMatches(binding.behavior_params, directoryUid, fieldUid);

    if (bindingRowMatches) {
      pushUnique(hits, {
        routeUid: binding.route_uid,
        actionOrBindingId: String(binding.uid),
        location: bindingLocation,
      });
    }

    scanActions(
      binding.actions,
      directoryUid,
      fieldUid,
      binding.route_uid,
      bindingLocation,
      hits,
    );
  }

  for (const route of routes) {
    scanActions(
      route.actions,
      directoryUid,
      fieldUid,
      route.uid,
      `Route ${route.uid}`,
      hits,
    );
  }

  return hits;
}
