import { memo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LiveRoom } from '@/features/conferences/ui/LiveRoom';
import { useConferenceSessionHost } from '@/features/conferences/lib/ConferenceSessionProvider';
import { useConferenceSse } from '@/features/conferences/lib/useConferenceSse';
import { useGetConferenceRoomQuery } from '@/shared/api/endpoints/conferenceRoomApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectCurrentUser } from '@/entities/User';
import cls from './ConferenceRoomPage.module.scss';

export const ConferenceRoomPage = memo(() => {
  const { t } = useTranslation();
  const roomUid = Number(useParams<{ uid: string }>().uid);
  const user = useAppSelector(selectCurrentUser);
  const { data: room, error } = useGetConferenceRoomQuery(roomUid, { skip: !roomUid });
  const host = useConferenceSessionHost();
  useConferenceSse({ mode: 'staff', roomUid });
  const role = room?.created_by === user?.uniqueid ? 'owner' as const : 'participant' as const;
  const hadSession = useRef(false);
  if (host.room.status === 'in-call' || host.room.error === 'sessionDropped') {
    hadSession.current = true;
  }
  useEffect(() => {
    if (error && typeof error === 'object' && 'status' in error && Number((error as { status: number }).status) === 409) {
      toast.error(t('conferences.live.full', 'В комнате нет свободных мест'));
    }
  }, [error, t]);
  return (
    <div className={cls.page} data-testid="conference-room-page">
      <LiveRoom
        roomUid={roomUid} roomName={room?.name ?? ''} roomNumber={room?.number ?? ''}
        participants={room?.participants ?? []} remoteTracks={host.room.remoteTracks}
        localStream={host.room.localStream} selfName={user?.name}
        selfRole={role}
        startedAt={room?.startedAt}
        recording={Boolean(room?.recording)} waitingForModerator={room?.waitingForModerator}
        inviteExternalScope={room?.invite_external_scope}
        canRecord={room?.record_mode === 'button' || room?.record_mode === 'both' || room?.record_mode === 'auto'}
        status={host.room.status} error={host.room.error} weakLink={host.weakLink}
        reconnecting={host.room.status === 'connecting' && hadSession.current}
        disconnected={host.room.error === 'sessionDropped'}
        onReconnect={host.room.reconnect}
        adminJoinNotice={Boolean(room && user && room.created_by != null && room.created_by !== user.uniqueid)}
        videoFailedMids={host.room.videoFailedMids} onRetryVideo={host.room.retryVideo}
        onJoin={() => host.startMedia({ roomUid, roomNumber: room?.number ?? '', name: room?.name, role, sipId: host.sipId })}
        onLeave={() => { void host.hangup(); }}
        onEnd={() => { void host.hangup(); }}
      />
    </div>
  );
});
ConferenceRoomPage.displayName = 'ConferenceRoomPage';
