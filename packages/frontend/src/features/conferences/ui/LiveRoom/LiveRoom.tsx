import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { ParticipantList } from './ParticipantList';
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
  roomUid?: number;
  selfRole?: ConferenceRole;
  participantsLoading?: boolean;
}

const PARTICIPANTS_PANEL_ID = 'conference-participants';

export function LiveRoom({
  participants,
  remoteTracks,
  mixedRemoteAudio,
  toolbar,
  roomUid,
  selfRole = 'participant',
  participantsLoading = false,
}: LiveRoomProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sheetMode = useIsMobile(1024);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return undefined;
    node.srcObject = mixedRemoteAudio ?? null;
    return () => {
      node.srcObject = null;
    };
  }, [mixedRemoteAudio]);

  const empty = participants.length === 0;
  const showRail = typeof roomUid === 'number';
  const participantsLabel = t('conferences.live.participants', 'Участники');

  return (
    <VStack max gap="8" className={cls.root}>
      <Flex className={cls.body} align="stretch" max>
        <VStack className={cls.stage} max>
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
        </VStack>
        {showRail && !sheetMode ? (
          <ParticipantList
            roomUid={roomUid}
            participants={participants}
            selfRole={selfRole}
            loading={participantsLoading}
            variant="column"
            panelId={PARTICIPANTS_PANEL_ID}
          />
        ) : null}
      </Flex>
      {showRail && sheetMode ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cls.railToggle}
          style={{ minWidth: 44, minHeight: 44 }}
          title={participantsLabel}
          aria-label={participantsLabel}
          aria-expanded={participantsOpen}
          aria-controls={PARTICIPANTS_PANEL_ID}
          onClick={() => setParticipantsOpen((open) => !open)}
        >
          <Users size={20} />
        </Button>
      ) : null}
      {toolbar}
      {showRail && sheetMode ? (
        <ParticipantList
          roomUid={roomUid}
          participants={participants}
          selfRole={selfRole}
          loading={participantsLoading}
          variant="sheet"
          open={participantsOpen}
          onOpenChange={setParticipantsOpen}
          panelId={PARTICIPANTS_PANEL_ID}
        />
      ) : null}
      {mixedRemoteAudio ? (
        <audio ref={audioRef} autoPlay aria-hidden hidden />
      ) : null}
    </VStack>
  );
}
