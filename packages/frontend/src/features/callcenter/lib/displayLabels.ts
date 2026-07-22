import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import type { IAgent, IQueueStats } from '../model/types/callCenterSchema';

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
