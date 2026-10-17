import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IAutodialCampaignContact } from '@krasterisk/shared';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useChangeAutodialContactTaskMutation, useCreateAutodialDncMutation } from '@/shared/api/endpoints/autodialApi';
import { autodialErrorKey } from '../../lib/mutationError';

export function ContactTaskActions({ uid, contact }: { uid: number; contact: IAutodialCampaignContact }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<'reschedule' | 'exclude' | 'dnc' | null>(null);
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [changeTask, taskState] = useChangeAutodialContactTaskMutation();
  const [addDnc, dncState] = useCreateAutodialDncMutation();
  const pending = taskState.isLoading || dncState.isLoading;
  const active = contact.tasks?.some((task) => task.status === 'leased' || task.status === 'dialing');
  const confirm = async () => {
    setError(null);
    try {
      if (dialog === 'dnc') {
        for (const phone of contact.phones) await addDnc({ scope: 'campaign', scope_uid: uid, normalized_phone: phone.normalized, source: 'campaign_workspace' }).unwrap();
      } else if (dialog) {
        await changeTask({ uid, contactUid: contact.uid, action: dialog,
          ...(dialog === 'reschedule' ? { next_attempt_at: new Date(time).toISOString() } : {}) }).unwrap();
      }
      setDialog(null);
    } catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.workspace.actionFailed'))); }
  };
  return <div onClick={(event) => event.stopPropagation()}>
    <HStack gap="8" wrap="wrap">
      <Button size="sm" variant="outline" disabled={active || !contact.tasks?.length} onClick={() => { setDialog('exclude'); setError(null); }}>{t('autodial.workspace.exclude')}</Button>
      <Button size="sm" variant="outline" disabled={active || !contact.tasks?.length || contact.tasks.some((task) => task.status !== 'pending')} onClick={() => { setDialog('reschedule'); setError(null); }}>{t('autodial.workspace.reschedule')}</Button>
      <Button size="sm" variant="outline" onClick={() => { setDialog('dnc'); setError(null); }}>{t('autodial.workspace.addDnc')}</Button>
    </HStack>
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && !pending && setDialog(null)}><DialogContent aria-describedby={undefined}>
      <DialogHeader><DialogTitle>{t(`autodial.workspace.${dialog ?? 'exclude'}`)}</DialogTitle></DialogHeader>
      <VStack gap="12" max><Text>{contact.phones.map((phone) => phone.normalized).join(', ')}</Text>
        <Text>{t(`autodial.workspace.confirm_${dialog ?? 'exclude'}`)}</Text>
        {dialog === 'reschedule' && <VStack gap="8" max><Label htmlFor={`retry-${contact.uid}`}>{t('autodial.workspace.retryTime')}</Label>
          <Input id={`retry-${contact.uid}`} type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} /></VStack>}
        {error && <Text role="alert">{error}</Text>}
      </VStack>
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
        <Button disabled={pending || (dialog === 'reschedule' && (!Number.isFinite(Date.parse(time)) || Date.parse(time) <= Date.now()))} onClick={() => void confirm()}>{t('common.confirm')}</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
