import { createHash } from 'crypto';

export interface DashboardStoredSnapshot {
  payload: string;
  updated_at?: number;
  inventory_payload?: string | null;
}

/** One bounded inventory row per node; the heartbeat remains on the original node row. */
export function dashboardInventoryKey(nodeId: string): string {
  return `inventory:${createHash('sha256').update(nodeId).digest('hex')}`;
}

export function encodeDashboardSnapshot<T extends { inventory: unknown[] }>(nodeId: string, snapshot: T) {
  const inventory = JSON.stringify(snapshot.inventory);
  const hash = createHash('sha256').update(inventory).digest('hex');
  const key = dashboardInventoryKey(nodeId);
  return {
    hash, key,
    inventory: JSON.stringify({ format: 2, nodeId, hash, inventory: snapshot.inventory }),
    payload: JSON.stringify({ ...snapshot, inventory: undefined, inventoryRef: { format: 2, key, hash } }),
  };
}

/** Read both rows in one SQL statement, so readers never mix two committed revisions. */
export const DASHBOARD_SNAPSHOT_SELECT = `SELECT s.payload,s.updated_at,i.payload AS inventory_payload
  FROM dashboard_live_state s LEFT JOIN dashboard_live_state i ON i.node_id=:inventoryNode
  WHERE s.node_id=:node AND OCTET_LENGTH(s.payload)<=:maxBytes
  AND (i.payload IS NULL OR OCTET_LENGTH(i.payload)<=:maxBytes)`;

export function decodeDashboardSnapshot<T extends { inventory: unknown[] }>(nodeId: string, row: DashboardStoredSnapshot): T {
  const snapshot = JSON.parse(row.payload);
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid dashboard snapshot');
  const ref = snapshot.inventoryRef;
  if (!ref) return snapshot as T; // Existing inline snapshots remain readable during upgrade.
  if (Buffer.byteLength(row.payload) + Buffer.byteLength(row.inventory_payload || '') > 32 * 1024 * 1024) {
    throw new Error('Dashboard snapshot exceeds fallback budget');
  }
  if (ref.format !== 2 || ref.key !== dashboardInventoryKey(nodeId) || !/^[a-f0-9]{64}$/.test(ref.hash) || !row.inventory_payload) {
    throw new Error('Invalid dashboard inventory reference');
  }
  const saved = JSON.parse(row.inventory_payload);
  if (saved?.format !== 2 || saved.nodeId !== nodeId || saved.hash !== ref.hash || !Array.isArray(saved.inventory)
    || createHash('sha256').update(JSON.stringify(saved.inventory)).digest('hex') !== ref.hash) {
    throw new Error('Dashboard inventory revision mismatch');
  }
  delete snapshot.inventoryRef;
  return { ...snapshot, inventory: saved.inventory } as T;
}
