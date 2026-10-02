import { describe, expect, it } from 'vitest';
import type { AgentTimelineItem } from '@krasterisk/shared';
import { mergeTimelines } from './aiChatLiveTimeline';

const at = '2026-10-02T10:00:00Z';
const user: AgentTimelineItem = { kind: 'user', id: 'm1', text: 'Create an IVR', createdAt: at };
const proposal: AgentTimelineItem = { kind: 'proposal', id: 'p3', card: 'workflow', createdAt: at };
const step = (id: string): AgentTimelineItem => ({
    kind: 'step', id, labelKey: 'plan', labelFallback: 'Plan', done: true, createdAt: at,
});
const answer: AgentTimelineItem = {
    kind: 'assistant', id: 'a-live', text: 'Applied', closeKind: 'complete', createdAt: at,
};

describe('mergeTimelines', () => {
    it('replaces temporary steps of a persisted proposal without duplicating the turn', () => {
        expect(mergeTimelines([user, step('m2'), proposal], [user, step('s1'), step('s2'), proposal]))
            .toEqual([user, step('m2'), proposal]);
    });
    it('keeps a later live continuation after a persisted proposal', () => {
        expect(mergeTimelines([user, step('m2'), proposal], [user, step('s1'), proposal, answer]))
            .toEqual([user, step('m2'), proposal, answer]);
    });
    it('keeps a live turn when a stale empty thread response arrives', () => {
        expect(mergeTimelines([], [user, step('s1'), proposal])).toEqual([user, step('s1'), proposal]);
    });
});
