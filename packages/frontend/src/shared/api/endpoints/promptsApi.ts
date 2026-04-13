import { rtkApi } from '../rtkApi';
import { IPrompt } from '@/entities/prompt';

const promptsApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getPrompts: builder.query<IPrompt[], void>({
      query: () => '/prompts',
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'Prompts' as const, id: r.uid })),
              { type: 'Prompts', id: 'LIST' },
            ]
          : [{ type: 'Prompts', id: 'LIST' }],
    }),

    getPromptById: builder.query<IPrompt, number>({
      query: (uid) => `/prompts/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'Prompts', id: uid }],
    }),

    uploadPrompt: builder.mutation<IPrompt, FormData>({
      query: (formData) => ({
        url: '/prompts/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: [{ type: 'Prompts', id: 'LIST' }],
    }),

    recordPrompt: builder.mutation<{ message: string }, { exten: string; comment: string }>({
      query: (data) => ({
        url: '/prompts/record',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Prompts', id: 'LIST' }],
    }),

    synthesizePrompt: builder.mutation<IPrompt, { text: string; engineId: number; comment: string }>({
      query: (data) => ({
        url: '/prompts/synthesize',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Prompts', id: 'LIST' }],
    }),

    deletePrompt: builder.mutation<void, number>({
      query: (uid) => ({ url: `/prompts/${uid}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Prompts', id: 'LIST' }],
    }),

    bulkDeletePrompts: builder.mutation<{ deleted: number }, number[]>({
      query: (ids) => ({
        url: '/prompts/bulk/delete',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Prompts', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetPromptsQuery,
  useGetPromptByIdQuery,
  useUploadPromptMutation,
  useRecordPromptMutation,
  useSynthesizePromptMutation,
  useDeletePromptMutation,
  useBulkDeletePromptsMutation,
} = promptsApi;

