/**
 * Provenance of the agent's current status — used to decide whether the
 * panel may override Asterisk QueueMember pause (heal) or must yield to AMI.
 *
 * Trusted origins = intentional human action or an approved automation path.
 * Untrusted (ami / unknown / call) = do not force Asterisk to match panel.
 */
export type AgentStatusOrigin =
  | 'manual'   // operator / supervisor API (pause, unpause, outbound work)
  | 'policy'   // auto-pause rules, wrap-up timeout, other approved algorithms
  | 'login'    // shift start → READY
  | 'restore'  // hydrated from open-session snapshot (itself from a trusted write)
  | 'call'     // live call lifecycle (IN_CALL / RINGING / DIALING / …)
  | 'ami'      // raw QueueMember / QueueMemberStatus without panel authority
  | 'unknown';

/** Origins that may drive QueuePause to match panel READY / PAUSED / OUTBOUND_WORK. */
export const PANEL_PAUSE_AUTHORITY_ORIGINS: ReadonlySet<AgentStatusOrigin> = new Set([
  'manual',
  'policy',
  'login',
  'restore',
]);

export function isTrustedPanelPauseOrigin(
  origin: AgentStatusOrigin | string | null | undefined,
): boolean {
  if (!origin) return false;
  return PANEL_PAUSE_AUTHORITY_ORIGINS.has(origin as AgentStatusOrigin);
}

/**
 * Convincing check: panel READY/PAUSED/OUTBOUND_WORK may override Asterisk only when
 * provenance is trusted and the status itself looks intentional (not a ghost).
 */
export function canPanelOverrideAsteriskPause(opts: {
  status: string;
  statusOrigin?: AgentStatusOrigin | string | null;
  pauseReason?: string | null;
  /** Session snapshot origin (Nest restart). */
  sessionStatus?: string | null;
  sessionStatusOrigin?: AgentStatusOrigin | string | null;
}): boolean {
  const status = opts.status;
  if (status !== 'READY' && status !== 'PAUSED' && status !== 'OUTBOUND_WORK') {
    return false;
  }

  let origin = opts.statusOrigin;
  if (!isTrustedPanelPauseOrigin(origin)) {
    // After Nest restart RAM may lack origin — accept session snapshot if it
    // matches the live status and was itself trusted.
    if (
      opts.sessionStatus === status
      && isTrustedPanelPauseOrigin(opts.sessionStatusOrigin)
    ) {
      origin = opts.sessionStatusOrigin;
    } else {
      return false;
    }
  }

  if (status === 'PAUSED') {
    const reason = String(opts.pauseReason || '').trim();
    // Manual / supervisor / catalog reason, or auto_pause:* / outbound_work codes.
    if (!reason) return false;
  }

  if (status === 'OUTBOUND_WORK') {
    const reason = String(opts.pauseReason || '').trim();
    if (reason && reason !== 'outbound_work') return false;
  }

  return isTrustedPanelPauseOrigin(origin);
}
