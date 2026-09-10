import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    threadUid: 7,
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
    it('keeps user line breaks in the dialog bubble', () => {
        const multiline: AgentTimelineItem[] = [
            { kind: 'user', id: 'm1', text: 'строка 1\nстрока 2', createdAt: AT },
        ];
        const { container } = render(<TimelineList items={multiline} cards={{}} />);
        const bubble = container.querySelector('[data-kind="user"]');
        expect(bubble?.textContent).toBe('строка 1\nстрока 2');
        const scss = readFileSync(
            join(process.cwd(), 'src/features/ai-chat/ui/Timeline/TimelineList.module.scss'),
            'utf8',
        );
        expect(scss).toMatch(/\.userBubble[\s\S]*white-space:\s*pre-wrap/);
    });

    it('renders one node per item in the given order', () => {
        const { container } = render(<TimelineList items={items} cards={cards} />);
        const kinds = [...container.querySelectorAll('[data-kind]')].map((node) => node.getAttribute('data-kind'));
        expect(kinds).toEqual(['user', 'step', 'proposal']);

        const text = container.textContent ?? '';
        expect(text.indexOf('Создай IVR Приёмная')).toBeGreaterThan(-1);
        expect(text.indexOf('Создай IVR Приёмная')).toBeLessThan(text.indexOf('aiChat.progress.tools.create_ivr'));
        expect(text.indexOf('aiChat.progress.tools.create_ivr')).toBeLessThan(text.indexOf('single-card'));
        expect(text).not.toContain('Подтвердите карточку');
        expect(screen.getByTestId('ai-agent-timeline')).toBeInTheDocument();
        expect(screen.getByTestId('ai-agent-step')).toHaveAttribute('data-kind', 'step');
    });

    it('names a step by locale key and never by tool identifier', () => {
        render(<TimelineList items={items} cards={cards} />);
        expect(screen.getByText('aiChat.progress.tools.create_ivr')).toBeInTheDocument();
        expect(screen.queryByText('create_ivr')).toBeNull();
    });

    it('hides the expander when a successful step has no useful detail', () => {
        render(<TimelineList items={items} cards={cards} />);
        expect(screen.getByTestId('ai-agent-step').querySelector('button')).toBeNull();
        expect(screen.queryByTestId('ai-agent-step-detail')).toBeNull();
        expect(screen.queryByText(/Подготовил изменение|Prepared a change/i)).toBeNull();
    });

    it('opens a step to show a human detail, not a tool id', () => {
        const withDetail: AgentTimelineItem[] = [{
            kind: 'step',
            id: 's1',
            labelKey: 'aiChat.progress.tools.propose_plan',
            labelFallback: 'propose_plan',
            detailKey: 'aiChat.progress.detail.planFailed',
            detailFallback: 'Plan failed',
            done: true,
            createdAt: AT,
        }];
        render(<TimelineList items={withDetail} cards={{}} />);
        expect(screen.queryByText('propose_plan')).toBeNull();
        fireEvent.click(screen.getByTestId('ai-agent-step').querySelector('button') as HTMLButtonElement);
        expect(screen.getByTestId('ai-agent-step-detail')).toHaveTextContent('aiChat.progress.detail.planFailed');
    });

    it('shows a working row while the model thinks between steps', () => {
        render(<TimelineList items={items} cards={cards} working />);
        expect(screen.getByTestId('ai-agent-working')).toHaveTextContent('aiChat.progress.working');
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

    it('shows the pending card once, under the latest confirm ask', () => {
        render(<TimelineList items={items} cards={cards} />);
        expect(screen.getAllByText('single-card')).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'apply' })).toHaveLength(1);
        expect(screen.queryByTestId('ai-agent-confirm-here')).toBeNull();
    });

    it('does not show snake_case tool ids in the assistant bubble', () => {
        const leaked: AgentTimelineItem[] = [
            {
                kind: 'assistant',
                id: 'm4',
                text: 'Отлично! create_endpoints_bulk подготовил черновик для 102 и 103.',
                closeKind: 'complete',
                createdAt: AT,
            },
        ];
        render(<TimelineList items={leaked} cards={{}} />);
        expect(screen.queryByText(/create_endpoints_bulk/)).toBeNull();
        expect(screen.getByText(/подготовил черновик для 102 и 103/)).toBeInTheDocument();
    });

    it('hides the confirm recap — the card is the only summary', () => {
        render(<TimelineList items={items} cards={cards} />);
        expect(screen.queryByText('Подтвердите карточку')).toBeNull();
        expect(screen.getByText('single-card')).toBeInTheDocument();
    });

    it('hides card actions in read-only mode', () => {
        render(<TimelineList items={items} cards={cards} readOnly />);
        expect(screen.queryByRole('button', { name: 'apply' })).toBeNull();
        expect(screen.getByText('aiChat.timeline.readOnlyHint')).toBeInTheDocument();
    });

    it('scrolls to the focused workflow card without writing its id into markup', () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        const workflowItems: AgentTimelineItem[] = [
            { kind: 'proposal', id: 'p1', card: 'workflow', createdAt: AT },
        ];
        const workflowCards: Record<string, IAiChatCard> = {
            p1: { card: 'workflow', workflow: workflowPlan },
        };
        const { container } = render(
            <TimelineList items={workflowItems} cards={workflowCards} focusWorkflowId={WORKFLOW_ID} />,
        );
        expect(container.querySelector('[data-focused="true"]')).not.toBeNull();
        expect(scrollIntoView).toHaveBeenCalled();
        expect(container.innerHTML).not.toContain(WORKFLOW_ID);
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
