import { rtkApi } from '@/shared/api/rtkApi';

const aiToolsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
    getAiTools: builder.query<Array<{ id: string; name: string; status: string; kind: string }>, void>({
      query: () => '/ai-tools',
      providesTags: [{ type: 'AiVoice', id: 'TOOLS' }],
    }),
    createAiTool: builder.mutation<unknown, { name: string; kind: string; destination: string }>({
      query: (body) => ({ url: '/ai-tools', method: 'POST', body }),
      invalidatesTags: [{ type: 'AiVoice', id: 'TOOLS' }],
    }),
    getKnowledgeBases: builder.query<Array<{ id: string; name: string; status: string }>, void>({
      query: () => '/ai-knowledge',
      providesTags: [{ type: 'AiVoice', id: 'KB' }],
    }),
    createKnowledgeBase: builder.mutation<{ id: string }, { name: string }>({
      query: (body) => ({ url: '/ai-knowledge', method: 'POST', body }),
      invalidatesTags: [{ type: 'AiVoice', id: 'KB' }],
    }),
    addKnowledgeText: builder.mutation<unknown, { id: string; title: string; text: string }>({
      query: ({ id, ...body }) => ({ url: `/ai-knowledge/${id}/text`, method: 'POST', body }),
    }),
    queryKnowledge: builder.mutation<Array<{ id: string; excerpt: string }>, { baseIds: string[]; query: string }>({
      query: (body) => ({ url: '/ai-knowledge/query', method: 'POST', body }),
    }),
  }),
});

export const {
  useGetAiToolsQuery,
  useCreateAiToolMutation,
  useGetKnowledgeBasesQuery,
  useCreateKnowledgeBaseMutation,
  useAddKnowledgeTextMutation,
  useQueryKnowledgeMutation,
} = aiToolsApi;
