import { collapseDuplicateAgentSteps, type AgentTimelineItem } from '@krasterisk/shared';

const liveTimelines = new Map<number, AgentTimelineItem[]>();

export function mergeTimelines(incoming: AgentTimelineItem[], live: AgentTimelineItem[]): AgentTimelineItem[] {
    const incomingIds = new Set(incoming.map((item) => item.id));
    const liveById = new Map(live.map((item) => [item.id, item]));
    const merged = incoming.map((item) => liveById.get(item.id) ?? item);
    // A persisted proposal closes a turn: its preceding temporary SSE step IDs
    // have been replaced by database message IDs. Keep only later live items.
    let persistedProposalIndex = -1;
    live.forEach((item, index) => {
        if (item.kind === 'proposal' && incomingIds.has(item.id)) persistedProposalIndex = index;
    });
    for (const item of live.slice(persistedProposalIndex + 1)) {
        if (!incomingIds.has(item.id)) merged.push(item);
    }
    return collapseDuplicateAgentSteps(merged);
}

export function getLiveTimeline(uid: number): AgentTimelineItem[] | undefined {
    return liveTimelines.get(uid);
}

export function setLiveTimeline(uid: number, items: AgentTimelineItem[] | null): void {
    if (!items) liveTimelines.delete(uid);
    else liveTimelines.set(uid, items.slice());
}

export function clearLiveTimelines(): void {
    liveTimelines.clear();
}
