import { rtkApi } from '../rtkApi';
import type { IIvrPhraseTtsSettings, IPrompt, IPromptTtsMeta } from '@krasterisk/shared';

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

    recordPrompt: builder.mutation<
      { message: string },
      { exten: string; comment: string; description?: string }
    >({
      query: (data) => ({
        url: '/prompts/record',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Prompts', id: 'LIST' }],
    }),

    previewPromptTts: builder.mutation<
      Blob,
      { text: string; engine_uid: number; settings?: IIvrPhraseTtsSettings }
    >({
      query: (body) => ({
        url: '/prompts/tts-preview',
        method: 'POST',
        body,
        responseHandler: (response) => response.blob(),
      }),
    }),

    synthesizePrompt: builder.mutation<
      IPrompt,
      {
        text: string;
        engine_uid: number;
        comment: string;
        description?: string;
        settings?: IIvrPhraseTtsSettings;
      }
    >({
      query: (data) => ({
        url: '/prompts/synthesize',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Prompts', id: 'LIST' }],
    }),

    updatePrompt: builder.mutation<
      IPrompt,
      { uid: number; comment: string; description?: string; tts?: IPromptTtsMeta }
    >({
      query: ({ uid, ...body }) => ({
        url: `/prompts/${uid}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: 'Prompts', id: uid },
        { type: 'Prompts', id: 'LIST' },
      ],
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
  usePreviewPromptTtsMutation,
  useSynthesizePromptMutation,
  useUpdatePromptMutation,
  useDeletePromptMutation,
  useBulkDeletePromptsMutation,
} = promptsApi;

