/**
 * Bandwidth budget for conference admission. No I/O, no exceptions, no dialplan.
 * Formula locked by 16.1-RESEARCH Pattern 3 (D-18 / D-19). Do not recalculate.
 */
export const STREAM_KBPS = 800;

export function maxParticipantsForBudget(budgetStreams: number): number {
  if (budgetStreams <= 0) return 0;
  return Math.floor((1 + Math.sqrt(1 + 4 * budgetStreams)) / 2);
}

export function streamsForParticipants(n: number): number {
  return n <= 1 ? 0 : n * (n - 1);
}

export function effectiveMax(tariffMax: number | null | undefined, budgetMax: number): number {
  return Math.min(tariffMax ?? budgetMax, budgetMax);
}
