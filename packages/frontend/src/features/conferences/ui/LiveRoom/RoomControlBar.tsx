import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Disc,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  PhoneOff,
  PhoneOutgoing,
  UserPlus,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useStartConferenceRecordingMutation,
  useStopConferenceRecordingMutation,
} from '@/shared/api/endpoints/conferenceMeetingsApi';
import type { ConferenceInviteScope, ConferenceRole } from '@/shared/api/endpoints/conferenceRoomApi';
import { InviteSheet, type InviteSheetMode } from './InviteSheet';
import styles from './RoomControlBar.module.scss';

export interface RoomControlBarProps {
  roomUid: number;
  role: ConferenceRole;
  inviteExternalScope?: ConferenceInviteScope;
  canRecord?: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isRecording: boolean;
  onMicToggle: () => void;
  onCamToggle: () => void;
  onLeave: () => void;
  onEnd?: () => void;
  onParticipantsToggle?: () => void;
  participantsOpen?: boolean;
  participantsPanelId?: string;
  /** When true, hide the Participants toggle (already in header / railToggle). */
  hideParticipantsToggle?: boolean;
}

const ICON_SIZE = 20;
const HIT: CSSProperties = { minWidth: 44, minHeight: 44 };

function canInviteExternal(role: ConferenceRole, scope?: ConferenceInviteScope): boolean {
  if (!scope) return false;
  if (scope === 'anyone') return true;
  if (scope === 'moderator') return role === 'owner' || role === 'moderator';
  return role === 'owner';
}

export function RoomControlBar({
  roomUid,
  role,
  inviteExternalScope,
  canRecord = false,
  isMuted,
  isCameraOff,
  isRecording,
  onMicToggle,
  onCamToggle,
  onLeave,
  onEnd,
  onParticipantsToggle,
  participantsOpen = false,
  participantsPanelId = 'conference-participants',
  hideParticipantsToggle = false,
}: RoomControlBarProps) {
  const { t } = useTranslation();
  const iconOnly = useIsMobile(768);
  const showParticipantsToggle = useIsMobile(1024) && !hideParticipantsToggle;
  const isHost = role === 'owner' || role === 'moderator';

  const [startRecording, startState] = useStartConferenceRecordingMutation();
  const [stopRecording, stopState] = useStopConferenceRecordingMutation();
  const recordPending = Boolean(startState.isLoading || stopState.isLoading);

  const [inviteMode, setInviteMode] = useState<InviteSheetMode | null>(null);
  const [endOpen, setEndOpen] = useState(false);

  const showInviteMember = isHost;
  const showInviteExternal = canInviteExternal(role, inviteExternalScope);
  const showRecord = isHost && canRecord;
  const showEnd = isHost && Boolean(onEnd);

  const renderButton = (
    key: string,
    icon: ReactNode,
    label: string,
    onClick: () => void,
    opts?: {
      variant?: 'outline' | 'destructive' | 'ghost';
      disabled?: boolean;
      className?: string;
      expanded?: boolean;
      controls?: string;
      pending?: boolean;
    },
  ) => (
    <Button
      key={key}
      type="button"
      variant={opts?.variant ?? 'outline'}
      size={iconOnly ? 'icon' : 'sm'}
      className={`${styles.controlBtn}${opts?.className ? ` ${opts.className}` : ''}`}
      style={HIT}
      onClick={onClick}
      disabled={opts?.disabled}
      title={label}
      aria-label={label}
      aria-expanded={opts?.expanded}
      aria-controls={opts?.controls}
      data-pending={opts?.pending || undefined}
    >
      {icon}
      {!iconOnly ? <span className={styles.controlLabel}>{label}</span> : null}
    </Button>
  );

  const handleRecord = () => {
    if (recordPending) return;
    if (isRecording) {
      void stopRecording(roomUid);
      return;
    }
    void startRecording(roomUid);
  };

  return (
    <div
      className={styles.bar}
      role="group"
      aria-label={t('conferences.live.controls', 'Управление конференцией')}
      data-testid="room-control-bar"
    >
      <div className={styles.zone}>
        {renderButton(
          'mic',
          isMuted ? <MicOff size={ICON_SIZE} className={styles.icon} /> : <Mic size={ICON_SIZE} className={styles.icon} />,
          isMuted
            ? t('conferences.live.micUnmute', 'Включить микрофон')
            : t('conferences.live.micMute', 'Выключить микрофон'),
          onMicToggle,
        )}
        {renderButton(
          'cam',
          isCameraOff
            ? <VideoOff size={ICON_SIZE} className={styles.icon} />
            : <Video size={ICON_SIZE} className={styles.icon} />,
          isCameraOff
            ? t('conferences.live.camOn', 'Включить камеру')
            : t('conferences.live.camDisable', 'Выключить камеру'),
          onCamToggle,
        )}
      </div>

      <div className={styles.zoneCenter}>
        {showInviteMember
          ? renderButton(
            'inviteMember',
            <UserPlus size={ICON_SIZE} className={styles.icon} />,
            t('conferences.live.inviteMember', 'Пригласить абонента'),
            () => setInviteMode('member'),
          )
          : null}
        {showInviteExternal
          ? renderButton(
            'inviteExternal',
            <PhoneOutgoing size={ICON_SIZE} className={styles.icon} />,
            t('conferences.live.inviteExternal', 'Пригласить внешний номер'),
            () => setInviteMode('external'),
          )
          : null}
        {showRecord
          ? renderButton(
            'record',
            recordPending
              ? <Loader2 size={ICON_SIZE} className={styles.icon} data-pending />
              : <Disc size={ICON_SIZE} className={styles.icon} />,
            isRecording
              ? t('conferences.live.recordStop', 'Остановить запись')
              : t('conferences.live.recordStart', 'Начать запись'),
            handleRecord,
            {
              variant: isRecording ? 'destructive' : 'outline',
              disabled: recordPending,
              pending: recordPending,
            },
          )
          : null}
        {showParticipantsToggle
          ? renderButton(
            'participants',
            <Users size={ICON_SIZE} className={styles.icon} />,
            t('conferences.live.participants', 'Участники'),
            () => onParticipantsToggle?.(),
            {
              variant: 'ghost',
              expanded: participantsOpen,
              controls: participantsPanelId,
            },
          )
          : null}
      </div>

      <div className={styles.zoneEnd}>
        {renderButton(
          'leave',
          <LogOut size={ICON_SIZE} className={styles.icon} />,
          t('conferences.live.leave', 'Выйти из конференции'),
          onLeave,
          { variant: 'outline', className: styles.leaveBtn },
        )}
        {showEnd
          ? renderButton(
            'end',
            <PhoneOff size={ICON_SIZE} className={styles.icon} />,
            t('conferences.live.end', 'Завершить конференцию'),
            () => setEndOpen(true),
            { variant: 'destructive' },
          )
          : null}
      </div>

      <InviteSheet
        open={inviteMode !== null}
        mode={inviteMode ?? 'member'}
        roomUid={roomUid}
        onOpenChange={(next) => {
          if (!next) setInviteMode(null);
        }}
      />

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('conferences.live.confirmEnd', 'Завершить конференцию для всех?')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'conferences.live.confirmEndBody',
                'Все участники будут отключены. Запись, если она идёт, остановится и сохранится.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEndOpen(false)}>
              {t('conferences.live.confirmEndKeep', 'Продолжить встречу')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setEndOpen(false);
                onEnd?.();
              }}
            >
              {t('conferences.live.confirmEndConfirm', 'Завершить конференцию')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
