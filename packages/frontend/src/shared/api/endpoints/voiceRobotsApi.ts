import { rtkApi } from '../rtkApi';
import { IVoiceRobot, IVoiceRobotKeywordGroup, IVoiceRobotKeyword, IVoiceRobotLog } from '@/entities/voiceRobot';

export const voiceRobotsApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getVoiceRobots: build.query<IVoiceRobot[], void>({
      query: () => '/voice-robots',
      providesTags: ['VoiceRobots'],
    }),
    getVoiceRobot: build.query<IVoiceRobot, number>({
      query: (uid) => `/voice-robots/${uid}`,
      providesTags: (result, error, uid) => [{ type: 'VoiceRobots', id: uid }],
    }),
    createVoiceRobot: build.mutation<IVoiceRobot, Partial<IVoiceRobot>>({
      query: (data) => ({
        url: '/voice-robots',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['VoiceRobots'],
    }),
    updateVoiceRobot: build.mutation<IVoiceRobot, { uid: number; data: Partial<IVoiceRobot> }>({
      query: ({ uid, data }) => ({
        url: `/voice-robots/${uid}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['VoiceRobots'],
    }),
    deleteVoiceRobot: build.mutation<void, number>({
      query: (uid) => ({
        url: `/voice-robots/${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['VoiceRobots'],
    }),
    getVoiceRobotKeywordGroups: build.query<IVoiceRobotKeywordGroup[], number>({
      query: (robotId) => `/voice-robots/${robotId}/keyword-groups`,
      providesTags: ['VoiceRobotsGroups'],
    }),
    createVoiceRobotKeywordGroup: build.mutation<IVoiceRobotKeywordGroup, { robotId: number; data: Partial<IVoiceRobotKeywordGroup> }>({
      query: ({ robotId, data }) => ({
        url: `/voice-robots/${robotId}/keyword-groups`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['VoiceRobotsGroups'],
    }),
    updateVoiceRobotKeywordGroup: build.mutation<IVoiceRobotKeywordGroup, { id: number; data: Partial<IVoiceRobotKeywordGroup> }>({
      query: ({ id, data }) => ({
        url: `/voice-robots/keyword-groups/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['VoiceRobotsGroups'],
    }),
    deleteVoiceRobotKeywordGroup: build.mutation<void, number>({
      query: (groupId) => ({
        url: `/voice-robots/keyword-groups/${groupId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['VoiceRobotsGroups'],
    }),
    getVoiceRobotKeywords: build.query<IVoiceRobotKeyword[], number>({
      query: (groupId) => `/voice-robots/keyword-groups/${groupId}/keywords`,
      providesTags: ['VoiceRobotsKeywords'],
    }),
    createVoiceRobotKeyword: build.mutation<IVoiceRobotKeyword, { groupId: number; data: Partial<IVoiceRobotKeyword> }>({
      query: ({ groupId, data }) => ({
        url: `/voice-robots/keyword-groups/${groupId}/keywords`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['VoiceRobotsKeywords'],
    }),
    updateVoiceRobotKeyword: build.mutation<IVoiceRobotKeyword, { uid: number; data: Partial<IVoiceRobotKeyword> }>({
      query: ({ uid, data }) => ({
        url: `/voice-robots/keywords/${uid}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['VoiceRobotsKeywords'],
    }),
    deleteVoiceRobotKeyword: build.mutation<void, number>({
      query: (uid) => ({
        url: `/voice-robots/keywords/${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['VoiceRobotsKeywords'],
    }),
    getVoiceRobotLogs: build.query<IVoiceRobotLog[], number>({
      query: (robotId) => `/voice-robots/${robotId}/logs`,
      providesTags: ['VoiceRobotsLogs'],
    }),
    testMatchVoiceRobot: build.mutation<
      {
        input_text: string;
        match: {
          keyword_uid: number;
          keyword_text: string;
          matched_phrase: string;
          confidence: number;
          method: 'levenshtein' | 'semantic';
          matched_word_count: number;
          bot_action: any | null;
        } | null;
        total_keywords: number;
        elapsed_ms: number;
      },
      { robotId: number; text: string }
    >({
      query: ({ robotId, text }) => ({
        url: `/voice-robots/${robotId}/test-match`,
        method: 'POST',
        body: { text },
      }),
    }),
  }),
});

export const {
  useGetVoiceRobotsQuery,
  useGetVoiceRobotQuery,
  useCreateVoiceRobotMutation,
  useUpdateVoiceRobotMutation,
  useDeleteVoiceRobotMutation,
  useGetVoiceRobotKeywordGroupsQuery,
  useCreateVoiceRobotKeywordGroupMutation,
  useUpdateVoiceRobotKeywordGroupMutation,
  useDeleteVoiceRobotKeywordGroupMutation,
  useGetVoiceRobotKeywordsQuery,
  useCreateVoiceRobotKeywordMutation,
  useUpdateVoiceRobotKeywordMutation,
  useDeleteVoiceRobotKeywordMutation,
  useGetVoiceRobotLogsQuery,
  useTestMatchVoiceRobotMutation,
} = voiceRobotsApi;
