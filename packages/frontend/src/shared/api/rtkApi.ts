import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

import { getEffectiveApiBase, isStandaloneApp } from './apiBase';

type AuthSliceState = { auth?: { accessToken?: string | null } };

function resolveAccessToken(getState: () => unknown): string | null {
  const fromStore = (getState() as AuthSliceState).auth?.accessToken;
  return fromStore ?? localStorage.getItem('accessToken');
}

function createBaseQuery(baseUrl: string) {
  return fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      if (isStandaloneApp()) return headers;
      const token = resolveAccessToken(getState);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  });
}

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const baseQuery = createBaseQuery(getEffectiveApiBase());
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    if (isStandaloneApp()) return result;

    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshResult = await createBaseQuery(getEffectiveApiBase())(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions,
      );

      if (refreshResult.data) {
        const data = refreshResult.data as { accessToken: string; refreshToken: string; user: unknown };

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        result = await createBaseQuery(getEffectiveApiBase())(args, api, extraOptions);
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');

        window.location.href = '/login';
      }
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }

  return result;
};

export const rtkApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Endpoints', 'Contexts', 'Peers', 'Trunks', 'Queues', 'Routes', 'Users', 'Roles', 'Numbers', 'CDR', 'PickupGroups', 'ProvisionTemplates', 'Ivrs', 'Prompts', 'TtsEngines', 'SttEngines', 'Moh', 'VoiceRobots', 'VoiceRobotsGroups', 'VoiceRobotsKeywords', 'VoiceRobotsLogs', 'VoiceRobotsCdr', 'VoiceRobotsDataLists', 'ServiceRequests', 'TimeGroups', 'Phonebooks', 'ServerConfig', 'AuditLog', 'WebhookFailure', 'Tenants', 'CallCenter', 'PauseReasons', 'MissedCalls', 'CcOperatorSettings', 'CcSettings', 'CcChat', 'AiAgents', 'AiProviders', 'AiToolsets', 'AiChatSettings', 'CallGroups', 'Notifications', 'CardTemplates', 'Cards', 'CcDisplayTokens', 'CcAlertConfig', 'ReportSchedules'],
  endpoints: () => ({}),
});
