import { rtkApi } from '../rtkApi';
import { IVoiceRobot, IVoiceRobotKeywordGroup, IVoiceRobotKeyword, IVoiceRobotLog } from '@/entities/voiceRobot';

export const voiceRobotsApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getVoiceRobots: build.query<IVoiceRobot[], void>({
      query: () => '/voice-robots',
      providesTags: ['VoiceRobots'],
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
  }),
});

export const {
  useGetVoiceRobotsQuery,
  useCreateVoiceRobotMutation,
  useUpdateVoiceRobotMutation,
  useDeleteVoiceRobotMutation,
  useGetVoiceRobotKeywordGroupsQuery,
  useCreateVoiceRobotKeywordGroupMutation,
  useDeleteVoiceRobotKeywordGroupMutation,
  useGetVoiceRobotKeywordsQuery,
  useCreateVoiceRobotKeywordMutation,
  useUpdateVoiceRobotKeywordMutation,
  useDeleteVoiceRobotKeywordMutation,
  useGetVoiceRobotLogsQuery,
} = voiceRobotsApi;
