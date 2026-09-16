import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MicOff, VideoOff } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Text,
} from '@/shared/ui';
import { roleLabel } from '@/entities/conference/roleLabel';
import {
  useKickConferenceParticipantMutation,
  useMuteConferenceParticipantMutation,
  useSetConferenceParticipantRoleMutation,
  useUnmuteConferenceParticipantMutation,
} from '@/shared/api/endpoints/conferenceRoomApi';
import type { ConferenceRole } from './LiveRoom';
import type { LiveRoomParticipant } from './LiveRoom';
import cls from './ParticipantList.module.scss';

export interface ParticipantRowProps {
  roomUid: number;
  participant: LiveRoomParticipant;
  selfRole: ConferenceRole;
}

const canModerate = (role: ConferenceRole) => role === 'owner' || role === 'moderator';

export function ParticipantRow({ roomUid, participant, selfRole }: ParticipantRowProps) {
  const { t } = useTranslation();
  const [kickOpen, setKickOpen] = useState(false);
  const [mute] = useMuteConferenceParticipantMutation();
  const [unmute] = useUnmuteConferenceParticipantMutation();
  const [kick] = useKickConferenceParticipantMutation();
  const [setRole] = useSetConferenceParticipantRoleMutation();
  const moderate = canModerate(selfRole);
  const label = roleLabel(participant.role, (key) => {
    const fallbacks: Record<string, string> = {
      'conferences.live.roleOwner': 'Организатор',
      'conferences.live.roleModerator': 'Модератор',
      'conferences.live.roleMember': 'Участник',
    };
    return t(key, fallbacks[key] || key);
  });

  const body = (
    <>
      <Text as="span" className={cls.name}>
        {participant.displayName}
      </Text>
      <span className={cls.indicators}>
        {participant.muted ? <MicOff size={16} className={cls.icon} aria-label={t('conferences.live.micOff', 'Микрофон выключен')} /> : null}
        {participant.video ? null : <VideoOff size={16} className={cls.icon} aria-label={t('conferences.live.camOff', 'Камера выключена')} />}
        {label ? <Badge variant="outline">{label}</Badge> : null}
      </span>
    </>
  );

  return (
    <div
      className={participant.speaking ? cls.speaking : undefined}
      data-testid={`participant-row-${participant.ref}`}
    >
      {moderate ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cls.row} aria-label={participant.displayName}>
              {body}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                if (participant.muted) {
                  void unmute({ roomUid, ref: participant.ref });
                  return;
                }
                void mute({ roomUid, ref: participant.ref });
              }}
            >
              {participant.muted
                ? t('conferences.live.unmuteMember', 'Разрешить говорить')
                : t('conferences.live.muteMember', 'Заглушить участника')}
            </DropdownMenuItem>
            {participant.role === 'participant' ? (
              <DropdownMenuItem
                onClick={() => {
                  void setRole({ roomUid, ref: participant.ref, role: 'moderator' });
                }}
              >
                {t('conferences.live.promote', 'Сделать модератором')}
              </DropdownMenuItem>
            ) : participant.role === 'moderator' ? (
              <DropdownMenuItem
                onClick={() => {
                  void setRole({ roomUid, ref: participant.ref, role: null });
                }}
              >
                {t('conferences.live.demote', 'Снять права модератора')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => setKickOpen(true)}>
              {t('conferences.live.kick', 'Исключить участника')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className={cls.row}>{body}</div>
      )}

      <Dialog open={kickOpen} onOpenChange={setKickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('conferences.live.confirmKick', {
                name: participant.displayName,
                defaultValue: `Исключить "${participant.displayName}" из конференции?`,
              })}
            </DialogTitle>
            <DialogDescription>
              {t(
                'conferences.live.confirmKickBody',
                'Участник отключится сразу. Он сможет войти снова, если у него есть действующая ссылка или доступ по номеру.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setKickOpen(false)}>
              {t('conferences.live.confirmKickKeep', 'Оставить участника')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void kick({ roomUid, ref: participant.ref });
                setKickOpen(false);
              }}
            >
              {t('conferences.live.confirmKickConfirm', 'Исключить участника')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
