/**
 * Dialer KPI formulas. Kept pure so the definitions are testable and identical
 * between the live monitor and the reports.
 */

export interface AutodialKpiInput {
  dials: number;
  answered: number;
  success: number;
  short: number;
  abandoned: number;
  talkSecSum: number;
  billsecSum: number;
  /** Distinct contacts reached at least once */
  contactsReached: number;
  /** Distinct contacts in the list */
  contactsTotal: number;
  /** Contacts with at least one task attempted */
  contactsAttempted: number;
  /** Wall-clock seconds the campaign spent dialing */
  activeSec: number;
}

export interface AutodialKpi {
  /** Answered / dials */
  contact_rate: number;
  /** Successful contacts / dials — "right party connect" */
  rpc: number;
  /** Answer-seizure ratio: answered / dials, expressed as a percentage */
  asr: number;
  /** Average handle time over answered calls */
  aht: number;
  /** Average call duration over all dials */
  acd: number;
  /** Abandoned / answered — the number regulators care about */
  abandon_rate: number;
  /** Share of the list already attempted */
  list_penetration: number;
  /** Dials spent per contact reached */
  dials_per_contact: number;
  /** Dials per hour of active dialing */
  calls_per_hour: number;
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function pct(numerator: number, denominator: number): number {
  return Math.round(ratio(numerator, denominator) * 1000) / 10;
}

export function computeAutodialKpi(input: AutodialKpiInput): AutodialKpi {
  return {
    contact_rate: pct(input.answered, input.dials),
    rpc: pct(input.success, input.dials),
    asr: pct(input.answered, input.dials),
    aht: Math.round(ratio(input.talkSecSum, input.answered)),
    acd: Math.round(ratio(input.billsecSum, input.dials)),
    abandon_rate: pct(input.abandoned, input.answered),
    list_penetration: pct(input.contactsAttempted, input.contactsTotal),
    dials_per_contact: Math.round(ratio(input.dials, input.contactsReached) * 100) / 100,
    calls_per_hour: Math.round(ratio(input.dials, input.activeSec / 3600) * 10) / 10,
  };
}

export function emptyAutodialKpi(): AutodialKpi {
  return computeAutodialKpi({
    dials: 0,
    answered: 0,
    success: 0,
    short: 0,
    abandoned: 0,
    talkSecSum: 0,
    billsecSum: 0,
    contactsReached: 0,
    contactsTotal: 0,
    contactsAttempted: 0,
    activeSec: 0,
  });
}
