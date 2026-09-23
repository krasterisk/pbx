import { rtkApi } from '../rtkApi';

// ─── Types ────────────────────────────────────────────────

export type AiProviderKind = 'online' | 'local' | 'custom';
export type AiCapability = 'llm' | 'stt' | 'tts' | 'realtime' | 'tools' | 'function_calling';
export type AiPipelineMode = 'realtime' | 'cascade';

export interface IAiProvider {
  uid: number;
  name: string;
  kind: AiProviderKind;
  vendor: string;
  endpoint: string;
  auth_type: string;
  /** API key is never returned by the API; only presence is signaled with `has_key`. */
  has_key?: boolean;
  capabilities: AiCapability[];
  defaults: Record<string, unknown>;
  pricing: Record<string, number>;
  enabled: boolean;
  /** Platform catalog row. Cabinet lists drop these. */
  is_global?: boolean;
  user_uid: number;
  created_at?: string;
  updated_at?: string;
}

export interface IAiToolset {
  uid: number;
  name: string;
  description: string;
  tools: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    endpoint?: string;
  }>;
  user_uid: number;
}

export interface IAiAgent {
  uid: number;
  name: string;
  unique_id: string;
  mode: AiPipelineMode;
  voice: string;
  greeting: string;
  instruction: string;
  model_profile_id: number | null;
  stt_profile_id: number | null;
  tts_profile_id: number | null;
  vad_config: Record<string, unknown>;
  toolset_id: number | null;
  channel_kind: 'local' | 'pjsip' | 'sip';
  enabled: boolean;
  user_uid: number;
  created_at?: string;
  draft_revision?: number;
  robot_uuid?: string;
}

export interface ICreateAiAgent {
  name: string;
  unique_id: string;
  mode: AiPipelineMode;
  voice?: string;
  greeting?: string;
  instruction?: string;
  model_profile_id?: number;
  stt_profile_id?: number;
  tts_profile_id?: number;
  vad_config?: Record<string, unknown>;
  toolset_id?: number;
  channel_kind?: 'local' | 'pjsip' | 'sip';
  enabled?: boolean;
}

export interface ISpeechAnalyticsModelOption {
  uid: number;
  name: string;
  capabilities: string[];
  model: string | null;
  enabled: boolean;
}

export interface ISpeechAnalyticsModels {
  sttProviderUid: number | null;
  llmProviderUid: number | null;
  providers: ISpeechAnalyticsModelOption[];
}

export interface ICreateAiProvider {
  name: string;
  kind: AiProviderKind;
  vendor: string;
  endpoint: string;
  auth_type?: string;
  apiKey?: string;
  capabilities: AiCapability[];
  defaults?: Record<string, unknown>;
  pricing: Record<string, number>;
  enabled?: boolean;
}

// ─── API ──────────────────────────────────────────────────

const aiAgentsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (build) => ({
    // Agents
    getAiAgents: build.query<IAiAgent[], void>({
      query: () => '/ai-agents',
      providesTags: ['AiAgents'],
    }),
    createAiAgent: build.mutation<IAiAgent, ICreateAiAgent>({
      query: (body) => ({ url: '/ai-agents', method: 'POST', body }),
      invalidatesTags: ['AiAgents'],
    }),
    updateAiAgent: build.mutation<IAiAgent, { id: number; data: Partial<ICreateAiAgent>; expectedRevision: number }>({
      query: ({ id, data, expectedRevision }) => ({
        url: `/ai-agents/${id}`, method: 'PUT', body: data,
        headers: { 'If-Match': String(expectedRevision) },
      }),
      invalidatesTags: ['AiAgents'],
    }),
    deleteAiAgent: build.mutation<{ success: boolean }, { id: number; expectedRevision: number }>({
      query: ({ id, expectedRevision }) => ({
        url: `/ai-agents/${id}`, method: 'DELETE',
        headers: { 'If-Match': String(expectedRevision) },
      }),
      invalidatesTags: ['AiAgents'],
    }),

    // Providers
    getAiProviders: build.query<IAiProvider[], void>({
      query: () => '/ai-agents/providers/list',
      transformResponse: (rows: IAiProvider[]) =>
        (Array.isArray(rows) ? rows : []).filter((row) => row.is_global !== true),
      providesTags: ['AiProviders'],
    }),
    createAiProvider: build.mutation<IAiProvider, ICreateAiProvider>({
      query: (body) => ({ url: '/ai-agents/providers', method: 'POST', body }),
      invalidatesTags: ['AiProviders'],
    }),
    updateAiProvider: build.mutation<IAiProvider, { id: number; data: Partial<ICreateAiProvider> }>({
      query: ({ id, data }) => ({ url: `/ai-agents/providers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['AiProviders'],
    }),
    deleteAiProvider: build.mutation<{ success: boolean }, number>({
      query: (id) => ({ url: `/ai-agents/providers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AiProviders'],
    }),
    getGlobalAiProviders: build.query<IAiProvider[], void>({
      query: () => '/cloud-admin/global-providers',
      providesTags: [{ type: 'AiProviders', id: 'GLOBAL' }],
    }),
    createGlobalAiProvider: build.mutation<IAiProvider, ICreateAiProvider>({
      query: (body) => ({ url: '/cloud-admin/global-providers', method: 'POST', body }),
      invalidatesTags: [{ type: 'AiProviders', id: 'GLOBAL' }, { type: 'AiProviders', id: 'SPEECH' }],
    }),
    updateGlobalAiProvider: build.mutation<IAiProvider, { id: number; data: Partial<ICreateAiProvider> }>({
      query: ({ id, data }) => ({ url: `/cloud-admin/global-providers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: [{ type: 'AiProviders', id: 'GLOBAL' }, { type: 'AiProviders', id: 'SPEECH' }],
    }),
    deleteGlobalAiProvider: build.mutation<{ success: boolean }, number>({
      query: (id) => ({ url: `/cloud-admin/global-providers/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'AiProviders', id: 'GLOBAL' }, { type: 'AiProviders', id: 'SPEECH' }],
    }),
    getSpeechAnalyticsModels: build.query<ISpeechAnalyticsModels, void>({
      query: () => '/cloud-admin/speech-analytics-models',
      providesTags: [{ type: 'AiProviders', id: 'SPEECH' }],
    }),
    saveSpeechAnalyticsModels: build.mutation<ISpeechAnalyticsModels, {
      sttProviderUid: number | null;
      llmProviderUid: number | null;
    }>({
      query: (body) => ({ url: '/cloud-admin/speech-analytics-models', method: 'PUT', body }),
      invalidatesTags: [{ type: 'AiProviders', id: 'SPEECH' }],
    }),

    // Toolsets
    getAiToolsets: build.query<IAiToolset[], void>({
      query: () => '/ai-agents/toolsets/list',
      providesTags: ['AiToolsets'],
    }),
    createAiToolset: build.mutation<IAiToolset, Partial<IAiToolset>>({
      query: (body) => ({ url: '/ai-agents/toolsets', method: 'POST', body }),
      invalidatesTags: ['AiToolsets'],
    }),
    updateAiToolset: build.mutation<IAiToolset, { id: number; data: Partial<IAiToolset> }>({
      query: ({ id, data }) => ({ url: `/ai-agents/toolsets/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['AiToolsets'],
    }),
    deleteAiToolset: build.mutation<{ success: boolean }, number>({
      query: (id) => ({ url: `/ai-agents/toolsets/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AiToolsets'],
    }),
  }),
});

export const {
  useGetAiAgentsQuery,
  useCreateAiAgentMutation,
  useUpdateAiAgentMutation,
  useDeleteAiAgentMutation,
  useGetAiProvidersQuery,
  useCreateAiProviderMutation,
  useUpdateAiProviderMutation,
  useDeleteAiProviderMutation,
  useGetGlobalAiProvidersQuery,
  useCreateGlobalAiProviderMutation,
  useUpdateGlobalAiProviderMutation,
  useDeleteGlobalAiProviderMutation,
  useGetSpeechAnalyticsModelsQuery,
  useSaveSpeechAnalyticsModelsMutation,
  useGetAiToolsetsQuery,
  useCreateAiToolsetMutation,
  useUpdateAiToolsetMutation,
  useDeleteAiToolsetMutation,
} = aiAgentsApi;
