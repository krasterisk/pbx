import type { IAutodialPacingConfig } from '@krasterisk/shared';

export function countAutodialReadyAgents(pacing: IAutodialPacingConfig, agents: Array<{
  userId: number; interface: string; status: string; queues: string[];
}>): number {
  const names = new Set((pacing?.providers ?? []).flatMap((provider) => provider.type === 'queue_agents' ? provider.queue_names : []));
  return new Set(agents.filter((agent) => agent.status === 'READY' && agent.queues.some((name) => names.has(name)))
    .map((agent) => agent.userId > 0 ? `user:${agent.userId}` : `interface:${agent.interface}`)).size;
}
