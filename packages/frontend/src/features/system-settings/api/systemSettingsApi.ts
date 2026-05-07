import { rtkApi } from '@/shared/api/rtkApi';

// ------- Apply Subroutines -------

export interface ApplySubroutinesResult {
  success: boolean;
  linesApplied?: number;
  error?: string;
}

// ------- Server Config -------

export interface ServerConfig {
  records_base_path: string;
  records_base_url: string;
  /** Always returned as '••••••••' if set — submit new value to change, empty string to clear */
  webhook_secret: string;
}

export interface UpdateConfigResult {
  updated: string[];
}

// ------- ffmpeg -------

export interface FfmpegStatus {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

// ------- Redis Status -------

export interface RedisStatus {
  connected: boolean;
  version?: string;
  host?: string;
  port?: number;
  message?: string;
}

// ------- RTK API -------

export const systemSettingsApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    // Dialplan subroutines
    applySubroutines: build.mutation<ApplySubroutinesResult, void>({
      query: () => ({
        url: '/system-settings/apply-subroutines',
        method: 'POST',
      }),
    }),

    // Server config (recordings, webhook secret)
    getServerConfig: build.query<ServerConfig, void>({
      query: () => '/system-settings/server-config',
      providesTags: ['ServerConfig'],
    }),
    updateServerConfig: build.mutation<UpdateConfigResult, Partial<ServerConfig>>({
      query: (body) => ({
        url: '/system-settings/server-config',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['ServerConfig'],
    }),

    // ffmpeg availability check
    getFfmpegStatus: build.query<FfmpegStatus, void>({
      query: () => '/system-settings/ffmpeg-status',
    }),

    // Redis connection + queue stats
    getRedisStatus: build.query<RedisStatus, void>({
      query: () => '/system-settings/redis-status',
    }),
  }),
});

export const {
  useApplySubroutinesMutation,
  useGetServerConfigQuery,
  useUpdateServerConfigMutation,
  useGetFfmpegStatusQuery,
  useLazyGetFfmpegStatusQuery,
  useGetRedisStatusQuery,
  useLazyGetRedisStatusQuery,
} = systemSettingsApi;
