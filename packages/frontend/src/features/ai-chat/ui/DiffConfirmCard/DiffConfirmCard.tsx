import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
    useConfirmAiChatProposalMutation,
    useRejectAiChatProposalMutation,
    useConfirmAiChatWorkflowMutation,
    useRejectAiChatWorkflowMutation,
    type IAgentProposalView,
} from '@/shared/api/endpoints/aiChatApi';
import { isRawToolId, resolveCardStatusLabel, resolveWorkflowStepLabel } from '../../model/agentToolLabels';
import cls from './DiffConfirmCard.module.scss';

export interface DiffConfirmCardProps {
    proposal: IAgentProposalView;
    onAskAgain?: () => void;
    onSettled?: (proposal: IAgentProposalView) => void;
    readOnly?: boolean;
}

function formatDigitLabel(
    digit: string,
    t: (key: string, fallback?: string) => string,
): string {
    if (digit === 't') return t('aiChat.card.dest.timeout', 'таймаут');
    if (digit === 'i') return t('aiChat.card.dest.invalid', 'ошибка ввода');
    return digit;
}

function formatDestKind(
    kind: string,
    t: (key: string, fallback?: string) => string,
): string {
    const key = `aiChat.card.dest.${kind}`;
    const translated = t(key, kind);
    return isRawToolId(translated) ? kind : translated;
}

