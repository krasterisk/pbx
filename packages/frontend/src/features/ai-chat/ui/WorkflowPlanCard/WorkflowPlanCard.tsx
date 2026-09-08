/**
 * WorkflowPlanCard — single HITL card for a staged multi-step plan.
 * Reuses DiffConfirmCard presentation by projecting the workflow into the
 * proposal view shape (one Apply / Reject for the whole plan).
 */
import { DiffConfirmCard } from '../DiffConfirmCard/DiffConfirmCard';
import type { IAgentWorkflowPlanView, IAgentProposalView } from '@/shared/api/endpoints/aiChatApi';

export interface WorkflowPlanCardProps {
    workflow: IAgentWorkflowPlanView;
    onAskAgain?: () => void;
    onSettled?: (proposal: IAgentProposalView) => void;
    readOnly?: boolean;
}

export function workflowToProposalView(workflow: IAgentWorkflowPlanView): IAgentProposalView {
    return {
        proposalId: workflow.workflowId,
        entityType: 'workflow',
        entityLabel: workflow.title,
        summary: workflow.summary,
        status: workflow.status,
        expiresAt: workflow.expiresAt,
        error: workflow.error,
        appliedAt: workflow.appliedAt,
        workflowId: workflow.workflowId,
        steps: workflow.steps,
    };
}

export const WorkflowPlanCard = ({ workflow, onAskAgain, onSettled, readOnly }: WorkflowPlanCardProps) => (
    <DiffConfirmCard
        proposal={workflowToProposalView(workflow)}
        onAskAgain={onAskAgain}
        onSettled={onSettled}
        readOnly={readOnly}
    />
);
