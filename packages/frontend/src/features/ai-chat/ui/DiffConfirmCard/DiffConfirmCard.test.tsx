import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

type IAgentProposalView = {
    proposalId: string;
    entityType: string;
    entityLabel: string;
    summary: string[];
    status: string;
    expiresAt: string;
    error?: string | null;
    appliedAt?: string | null;
};

const confirmCalls: unknown[] = [];
const rejectCalls: unknown[] = [];

let confirmResult: { ok: boolean; proposal?: IAgentProposalView; error?: string; reason?: string } = {
    ok: true,
};
let rejectResult: { ok: boolean; proposal?: IAgentProposalView } = { ok: true };
let confirmLoading = false;
let rejectLoading = false;
let confirmUnwrap: () => Promise<typeof confirmResult> = async () => confirmResult;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { reason?: string }) =>
            options?.reason != null ? `${key}:${options.reason}` : key,
    }),
}));

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
    useConfirmAiChatProposalMutation: () => [
        (arg: unknown) => {
            confirmCalls.push(arg);
            return { unwrap: confirmUnwrap };
        },
        { isLoading: confirmLoading },
    ],
    useRejectAiChatProposalMutation: () => [
        (arg: unknown) => {
            rejectCalls.push(arg);
            return {
                unwrap: async () => rejectResult,
            };
        },
        { isLoading: rejectLoading },
    ],
}));

import { DiffConfirmCard } from './DiffConfirmCard';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';

function pendingView(partial: Partial<IAgentProposalView> = {}): IAgentProposalView {
    return {
        proposalId: PROPOSAL_ID,
        entityType: 'directory',
        entityLabel: 'VIP',
        summary: ['Добавить поле num', 'Сохранить справочник'],
        status: 'pending',
        expiresAt: '2026-09-05T12:00:00.000Z',
        error: null,
        ...partial,
    };
}

