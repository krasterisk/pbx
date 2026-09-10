import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader } from 'lucide-react';
import { Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
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
    /** Общий индикатор, пока модель думает между шагами. */
    working?: boolean;
    /** Прокрутить к карточке плана, не записывая id в разметку. */
    focusWorkflowId?: string | null;
    onCardSettled?: (status: string) => void;
}

export function isPendingConfirmCard(card: IAiChatCard): boolean {
    const status = card.card === 'workflow' ? card.workflow.status : card.proposal.status;
    return status === 'pending' || status === 'failed';
}

/** Repeat the pending card under the latest “please confirm” reply so Apply stays on screen. */
export function resolveLiveConfirmCard(
    items: AgentTimelineItem[],
    cards: Record<string, IAiChatCard>,
): { sourceId: string; card: IAiChatCard } | null {
    const lastAssistant = [...items].reverse().find((item) => item.kind === 'assistant');
    if (!lastAssistant || lastAssistant.kind !== 'assistant' || lastAssistant.closeKind !== 'wait_confirm') {
        return null;
    }
    const lastIndex = items.lastIndexOf(lastAssistant);
    if (items.slice(lastIndex + 1).some((item) => item.kind === 'proposal')) return null;
    for (let index = lastIndex - 1; index >= 0; index -= 1) {
        const item = items[index];
        if (item.kind !== 'proposal') continue;
        const card = cards[item.id];
        if (card && isPendingConfirmCard(card)) return { sourceId: item.id, card };
    }
    const pending = Object.entries(cards).reverse().find(([, card]) => isPendingConfirmCard(card));
    return pending ? { sourceId: pending[0], card: pending[1] } : null;
}

export const TimelineList = ({
    items,
    cards,
    readOnly,
    working,
    focusWorkflowId,
    onCardSettled,
}: TimelineListProps) => {
    const { t } = useTranslation();
    const pendingStep = items.some((item) => item.kind === 'step' && !item.done);
    const showWorking = Boolean(working) && !pendingStep;
    const liveConfirm = readOnly ? null : resolveLiveConfirmCard(items, cards);

    return (
        <VStack
            className={cls.root}
            gap="8"
            align="stretch"
            data-testid="ai-agent-timeline"
            data-working={working ? 'true' : 'false'}
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
                        if (item.closeKind === 'wait_confirm') return null;
                        return <AssistantBubble key={item.id} item={item} />;
                    case 'step':
                        return <StepRow key={item.id} item={item} />;
                    case 'proposal':
                        if (liveConfirm?.sourceId === item.id) return null;
                        return (
                            <ProposalItem
                                key={item.id}
                                item={item}
                                card={cards[item.id]}
                                readOnly={readOnly}
                                focused={
                                    Boolean(
                                        focusWorkflowId
                                        && cards[item.id]?.card === 'workflow'
                                        && cards[item.id].workflow.workflowId === focusWorkflowId,
                                    )
                                }
                                onCardSettled={onCardSettled}
                            />
                        );
                }
            })}
            {liveConfirm && (
                <ProposalItem
                    key={`${liveConfirm.sourceId}-live`}
                    item={{
                        kind: 'proposal',
                        id: `${liveConfirm.sourceId}-live`,
                        card: liveConfirm.card.card,
                        createdAt: items[items.length - 1]?.createdAt ?? '',
                    }}
                    card={liveConfirm.card}
                    readOnly={readOnly}
                    focused={
                        Boolean(
                            focusWorkflowId
                            && liveConfirm.card.card === 'workflow'
                            && liveConfirm.card.workflow.workflowId === focusWorkflowId,
                        )
                    }
                    onCardSettled={onCardSettled}
                />
            )}
            {showWorking && (
                <HStack
                    className={`${cls.item} ${cls.step}`}
                    gap="8"
                    align="center"
                    data-testid="ai-agent-working"
                    aria-live="polite"
                >
                    <Loader size={13} className={cls.spinIcon} aria-hidden />
                    <Text as="span" className={cls.stepLabel}>{t('aiChat.progress.working')}</Text>
                </HStack>
            )}
        </VStack>
    );
};

function ProposalItem({
    item,
    card,
    readOnly,
    focused,
    onCardSettled,
}: {
    item: AgentTimelineProposalItem;
    card?: IAiChatCard;
    readOnly?: boolean;
    focused?: boolean;
    onCardSettled?: (status: string) => void;
}) {
    const nodeRef = useRef<HTMLDivElement>(null);
    const cardBind = {
        readOnly,
        onSettled: (settled: { status: string }) => onCardSettled?.(settled.status),
    };

    useEffect(() => {
        if (!focused) return;
        nodeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, [focused]);

    return (
        <Flex
            ref={nodeRef}
            direction="column"
            className={`${cls.item} ${cls.proposal} ${focused ? cls.proposalFocused : ''}`}
            data-kind="proposal"
            data-focused={focused ? 'true' : undefined}
            align="stretch"
        >
            {card?.card === 'workflow' ? (
                <WorkflowPlanCard workflow={card.workflow} {...cardBind} />
            ) : card?.card === 'single' ? (
                <DiffConfirmCard proposal={card.proposal} {...cardBind} />
            ) : null}
        </Flex>
    );
}
