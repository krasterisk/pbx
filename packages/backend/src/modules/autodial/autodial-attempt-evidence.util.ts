import { stampAutodialOutcome } from './autodial-outcome-evidence.util';
type Evidence = Record<string, unknown> | null | undefined;

/** Legacy non-null scenario_result meant a dialplan callback had supplied CDR facts.
 * New admission snapshots require an explicit durable source instead. */
export function hasAutodialCdrBillsec(value: Evidence): boolean {
  return Boolean(value && (value._evidence_version !== 1
    || (value._facts as Record<string, unknown> | undefined)?.billsec_source === 'dialplan'));
}

/** Callback payloads enrich results without replacing immutable admission data. */
export function mergeAutodialAttemptEvidence(stored: Evidence, incoming: Evidence, cdrBillsec = false): Evidence {
  if (!stored && !incoming && !cdrBillsec) return stored;
  const result = { ...stored, ...incoming };
  if (stored?._evidence_version === 1) {
    result._evidence_version = 1;
    result.snapshot = stored.snapshot;
    result._facts = { ...(stored._facts as Record<string, unknown> | undefined),
      ...(cdrBillsec ? { billsec_source: 'dialplan' } : {}) };
  }
  if (result.business_outcome) stampAutodialOutcome(result, stored?.snapshot);
  return result;
}
