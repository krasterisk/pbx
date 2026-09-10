import type { AgentTimelineItem } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';
import type { AiModel } from '@/features/ai-chat/model/types/AiChatSchema';
import { getLiveTimeline, mergeTimelines, setLiveTimeline } from './aiChatLiveTimeline';

export interface IAiChatSettings {
    confirmDestructive: boolean;
    seeAllThreads: boolean;
}

export interface IAgentUsageRow {
    tenantUid: number;
    tenantName: string | null;
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

/** Conversation row returned by GET /ai-chat/threads (15-03 persistence). */
export interface IAiChatThread {
    uid: number;
    title: string;
    status: AiChatThreadStatus;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
    ownerName?: string;
    readOnly?: boolean;
}

/** Stored message from GET /ai-chat/threads/:uid. */
/** Client-facing proposal view — apply payload omitted by type (T-15-61). */
export type AgentProposalStatus = 'pending' | 'applied' | 'rejected' | 'denied' | 'expired';

export interface IAgentProposalView {
    proposalId: string;
    entityType: string;
    entityLabel: string;
    summary: string[];
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    status: AgentProposalStatus | string;
    expiresAt: string;
    error?: string | null;
    appliedAt?: string | null;
    /** Optional multi-step plan attached to the same HITL card. */
    workflowId?: string | null;
    steps?: IAgentWorkflowStepView[];
}

export type AgentWorkflowStatus =
    | 'pending'
    | 'applying'
    | 'applied'
    | 'failed'
    | 'rejected'
    | 'denied'
    | 'expired';

export interface IAgentWorkflowStepView {
    stepKey: string;
    stepIndex: number;
    tool: string;
    entityType: string;
    entityLabel: string;
    status: string;
    error: string | null;
    dependsOn: string[];
    requiresSecureInput: boolean;
}

export interface IAgentWorkflowPlanView {
    workflowId: string;
    threadUid: number;
    title: string;
    summary: string[];
    status: AgentWorkflowStatus | string;
    error: string | null;
    expiresAt: string;
    appliedAt: string | null;
    steps: IAgentWorkflowStepView[];
}

export interface IAgentProposalActionResult {
    ok: boolean;
    reason?: string;
    error?: string;
    proposal?: IAgentProposalView;
}

export type IAiChatCard =
    | { card: 'single'; proposal: IAgentProposalView }
    | { card: 'workflow'; workflow: IAgentWorkflowPlanView };

export interface IAiChatThreadDetail extends IAiChatThread {
    timeline: AgentTimelineItem[];
    cards: Record<string, IAiChatCard>;
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
            async onQueryStarted(body, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    aiChatApi.util.updateQueryData('getAiChatSettings', undefined, (draft) => {
                        if (body.seeAllThreads !== undefined) draft.seeAllThreads = body.seeAllThreads;
                        if (body.confirmDestructive !== undefined) {
                            draft.confirmDestructive = body.confirmDestructive;
                        }
                    }),
                );
                try {
                    const { data } = await queryFulfilled;
                    dispatch(aiChatApi.util.updateQueryData('getAiChatSettings', undefined, () => data));
                } catch {
                    patch.undo();
                }
            },
            invalidatesTags: ['AiChatSettings', { type: 'AiChatThreads', id: 'SHARED' }],
        }),
        getAiChatDefaultProvider: builder.query<{ providerUid: number | null }, void>({
            query: () => '/ai-chat/default-provider',
            providesTags: ['AiChatSettings'],
        }),
        updateAiChatDefaultProvider: builder.mutation<{ providerUid: number }, { providerUid: number }>({
            query: (body) => ({
                url: '/ai-chat/default-provider',
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
        getSharedAiChatThreads: builder.query<IAiChatThread[], void>({
            query: () => '/ai-chat/threads/shared',
            providesTags: [{ type: 'AiChatThreads', id: 'SHARED' }],
        }),
        getPlatformAiChatThreads: builder.query<IAiChatThread[], number>({
            query: (tenantUid) => `/cloud-admin/ai-chat/tenants/${tenantUid}/threads`,
            providesTags: (result, _err, tenantUid) =>
                result
                    ? [
                          ...result.map((thread) => ({
                              type: 'AiChatThreads' as const,
                              id: `platform-${tenantUid}-${thread.uid}`,
                          })),
                          { type: 'AiChatThreads' as const, id: `PLATFORM-${tenantUid}` },
                      ]
                    : [{ type: 'AiChatThreads' as const, id: `PLATFORM-${tenantUid}` }],
        }),
        getPlatformAiChatThread: builder.query<IAiChatThreadDetail, { tenantUid: number; uid: number }>({
            query: ({ tenantUid, uid }) => `/cloud-admin/ai-chat/tenants/${tenantUid}/threads/${uid}`,
            providesTags: (_result, _err, { tenantUid, uid }) => [
                { type: 'AiChatThreads', id: `platform-${tenantUid}-${uid}` },
            ],
        }),
        getAiChatThread: builder.query<IAiChatThreadDetail, number>({
            query: (uid) => `/ai-chat/threads/${uid}`,
            providesTags: (_result, _err, uid) => [{ type: 'AiChatThreads', id: uid }],
            async onQueryStarted(uid, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    const live = getLiveTimeline(uid);
                    if (live && live.length > data.timeline.length) {
                        const merged = mergeTimelines(data.timeline, live);
                        dispatch(aiChatApi.util.updateQueryData('getAiChatThread', uid, (draft) => {
                            draft.timeline = merged;
                        }));
                        setLiveTimeline(uid, merged);
                        return;
                    }
                    if (data.timeline) setLiveTimeline(uid, data.timeline);
                } catch {
                    // refetch failed — keep the live timeline
                }
            },
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
                'AiChatThreads',
            ],
        }),
        confirmAiChatProposal: builder.mutation<IAgentProposalActionResult, string>({
            query: (proposalId) => ({
                url: `/ai-chat/proposals/${proposalId}/apply`,
                method: 'POST',
            }),
            invalidatesTags: ['AiChatThreads', 'Ivrs', 'CallGroups', 'Endpoints'],
        }),
        rejectAiChatProposal: builder.mutation<IAgentProposalActionResult, string>({
            query: (proposalId) => ({
                url: `/ai-chat/proposals/${proposalId}/reject`,
                method: 'POST',
            }),
            invalidatesTags: ['AiChatThreads'],
        }),
        getPendingAiChatWorkflows: builder.query<IAgentWorkflowPlanView[], void>({
            query: () => '/ai-chat/workflows/pending',
            providesTags: ['AiChatThreads'],
        }),
        confirmAiChatWorkflow: builder.mutation<IAgentWorkflowPlanView, string>({
            query: (workflowId) => ({
                url: `/ai-chat/workflows/${workflowId}/apply`,
                method: 'POST',
            }),
            invalidatesTags: ['AiChatThreads', 'Ivrs', 'CallGroups', 'Endpoints'],
        }),
        rejectAiChatWorkflow: builder.mutation<IAgentWorkflowPlanView, string>({
            query: (workflowId) => ({
                url: `/ai-chat/workflows/${workflowId}/reject`,
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
    useGetAiChatDefaultProviderQuery,
    useUpdateAiChatDefaultProviderMutation,
    useGetAgentUsageQuery,
    useGetAgentUsageFunnelQuery,
    useGetAgentDefaultModelQuery,
    useUpdateAgentDefaultModelMutation,
    useGetAiChatThreadsQuery,
    useGetSharedAiChatThreadsQuery,
    useGetPlatformAiChatThreadsQuery,
    useGetPlatformAiChatThreadQuery,
    useGetAiChatThreadQuery,
    useCreateAiChatThreadMutation,
    useDeleteAiChatThreadMutation,
    useConfirmAiChatProposalMutation,
    useRejectAiChatProposalMutation,
    useGetPendingAiChatWorkflowsQuery,
    useConfirmAiChatWorkflowMutation,
    useRejectAiChatWorkflowMutation,
} = aiChatApi;

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
