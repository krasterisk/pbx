import { toast } from 'react-toastify';

import i18n from '@/shared/config/i18n';

import { rtkApi } from '../rtkApi';

/** Catalog row for the route-step room picker. */
export interface ConferenceRoomCatalogItem {
  uid: number;
  number: string;
  name: string;
}

export type ConferenceRoomKind = 'permanent' | 'ephemeral';
export type ConferenceEntryStrictness =
  | 'token_name'
  | 'token_name_pin'
  | 'token_name_pin_moderator';
export type ConferenceRecordMode = 'off' | 'auto' | 'button' | 'both';
export type ConferenceInviteScope = 'owner' | 'moderator' | 'anyone';
export type ConferenceRole = 'owner' | 'moderator' | 'participant';

export interface ConferenceParticipant {
  ref: string;
  displayName: string;
  role: ConferenceRole;
  speaking: boolean;
  muted: boolean;
  video: boolean;
}

/** Full room from GET /conferences/:uid. Live fields are patched by SSE onto this same cache entry. */
export interface ConferenceRoom {
  uid: number;
  number: string;
  name: string;
  kind: ConferenceRoomKind;
  entry_strictness: ConferenceEntryStrictness;
  pin: string | null;
  wait_marked: boolean;
  end_marked: boolean;
  record_mode: ConferenceRecordMode;
  notify_recording: boolean;
  invite_external_scope: ConferenceInviteScope;
  tariff_max_participants: number | null;
  musiconhold: string | null;
  announce_join_leave: boolean;
  participants?: ConferenceParticipant[];
  waitingForModerator?: boolean;
  recording?: boolean;
}

export interface ConferenceRoomWrite {
  number?: string;
  name?: string;
  kind?: ConferenceRoomKind;
  entry_strictness?: ConferenceEntryStrictness;
  pin?: string | null;
  wait_marked?: boolean;
  end_marked?: boolean;
  record_mode?: ConferenceRecordMode;
  notify_recording?: boolean;
  invite_external_scope?: ConferenceInviteScope;
  tariff_max_participants?: number | null;
  musiconhold?: string | null;
  announce_join_leave?: boolean;
}

export interface ConferenceGuestMeta {
  name: string;
  entry_strictness: ConferenceEntryStrictness;
  requiresPin: boolean;
}

export interface ConferenceGuestJoinResult {
  sipId: string;
  password: string;
  sipDomain: string | null;
  roomUid: number;
}

export interface ConferenceInviteInput {
  kind: 'internal' | 'external';
  target: string;
}

export interface ConferenceTelemetryBody {
  qualityLimitationReason?: 'none' | 'cpu' | 'bandwidth' | 'other';
  packetsLost?: number;
  totalFreezesDuration?: number;
}

/** Guest ICE/WSS — wssUrl + iceServers only. SIP password is never here (T-16.3-04). */
export interface ConferenceWebrtcConfig {
  wssUrl: string | null;
  iceServers: RTCIceServer[];
}

export interface ConferenceGuestLink {
  uid: number;
  room_uid: number;
  token: string;
  kind: 'shared_link' | 'named_invite';
  invite_name: string | null;
  expires_at: string | null;
}

export interface ConferenceRoomModerator {
  endpointRef: string;
  role: 'owner' | 'moderator';
}

function encodeGuestToken(token: string): string {
  return encodeURIComponent(token);
}

export function guestGetUrl(token: string): string {
  return `/conferences/guest/${encodeGuestToken(token)}`;
}

export function guestJoinUrl(token: string): string {
  return `/conferences/guest/${encodeGuestToken(token)}/join`;
}

export function guestLeaveUrl(token: string): string {
  return `/conferences/guest/${encodeGuestToken(token)}/leave`;
}

export function guestEventsUrl(token: string, authToken: string): string {
  return `/conferences/guest/${encodeGuestToken(token)}/events?token=${encodeURIComponent(authToken)}`;
}

export function staffEventsUrl(roomUid: number, jwt: string): string {
  return `/conferences/${roomUid}/events?token=${encodeURIComponent(jwt)}`;
}

export function pickGuestWebrtcConfig(raw: {
  wssUrl?: string | null;
  iceServers?: RTCIceServer[];
}): ConferenceWebrtcConfig {
  return {
    wssUrl: raw.wssUrl ?? null,
    iceServers: raw.iceServers ?? [],
  };
}

