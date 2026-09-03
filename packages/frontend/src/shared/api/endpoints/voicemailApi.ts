import type { IVoicemailMessage } from '@krasterisk/shared';
import { rtkApi } from '../rtkApi';

export const voicemailApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getVoicemailMessages: builder.query<IVoicemailMessage[], void>({
      query: () => '/voicemail',
      providesTags: [{ type: 'Voicemail', id: 'LIST' }],
    }),
  }),
});

export const { useGetVoicemailMessagesQuery } = voicemailApi;
