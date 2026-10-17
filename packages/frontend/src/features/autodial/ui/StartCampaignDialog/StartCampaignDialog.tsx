import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AutodialDisposition } from '@krasterisk/shared';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useStartAutodialCampaignMutation,
  useGetAutodialPreflightQuery,
  type AutodialCampaignWithSchedules,
} from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import { autodialErrorKey } from '../../lib/mutationError';
import cls from './StartCampaignDialog.module.scss';
import { PreflightChecks } from '../CampaignWorkspace/PreflightChecklist';

/**
 * Dispositions worth another dial. Terminal outcomes (success, dnc,
 * invalid_number, ...) are deliberately absent — re-arming those is how you
 * call a person who already said no.
 */
const REDIAL_DISPOSITIONS: AutodialDisposition[] = [
  'no_answer',
  'busy',
  'congestion',
  'failed',
  'answered_short',
  'amd_machine',
  'voicemail',
  'max_attempts',
  'callback_scheduled',
];

interface StartCampaignDialogProps {
  campaign: AutodialCampaignWithSchedules | null;
  onClose: () => void;
  initialDispositions?: string;
}

export const StartCampaignDialog = memo(({ campaign, onClose, initialDispositions = '' }: StartCampaignDialogProps) => {
  const { t } = useTranslation();
  const [start, { isLoading }] = useStartAutodialCampaignMutation();
  const [selected, setSelected] = useState<AutodialDisposition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { currentData: preflight, isFetching: checking, isError: checkFailed, refetch } = useGetAutodialPreflightQuery(campaign?.uid ?? 0, {
    skip: !campaign, refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (campaign) {
      setSelected(initialDispositions.split(',').filter((value): value is AutodialDisposition => REDIAL_DISPOSITIONS.includes(value as AutodialDisposition)));
      setError(null);
    }
  }, [campaign?.uid, initialDispositions]);

  const toggle = (disposition: AutodialDisposition) => {
    setSelected((prev) =>
      prev.includes(disposition)
        ? prev.filter((d) => d !== disposition)
        : [...prev, disposition],
    );
  };

  const onStart = async () => {
    if (!campaign) return;
    try {
      await start({
        uid: campaign.uid,
        include_dispositions: selected.length ? selected : undefined,
      }).unwrap();
      onClose();
    } catch (error) {
      // A campaign without a trunk is rejected server-side (AC_NO_TRUNK);
      // keep the dialog open so the choice is not lost.
      setError(t(autodialErrorKey(error, 'autodial.start.failed')));
    }
  };

  return (
    <Dialog open={Boolean(campaign)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('autodial.start.title', { name: campaign?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('autodial.start.body')}</DialogDescription>
        </DialogHeader>

        <VStack gap="8" max className={cls.list}>
          {preflight && <PreflightChecks data={preflight} />}
          {checkFailed && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
          <Button variant="outline" disabled={checking} onClick={() => void refetch()}>{t('autodial.workspace.recheck')}</Button>
          <Text variant="muted">{t('autodial.start.redialHint')}</Text>
          {REDIAL_DISPOSITIONS.map((disposition) => (
            <HStack key={disposition} gap="8" align="center">
              <Checkbox
                id={`autodial-redial-${disposition}`}
                checked={selected.includes(disposition)}
                onChange={() => toggle(disposition)}
              />
              <Label htmlFor={`autodial-redial-${disposition}`}>
                {autodialDispositionLabel(disposition, t)}
              </Label>
            </HStack>
          ))}
          {error && <Text className={cls.error}>{error}</Text>}
        </VStack>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={isLoading || checking || !preflight?.ready} onClick={() => void onStart()}>
            {t('autodial.campaigns.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

StartCampaignDialog.displayName = 'StartCampaignDialog';
