import type { AgentStatus, IAgent, IQueueStats } from '../model/types/callCenterSchema';
import { queueNumberFromName } from './displayLabels';

export const SUPERVISOR_QUEUE_LABEL_LIMIT = 32;

/** Queue events carry live figures, while the tenant directory owns human names. */
export function supervisorNamedQueues(
  live: readonly IQueueStats[],
  directory: readonly { name: string; display_name?: string | null }[],
): IQueueStats[] {
  const names = new Map(directory.map(queue => [queue.name, queue.display_name?.trim()]));
  return live.map(queue => {
    const displayName = names.get(queue.name);
    return displayName ? { ...queue, displayName } : queue;
  });
}

/** null is unrestricted; an empty access list grants no queues. */
export function supervisorQueueAllowed(name: string, exten: string | undefined, allowed: readonly string[] | null): boolean {
  if (allowed === null) return true;
  const tokens = new Set(allowed.map(value => value.toLowerCase()));
  return [name, exten, queueNumberFromName(name)].some(value => Boolean(value && tokens.has(value.toLowerCase())));
}

/** Unicode character limit includes the ellipsis; callers retain the original for the tooltip. */
export function supervisorQueueSummary(full: string, limit = SUPERVISOR_QUEUE_LABEL_LIMIT): string {
  const characters = Array.from(full);
  if (characters.length <= limit) return full;
  if (limit < 2) return limit === 1 ? '…' : '';
  return `${characters.slice(0, limit - 1).join('').replace(/[,\s]+$/u, '')}…`;
}

export function supervisorStatusActions(agent: Pick<IAgent, 'interface' | 'userId' | 'status'>) {
  const live = Boolean(agent.interface) && !agent.interface.startsWith('user:');
  const offline = !live || agent.status === 'OFFLINE';
  return {
    start: agent.userId > 0 && offline,
    end: agent.userId > 0 && live && !offline,
    pause: live && agent.status === 'READY',
    resume: live && (agent.status === 'PAUSED' || agent.status === 'OUTBOUND_WORK'),
    confirmEnd: (['IN_CALL', 'RINGING', 'DIALING', 'CONSULT'] as AgentStatus[]).includes(agent.status),
    queues: live && !offline,
  };
}
