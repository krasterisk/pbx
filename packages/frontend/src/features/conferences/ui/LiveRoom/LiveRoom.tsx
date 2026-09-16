import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui/Text/Text';
import { VStack } from '@/shared/ui/Stack';
import { VideoGrid } from './VideoGrid';
import cls from './LiveRoom.module.scss';

export type ConferenceRole = 'owner' | 'moderator' | 'participant';

export interface LiveRoomParticipant {
  ref: string;
  displayName: string;
  role: ConferenceRole;
  speaking: boolean;
  muted: boolean;
  video: boolean;
}

export interface LiveRoomProps {
  participants: LiveRoomParticipant[];
  remoteTracks: Record<string, MediaStreamTrack>;
  mixedRemoteAudio?: MediaStream;
  toolbar?: ReactNode;
}

export function LiveRoom({
  participants,
  remoteTracks,
  mixedRemoteAudio,
  toolbar,
}: LiveRoomProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return undefined;
    node.srcObject = mixedRemoteAudio ?? null;
    return () => {
      node.srcObject = null;
    };
  }, [mixedRemoteAudio]);

  const empty = participants.length === 0;

  return (
    <VStack max gap="8" className={cls.root}>
      {empty ? (
        <VStack align="center" justify="center" gap="8" className={cls.empty}>
          <Text>
            {t('conferences.live.emptyRoom', 'В комнате пока никого нет')}
          </Text>
          <Text variant="muted">
            {t(
              'conferences.live.emptyRoomHint',
              'Позовите участников по короткому номеру или отправьте ссылку приглашения.',
            )}
          </Text>
        </VStack>
      ) : (
        <VideoGrid participants={participants} remoteTracks={remoteTracks} />
      )}
      {toolbar}
      {mixedRemoteAudio ? (
        <audio ref={audioRef} autoPlay aria-hidden hidden />
      ) : null}
    </VStack>
  );
}
