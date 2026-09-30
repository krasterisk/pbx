import { useSyncExternalStore } from 'react';
import type { SaAnalysisJob } from '../api/speechAnalyticsApi';

export interface PendingUpload {
  id: string;
  filename: string;
  projectName: string | null;
}

let items: PendingUpload[] = [];
let snapshot: SaAnalysisJob[] = [];
const listeners = new Set<() => void>();

function publish() {
  snapshot = items.map((item) => ({
    id: item.id,
    filename: item.filename,
    projectName: item.projectName,
    state: 'uploading' as const,
    reason: null,
  }));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addPendingUploads(rows: PendingUpload[]) {
  if (rows.length === 0) return;
  items = [...rows, ...items];
  publish();
}

export function removePendingUpload(id: string) {
  const next = items.filter((row) => row.id !== id);
  if (next.length === items.length) return;
  items = next;
  publish();
}

export function usePendingUploads(): SaAnalysisJob[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Drop a local row once the journal already lists that file. */
export function mergeAnalysisJobs(server: SaAnalysisJob[], pending: SaAnalysisJob[]): SaAnalysisJob[] {
  const remaining = new Map<string, number>();
  for (const job of server) {
    remaining.set(job.filename, (remaining.get(job.filename) ?? 0) + 1);
  }
  const extras = pending.filter((job) => {
    const count = remaining.get(job.filename) ?? 0;
    if (count <= 0) return true;
    remaining.set(job.filename, count - 1);
    return false;
  });
  return [...extras, ...server];
}
