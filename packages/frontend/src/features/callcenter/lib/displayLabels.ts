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

/**
 * Localize engine auto-pause reason codes (and legacy English strings) for UI.
 * Manual pause reasons from the catalog are returned unchanged.
 */
export function formatPauseReason(
  reason: string | undefined | null,
  t: (key: string, fallback?: string) => string,
): string {
  if (!reason) return '';

  if (reason === 'outbound_work') {
    return t('callcenter.status.outboundWork', 'Outbound work');
  }

  if (reason === 'auto_pause:rona' || reason === 'RONA (ring-no-answer)') {
    return t('callcenter.pauseReasons.auto.rona', 'Auto-pause: no answer');
  }

  const missedCode = reason.match(/^auto_pause:missed:(\d+)$/);
  const missedLegacy = reason.match(/^Auto-pause: (\d+) missed calls$/);
  const missed = missedCode || missedLegacy;
  if (missed) {
    return t('callcenter.pauseReasons.auto.missed', 'Auto-pause: {{count}} missed')
      .replace(/\{\{count\}\}/g, missed[1]);
  }

  const idleCode = reason.match(/^auto_pause:idle:(\d+)$/);
  const idleLegacy = reason.match(/^Auto-pause: idle (\d+)s$/);
  const idle = idleCode || idleLegacy;
  if (idle) {
    return t('callcenter.pauseReasons.auto.idle', 'Auto-pause: idle {{sec}}s')
      .replace(/\{\{sec\}\}/g, idle[1]);
  }

  const statusCode = reason.match(/^auto_pause:status:([A-Z_]+):(\d+)$/);
  const statusLegacy = reason.match(/^Auto-pause: ([A-Z_]+) > (\d+)s$/);
  const statusMatch = statusCode || statusLegacy;
  if (statusMatch) {
    const statusLabel = agentStatusLabel(statusMatch[1] as AgentStatus, t);
    return t('callcenter.pauseReasons.auto.status', 'Auto-pause: {{status}} > {{sec}}s')
      .replace(/\{\{status\}\}/g, statusLabel)
      .replace(/\{\{sec\}\}/g, statusMatch[2]);
  }

  return reason;
}

/** Caller cell: "Name (201)" or just number. */
export function callerDisplayLabel(callerIdNum?: string, callerIdName?: string): string {
  const num = (callerIdNum || '').trim();
  const name = (callerIdName || '').trim();
  if (name && name !== 'unknown' && name !== num) {
    return num ? `${name} (${num})` : name;
  }
  return num || '-';
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
  OUTBOUND_WORK: { key: 'callcenter.status.outboundWork', fallback: 'Outbound work' },
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
  OUTBOUND_WORK: 'info',
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

export type CoworkerActivityTone = 'warning' | 'success' | 'muted' | 'default';

/**
 * Rich coworker activity line: "Calling · Queue (700)" / "Talking · Personal (201)".
 * RINGING/DIALING → warning; IN_CALL → success.
 */
export function coworkerActivityLabel(
  agent: Pick<IAgent, 'status' | 'dialTarget' | 'pauseReason'>,
  call: { callerIdNum?: string; callerIdName?: string; queue?: string } | undefined,
  queues: Array<Pick<IQueueStats, 'name' | 'displayName'> & { exten?: string }>,
  t: (key: string, fallback?: string) => string,
): { text: string; tone: CoworkerActivityTone } {
  const status = agent.status;

    if (status === 'RINGING' || status === 'DIALING' || status === 'IN_CALL') {
    const verb =
      status === 'IN_CALL'
        ? t('callcenter.coworkersTab.activityTalking', 'Talking')
        : t('callcenter.coworkersTab.activityCalling', 'Calling');
    const tone: CoworkerActivityTone = status === 'IN_CALL' ? 'success' : 'warning';

    let context: string;
    if (call?.queue) {
      context = queueDisplayName(call.queue, queues);
    } else if (agent.dialTarget || status === 'DIALING') {
      const num = agent.dialTarget || call?.callerIdNum || '';
      const outbound = t('callcenter.statusBar.outbound', 'Outbound');
      context = num ? `${outbound} (${num})` : outbound;
    } else {
      const personal = t('callcenter.statusBar.personal', 'Personal');
      const caller = callerDisplayLabel(call?.callerIdNum, call?.callerIdName);
      context = caller && caller !== '-' ? `${personal} (${caller})` : personal;
    }

    return { text: `${verb} · ${context}`, tone };
  }

  if (status === 'PAUSED' && agent.pauseReason) {
    return {
      text: `${agentStatusLabel(status, t)} (${formatPauseReason(agent.pauseReason, t)})`,
      tone: 'warning',
    };
  }

  if (status === 'OUTBOUND_WORK') {
    return { text: agentStatusLabel(status, t), tone: 'default' };
  }

  return { text: agentStatusLabel(status, t), tone: status === 'READY' ? 'success' : 'default' };
}
