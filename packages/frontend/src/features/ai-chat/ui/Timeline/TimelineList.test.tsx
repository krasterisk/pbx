import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AgentTimelineItem } from '@krasterisk/shared';
import type { IAiChatCard } from './TimelineList';

const AT = '2026-09-08T00:00:00.000Z';
const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const WORKFLOW_ID = '22222222-2222-4222-8222-222222222222';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, _fallback?: string) => key,
    }),
}));

vi.mock('../DiffConfirmCard/DiffConfirmCard', () => ({
    DiffConfirmCard: ({ readOnly }: { readOnly?: boolean }) => (
        <div>
            single-card
            {!readOnly && <button type="button">apply</button>}
        </div>
    ),
}));

vi.mock('../WorkflowPlanCard/WorkflowPlanCard', () => ({
    WorkflowPlanCard: ({ readOnly }: { readOnly?: boolean }) => (
        <div>
            workflow-card
            {!readOnly && <button type="button">apply</button>}
        </div>
    ),
}));

import { TimelineList } from './TimelineList';

const items: AgentTimelineItem[] = [
    { kind: 'user', id: 'm1', text: 'Создай IVR Приёмная', createdAt: AT },
    {
        kind: 'step',
        id: 's1',
        labelKey: 'aiChat.progress.tools.create_ivr',
        labelFallback: 'create_ivr',
        done: true,
        createdAt: AT,
    },
    { kind: 'proposal', id: 'p1', card: 'single', createdAt: AT },
    { kind: 'assistant', id: 'm4', text: 'Подтвердите карточку', closeKind: 'wait_confirm', createdAt: AT },
];

const singleProposal = {
    proposalId: PROPOSAL_ID,
    entityType: 'ivr',
    entityLabel: 'Reception',
    summary: ['Create IVR'],
    status: 'pending',
    expiresAt: '2027-09-08T00:00:00.000Z',
};

const workflowPlan = {
    workflowId: WORKFLOW_ID,
    title: 'Plan',
    summary: ['Step one'],
    status: 'pending',
    error: null,
    expiresAt: '2027-09-08T00:00:00.000Z',
    appliedAt: null,
    steps: [],
};

const cards: Record<string, IAiChatCard> = {
    p1: { card: 'single', proposal: singleProposal },
};

describe('TimelineList', () => {
    it('renders one node per item in the given order', () => {
        const { container } = render(<TimelineList items={items} cards={cards} />);
        const kinds = [...container.querySelectorAll('[data-kind]')].map((node) => node.getAttribute('data-kind'));
        expect(kinds).toEqual(['user', 'step', 'proposal', 'assistant']);

        const text = container.textContent ?? '';
        expect(text.indexOf('Создай IVR Приёмная')).toBeGreaterThan(-1);
        expect(text.indexOf('Создай IVR Приёмная')).toBeLessThan(text.indexOf('aiChat.progress.tools.create_ivr'));
        expect(text.indexOf('aiChat.progress.tools.create_ivr')).toBeLessThan(text.indexOf('single-card'));
        expect(text.indexOf('single-card')).toBeLessThan(text.indexOf('Подтвердите карточку'));
        expect(screen.getByTestId('ai-agent-timeline')).toBeInTheDocument();
        expect(screen.getByTestId('ai-agent-step')).toHaveAttribute('data-kind', 'step');
    });

    it('names a step by locale key and never by tool identifier', () => {
        render(<TimelineList items={items} cards={cards} />);
        expect(screen.getByText('aiChat.progress.tools.create_ivr')).toBeInTheDocument();
        expect(screen.queryByText('create_ivr')).toBeNull();
    });

    it('renders a workflow card for a workflow item', () => {
        const workflowCards: Record<string, IAiChatCard> = {
            p1: { card: 'workflow', workflow: workflowPlan },
        };
        const workflowItems: AgentTimelineItem[] = [
            { kind: 'proposal', id: 'p1', card: 'workflow', createdAt: AT },
        ];
        render(<TimelineList items={workflowItems} cards={workflowCards} />);
        expect(screen.getByText('workflow-card')).toBeInTheDocument();
        expect(screen.queryByText('single-card')).toBeNull();
    });

    it('shows a streaming cursor only while the assistant item is streaming', () => {
        const streaming: AgentTimelineItem[] = [
            { kind: 'assistant', id: 'm4', text: 'Печатаю', closeKind: 'complete', streaming: true, createdAt: AT },
        ];
        const { rerender, container } = render(<TimelineList items={streaming} cards={{}} />);
        expect(container.querySelector('[data-streaming="true"]')).not.toBeNull();
        expect(container.querySelector('[data-streaming-cursor]')).not.toBeNull();

        rerender(
            <TimelineList
                items={[{ kind: 'assistant', id: 'm4', text: 'Печатаю', closeKind: 'complete', createdAt: AT }]}
                cards={{}}
            />,
        );
        expect(container.querySelector('[data-streaming="true"]')).toBeNull();
        expect(container.querySelector('[data-streaming-cursor]')).toBeNull();
    });

    it('hides card actions in read-only mode', () => {
        render(<TimelineList items={items} cards={cards} readOnly />);
        expect(screen.queryByRole('button', { name: 'apply' })).toBeNull();
        expect(screen.getByText('aiChat.timeline.readOnlyHint')).toBeInTheDocument();
    });

    it('leaves no technical data in the rendered markup', () => {
        const { container } = render(<TimelineList items={items} cards={cards} />);
        const html = container.innerHTML;
        expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
        expect(html).not.toMatch(/\b(e|ew)\d+_\d+\b/);
        expect(html).not.toMatch(/\bq\w+_\d+\b/);
        expect(html).not.toMatch(/"proposalId"|applyPayload|tool_call/);
    });
});
