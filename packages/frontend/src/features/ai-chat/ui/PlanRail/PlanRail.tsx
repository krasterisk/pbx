import { useTranslation } from 'react-i18next';
import { Badge, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import type { IAgentWorkflowPlanView } from '@/shared/api/endpoints/aiChatApi';
import cls from './PlanRail.module.scss';

export interface PlanRailProps {
    workflows: IAgentWorkflowPlanView[];
    onFocusWorkflow?: (workflowId: string) => void;
}

function appliedStepCount(workflow: IAgentWorkflowPlanView): number {
    return workflow.steps.filter((step) => step.status === 'applied').length;
}

function statusBadgeKey(status: string): string {
    return `aiChat.card.badge.${status}`;
}

export const PlanRail = ({ workflows, onFocusWorkflow }: PlanRailProps) => {
    const { t } = useTranslation();

    return (
        <VStack
            className={cls.root}
            gap="8"
            align="stretch"
            data-testid="ai-agent-plan-rail"
            aria-label={t('aiChat.plansHeading')}
        >
            <Text as="span" className={cls.heading}>{t('aiChat.plansHeading')}</Text>

            {workflows.length === 0 && (
                <Text as="span" className={cls.empty}>{t('aiChat.emptyPlans')}</Text>
            )}

            {workflows.length > 0 && (
                <VStack
                    className={cls.list}
                    gap="4"
                    align="stretch"
                    role="list"
                    aria-label={t('aiChat.plansHeading')}
                >
                    {workflows.map((workflow) => {
                        const applied = appliedStepCount(workflow);
                        const total = workflow.steps.length;
                        const focusable = Boolean(onFocusWorkflow) && workflow.threadUid > 0;
                        return (
                            <VStack
                                key={workflow.workflowId}
                                className={`${cls.card} ${focusable ? cls.clickable : ''}`}
                                gap="4"
                                align="stretch"
                                role={focusable ? 'button' : 'listitem'}
                                tabIndex={focusable ? 0 : undefined}
                                title={focusable ? t('aiChat.openPlanThread') : undefined}
                                onClick={
                                    focusable && onFocusWorkflow
                                        ? () => onFocusWorkflow(workflow.workflowId)
                                        : undefined
                                }
                                onKeyDown={
                                    focusable && onFocusWorkflow
                                        ? (event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                onFocusWorkflow(workflow.workflowId);
                                            }
                                        }
                                        : undefined
                                }
                            >
                                <Text as="span" className={cls.title}>{workflow.title}</Text>
                                <HStack gap="8" align="center" justify="between">
                                    <Text as="span" className={cls.steps}>
                                        {t('aiChat.planSteps', { applied, total })}
                                    </Text>
                                    <Badge variant="outline">{t(statusBadgeKey(workflow.status))}</Badge>
                                </HStack>
                            </VStack>
                        );
                    })}
                </VStack>
            )}
        </VStack>
    );
};
