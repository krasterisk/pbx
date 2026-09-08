import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import type {
    AgentTimelineItem,
    AgentTimelineProposalItem,
} from '@krasterisk/shared';
import type { IAgentProposalView, IAgentWorkflowPlanView } from '@/shared/api/endpoints/aiChatApi';
import { DiffConfirmCard } from '../DiffConfirmCard/DiffConfirmCard';
import { WorkflowPlanCard } from '../WorkflowPlanCard/WorkflowPlanCard';
import { UserBubble } from './UserBubble';
import { AssistantBubble } from './AssistantBubble';
import { StepRow } from './StepRow';
import cls from './TimelineList.module.scss';

export type IAiChatCard =
    | { card: 'single'; proposal: IAgentProposalView }
    | { card: 'workflow'; workflow: IAgentWorkflowPlanView };

export interface TimelineListProps {
    items: AgentTimelineItem[];
    cards: Record<string, IAiChatCard>;
    /** Скрывает Apply/Reject и подсказку «подтвердите» — режим чужого треда (Стадия F). */
    readOnly?: boolean;
    onCardSettled?: (item: AgentTimelineProposalItem) => void;
}

export const TimelineList = ({ items, cards, readOnly, onCardSettled }: TimelineListProps) => {
    const { t } = useTranslation();

    return (
        <VStack
            className={cls.root}
            gap="8"
            align="stretch"
            data-testid="ai-agent-timeline"
        >
            {readOnly && (
                <Text as="span" className={cls.readOnlyHint}>
                    {t('aiChat.timeline.readOnlyHint')}
                </Text>
            )}
            {items.map((item) => {
                switch (item.kind) {
                    case 'user':
                        return <UserBubble key={item.id} item={item} />;
                    case 'assistant':
                        return <AssistantBubble key={item.id} item={item} />;
                    case 'step':
                        return <StepRow key={item.id} item={item} />;
                    case 'proposal':
                        return (
                            <ProposalItem
                                key={item.id}
                                item={item}
                                card={cards[item.id]}
                                readOnly={readOnly}
                                onCardSettled={onCardSettled}
                            />
                        );
                }
            })}
        </VStack>
    );
};

function ProposalItem({
    item,
    card,
    readOnly,
    onCardSettled,
}: {
    item: AgentTimelineProposalItem;
    card?: IAiChatCard;
    readOnly?: boolean;
    onCardSettled?: (item: AgentTimelineProposalItem) => void;
}) {
    const cardBind = {
        readOnly,
        onSettled: () => onCardSettled?.(item),
    };

    return (
        <VStack className={`${cls.item} ${cls.proposal}`} data-kind="proposal" align="stretch">
            {card?.card === 'workflow' ? (
                <WorkflowPlanCard workflow={card.workflow} {...cardBind} />
            ) : card?.card === 'single' ? (
                <DiffConfirmCard proposal={card.proposal} {...cardBind} />
            ) : null}
        </VStack>
    );
}
