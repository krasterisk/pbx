import type { AiVoiceRobot, AiVoiceRobotConfig } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

export const aiVoiceRobotsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: build => ({
    getAiVoiceRobots: build.query<AiVoiceRobot[], void>({
      query: () => '/ai-voice/robots', providesTags: [{ type: 'AiVoice', id: 'ROBOTS' }],
    }),
    getAiRobotTemplates: build.query<Array<{ id: string; name: string; description: string }>, void>({
      query: () => '/ai-voice/robots/templates',
    }),
    playAiVoiceRobot: build.mutation<{
      assistant: string; outcome: string;
      toolCalls: Array<{ name: string; arguments: Record<string, unknown>; result: unknown }>;
    }, { uid?: number; config: AiVoiceRobotConfig; userText: string; history?: Array<{ role: string; content: string }> }>({
      query: ({ uid, ...body }) => ({
        url: uid ? `/ai-voice/robots/${uid}/playground` : '/ai-voice/robots/playground',
        method: 'POST', body,
      }),
    }),
    rollbackAiVoiceRobot: build.mutation<AiVoiceRobot, { uid: number; versionId: string }>({
      query: ({ uid, versionId }) => ({ url: `/ai-voice/robots/${uid}/rollback`, method: 'POST', body: { versionId } }),
      invalidatesTags: [{ type: 'AiVoice', id: 'ROBOTS' }],
    }),
    saveAiVoiceRobot: build.mutation<AiVoiceRobot, { uid?: number; revision?: number; config: AiVoiceRobotConfig }>({
      query: ({ uid, revision, config }) => ({ url: `/ai-voice/robots${uid ? `/${uid}` : ''}`,
        method: uid ? 'PUT' : 'POST', body: config,
        headers: uid ? { 'If-Match': String(revision) } : undefined }),
      invalidatesTags: [{ type: 'AiVoice', id: 'ROBOTS' }, { type: 'AiVoice', id: 'DEPLOYMENTS' }, 'AiAgents'],
    }),
  }),
});

export const {
  useGetAiVoiceRobotsQuery, useSaveAiVoiceRobotMutation, useGetAiRobotTemplatesQuery,
  usePlayAiVoiceRobotMutation, useRollbackAiVoiceRobotMutation,
} = aiVoiceRobotsApi;
