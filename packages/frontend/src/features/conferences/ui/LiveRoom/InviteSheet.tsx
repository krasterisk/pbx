import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui';
import { useInviteConferenceMutation } from '@/shared/api/endpoints/conferenceRoomApi';

export type InviteSheetMode = 'member' | 'external';

export interface InviteSheetProps {
  open: boolean;
  mode: InviteSheetMode;
  roomUid: number;
  onOpenChange: (open: boolean) => void;
}

function inviteErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err && 'status' in err) {
    const status = (err as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

export function InviteSheet({ open, mode, roomUid, onOpenChange }: InviteSheetProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState('');
  const [invite, { isPending }] = useInviteConferenceMutation();

  const title = mode === 'external'
    ? t('conferences.live.inviteExternal', 'Пригласить внешний номер')
    : t('conferences.live.inviteMember', 'Пригласить абонента');

  const handleSubmit = async () => {
    const value = target.trim();
    if (!value) return;
    try {
      await invite({
        uid: roomUid,
        data: { kind: mode === 'external' ? 'external' : 'internal', target: value },
      }).unwrap();
      toast.success(t('conferences.live.inviteSent', 'Звоним участнику'));
      setTarget('');
      onOpenChange(false);
    } catch (err) {
      if (inviteErrorStatus(err) === 403) {
        toast.error(
          t(
            'conferences.live.inviteExternalForbidden',
            'У вас нет права приглашать внешние номера в этой комнате.',
          ),
        );
        return;
      }
      toast.error(
        t(
          'conferences.live.inviteFailed',
          'Не удалось дозвониться. Проверьте номер и попробуйте снова.',
        ),
      );
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setTarget('');
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'external'
              ? t('conferences.live.inviteExternalHint', 'Исходящий вызов оплачивается по вашему тарифу.')
              : title}
          </SheetDescription>
        </SheetHeader>
        <Input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          aria-label={title}
        />
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isPending || !target.trim()}
          aria-label={title}
        >
          {title}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
