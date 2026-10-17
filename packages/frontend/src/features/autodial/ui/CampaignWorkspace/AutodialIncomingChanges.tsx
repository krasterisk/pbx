import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectUserLevel } from '@/entities/User';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetPendingAiChatProposalsQuery, useGetPendingAiChatWorkflowsQuery } from '@/shared/api/endpoints/aiChatApi';
import { DiffConfirmCard } from '@/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard';
import { WorkflowPlanCard } from '@/features/ai-chat/ui/WorkflowPlanCard/WorkflowPlanCard';

export function AutodialIncomingChanges() {
  const { t } = useTranslation(), level = useAppSelector(selectUserLevel), allowed = [0, 1, 3].includes(Number(level));
  const proposals = useGetPendingAiChatProposalsQuery(undefined, { skip: !allowed, pollingInterval: 30000 });
  const workflows = useGetPendingAiChatWorkflowsQuery(undefined, { skip: !allowed, pollingInterval: 30000 });
  if (!allowed) return null;
  const cards = (proposals.currentData ?? []).filter((card) => card.entityType.startsWith('autodial'));
  const plans = (workflows.currentData ?? []).filter((plan) => plan.steps.some((step) => step.tool.includes('_autodial_')));
  const count = cards.length + plans.length;
  return <details><summary>{t('autodial.workspace.incomingChanges', { count })}</summary>
    <VStack gap="12" max><Text variant="muted">{t('autodial.workspace.incomingHint')}</Text>
      {(proposals.isError || workflows.isError) && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
      {cards.slice(0, 50).map((proposal) => <DiffConfirmCard key={proposal.proposalId} proposal={proposal} />)}
      {plans.slice(0, 50).map((workflow) => <WorkflowPlanCard key={workflow.workflowId} workflow={workflow} />)}
    </VStack>
  </details>;
}
