import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
    useConfirmAiChatProposalMutation,
    useRejectAiChatProposalMutation,
    type IAgentProposalView,
} from '@/shared/api/endpoints/aiChatApi';
import cls from './DiffConfirmCard.module.scss';

export interface DiffConfirmCardProps {
    proposal: IAgentProposalView;
    onAskAgain?: () => void;
}

export const DiffConfirmCard = ({ proposal }: DiffConfirmCardProps) => {
    const { t } = useTranslation();
    const [view, setView] = useState(proposal);
    const [confirmProposal, confirmState] = useConfirmAiChatProposalMutation();
    const [rejectProposal, rejectState] = useRejectAiChatProposalMutation();

    useEffect(() => {
        setView(proposal);
    }, [proposal]);

    const busy = confirmState.isLoading || rejectState.isLoading;
    const showActions = view.status === 'pending';

    const handleConfirm = async () => {
        if (busy || !showActions) return;
        const result = await confirmProposal(view.proposalId).unwrap();
        if (result.ok && result.proposal) {
            setView(result.proposal);
        }
    };

    const handleReject = async () => {
        if (busy || !showActions) return;
        const result = await rejectProposal(view.proposalId).unwrap();
        if (result.ok && result.proposal) {
            setView(result.proposal);
        }
    };

    return (
        <VStack
            className={cls.root}
            gap="8"
            align="stretch"
            data-testid="ai-agent-diff-card"
            data-status={view.status}
        >
            <HStack className={cls.header} gap="8" align="center" justify="between">
                <Text as="span" className={cls.heading}>{t('aiChat.card.heading')}</Text>
                {view.status === 'applied' && (
                    <Badge variant="secondary">{t('aiChat.card.badge.applied')}</Badge>
                )}
                {view.status === 'rejected' && (
                    <Badge variant="outline">{t('aiChat.card.badge.rejected')}</Badge>
                )}
                {view.status === 'pending' && (
                    <Badge variant="default">{t('aiChat.card.badge.pending')}</Badge>
                )}
            </HStack>

            <Text as="p" className={cls.entity}>
                {t('aiChat.card.entityPrefix')} {view.entityLabel}
            </Text>

            <VStack className={cls.summary} gap="4" align="stretch">
                <Text as="p" className={cls.summaryLead}>{t('aiChat.card.summaryLead')}</Text>
                {view.summary.map((line) => (
                    <Text as="p" key={line} className={cls.summaryLine}>{line}</Text>
                ))}
            </VStack>

            {busy && (
                <Text as="span" className={cls.busy} aria-live="polite">
                    {t('aiChat.card.busy')}
                </Text>
            )}

            {showActions && (
                <HStack className={cls.actions} gap="8" align="center">
                    <Button
                        type="button"
                        disabled={busy}
                        title={t('aiChat.card.applyHint')}
                        onClick={handleConfirm}
                    >
                        {t('aiChat.card.apply')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={handleReject}
                    >
                        {t('aiChat.card.reject')}
                    </Button>
                </HStack>
            )}
        </VStack>
    );
};
