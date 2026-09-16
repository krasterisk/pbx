import { useEffect, useRef } from 'react';

import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  conferenceRoomApi,
  guestEventsUrl,
  staffEventsUrl,
  type ConferenceParticipant,
} from '@/shared/api/endpoints/conferenceRoomApi';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const ROOM_EVENT_TYPES = [
  'fullSnapshot',
  'participantJoin',
  'participantLeave',
  'participantTalking',
  'participantMute',
  'participantUnmute',
  'participantVideo',
  'participantDisplayName',
  'roleGrant',
  'roleRevoke',
  'recording',
] as const;

export type UseConferenceSseArgs =
  | { mode: 'staff'; roomUid: number; token?: string }
  | { mode: 'guest'; roomUid: number; token: string };

type RoomSnapshotPatch = {
  participants?: ConferenceParticipant[];
  waitingForModerator?: boolean;
  recording?: boolean;
};

/**
 * Native EventSource for the live room. JWT / guest token goes in the query
 * (EventSource cannot set headers). Patches the same getConferenceRoom cache
 * entry that GET provides — no parallel in-memory participant list.
 */
export function useConferenceSse(args: UseConferenceSseArgs): void {
  const dispatch = useAppDispatch();
  const esRef = useRef<EventSource | null>(null);
  const roomUid = args.roomUid;
  const mode = args.mode;
  const explicitToken = args.token;

  useEffect(() => {
    const token =
      mode === 'guest' ? explicitToken : (explicitToken ?? localStorage.getItem('accessToken'));
    if (!token) return;

    const path =
      mode === 'guest' ? guestEventsUrl(explicitToken as string, token) : staffEventsUrl(roomUid, token);
    const es = new EventSource(`${API_BASE}${path}`);
    esRef.current = es;

    const patchRoom = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as RoomSnapshotPatch;
        if (!data || !Array.isArray(data.participants)) return;
        dispatch(
          conferenceRoomApi.util.updateQueryData('getConferenceRoom', roomUid, (draft) => {
            draft.participants = data.participants;
            if (data.waitingForModerator !== undefined) {
              draft.waitingForModerator = data.waitingForModerator;
            }
            if (data.recording !== undefined) {
              draft.recording = data.recording;
            }
          }),
        );
      } catch {
        /* ignore parse / missing cache */
      }
    };

    for (const type of ROOM_EVENT_TYPES) {
      es.addEventListener(type, patchRoom);
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [dispatch, explicitToken, mode, roomUid]);
}
