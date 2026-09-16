import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Badge, Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useSetConferenceMeVideoMutation } from '@/shared/api/endpoints/conferenceRoomApi';
import type { ConferenceInviteScope } from '@/shared/api/endpoints/conferenceRoomApi';
import type { ConferenceRoomError, UseConferenceRoomResult } from '@/features/conferences/lib/useConferenceRoom';
import { ParticipantList } from './ParticipantList';
import { RoomControlBar } from './RoomControlBar';
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
  roomName?: string;
  roomNumber?: string;
  recording?: boolean;
  waitingForModerator?: boolean;
  startedAt?: string | null;
  status?: UseConferenceRoomResult['status'];
  error?: ConferenceRoomError | null;
  weakLink?: boolean;
  disconnected?: boolean;
  reconnecting?: boolean;
  adminJoinNotice?: boolean;
  canRecord?: boolean;
  inviteExternalScope?: ConferenceInviteScope;
  isMuted?: boolean;
  isCameraOff?: boolean;
  videoFailedMids?: string[];
  onJoin?: () => void;
  onLeave?: () => void;
  onEnd?: () => void;
  onMicToggle?: () => void;
  onCamToggle?: () => void;
}

const PARTICIPANTS_PANEL_ID = 'conference-participants';

function formatElapsed(startedAt?: string | null): string {
  if (!startedAt) return '00:00';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function LiveRoom({
  participants,
  remoteTracks,
  mixedRemoteAudio,
  toolbar,
  roomUid,
  selfRole = 'participant',
  participantsLoading = false,
  roomName,
  roomNumber,
  recording = false,
  waitingForModerator = false,
  startedAt,
  status = 'idle',
  error = null,
  weakLink = false,
  disconnected = false,
  reconnecting = false,
  adminJoinNotice = false,
  canRecord = false,
  inviteExternalScope,
  isMuted: mutedProp,
  isCameraOff: camProp,
  onJoin,
  onLeave,
  onEnd,
  onMicToggle,
  onCamToggle,
}: LiveRoomProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sheetMode = useIsMobile(1024);
  const tabletUsers = useIsMobile(1024) && !useIsMobile(768);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [muted, setMuted] = useState(Boolean(mutedProp));
  const [cameraOff, setCameraOff] = useState(Boolean(camProp));
  const [setMeVideo] = useSetConferenceMeVideoMutation();
  const [, setTick] = useState(0);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return undefined;
    node.srcObject = mixedRemoteAudio ?? null;
    return () => {
      node.srcObject = null;
    };
  }, [mixedRemoteAudio]);

  useEffect(() => {
    if (!startedAt) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const empty = participants.length === 0;
  const showRail = typeof roomUid === 'number';
  const participantsLabel = t('conferences.live.participants', 'Участники');
  const noCompanion = error === 'noWebrtcCompanion';
  const showJoin = Boolean(onJoin) && status !== 'in-call' && !noCompanion;
  const showHeader = Boolean(roomName || roomNumber || recording || startedAt);
  const timerLabel = formatElapsed(startedAt);

  const handleMic = () => {
    setMuted((v) => !v);
    onMicToggle?.();
  };
  const handleCam = () => {
    const next = !cameraOff;
    setCameraOff(next);
    onCamToggle?.();
    if (typeof roomUid === 'number') {
      void setMeVideo({ roomUid, enabled: !next });
    }
  };

  return (
    <VStack max gap="8" className={cls.root}>
      {showHeader ? (
        <HStack
          justify="between"
          align="center"
          className={cls.header}
          style={{ height: 56 }}
          data-testid="live-room-header"
          max
        >
          <HStack gap="12" align="center">
            {roomName ? <Text className={cls.headerName}>{roomName}</Text> : null}
            {roomNumber ? <Text className={cls.headerNumber}>{roomNumber}</Text> : null}
            <Text className={cls.timer} aria-label={timerLabel}>{timerLabel}</Text>
            {recording ? (
              <Badge variant="destructive">{t('conferences.live.recording', 'Идёт запись')}</Badge>
            ) : null}
            <Text>
              {t('conferences.live.participantsCount', {
                count: participants.length,
                defaultValue: `Участников: ${participants.length}`,
              })}
            </Text>
          </HStack>
          {tabletUsers ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
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
        </HStack>
      ) : null}

      <Flex className={cls.body} align="stretch" max>
        <VStack className={cls.stage} max data-testid="live-room-stage">
          {empty ? (
            <VStack align="center" justify="center" gap="8" className={cls.empty}>
              <Text>{t('conferences.live.emptyRoom', 'В комнате пока никого нет')}</Text>
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
          {reconnecting ? (
            <div className={cls.banner} data-banner="reconnecting" aria-live="polite">
              <Text>{t('conferences.live.reconnecting', 'Переподключаемся')}</Text>
            </div>
          ) : null}
          {weakLink ? (
            <div className={cls.banner} data-banner="weakLink" aria-live="polite">
              <Text>{t('conferences.live.weakLink', 'Слабое соединение, качество видео снижено')}</Text>
            </div>
          ) : null}
          {disconnected ? (
            <div className={cls.banner} data-banner="disconnected" aria-live="assertive">
              <Text>{t('conferences.live.disconnected', 'Связь с комнатой прервана')}</Text>
            </div>
          ) : null}
          {waitingForModerator ? (
            <div className={cls.banner} data-banner="waitingHost" aria-live="polite">
              <Text>{t('conferences.live.waitingHost', 'Ждём организатора')}</Text>
            </div>
          ) : null}
          {adminJoinNotice ? (
            <div className={cls.banner} data-banner="adminJoinNotice" aria-live="polite">
              <Text>
                {t(
                  'conferences.live.adminJoinNotice',
                  'Вход администратора в эту встречу записывается в журнал событий.',
                )}
              </Text>
            </div>
          ) : null}
          {noCompanion ? (
            <div className={cls.banner} data-banner="noWebrtcCompanion" aria-live="polite">
              <Text>
                {t(
                  'conferences.live.noWebrtcCompanion',
                  'У вашей учётной записи нет WebRTC-абонента. Обратитесь к администратору, чтобы войти в конференцию из браузера.',
                )}
              </Text>
            </div>
          ) : null}
          {showJoin ? (
            <div className={cls.joinWrap}>
              <Button type="button" onClick={onJoin}>
                {t('conferences.live.join', 'Войти в конференцию')}
              </Button>
            </div>
          ) : null}
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

      {showRail && sheetMode && !tabletUsers ? (
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

      {typeof roomUid === 'number' ? (
        <RoomControlBar
          roomUid={roomUid}
          role={selfRole}
          inviteExternalScope={inviteExternalScope}
          canRecord={canRecord}
          isMuted={muted}
          isCameraOff={cameraOff}
          isRecording={recording}
          onMicToggle={handleMic}
          onCamToggle={handleCam}
          onLeave={onLeave ?? (() => undefined)}
          onEnd={onEnd}
          onParticipantsToggle={() => setParticipantsOpen((open) => !open)}
          participantsOpen={participantsOpen}
          participantsPanelId={PARTICIPANTS_PANEL_ID}
        />
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

      <audio ref={audioRef} autoPlay aria-hidden hidden />
    </VStack>
  );
}