function formatAfterLines(
    after: Record<string, unknown> | null | undefined,
    t: (key: string, fallback?: string) => string,
): string[] {
    if (!after) return [];
    const lines: string[] = [];
    const greeting = typeof after.greeting === 'string' ? after.greeting.trim() : '';
    if (greeting) lines.push(greeting);
    const voice = typeof after.voice === 'string' ? after.voice.trim() : '';
    if (voice) lines.push(`${t('aiChat.card.dest.voice', 'Голос')}: ${voice}`);
    const digits = after.digits;
    if (digits && typeof digits === 'object' && !Array.isArray(digits)) {
        for (const [digit, raw] of Object.entries(digits as Record<string, unknown>)) {
            const dest = raw && typeof raw === 'object' && !Array.isArray(raw)
                ? raw as { kind?: unknown; target?: unknown }
                : {};
            const kind = dest.kind != null ? String(dest.kind) : '';
            const target = dest.target != null ? String(dest.target) : '';
            if (!kind && !target) continue;
            if (kind === 'none') continue;
            const left = formatDigitLabel(digit, t);
            const right = [formatDestKind(kind, t), target].filter(Boolean).join(' ');
            lines.push(`${left} → ${right}`);
        }
    }
    return lines;
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

const SETTLED_STATUSES = new Set(['applied', 'rejected', 'denied']);

export const DiffConfirmCard = ({ proposal, onAskAgain, onSettled, readOnly }: DiffConfirmCardProps) => {
    const { t } = useTranslation();
    const [view, setView] = useState(proposal);
    const [applyError, setApplyError] = useState<string | null>(
        proposal.status === 'pending' || proposal.status === 'failed' ? proposal.error ?? null : null,
    );
    const [confirmProposal, confirmState] = useConfirmAiChatProposalMutation();
    const [rejectProposal, rejectState] = useRejectAiChatProposalMutation();
    const [confirmWorkflow, confirmWorkflowState] = useConfirmAiChatWorkflowMutation();
    const [rejectWorkflow, rejectWorkflowState] = useRejectAiChatWorkflowMutation();

    useEffect(() => {
        // Stream/parent often re-sends the original pending snapshot after Apply succeeds.
        // Never downgrade a settled local card back to pending for the same id.
        setView((prev) => {
            const keepSettled =
                prev.proposalId === proposal.proposalId &&
                SETTLED_STATUSES.has(prev.status) &&
                !SETTLED_STATUSES.has(proposal.status);
            const next = keepSettled ? prev : proposal;
            setApplyError(
                SETTLED_STATUSES.has(next.status)
                    ? null
                    : next.status === 'pending' || next.status === 'failed'
                      ? next.error ?? null
                      : null,
            );
            return next;
        });
    }, [proposal]);

    const busy =
        confirmState.isLoading ||
        rejectState.isLoading ||
        confirmWorkflowState.isLoading ||
        rejectWorkflowState.isLoading;
    const expired = isExpired(view);
    const settled = view.status === 'applied' || view.status === 'rejected' || view.status === 'denied';
    const showActions =
        !readOnly && (view.status === 'pending' || view.status === 'failed') && !expired && !settled;
    const workflowId = view.workflowId;

    const handleConfirm = async () => {
        if (busy || !showActions) return;
        if (workflowId) {
            const result = await confirmWorkflow(workflowId).unwrap();
            const next = {
                ...view,
                status: result.status,
                error: result.error,
                appliedAt: result.appliedAt,
                steps: result.steps,
                summary: result.summary,
            };
            setView(next);
            setApplyError(result.status === 'failed' ? result.error : null);
            if (SETTLED_STATUSES.has(result.status)) onSettled?.(next);
            return;
        }
        const result = await confirmProposal(view.proposalId).unwrap();
        if (result.ok && result.proposal) {
            setView(result.proposal);
            setApplyError(null);
            if (SETTLED_STATUSES.has(result.proposal.status)) onSettled?.(result.proposal);
            return;
        }
        if (result.proposal?.status === 'denied') {
            setView(result.proposal);
            setApplyError(null);
            onSettled?.(result.proposal);
            return;
        }
        if (result.proposal && SETTLED_STATUSES.has(result.proposal.status)) {
            setView(result.proposal);
            setApplyError(null);
            onSettled?.(result.proposal);
            return;
        }
        setApplyError(result.error ?? result.reason ?? result.proposal?.error ?? 'apply_failed');
    };

    const handleReject = async () => {
        if (busy || !showActions) return;
        if (workflowId) {
            const result = await rejectWorkflow(workflowId).unwrap();
            const next = {
                ...view,
                status: result.status,
                error: result.error,
                steps: result.steps,
            };
            setView(next);
            setApplyError(null);
            if (SETTLED_STATUSES.has(result.status)) onSettled?.(next);
            return;
        }
        const result = await rejectProposal(view.proposalId).unwrap();
        if (result.ok && result.proposal) {
            setView(result.proposal);
            setApplyError(null);
            onSettled?.(result.proposal);
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

            {Array.isArray(view.steps) && view.steps.length > 0 && (
                <VStack className={cls.summary} gap="4" align="stretch" data-testid="ai-agent-workflow-steps" role="list">
                    {view.steps.map((step) => (
                        <HStack key={step.stepKey} gap="8" align="center" justify="between" role="listitem">
                            <Text as="span">{resolveWorkflowStepLabel(t, step)}</Text>
                            <Badge variant={step.status === 'failed' ? 'destructive' : 'outline'}>
                                {resolveCardStatusLabel(t, step.status)}
                            </Badge>
                        </HStack>
                    ))}
                </VStack>
            )}

            <VStack className={cls.summary} gap="4" align="stretch">
                <Text as="p" className={cls.summaryLead}>{t('aiChat.card.summaryLead')}</Text>
                {view.summary.map((line) => (
                    <Text as="p" key={line} className={cls.summaryLine}>{line}</Text>
                ))}
                {formatAfterLines(view.after, t)
                    .filter((line) => !view.summary.some((row) => row.includes(line)))
                    .map((line) => (
                        <Text as="p" key={`after:${line}`} className={cls.summaryLine}>{line}</Text>
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

            {expired && !settled && !readOnly && (
                <Button type="button" variant="ghost" onClick={onAskAgain}>
                    {t('aiChat.card.askAgain')}
                </Button>
            )}
        </VStack>
    );
};
