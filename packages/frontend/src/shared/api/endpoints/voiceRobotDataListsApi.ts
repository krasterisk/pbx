import { rtkApi } from '../rtkApi';
import { IVoiceRobotDataList } from '@/entities/voiceRobot';

export const voiceRobotDataListsApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getVoiceRobotDataLists: build.query<IVoiceRobotDataList[], number>({
      query: (robotId) => `/voice-robots/${robotId}/data-lists`,
      providesTags: ['VoiceRobotsDataLists'],
    }),
    createVoiceRobotDataList: build.mutation<IVoiceRobotDataList, { robotId: number; data: Partial<IVoiceRobotDataList> }>({
      query: ({ robotId, data }) => ({
        url: `/voice-robots/${robotId}/data-lists`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['VoiceRobotsDataLists'],
    }),
    updateVoiceRobotDataList: build.mutation<IVoiceRobotDataList, { id: number; data: Partial<IVoiceRobotDataList> }>({
      query: ({ id, data }) => ({
        url: `/voice-robots/data-lists/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['VoiceRobotsDataLists'],
    }),
    deleteVoiceRobotDataList: build.mutation<void, number>({
      query: (id) => ({
        url: `/voice-robots/data-lists/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['VoiceRobotsDataLists'],
    }),
    testDataListSearch: build.mutation<
      {
        input_query: string;
        return_field: string;
        result: {
          value: string;
          row: Record<string, string>;
          rowIndex: number;
          confidence: number;
          method: 'fuzzy' | 'semantic';
        } | null;
        total_rows: number;
        elapsed_ms: number;
      },
      { listId: number; query: string; returnField: string }
    >({
      query: ({ listId, query, returnField }) => ({
        url: `/voice-robots/data-lists/${listId}/test-search`,
        method: 'POST',
        body: { query, returnField },
      }),
    }),
  }),
});

export const {
  useGetVoiceRobotDataListsQuery,
  useCreateVoiceRobotDataListMutation,
  useUpdateVoiceRobotDataListMutation,
  useDeleteVoiceRobotDataListMutation,
  useTestDataListSearchMutation,
} = voiceRobotDataListsApi;
