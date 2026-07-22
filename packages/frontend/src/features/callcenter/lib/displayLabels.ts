import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import type { AgentStatus, IAgent, IQueueStats } from '../model/types/callCenterSchema';

/** True when name is a raw AMI/PJSIP interface string. */
export function isRawAgentName(name: string | undefined, iface?: string): boolean {
  if (!name) return true;
  if (iface && name === iface) return true;
  return /^(PJSIP|SIP)\//i.test(name);
}

/** Operator label: human name, else extension (ew112_0 → 112). */
export function agentDisplayName(agent: Pick<IAgent, 'name' | 'interface'>): string {
  if (!isRawAgentName(agent.name, agent.interface)) return agent.name;
  return interfaceToExtension(agent.interface) || agent.name || agent.interface;
}

/** q700_0 → 700; sales_7 → null (no leading q). */
export function queueNumberFromName(queueName: string): string | null {
  const m = queueName.match(/^q(.+)_\d+$/i);
  return m?.[1] || null;
}

/**
 * Queue label as "Name (number)" — e.g. "Очередь продаж (700)".
 * Falls back to number-only or raw name when displayName is missing.
 */
export function queueDisplayName(
  queueName: string,
  queues: Array<Pick<IQueueStats, 'name' | 'displayName'> & { exten?: string }>,
): string {
  const q = queues.find((x) => x.name === queueName);
  const num = q?.exten || queueNumberFromName(queueName);
  const rawName = q?.displayName || queueName;
  const isRaw = !q?.displayName || rawName === queueName || /^q.+_\d+$/i.test(rawName);
  const label = isRaw && num ? num : rawName;

  if (num && label !== num && !label.includes(`(${num})`)) {
    return `${label} (${num})`;
  }
  return label;
}

/** Caller cell: "Name (201)" or just number. */
export function callerDisplayLabel(callerIdNum?: string, callerIdName?: string): string {
  const num = (callerIdNum || '').trim();
  const name = (callerIdName || '').trim();
  if (name && name !== 'unknown' && name !== num) {
    return num ? `${name} (${num})` : name;
  }
  return num || '—';
}

// ─── Agent status (D-13/D-44) — single authoritative label + color map ──

/**
 * Authoritative i18n key + fallback per AgentStatus (all 9 members).
 * READY is relabelled to "Ожидание звонка"/"Waiting for call" per D-13 —
 * this is a label-only change, the union member itself stays 'READY'.
 */
export const AGENT_STATUS_LABEL_KEYS: Record<AgentStatus, { key: string; fallback: string }> = {
  OFFLINE: { key: 'callcenter.status.offline', fallback: 'Offline' },
  READY: { key: 'callcenter.status.ready', fallback: 'Waiting for call' },
  IN_CALL: { key: 'callcenter.status.inCall', fallback: 'In Call' },
  RINGING: { key: 'callcenter.status.ringing', fallback: 'Ringing' },
  PAUSED: { key: 'callcenter.status.paused', fallback: 'Paused' },
  WRAPUP: { key: 'callcenter.status.wrapup', fallback: 'Wrap-up' },
  DIALING: { key: 'callcenter.status.dialing', fallback: 'Dialing' },
  CONSULT: { key: 'callcenter.status.consult', fallback: 'Consulting' },
  ACW: { key: 'callcenter.status.acw', fallback: 'After-call work' },
};

/** Resolve the i18n label for an AgentStatus via a react-i18next `t` function. */
export function agentStatusLabel(
  status: AgentStatus,
  t: (key: string, fallback?: string) => string,
): string {
  const entry = AGENT_STATUS_LABEL_KEYS[status] ?? AGENT_STATUS_LABEL_KEYS.OFFLINE;
  return t(entry.key, entry.fallback);
}

/**
 * Status→color-family map (UI-SPEC Color contract, D-13/D-44): two-color busy system,
 * no 6th color. Matches the existing `.statusReady/.statusPaused/.statusInCall/.statusWrapup/
 * .statusOffline` SCSS class families in CallCenterAgentPage.module.scss — consumers pick the
 * matching class/token by this family name instead of re-deriving it per status.
 */
export type AgentStatusColorFamily = 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export const AGENT_STATUS_COLOR_FAMILY: Record<AgentStatus, AgentStatusColorFamily> = {
  READY: 'success',
  PAUSED: 'warning',
  IN_CALL: 'destructive',
  RINGING: 'destructive',
  DIALING: 'destructive',
  WRAPUP: 'info',
  CONSULT: 'info',
  ACW: 'info',
  OFFLINE: 'muted',
};

/** Resolve the color family for an AgentStatus (falls back to 'muted' for unknown values). */
export function agentStatusColorFamily(status: AgentStatus): AgentStatusColorFamily {
  return AGENT_STATUS_COLOR_FAMILY[status] ?? 'muted';
}
