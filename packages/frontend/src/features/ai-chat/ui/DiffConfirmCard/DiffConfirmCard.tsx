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

function formatAppliedAt(iso?: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isExpired(view: IAgentProposalView): boolean {
    if (view.status === 'expired') return true;
    if (view.status !== 'pending' || !view.expiresAt) return false;
    const expires = new Date(view.expiresAt).getTime();
    return !Number.isNaN(expires) && expires <= Date.now();
}

export const DiffConfirmCard = ({ proposal, onAskAgain }: DiffConfirmCardProps) => {
    const { t } = useTranslation();
    const [view, setView] = useState(proposal);
    const [applyError, setApplyError] = useState<string | null>(
        proposal.status === 'pending' ? proposal.error ?? null : null,
    );
    const [confirmProposal, confirmState] = useConfirmAiChatProposalMutation();
    const [rejectProposal, rejectState] = useRejectAiChatProposalMutation();

    useEffect(() => {
        setView(proposal);
        setApplyError(proposal.status === 'pending' ? proposal.error ?? null : null);
    }, [proposal]);

    const busy = confirmState.isLoading || rejectState.isLoading;
    const expired = isExpired(view);
    const settled = view.status === 'applied' || view.status === 'rejected' || view.status === 'denied';
    const showActions = view.status === 'pending' && !expired && !settled;

    const handleConfirm = async () => {
        if (busy || !showActions) return;
        const result = await confirmProposal(view.proposalId).unwrap();
        if (result.ok && result.proposal) {
            setView(result.proposal);
            setApplyError(null);
            return;
        }
        if (result.proposal?.status === 'denied') {
            setView(result.proposal);
            setApplyError(null);
            return;
        }
        setApplyError(result.error ?? result.reason ?? 'apply_failed');
    };

    const handleReject = async () => {
        if (busy || !showActions) return;
        const result = await rejectProposal(view.proposalId).unwrap();
        if (result.ok && result.proposal) {
            setView(result.proposal);
            setApplyError(null);
        }
    };

    const appliedAt = view.status === 'applied' ? formatAppliedAt(view.appliedAt) : null;

    return (
        <VStack
            className={cls.root}
            gap="8"
            align="stretch"
            data-testid="ai-agent-diff-card"
            data-status={expired && view.status === 'pending' ? 'expired' : view.status}
        >
            <HStack className={cls.header} gap="8" align="center" justify="between">
                <Text as="span" className={cls.heading}>{t('aiChat.card.heading')}</Text>
                {view.status === 'applied' && (
                    <HStack gap="8" align="center">
                        <Badge variant="secondary">{t('aiChat.card.badge.applied')}</Badge>
                        {appliedAt && (
                            <Text as="span" className={cls.appliedAt}>{appliedAt}</Text>
                        )}
                    </HStack>
                )}
                {view.status === 'rejected' && (
                    <Badge variant="outline">{t('aiChat.card.badge.rejected')}</Badge>
                )}
                {view.status === 'denied' && (
                    <Badge variant="destructive">{t('aiChat.card.badge.denied')}</Badge>
                )}
                {expired && !settled && (
                    <Badge variant="outline">{t('aiChat.card.badge.expired')}</Badge>
                )}
                {view.status === 'pending' && !expired && (
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

            {view.status === 'denied' && (
                <Text as="p" className={cls.denied}>{t('aiChat.card.deniedExplanation')}</Text>
            )}

            {view.status === 'pending' && !expired && applyError && (
                <Text as="p" className={cls.failedText}>
                    {t('aiChat.card.applyFailed', { reason: applyError })}
                </Text>
            )}

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
                        {applyError ? t('aiChat.card.retry') : t('aiChat.card.apply')}
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

            {expired && !settled && (
                <Button type="button" variant="ghost" onClick={onAskAgain}>
                    {t('aiChat.card.askAgain')}
                </Button>
            )}
        </VStack>
    );
};
