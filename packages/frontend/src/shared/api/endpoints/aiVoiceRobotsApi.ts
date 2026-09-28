import type { AiVoiceRobot, AiVoiceRobotConfig } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

export const aiVoiceRobotsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: build => ({
    getAiVoiceRobots: build.query<AiVoiceRobot[], void>({
      query: () => '/ai-voice/robots', providesTags: [{ type: 'AiVoice', id: 'ROBOTS' }],
    }),
    saveAiVoiceRobot: build.mutation<AiVoiceRobot, { uid?: number; revision?: number; config: AiVoiceRobotConfig }>({
      query: ({ uid, revision, config }) => ({ url: `/ai-voice/robots${uid ? `/${uid}` : ''}`,
        method: uid ? 'PUT' : 'POST', body: config,
        headers: uid ? { 'If-Match': String(revision) } : undefined }),
      invalidatesTags: [{ type: 'AiVoice', id: 'ROBOTS' }, { type: 'AiVoice', id: 'DEPLOYMENTS' }, 'AiAgents'],
    }),
  }),
});

export const { useGetAiVoiceRobotsQuery, useSaveAiVoiceRobotMutation } = aiVoiceRobotsApi;
