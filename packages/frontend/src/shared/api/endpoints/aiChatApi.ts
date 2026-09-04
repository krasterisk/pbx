import { rtkApi } from '../rtkApi';
import type { AiModel } from '@/features/ai-chat/model/types/AiChatSchema';

export interface IAiChatSettings {
    confirmDestructive: boolean;
}

export interface IAgentUsageRow {
    tenantUid: number;
    tokensIn: number;
    tokensOut: number;
    turns: number;
    spendUsd: number | null;
    spendAvailable: boolean;
}

export interface IAgentUsageFunnelRow {
    tenantUid: number;
    pending: number;
    applied: number;
    rejected: number;
    denied: number;
}

export interface IAgentDefaultModelProvider {
    uid: number;
    name: string;
    model: string | null;
}

export interface IAgentDefaultModel {
    providerUid: number | null;
    providers: IAgentDefaultModelProvider[];
}

export type AiChatThreadStatus = 'active' | 'archived';
export type AiChatThreadMessageRole = 'user' | 'assistant' | 'tool' | 'system';

/** Conversation row returned by GET /ai-chat/threads (15-03 persistence). */
export interface IAiChatThread {
    uid: number;
    title: string;
    status: AiChatThreadStatus;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
}

/** Stored message from GET /ai-chat/threads/:uid. */
/** Client-facing proposal view — apply payload omitted by type (T-15-61). */
export type AgentProposalStatus = 'pending' | 'applied' | 'rejected' | 'denied' | 'expired';

export interface IAgentProposalView {
    proposalId: string;
    entityType: string;
    entityLabel: string;
    summary: string[];
    status: AgentProposalStatus | string;
    expiresAt: string;
    error?: string | null;
    appliedAt?: string | null;
}

export interface IAgentProposalActionResult {
    ok: boolean;
    reason?: string;
    error?: string;
    proposal?: IAgentProposalView;
}

export interface IAiChatThreadMessage {
    uid: number;
    thread_uid: number;
    role: AiChatThreadMessageRole;
    content: string | null;
    tool_name?: string | null;
    tool_calls?: unknown;
    proposal_id?: string | null;
    proposal?: IAgentProposalView | null;
    created_at: string;
}

export interface IAiChatThreadDetail extends IAiChatThread {
    messages: IAiChatThreadMessage[];
}

