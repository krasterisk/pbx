import type { IVoicemailMessage } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

export function voicemailPlayUrl(
  uniqueid: string,
  opts?: { download?: boolean },
): string {
  const path = `/voicemail/${encodeURIComponent(uniqueid)}/play`;
  return opts?.download ? `${path}?download=1` : path;
}

export const voicemailApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getVoicemailMessages: builder.query<IVoicemailMessage[], void>({
      query: () => '/voicemail',
      providesTags: [{ type: 'Voicemail', id: 'LIST' }],
    }),
    getVoicemailByUniqueid: builder.query<IVoicemailMessage, string>({
      query: (uniqueid) => `/voicemail/${encodeURIComponent(uniqueid)}`,
      providesTags: (_result, _err, uniqueid) => [{ type: 'Voicemail', id: uniqueid }],
    }),
    retryVoicemailStt: builder.mutation<{ ok: boolean }, string>({
      query: (uniqueid) => ({
        url: `/voicemail/${encodeURIComponent(uniqueid)}/retry-stt`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, uniqueid) => [
        { type: 'Voicemail', id: uniqueid },
        { type: 'Voicemail', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetVoicemailMessagesQuery,
  useGetVoicemailByUniqueidQuery,
  useRetryVoicemailSttMutation,
} = voicemailApi;
