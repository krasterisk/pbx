export interface IvrTimeoutFields {
  timeout?: string | null;
  timeout_response?: string | null;
  timeout_digit?: string | null;
}

export interface ResolvedIvrTimeouts {
  /** WaitExten — seconds to wait for menu choice after prompts */
  waitExten: number;
  /** Asterisk TIMEOUT(response) — first digit timeout */
  response: number;
  /** Asterisk TIMEOUT(digit) — pause between digits */
  digit: number;
}

const DEFAULT_WAIT_EXTEN = 10;
const DEFAULT_RESPONSE = 10;
const DEFAULT_DIGIT = 5;

function parsePositiveSeconds(raw: string | null | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveIvrTimeouts(ivr: IvrTimeoutFields): ResolvedIvrTimeouts {
  const waitExten = parsePositiveSeconds(ivr.timeout, DEFAULT_WAIT_EXTEN);
  const response = ivr.timeout_response != null && ivr.timeout_response !== ''
    ? parsePositiveSeconds(ivr.timeout_response, waitExten)
    : waitExten;
  const digit = ivr.timeout_digit != null && ivr.timeout_digit !== ''
    ? parsePositiveSeconds(ivr.timeout_digit, DEFAULT_DIGIT)
    : DEFAULT_DIGIT;

  return { waitExten, response, digit };
}