describe('DiffConfirmCard', () => {
    beforeEach(() => {
        confirmCalls.length = 0;
        rejectCalls.length = 0;
        confirmLoading = false;
        rejectLoading = false;
        confirmResult = {
            ok: true,
            proposal: pendingView({ status: 'applied', appliedAt: '2026-09-04T12:00:00.000Z' }),
        };
        rejectResult = { ok: true, proposal: pendingView({ status: 'rejected' }) };
        confirmUnwrap = async () => confirmResult;
    });

    it('renders the entity label, every change line and both actions', () => {
        render(<DiffConfirmCard proposal={pendingView()} />);

        expect(screen.getByText('aiChat.card.heading')).toBeInTheDocument();
        expect(screen.getByText(/VIP/)).toBeInTheDocument();
        expect(screen.getByText('Добавить поле num')).toBeInTheDocument();
        expect(screen.getByText('Сохранить справочник')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'aiChat.card.apply' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'aiChat.card.reject' })).toBeInTheDocument();
    });

    it('sends only the proposal identifier on confirm and moves the card to applied', async () => {
        render(<DiffConfirmCard proposal={pendingView()} />);

        fireEvent.click(screen.getByRole('button', { name: 'aiChat.card.apply' }));

        await vi.waitFor(() => {
            expect(screen.getByText('aiChat.card.badge.applied')).toBeInTheDocument();
        });
        expect(confirmCalls).toEqual([PROPOSAL_ID]);
        expect(rejectCalls).toHaveLength(0);
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'aiChat.card.reject' })).toBeNull();
    });

    it('moves the card to rejected without sending an apply', async () => {
        render(<DiffConfirmCard proposal={pendingView()} />);

        fireEvent.click(screen.getByRole('button', { name: 'aiChat.card.reject' }));

        await vi.waitFor(() => {
            expect(screen.getByText('aiChat.card.badge.rejected')).toBeInTheDocument();
        });
        expect(rejectCalls).toEqual([PROPOSAL_ID]);
        expect(confirmCalls).toHaveLength(0);
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
    });

    it('disables both actions while a request is in flight and shows a busy indication', () => {
        confirmLoading = true;
        render(<DiffConfirmCard proposal={pendingView()} />);

        expect(screen.getByRole('button', { name: 'aiChat.card.apply' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'aiChat.card.reject' })).toBeDisabled();
        expect(screen.getByText('aiChat.card.busy')).toBeInTheDocument();
    });

    it('renders summary lines as text nodes, never as markup', () => {
        render(
            <DiffConfirmCard
                proposal={pendingView({
                    summary: ['<img alt="xss" src="x" />', '<script>alert(1)</script>'],
                })}
            />,
        );

        expect(screen.getByText('<img alt="xss" src="x" />')).toBeInTheDocument();
        expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
        expect(document.querySelector('img[alt="xss"]')).toBeNull();
        expect(document.querySelector('script')).toBeNull();
    });

    it('shows the applied badge and time and hides both actions', () => {
        render(
            <DiffConfirmCard
                proposal={pendingView({
                    status: 'applied',
                    appliedAt: '2026-09-04T15:42:00.000Z',
                })}
            />,
        );

        expect(screen.getByText('aiChat.card.badge.applied')).toBeInTheDocument();
        expect(screen.getByText(/15:42|3:42/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'aiChat.card.reject' })).toBeNull();
    });

    it('shows the rejected badge and hides both actions', () => {
        render(<DiffConfirmCard proposal={pendingView({ status: 'rejected' })} />);

        expect(screen.getByText('aiChat.card.badge.rejected')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'aiChat.card.reject' })).toBeNull();
    });

    it('shows the permission explanation on a denied card and hides both actions', () => {
        render(<DiffConfirmCard proposal={pendingView({ status: 'denied' })} />);

        expect(screen.getByText('aiChat.card.badge.denied')).toBeInTheDocument();
        expect(screen.getByText('aiChat.card.deniedExplanation')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'aiChat.card.reject' })).toBeNull();
    });

    it('keeps a failed apply pending with the error and a retry', async () => {
        confirmResult = { ok: false, error: 'switch reload failed', reason: 'switch_failed' };
        render(<DiffConfirmCard proposal={pendingView()} />);

        fireEvent.click(screen.getByRole('button', { name: 'aiChat.card.apply' }));

        await vi.waitFor(() => {
            expect(screen.getByText('aiChat.card.applyFailed:switch reload failed')).toBeInTheDocument();
        });
        expect(screen.getByTestId('ai-agent-diff-card')).toHaveAttribute('data-status', 'pending');
        expect(screen.getByRole('button', { name: 'aiChat.card.retry' })).toBeInTheDocument();
        expect(screen.queryByText('aiChat.card.badge.applied')).toBeNull();
    });

    it('shows an expired card cannot be applied and offers to ask again', () => {
        const onAskAgain = vi.fn();
        render(
            <DiffConfirmCard
                proposal={pendingView({
                    status: 'expired',
                    expiresAt: '2026-09-01T12:00:00.000Z',
                })}
                onAskAgain={onAskAgain}
            />,
        );

        expect(screen.getByText('aiChat.card.badge.expired')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'aiChat.card.askAgain' }));
        expect(onAskAgain).toHaveBeenCalledTimes(1);
    });

    it('cannot confirm a denied or already settled card again', async () => {
        const { rerender } = render(<DiffConfirmCard proposal={pendingView({ status: 'denied' })} />);
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
        expect(confirmCalls).toHaveLength(0);

        rerender(<DiffConfirmCard proposal={pendingView({ status: 'applied' })} />);
        expect(screen.queryByRole('button', { name: 'aiChat.card.apply' })).toBeNull();
        expect(confirmCalls).toHaveLength(0);
    });

    it('confirm and reject mutations send only the proposal identifier', () => {
        const src = readFileSync(
            join(process.cwd(), 'src/shared/api/endpoints/aiChatApi.ts'),
            'utf8',
        );
        expect(src).toMatch(/confirmAiChatProposal/);
        expect(src).toMatch(/rejectAiChatProposal/);
        expect(src).toMatch(/url:\s*`\/ai-chat\/proposals\/\$\{proposalId\}\/apply`/);
        expect(src).toMatch(/url:\s*`\/ai-chat\/proposals\/\$\{proposalId\}\/reject`/);
        const confirmBlock = src.slice(src.indexOf('confirmAiChatProposal'), src.indexOf('rejectAiChatProposal'));
        const rejectBlock = src.slice(src.indexOf('rejectAiChatProposal'), src.indexOf('export { aiChatApi }'));
        expect(confirmBlock).not.toMatch(/body:/);
        expect(rejectBlock).not.toMatch(/body:/);
        expect(confirmBlock).not.toMatch(/confirm:\s*true/);
        expect(src).not.toMatch(/entityId|entity_id/);
    });
});