const aiChatApi = rtkApi.injectEndpoints({
    endpoints: (builder) => ({
        getAiChatModels: builder.query<AiModel[], void>({
            query: () => '/ai-chat/models',
        }),
        getAiChatState: builder.query<Record<string, any>, void>({
            query: () => '/ai-chat/state',
        }),
        // Per-tenant AI confirmation settings (D-20, D-25)
        getAiChatSettings: builder.query<IAiChatSettings, void>({
            query: () => '/ai-chat/settings',
            providesTags: ['AiChatSettings'],
        }),
        updateAiChatSettings: builder.mutation<IAiChatSettings, Partial<IAiChatSettings>>({
            query: (body) => ({
                url: '/ai-chat/settings',
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['AiChatSettings'],
        }),
        getAgentUsage: builder.query<IAgentUsageRow[], { from: string; to: string }>({
            query: ({ from, to }) => `/ai-chat/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            providesTags: ['AiChatSettings'],
        }),
        getAgentUsageFunnel: builder.query<IAgentUsageFunnelRow[], { from: string; to: string }>({
            query: ({ from, to }) => `/ai-chat/usage/funnel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            providesTags: ['AiChatSettings'],
        }),
        getAgentDefaultModel: builder.query<IAgentDefaultModel, void>({
            query: () => '/ai-chat/usage/default-model',
            providesTags: ['AiChatSettings'],
        }),
        updateAgentDefaultModel: builder.mutation<IAgentDefaultModel, { providerUid: number }>({
            query: (body) => ({
                url: '/ai-chat/usage/default-model',
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['AiChatSettings'],
        }),
        getAiChatThreads: builder.query<IAiChatThread[], void>({
            query: () => '/ai-chat/threads',
            providesTags: (result) =>
                result
                    ? [
                          ...result.map((thread) => ({ type: 'AiChatThreads' as const, id: thread.uid })),
                          { type: 'AiChatThreads' as const, id: 'LIST' },
                      ]
                    : [{ type: 'AiChatThreads' as const, id: 'LIST' }],
        }),
        getAiChatThread: builder.query<IAiChatThreadDetail, number>({
            query: (uid) => `/ai-chat/threads/${uid}`,
            providesTags: (_result, _err, uid) => [{ type: 'AiChatThreads', id: uid }],
        }),
        createAiChatThread: builder.mutation<IAiChatThread, void>({
            query: () => ({
                url: '/ai-chat/threads',
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'AiChatThreads', id: 'LIST' }],
        }),
        deleteAiChatThread: builder.mutation<void, number>({
            query: (uid) => ({
                url: `/ai-chat/threads/${uid}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _err, uid) => [
                { type: 'AiChatThreads', id: uid },
                { type: 'AiChatThreads', id: 'LIST' },
            ],
        }),
        confirmAiChatProposal: builder.mutation<IAgentProposalActionResult, string>({
            query: (proposalId) => ({
                url: `/ai-chat/proposals/${proposalId}/apply`,
                method: 'POST',
            }),
            invalidatesTags: ['AiChatThreads'],
        }),
        rejectAiChatProposal: builder.mutation<IAgentProposalActionResult, string>({
            query: (proposalId) => ({
                url: `/ai-chat/proposals/${proposalId}/reject`,
                method: 'POST',
            }),
            invalidatesTags: ['AiChatThreads'],
        }),
    }),
});

export { aiChatApi };

export const {
    useGetAiChatModelsQuery,
    useGetAiChatStateQuery,
    useGetAiChatSettingsQuery,
    useUpdateAiChatSettingsMutation,
    useGetAgentUsageQuery,
    useGetAgentUsageFunnelQuery,
    useGetAgentDefaultModelQuery,
    useUpdateAgentDefaultModelMutation,
    useGetAiChatThreadsQuery,
    useGetAiChatThreadQuery,
    useCreateAiChatThreadMutation,
    useDeleteAiChatThreadMutation,
    useConfirmAiChatProposalMutation,
    useRejectAiChatProposalMutation,
} = aiChatApi;

/**
 * Stream AI chat message via SSE.
 * Returns AbortController so the caller can cancel.
 */
export type AgentProgressEvent = {
    tool?: string;
    label?: string;
    step?: number;
    maxSteps?: number;
};

export function streamAiChatMessage(params: {
    message: string;
    history: Array<{ role: string; content: string }>;
    threadUid?: number;
    onText: (chunk: string) => void;
    onToolCall?: (data: { name: string; arguments: string }) => void;
    onToolResult?: (data: { name: string; result: string }) => void;
    onProgress?: (data: AgentProgressEvent) => void;
    onProposal?: (data: IAgentProposalView) => void;
    onDone: () => void;
    onError: (msg: string, code?: string) => void;
    onDisconnect?: () => void;
}): AbortController {
    const ac = new AbortController();
    const token = localStorage.getItem('accessToken');
    const apiBase = import.meta.env.VITE_API_URL || '/api';

    (async () => {
        let reachedTerminal = false;
        try {
            const response = await fetch(`${apiBase}/ai-chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message: params.message,
                    history: params.history,
                    ...(params.threadUid != null ? { threadUid: params.threadUid } : {}),
                }),
                signal: ac.signal,
            });

            if (!response.ok || !response.body) {
                params.onError(`HTTP ${response.status}`);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // Parse SSE lines
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                let eventType = '';
                for (const line of lines) {
                    if (ac.signal.aborted) return;
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const raw = line.slice(6).trim();
                        try {
                            const data = JSON.parse(raw);
                            if (eventType === 'text') {
                                params.onText(typeof data === 'string' ? data : String(data ?? ''));
                            } else if (eventType === 'tool_call') {
                                params.onToolCall?.(data);
                            } else if (eventType === 'tool_result') {
                                params.onToolResult?.(data);
                            } else if (eventType === 'progress') {
                                params.onProgress?.(data);
                            } else if (eventType === 'proposal' && params.onProposal && isProposalClientView(data)) {
                                params.onProposal(data);
                            } else if (eventType === 'done') {
                                reachedTerminal = true;
                                params.onDone();
                                return;
                            } else if (eventType === 'error') {
                                reachedTerminal = true;
                                const code = typeof data === 'object' && data && 'code' in data
                                    ? String((data as { code: unknown }).code)
                                    : undefined;
                                const message = typeof data === 'string'
                                    ? data
                                    : (data && typeof data === 'object' && 'message' in data
                                        ? String((data as { message: unknown }).message)
                                        : 'Stream error');
                                params.onError(message, code);
                                return;
                            }
                        } catch {
                            // ignore parse errors
                        }
                        eventType = '';
                    }
                }
            }
            if (!reachedTerminal && !ac.signal.aborted) {
                if (params.onDisconnect) params.onDisconnect();
                else params.onDone();
            }
        } catch (err: any) {
            if (err?.name === 'AbortError' || ac.signal.aborted) return;
            if (params.onDisconnect && (err?.name === 'TypeError' || /network|fetch/i.test(String(err?.message)))) {
                params.onDisconnect();
                return;
            }
            params.onError(err?.message ?? 'Stream error');
        }
    })();

    return ac;
}

export function isProposalClientView(value: unknown): value is IAgentProposalView {
    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'proposalId' in value &&
        typeof (value as IAgentProposalView).proposalId === 'string' &&
        !('applyPayload' in value) &&
        !('apply_payload' in value)
    );
}
