import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { enterSession, leaveSession } from '@/features/conferences/model/slice/conferenceSessionSlice';
import { useConferenceRoom, type UseConferenceRoomResult } from '@/features/conferences/lib/useConferenceRoom';
import {
  restoreLiveSoftphone,
  unregisterLiveSoftphone,
} from '@/features/callcenter/lib/softphoneParkBridge';
import { loadActiveShift } from '@/features/callcenter/lib/shiftSession';
import { useGetWebrtcConfigQuery } from '@/shared/api/endpoints/callCenterApi';
import { useGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import type { ConferenceRole } from '@/shared/api/endpoints/conferenceRoomApi';

export interface ConferenceStartMediaArgs {
  roomUid: number;
  roomNumber: string;
  name?: string;
  role: ConferenceRole;
  sipId?: string | null;
}

export interface ConferenceSessionHost {
  startMedia: (args: ConferenceStartMediaArgs) => void;
  hangup: () => Promise<void>;
  room: UseConferenceRoomResult;
  sipId: string | null;
  weakLink: boolean;
}

const ConferenceSessionHostContext = createContext<ConferenceSessionHost | null>(null);

export function useConferenceSessionHost(): ConferenceSessionHost {
  const host = useContext(ConferenceSessionHostContext);
  if (!host) {
    throw new Error('useConferenceSessionHost must be used within ConferenceSessionProvider');
  }
  return host;
}

export function ConferenceSessionProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { data: rtc } = useGetWebrtcConfigQuery();
  const shift = loadActiveShift();
  const { data: creds } = useGetEndpointCredentialsQuery(shift?.sipId ?? '', { skip: !shift?.sipId });
  const sip = creds?.webrtc ?? creds;
  const [media, setMedia] = useState<ConferenceStartMediaArgs | null>(null);
  const [weakLink, setWeakLink] = useState(false);
  const active = Boolean(media && sip?.password && sip?.domain && rtc?.wssUrl);

  const room = useConferenceRoom({
    roomUid: media?.roomUid ?? 0,
    roomNumber: media?.roomNumber ?? '',
    sipId: active ? sip?.username || sip?.sipId : null,
    sipPassword: active ? sip?.password : null,
    sipDomain: active ? sip?.domain : null,
    wssUrl: rtc?.wssUrl,
    iceServers: rtc?.iceServers,
    displayName: media?.name,
    liveSoftphoneAor: shift?.sipId,
    unregisterSoftphone: unregisterLiveSoftphone,
    restoreSoftphone: restoreLiveSoftphone,
    onTelemetry: (body) => setWeakLink(
      body.qualityLimitationReason === 'cpu' || body.qualityLimitationReason === 'bandwidth',
    ),
  });

  const startMedia = useCallback((args: ConferenceStartMediaArgs) => {
    setMedia(args);
    dispatch(enterSession({
      roomUid: args.roomUid,
      number: args.roomNumber,
      name: args.name,
      role: args.role,
      sipId: args.sipId,
    }));
  }, [dispatch]);

  const hangup = useCallback(async () => {
    await room.leave();
    dispatch(leaveSession());
    setMedia(null);
    setWeakLink(false);
  }, [dispatch, room.leave]);

  const value = useMemo<ConferenceSessionHost>(() => ({
    startMedia,
    hangup,
    room,
    sipId: sip?.sipId ?? shift?.sipId ?? null,
    weakLink,
  }), [hangup, room, sip?.sipId, shift?.sipId, startMedia, weakLink]);

  return (
    <ConferenceSessionHostContext.Provider value={value}>
      {children}
    </ConferenceSessionHostContext.Provider>
  );
}
