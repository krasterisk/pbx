import { rtkApi } from '../rtkApi';

export interface ConferenceMeetingParticipant {
  display_name: string;
  role: string;
  joined_at: string;
  left_at: string | null;
  caller_id_num: string | null;
}

export interface ConferenceMeeting {
  uid: number;
  room_uid: number;
  started_at: string;
  ended_at: string | null;
  has_recording: boolean;
  recording_file_rel: string | null;
  participants: ConferenceMeetingParticipant[];
}

export interface ConferenceRecordingByUniqueid {
  uniqueid: string;
  meetingUid: number;
  roomUid: number;
  playPath: string;
}

export function conferenceMeetingPlayUrl(
  roomUid: number,
  meetingUid: number,
  opts?: { download?: boolean },
): string {
  const path = `/conferences/${roomUid}/meetings/${meetingUid}/play`;
  return opts?.download ? `${path}?download=1` : path;
}

export const conferenceMeetingsApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    getConferenceMeetings: builder.query<ConferenceMeeting[], number>({
      query: (roomUid) => `/conferences/${roomUid}/meetings`,
      providesTags: (_result, _err, roomUid) => [
        { type: 'ConferenceMeetings', id: `ROOM-${roomUid}` },
      ],
    }),
    getConferenceRecordingsByUniqueid: builder.query<
      ConferenceRecordingByUniqueid[],
      string[]
    >({
      query: (uniqueids) =>
        `/conferences/recordings-by-uniqueid?uniqueids=${uniqueids
          .map((id) => encodeURIComponent(id))
          .join(',')}`,
      providesTags: [{ type: 'ConferenceMeetings', id: 'UNIQUEID' }],
    }),
    startConferenceRecording: builder.mutation<void, number>({
      query: (roomUid) => ({
        url: `/conferences/${roomUid}/recording/start`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, roomUid) => [
        { type: 'ConferenceMeetings', id: `ROOM-${roomUid}` },
        'ConferenceRooms',
      ],
    }),
    stopConferenceRecording: builder.mutation<void, number>({
      query: (roomUid) => ({
        url: `/conferences/${roomUid}/recording/stop`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, roomUid) => [
        { type: 'ConferenceMeetings', id: `ROOM-${roomUid}` },
        'ConferenceRooms',
      ],
    }),
  }),
});

export const {
  useGetConferenceMeetingsQuery,
  useGetConferenceRecordingsByUniqueidQuery,
  useStartConferenceRecordingMutation,
  useStopConferenceRecordingMutation,
} = conferenceMeetingsApi;
