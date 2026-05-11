import { rtkApi } from '../rtkApi';

// ─── Types ────────────────────────────────────────────────

export type AiProviderKind = 'online' | 'local' | 'custom';
export type AiCapability = 'llm' | 'stt' | 'tts' | 'realtime';
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
    updateAiAgent: build.mutation<IAiAgent, { id: number; data: Partial<ICreateAiAgent> }>({
      query: ({ id, data }) => ({ url: `/ai-agents/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['AiAgents'],
    }),
    deleteAiAgent: build.mutation<{ success: boolean }, number>({
      query: (id) => ({ url: `/ai-agents/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AiAgents'],
    }),

    // Providers
    getAiProviders: build.query<IAiProvider[], void>({
      query: () => '/ai-agents/providers/list',
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
    cloneAiProvider: build.mutation<IAiProvider, number>({
      query: (id) => ({ url: `/ai-agents/providers/${id}/clone`, method: 'POST' }),
      invalidatesTags: ['AiProviders'],
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
  useCloneAiProviderMutation,
  useGetAiToolsetsQuery,
  useCreateAiToolsetMutation,
  useUpdateAiToolsetMutation,
  useDeleteAiToolsetMutation,
} = aiAgentsApi;
