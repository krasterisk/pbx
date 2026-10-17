import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutodialIncomingChanges } from './AutodialIncomingChanges';

const state = vi.hoisted(() => ({ level: 1, failed: false }));
const queries = vi.hoisted(() => ({ proposals: vi.fn(), workflows: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { count?: number }) => `${key}${options?.count === undefined ? '' : `:${options.count}`}` }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: () => state.level }));
vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetPendingAiChatProposalsQuery: (...args: unknown[]) => { queries.proposals(...args); return { isError: state.failed, currentData: [
    { proposalId: 'ac', entityType: 'autodial_dnc', entityLabel: 'DNC proposal' }, { proposalId: 'pbx', entityType: 'endpoint', entityLabel: 'Other module proposal' },
  ] }; },
  useGetPendingAiChatWorkflowsQuery: (...args: unknown[]) => { queries.workflows(...args); return { currentData: [
    { workflowId: 'ac', title: 'Autodial plan', steps: [{ tool: 'create_autodial_base' }] },
    { workflowId: 'pbx', title: 'Other module plan', steps: [{ tool: 'create_endpoint' }] },
  ] }; },
}));
vi.mock('@/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard', () => ({ DiffConfirmCard: ({ proposal }: { proposal: { entityLabel: string } }) => <div>{proposal.entityLabel}</div> }));
vi.mock('@/features/ai-chat/ui/WorkflowPlanCard/WorkflowPlanCard', () => ({ WorkflowPlanCard: ({ workflow }: { workflow: { title: string } }) => <div>{workflow.title}</div> }));
describe('Autodial incoming confirmation cards', () => {
  beforeEach(() => { state.level = 1; state.failed = false; vi.clearAllMocks(); });
  it('notifies about owned autodial cards and plans while excluding unrelated modules', () => {
    render(<AutodialIncomingChanges />);
    fireEvent.click(screen.getByText('autodial.workspace.incomingChanges:2'));
    expect(screen.getByText('DNC proposal')).toBeVisible(); expect(screen.getByText('Autodial plan')).toBeVisible();
    expect(screen.queryByText('Other module proposal')).not.toBeInTheDocument();
    expect(screen.queryByText('Other module plan')).not.toBeInTheDocument();
  });
  it('does not request or display confirmation cards for an operator/read-only user', () => {
    state.level = 5; const { container } = render(<AutodialIncomingChanges />);
    expect(container).toBeEmptyDOMElement();
    expect(queries.proposals).toHaveBeenCalledWith(undefined, expect.objectContaining({ skip: true }));
  });
  it('shows a failed refresh instead of suggesting the incoming list is up to date', () => {
    state.failed = true; render(<AutodialIncomingChanges />);
    fireEvent.click(screen.getByText('autodial.workspace.incomingChanges:2'));
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.common.loadFailed');
  });
});