function allowListedTelemetry(body: ConferenceTelemetryBody): ConferenceTelemetryBody {
  const next: ConferenceTelemetryBody = {};
  if (body.qualityLimitationReason !== undefined) {
    next.qualityLimitationReason = body.qualityLimitationReason;
  }
  if (body.packetsLost !== undefined) {
    next.packetsLost = body.packetsLost;
  }
  if (body.totalFreezesDuration !== undefined) {
    next.totalFreezesDuration = body.totalFreezesDuration;
  }
  return next;
}

const conferenceRoomApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getConferenceRooms: build.query<ConferenceRoomCatalogItem[], void>({
      query: () => '/conferences',
      providesTags: ['ConferenceRooms'],
    }),
    getConferenceRoom: build.query<ConferenceRoom, number>({
      query: (uid) => `/conferences/${uid}`,
      providesTags: (_r, _e, uid) => [
        { type: 'ConferenceRooms', id: uid },
        { type: 'ConferenceParticipants', id: uid },
      ],
    }),
    createConferenceRoom: build.mutation<ConferenceRoom, ConferenceRoomWrite>({
      query: (body) => ({
        url: '/conferences',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ConferenceRooms'],
    }),
    updateConferenceRoom: build.mutation<ConferenceRoom, { uid: number; data: ConferenceRoomWrite }>({
      query: ({ uid, data }) => ({
        url: `/conferences/${uid}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['ConferenceRooms'],
    }),
    deleteConferenceRoom: build.mutation<void, number>({
      query: (uid) => ({
        url: `/conferences/${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ConferenceRooms'],
    }),
    getConferenceCapacity: build.query<{ maxParticipants: number }, number>({
      query: (uid) => `/conferences/${uid}/capacity`,
    }),
    getConferenceModerators: build.query<ConferenceRoomModerator[], number>({
      query: (uid) => `/conferences/${uid}/moderators`,
      providesTags: (_r, _e, uid) => [{ type: 'ConferenceRooms', id: `mods-${uid}` }],
    }),
    setConferenceModerators: build.mutation<
      ConferenceRoomModerator[],
      { uid: number; moderators: ConferenceRoomModerator[] }
    >({
      query: ({ uid, moderators }) => ({
        url: `/conferences/${uid}/moderators`,
        method: 'PUT',
        body: { moderators },
      }),
      invalidatesTags: (_r, _e, { uid }) => [{ type: 'ConferenceRooms', id: `mods-${uid}` }],
    }),
    muteConferenceParticipant: build.mutation<void, { roomUid: number; ref: string }>({
      query: ({ roomUid, ref }) => ({
        url: `/conferences/${roomUid}/participants/${encodeURIComponent(ref)}/mute`,
        method: 'POST',
      }),
      async onQueryStarted({ roomUid, ref }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          conferenceRoomApi.util.updateQueryData('getConferenceRoom', roomUid, (draft) => {
            const row = draft.participants?.find((p) => p.ref === ref);
            if (row) row.muted = true;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          toast.error(i18n.t('conferences.live.muteFailed', 'Could not mute participant'));
        }
      },
    }),
    unmuteConferenceParticipant: build.mutation<void, { roomUid: number; ref: string }>({
      query: ({ roomUid, ref }) => ({
        url: `/conferences/${roomUid}/participants/${encodeURIComponent(ref)}/unmute`,
        method: 'POST',
      }),
      async onQueryStarted({ roomUid, ref }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          conferenceRoomApi.util.updateQueryData('getConferenceRoom', roomUid, (draft) => {
            const row = draft.participants?.find((p) => p.ref === ref);
            if (row) row.muted = false;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          toast.error(i18n.t('conferences.live.unmuteFailed', 'Could not unmute participant'));
        }
      },
    }),
    kickConferenceParticipant: build.mutation<void, { roomUid: number; ref: string }>({
      query: ({ roomUid, ref }) => ({
        url: `/conferences/${roomUid}/participants/${encodeURIComponent(ref)}/kick`,
        method: 'POST',
      }),
    }),
    setConferenceParticipantRole: build.mutation<
      void,
      { roomUid: number; ref: string; role: 'moderator' | null }
    >({
      query: ({ roomUid, ref, role }) => ({
        url: `/conferences/${roomUid}/participants/${encodeURIComponent(ref)}/role`,
        method: role ? 'POST' : 'DELETE',
        body: role ? { role } : undefined,
      }),
      async onQueryStarted({ roomUid, ref, role }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          conferenceRoomApi.util.updateQueryData('getConferenceRoom', roomUid, (draft) => {
            const row = draft.participants?.find((p) => p.ref === ref);
            if (row) row.role = role ?? 'participant';
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          toast.error(i18n.t('conferences.live.roleFailed', 'Could not change participant role'));
        }
      },
    }),
    setConferenceMeVideo: build.mutation<void, { roomUid: number; enabled: boolean }>({
      query: ({ roomUid, enabled }) => ({
        url: `/conferences/${roomUid}/me/video`,
        method: 'POST',
        body: { enabled },
      }),
    }),
    setConferenceMeDisplayName: build.mutation<void, { roomUid: number; displayName: string }>({
      query: ({ roomUid, displayName }) => ({
        url: `/conferences/${roomUid}/me/display-name`,
        method: 'POST',
        body: { displayName },
      }),
    }),
    inviteConference: build.mutation<void, { uid: number; data: ConferenceInviteInput }>({
      query: ({ uid, data }) => ({
        url: `/conferences/${uid}/invite`,
        method: 'POST',
        body: data,
      }),
    }),
    postConferenceTelemetry: build.mutation<
      void,
      { uid: number; body: ConferenceTelemetryBody }
    >({
      query: ({ uid, body }) => ({
        url: `/conferences/${uid}/telemetry`,
        method: 'POST',
        body: allowListedTelemetry(body),
      }),
    }),
    getConferenceGuestTokens: build.query<ConferenceGuestLink[], number>({
      query: (uid) => `/conferences/${uid}/guest-tokens`,
      providesTags: (_r, _e, uid) => [{ type: 'ConferenceLinks', id: uid }],
    }),
    createConferenceGuestToken: build.mutation<
      ConferenceGuestLink,
      { uid: number; kind: 'shared_link' | 'named_invite'; inviteName?: string; ttlSec?: number }
    >({
      query: ({ uid, ...body }) => ({
        url: `/conferences/${uid}/guest-tokens`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { uid }) => [{ type: 'ConferenceLinks', id: uid }],
    }),
    revokeConferenceGuestToken: build.mutation<void, { uid: number; tokenUid: number }>({
      query: ({ uid, tokenUid }) => ({
        url: `/conferences/${uid}/guest-tokens/${tokenUid}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { uid }) => [{ type: 'ConferenceLinks', id: uid }],
    }),
    guestGet: build.query<ConferenceGuestMeta, string>({
      query: (token) => guestGetUrl(token),
    }),
    guestJoin: build.mutation<
      ConferenceGuestJoinResult,
      { token: string; displayName?: string; pin?: string }
    >({
      query: ({ token, ...body }) => ({
        url: guestJoinUrl(token),
        method: 'POST',
        body,
      }),
    }),
    guestLeave: build.mutation<void, string>({
      query: (token) => ({
        url: guestLeaveUrl(token),
        method: 'POST',
      }),
    }),
    guestSetDisplayName: build.mutation<void, { token: string; displayName: string }>({
      query: ({ token, displayName }) => ({
        url: `${guestGetUrl(token)}/me/display-name`,
        method: 'POST',
        body: { displayName },
      }),
    }),
    guestPostTelemetry: build.mutation<void, { token: string; body: ConferenceTelemetryBody }>({
      query: ({ token, body }) => ({
        url: `${guestGetUrl(token)}/telemetry`,
        method: 'POST',
        body: allowListedTelemetry(body),
      }),
    }),
    guestWebrtcConfig: build.query<ConferenceWebrtcConfig, string>({
      query: (token) => `/conferences/guest/${encodeURIComponent(token)}/webrtc-config`,
      transformResponse: (raw: { wssUrl?: string | null; iceServers?: RTCIceServer[] }) =>
        pickGuestWebrtcConfig(raw),
    }),
  }),
});

export { conferenceRoomApi };

export const {
  useGetConferenceRoomsQuery,
  useGetConferenceRoomQuery,
  useCreateConferenceRoomMutation,
  useUpdateConferenceRoomMutation,
  useDeleteConferenceRoomMutation,
  useGetConferenceCapacityQuery,
  useGetConferenceModeratorsQuery,
  useSetConferenceModeratorsMutation,
  useMuteConferenceParticipantMutation,
  useUnmuteConferenceParticipantMutation,
  useKickConferenceParticipantMutation,
  useSetConferenceParticipantRoleMutation,
  useSetConferenceMeVideoMutation,
  useSetConferenceMeDisplayNameMutation,
  useInviteConferenceMutation,
  usePostConferenceTelemetryMutation,
  useGetConferenceGuestTokensQuery,
  useCreateConferenceGuestTokenMutation,
  useRevokeConferenceGuestTokenMutation,
  useGuestGetQuery,
  useGuestJoinMutation,
  useGuestLeaveMutation,
  useGuestSetDisplayNameMutation,
  useGuestPostTelemetryMutation,
  useGuestWebrtcConfigQuery,
} = conferenceRoomApi;
