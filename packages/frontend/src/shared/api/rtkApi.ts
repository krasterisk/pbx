import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

/**
 * Detect standalone mode (loaded from standalone.html, embedded in v3 iframe).
 * In standalone mode, API calls go to /api/public/* (no JWT required).
 *
 * We check the pathname for 'standalone' because the hash is empty
 * at module load time (before React Router's Navigate fires).
 */
const isStandalone = typeof window !== 'undefined'
  && window.location.pathname.includes('standalone');
const API_BASE = isStandalone
  ? (import.meta.env.VITE_API_URL || '/api') + '/public'
  : (import.meta.env.VITE_API_URL || '/api');

const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  prepareHeaders: (headers) => {
    // In standalone mode, no auth token is needed
    if (isStandalone) return headers;
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // In standalone mode, don't try to refresh or redirect to login
    if (isStandalone) return result;

    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      // Try to get a new token
      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        // Type assertion for the success response
        const data = refreshResult.data as { accessToken: string; refreshToken: string; user: any };
        
        // Store the new token
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Retry the original query with new access token
        result = await baseQuery(args, api, extraOptions);
      } else {
        // Refresh failed, clear state 
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // We could dispatch an action to clear auth state here:
        // api.dispatch(logout()); 
        window.location.href = '/login';
      }
    } else {
       // Token expired and no refresh token
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
  tagTypes: ['Endpoints', 'Contexts', 'Peers', 'Trunks', 'Queues', 'Routes', 'Users', 'Roles', 'Numbers', 'CDR', 'PickupGroups', 'ProvisionTemplates', 'Ivrs', 'Prompts', 'TtsEngines', 'SttEngines', 'Moh', 'VoiceRobots', 'VoiceRobotsGroups', 'VoiceRobotsKeywords', 'VoiceRobotsLogs', 'VoiceRobotsCdr', 'VoiceRobotsDataLists', 'ServiceRequests', 'TimeGroups', 'Phonebooks'],
  endpoints: () => ({}),
});

