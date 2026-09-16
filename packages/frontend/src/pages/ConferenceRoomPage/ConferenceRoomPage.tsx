import { memo, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LiveRoom } from '@/features/conferences/ui/LiveRoom';
import { useConferenceRoom } from '@/features/conferences/lib/useConferenceRoom';
import { useConferenceSse } from '@/features/conferences/lib/useConferenceSse';
import { enterSession, leaveSession } from '@/features/conferences/model/slice/conferenceSessionSlice';
import { useGetConferenceRoomQuery } from '@/shared/api/endpoints/conferenceRoomApi';
import { useGetWebrtcConfigQuery } from '@/shared/api/endpoints/callCenterApi';
import { useGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';
import { loadActiveShift } from '@/features/callcenter/lib/shiftSession';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { selectCurrentUser } from '@/entities/User';
import cls from './ConferenceRoomPage.module.scss';

export const ConferenceRoomPage = memo(() => {
  const { t } = useTranslation();
  const roomUid = Number(useParams<{ uid: string }>().uid);
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const { data: room, error } = useGetConferenceRoomQuery(roomUid, { skip: !roomUid });
  const { data: rtc } = useGetWebrtcConfigQuery();
  const shift = loadActiveShift();
  const { data: creds } = useGetEndpointCredentialsQuery(shift?.sipId ?? '', { skip: !shift?.sipId });
  const sip = creds?.webrtc ?? creds;
  const [joined, setJoined] = useState(false);
  const [weakLink, setWeakLink] = useState(false);
  const media = Boolean(joined && sip?.password && sip?.domain && rtc?.wssUrl);
  const roomHook = useConferenceRoom({
    roomUid, roomNumber: room?.number ?? '',
    sipId: media ? sip?.username || sip?.sipId : null,
    sipPassword: media ? sip?.password : null,
    sipDomain: media ? sip?.domain : null,
    wssUrl: rtc?.wssUrl, iceServers: rtc?.iceServers, liveSoftphoneAor: shift?.sipId,
    onTelemetry: (b) => setWeakLink(b.qualityLimitationReason === 'cpu' || b.qualityLimitationReason === 'bandwidth'),
  });
  useConferenceSse({ mode: 'staff', roomUid });
  const role = room?.created_by === user?.uniqueid ? 'owner' as const : 'participant' as const;
  useEffect(() => {
    if (roomHook.status === 'in-call' && room) {
      dispatch(enterSession({ roomUid, number: room.number, name: room.name, role, sipId: sip?.sipId }));
    }
    if (error && typeof error === 'object' && 'status' in error && Number((error as { status: number }).status) === 409) {
      toast.error(t('conferences.live.full', 'В комнате нет свободных мест'));
    }
  }, [dispatch, error, role, room, roomHook.status, roomUid, sip?.sipId, t]);
  useEffect(() => () => { dispatch(leaveSession()); void roomHook.leave(); }, [dispatch, roomHook.leave]);
  return (
    <div className={cls.page} data-testid="conference-room-page">
      <LiveRoom
        roomUid={roomUid} roomName={room?.name ?? ''} roomNumber={room?.number ?? ''}
        participants={room?.participants ?? []} remoteTracks={roomHook.remoteTracks} selfRole={role}
        recording={Boolean(room?.recording)} waitingForModerator={room?.waitingForModerator}
        inviteExternalScope={room?.invite_external_scope}
        canRecord={room?.record_mode === 'button' || room?.record_mode === 'both' || room?.record_mode === 'auto'}
        status={roomHook.status} error={roomHook.error} weakLink={weakLink}
        reconnecting={roomHook.status === 'connecting'}
        disconnected={roomHook.status === 'error' && roomHook.error !== 'noWebrtcCompanion'}
        adminJoinNotice={Boolean(room && user && room.created_by != null && room.created_by !== user.uniqueid)}
        onJoin={() => setJoined(true)}
        onLeave={() => { setJoined(false); void roomHook.leave(); dispatch(leaveSession()); }}
        onEnd={() => { setJoined(false); void roomHook.leave(); dispatch(leaveSession()); }}
      />
    </div>
  );
});
ConferenceRoomPage.displayName = 'ConferenceRoomPage';
