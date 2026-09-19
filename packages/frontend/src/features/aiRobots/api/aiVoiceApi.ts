import { rtkApi } from '@/shared/api/rtkApi';

export interface AiVoiceDeployment {
  id: string;
  agent_uid: number;
  kind: 'internal' | 'browser_test' | 'external_sip';
  active_version_id: string | null;
  status: 'disabled' | 'ready' | 'draining' | 'stopped';
  revision: number;
}

export interface AiVoiceSession {
  id: string;
  deployment_id: string;
  version_id: string;
  ingress_kind: string;
  state: string;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface AiVoiceTimeline {
  session: AiVoiceSession;
  turns: Array<{
    id: string;
    input_turn_id: number;
    output_epoch: number;
    role: string;
    state: string;
    text: string;
    provenance: string;
  }>;
  events: Array<{ id: string; sequence: number; type: string; payload: string }>;
  operations: Array<{ id: string; operation_key: string; action: string; state: string }>;
}

const aiVoiceApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
    getAiVoiceCapabilities: builder.query<{ realtime: boolean; previewMic: string }, void>({
      query: () => '/ai-voice/capabilities',
      providesTags: [{ type: 'AiVoice', id: 'CAPS' }],
    }),
    getAiVoiceDeployments: builder.query<AiVoiceDeployment[], void>({
      query: () => '/ai-voice/deployments',
      providesTags: [{ type: 'AiVoice', id: 'DEPLOYMENTS' }],
    }),
    publishAiVoiceAgent: builder.mutation<unknown, { uid: number; operationKey: string }>({
      query: ({ uid, operationKey }) => ({
        url: `/ai-voice/agents/${uid}/publish`, method: 'POST', body: { operationKey },
      }),
      invalidatesTags: [{ type: 'AiVoice', id: 'DEPLOYMENTS' }],
    }),
    createAiVoiceDeployment: builder.mutation<AiVoiceDeployment, {
      agentUid: number; kind: 'internal' | 'browser_test'; versionId?: string;
    }>({
      query: (body) => ({ url: '/ai-voice/deployments', method: 'POST', body }),
      invalidatesTags: [{ type: 'AiVoice', id: 'DEPLOYMENTS' }],
    }),
    setAiVoiceDeploymentReady: builder.mutation<AiVoiceDeployment, { id: string; ready: boolean }>({
      query: ({ id, ready }) => ({
        url: `/ai-voice/deployments/${id}/ready`, method: 'PUT', body: { ready },
      }),
      async onQueryStarted({ id, ready }, { dispatch, queryFulfilled }) {
        const patch = dispatch(aiVoiceApi.util.updateQueryData('getAiVoiceDeployments', undefined, (draft) => {
          const row = draft.find((item) => item.id === id);
          if (row) row.status = ready ? 'ready' : 'disabled';
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: 'AiVoice', id: 'DEPLOYMENTS' }],
    }),
    issueAiVoiceBrowserTicket: builder.mutation<{ id: string; expiresAt: string }, string>({
      query: (id) => ({ url: `/ai-voice/deployments/${id}/browser-ticket`, method: 'POST' }),
    }),
    getAiVoiceSessions: builder.query<AiVoiceSession[], string | undefined>({
      query: (deploymentId) => deploymentId
        ? `/ai-voice/sessions?deploymentId=${deploymentId}`
        : '/ai-voice/sessions',
      providesTags: [{ type: 'AiVoice', id: 'SESSIONS' }],
    }),
    getAiVoiceTimeline: builder.query<AiVoiceTimeline, string>({
      query: (id) => `/ai-voice/sessions/${id}`,
    }),
    getAiSipConnections: builder.query<Array<{ id: string; name: string; status: string }>, void>({
      query: () => '/ai-voice/sip-connections',
      providesTags: [{ type: 'AiVoice', id: 'SIP' }],
    }),
    createAiSipConnection: builder.mutation<{ id: string }, { name: string; transport: 'udp' | 'tcp' | 'tls' }>({
      query: (body) => ({ url: '/ai-voice/sip-connections', method: 'POST', body }),
      invalidatesTags: [{ type: 'AiVoice', id: 'SIP' }],
    }),
  }),
});

export const {
  useGetAiVoiceCapabilitiesQuery,
  useGetAiVoiceDeploymentsQuery,
  usePublishAiVoiceAgentMutation,
  useCreateAiVoiceDeploymentMutation,
  useSetAiVoiceDeploymentReadyMutation,
  useIssueAiVoiceBrowserTicketMutation,
  useGetAiVoiceSessionsQuery,
  useGetAiVoiceTimelineQuery,
  useGetAiSipConnectionsQuery,
  useCreateAiSipConnectionMutation,
} = aiVoiceApi;
