import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IAgentWorkflowPlanView, IAgentWorkflowStepView } from '@/shared/api/endpoints/aiChatApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { applied?: number; total?: number }) => {
      if (key === 'aiChat.planSteps' && options) {
        return `${options.applied}/${options.total}`;
      }
      return key;
    },
  }),
}));

import { PlanRail } from './PlanRail';

const WORKFLOW_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WORKFLOW_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function step(partial: Partial<IAgentWorkflowStepView> = {}): IAgentWorkflowStepView {
  return {
    stepKey: 'step-1',
    stepIndex: 0,
    tool: 'create_queue',
    entityType: 'queue',
    entityLabel: 'Sales',
    status: 'pending',
    error: null,
    dependsOn: [],
    requiresSecureInput: false,
    ...partial,
  };
}

function workflow(partial: Partial<IAgentWorkflowPlanView> = {}): IAgentWorkflowPlanView {
  return {
    workflowId: WORKFLOW_A,
    threadUid: 7,
    title: 'Open a sales queue',
    summary: ['Create queue', 'Add members'],
    status: 'pending',
    error: null,
    expiresAt: '2027-09-05T12:00:00.000Z',
    appliedAt: null,
    steps: [step({ status: 'applied' }), step({ stepKey: 'step-2', stepIndex: 1, status: 'pending' })],
    ...partial,
  };
}

describe('PlanRail', () => {
  it('renders two plans with titles and step counters', () => {
    render(
      <PlanRail
        workflows={[
          workflow({
            workflowId: WORKFLOW_A,
            title: 'Open a sales queue',
            steps: [
              step({ status: 'applied' }),
              step({ stepKey: 'step-2', stepIndex: 1, status: 'pending' }),
              step({ stepKey: 'step-3', stepIndex: 2, status: 'pending' }),
            ],
          }),
          workflow({
            workflowId: WORKFLOW_B,
            title: 'Add a SIP trunk',
            status: 'failed',
            steps: [
              step({ stepKey: 'trunk-1', status: 'applied' }),
              step({ stepKey: 'trunk-2', stepIndex: 1, status: 'failed' }),
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText('Open a sales queue')).toBeInTheDocument();
    expect(screen.getByText('Add a SIP trunk')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('aiChat.card.badge.pending')).toBeInTheDocument();
    expect(screen.getByText('aiChat.card.badge.failed')).toBeInTheDocument();
  });

  it('never writes workflowId into the markup', () => {
    const { container } = render(
      <PlanRail
        workflows={[
          workflow({ workflowId: WORKFLOW_A, title: 'Open a sales queue' }),
          workflow({ workflowId: WORKFLOW_B, title: 'Add a SIP trunk' }),
        ]}
      />,
    );

    expect(container.innerHTML).not.toContain(WORKFLOW_A);
    expect(container.innerHTML).not.toContain(WORKFLOW_B);
    expect(container.innerHTML).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
  });

  it('shows an empty state when there are no plans', () => {
    render(<PlanRail workflows={[]} />);
    expect(screen.getByTestId('ai-agent-plan-rail')).toBeInTheDocument();
    expect(screen.getByText('aiChat.emptyPlans')).toBeInTheDocument();
    expect(screen.queryByText('Open a sales queue')).toBeNull();
  });

  it('passes workflowId only to the focus callback', () => {
    const onFocusWorkflow = vi.fn();
    render(
      <PlanRail
        workflows={[workflow({ workflowId: WORKFLOW_A, title: 'Open a sales queue' })]}
        onFocusWorkflow={onFocusWorkflow}
      />,
    );

    fireEvent.click(screen.getByText('Open a sales queue'));
    expect(onFocusWorkflow).toHaveBeenCalledTimes(1);
    expect(onFocusWorkflow).toHaveBeenCalledWith(WORKFLOW_A);
    expect(screen.getByTestId('ai-agent-plan-rail').innerHTML).not.toContain(WORKFLOW_A);
  });
});
