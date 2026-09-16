import { useTranslation } from 'react-i18next';
import {
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Text,
} from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import type { ConferenceRole, LiveRoomParticipant } from './LiveRoom';
import { ParticipantRow } from './ParticipantRow';
import cls from './ParticipantList.module.scss';

export interface ParticipantListProps {
  roomUid: number;
  participants: LiveRoomParticipant[];
  selfRole: ConferenceRole;
  loading?: boolean;
  variant: 'column' | 'sheet';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  panelId?: string;
}

function ListBody({
  roomUid,
  participants,
  selfRole,
  loading,
}: Pick<ParticipantListProps, 'roomUid' | 'participants' | 'selfRole' | 'loading'>) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <VStack gap="8">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className={cls.skeletonRow} height={44} />
        ))}
      </VStack>
    );
  }

  if (participants.length === 0) {
    return (
      <VStack align="center" gap="8" className={cls.empty}>
        <Text>{t('conferences.live.emptyRoom', 'В комнате пока никого нет')}</Text>
        <Text variant="muted">
          {t(
            'conferences.live.emptyRoomHint',
            'Позовите участников по короткому номеру или отправьте ссылку приглашения.',
          )}
        </Text>
      </VStack>
    );
  }

  return (
    <>
      {participants.map((row) => (
        <ParticipantRow key={row.ref} roomUid={roomUid} participant={row} selfRole={selfRole} />
      ))}
    </>
  );
}

export function ParticipantList({
  roomUid,
  participants,
  selfRole,
  loading = false,
  variant,
  open = false,
  onOpenChange,
  panelId = 'conference-participants',
}: ParticipantListProps) {
  const { t } = useTranslation();
  const countLabel = t('conferences.live.participantsCount', {
    count: participants.length,
    defaultValue: `Участников: ${participants.length}`,
  });
  const title = t('conferences.live.participants', 'Участники');

  const body = (
    <>
      <div className={cls.header}>
        <Text>{countLabel}</Text>
      </div>
      <ScrollArea className={cls.scroll}>
        <ListBody
          roomUid={roomUid}
          participants={participants}
          selfRole={selfRole}
          loading={loading}
        />
      </ScrollArea>
    </>
  );

  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent id={panelId}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{countLabel}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cls.column}
      style={{ width: 320 }}
      data-testid="participant-list"
      id={panelId}
    >
      {body}
    </aside>
  );
}
