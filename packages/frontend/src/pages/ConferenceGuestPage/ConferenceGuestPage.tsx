import { memo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { LiveRoom } from '@/features/conferences/ui/LiveRoom';
import { ConferencePreJoinCard } from '@/features/conferences/ui/ConferencePreJoinCard';
import { ConferenceGuestShell } from '@/widgets/ConferenceGuestShell';
import { useConferenceRoom } from '@/features/conferences/lib/useConferenceRoom';
import { useConferenceSse } from '@/features/conferences/lib/useConferenceSse';
import {
  useGuestGetQuery, useGuestJoinMutation, useGuestLeaveMutation, useGuestWebrtcConfigQuery,
  useGuestPostTelemetryMutation, type ConferenceGuestJoinResult,
} from '@/shared/api/endpoints/conferenceRoomApi';
import cls from './ConferenceGuestPage.module.scss';

export const ConferenceGuestPage = memo(() => {
  const { t } = useTranslation();
  const token = useParams<{ token: string }>().token ?? '';
  const { data: meta, error: metaError } = useGuestGetQuery(token, { skip: !token });
  const { data: rtc } = useGuestWebrtcConfigQuery(token, { skip: !token });
  const [guestJoin, joinState] = useGuestJoinMutation();
  const [guestLeave] = useGuestLeaveMutation();
  const [guestPostTelemetry] = useGuestPostTelemetryMutation();
  const [creds, setCreds] = useState<ConferenceGuestJoinResult | null>(null);
  const [left, setLeft] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const ready = Boolean(creds?.sipId && creds.password && creds.sipDomain && rtc?.wssUrl);
  const room = useConferenceRoom({
    roomUid: creds?.roomUid ?? 0, roomNumber: '', displayName,
    sipId: ready ? creds?.sipId : null, sipPassword: ready ? creds?.password : null,
    sipDomain: ready ? creds?.sipDomain : null, wssUrl: rtc?.wssUrl, iceServers: rtc?.iceServers,
    onTelemetry: (body) => { if (token) void guestPostTelemetry({ token, body }); },
  });
  useConferenceSse({ mode: 'guest', roomUid: creds?.roomUid ?? 0, token });
  const lobby = Boolean(creds) && meta?.entry_strictness === 'token_name_pin_moderator' && room.status !== 'in-call';
  const hangup = () => { setLeft(true); setCreds(null); void room.leave(); if (token) void guestLeave(token); };
  return (
    <ConferenceGuestShell roomName={meta?.name ?? ''}>
      <VStack className={cls.page} data-testid="conference-guest-page" max>
        {left ? (
          <>
            <Text variant="h4">{t('conferences.guest.left', 'Вы вышли из конференции')}</Text>
            <Text variant="muted">{t('conferences.guest.leftHint', 'Страницу можно закрыть. Чтобы вернуться, откройте ссылку приглашения снова.')}</Text>
          </>
        ) : creds && !lobby ? (
          <LiveRoom
            roomUid={creds.roomUid} roomName={meta?.name ?? ''} participants={meta?.participants ?? []}
            remoteTracks={room.remoteTracks} videoFailedMids={room.videoFailedMids}
            selfRole="participant" status={room.status} error={room.error} onLeave={hangup}
          />
        ) : (
          <ConferencePreJoinCard
            requiresPin={meta?.requiresPin} joining={joinState.isLoading} waitingForModerator={lobby}
            error={metaError ?? joinState.error}
            onJoin={({ displayName: name, pin }) => {
              setDisplayName(name);
              void guestJoin({ token, displayName: name, pin }).unwrap().then(setCreds);
            }}
            onLeave={hangup}
          />
        )}
      </VStack>
    </ConferenceGuestShell>
  );
});
ConferenceGuestPage.displayName = 'ConferenceGuestPage';
