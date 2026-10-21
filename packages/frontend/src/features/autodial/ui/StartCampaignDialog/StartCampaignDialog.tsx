import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AutodialDisposition } from '@krasterisk/shared';
import {
  Button,
  Checkbox,
  Dialog,
  FormDialogContent,
  ModalBody,
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
  useGetAutodialTourPreviewQuery,
  type AutodialCampaignWithSchedules,
} from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import { autodialErrorKey } from '../../lib/mutationError';
import cls from './StartCampaignDialog.module.scss';
import { PreflightChecks } from '../CampaignWorkspace/PreflightChecklist';
import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { LaunchReadinessSummary } from './LaunchReadinessSummary';

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
  const dialogFocus = useAutodialDialogFocus();
  const [start, { isLoading }] = useStartAutodialCampaignMutation();
  const [selected, setSelected] = useState<AutodialDisposition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [alwaysConfirmed, setAlwaysConfirmed] = useState(false);
  const aroundTheClock = campaign?.schedules?.length === 0;
  const firstLaunch = (campaign?.tour_no ?? 0) === 0;
  const { currentData: scope, isFetching: scopeLoading, isError: scopeFailed, refetch: refreshScope } = useGetAutodialTourPreviewQuery({
    uid: campaign?.uid ?? 0, dispositions: firstLaunch ? [] : selected,
  }, { skip: !campaign, refetchOnMountOrArgChange: true });
  const { currentData: preflight, isFetching: checking, isError: checkFailed, refetch } = useGetAutodialPreflightQuery(campaign?.uid ?? 0, {
    skip: !campaign, refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (campaign) {
      setSelected(firstLaunch ? [] : initialDispositions.split(',').filter((value): value is AutodialDisposition => REDIAL_DISPOSITIONS.includes(value as AutodialDisposition)));
      setError(null);
      setAlwaysConfirmed(false);
    }
  }, [campaign?.uid, initialDispositions, firstLaunch]);

  const toggle = (disposition: AutodialDisposition) => {
    setSelected((prev) =>
      prev.includes(disposition)
        ? prev.filter((d) => d !== disposition)
        : [...prev, disposition],
    );
  };

  const onStart = async () => {
    if (!campaign || isLoading || checking || checkFailed || !preflight?.ready || scopeLoading || scopeFailed || !scope?.totals.tasks
      || scope.campaign_revision !== campaign.revision || scope.totals.active_tasks > 0 || (aroundTheClock && !alwaysConfirmed)
      || preflight.revision !== campaign.revision) return;
    try {
      await start({
        uid: campaign.uid,
        include_dispositions: !firstLaunch && selected.length ? selected : undefined,
        expected_revision: scope.campaign_revision,
        expected_base_revision: scope.base_revision,
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
      <FormDialogContent size="large" {...dialogFocus}>
        <DialogHeader>
          <DialogTitle>
            {t('autodial.start.title', { name: campaign?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>{t(firstLaunch ? 'autodial.workspace.firstLaunchHint' : 'autodial.workspace.nextTourHint')}</DialogDescription>
        </DialogHeader>

        <ModalBody><VStack gap="8" max className={cls.list}>
          {campaign && <LaunchReadinessSummary campaign={campaign} onClose={onClose} />}
          {preflight && <PreflightChecks data={preflight} />}
          {checkFailed && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
          <Button variant="outline" disabled={checking || scopeLoading} onClick={() => { void refetch(); void refreshScope(); }}>{t('autodial.workspace.recheck')}</Button>
          <section className={cls.scope} aria-live="polite" aria-busy={scopeLoading}>
            <Text>{t('autodial.workspace.tourScopeTitle')}</Text>
            {scopeLoading ? <Text>{t('autodial.workspace.tourScopeLoading')}</Text> : scopeFailed || !scope
              ? <Text role="alert">{t('autodial.common.loadFailed')}</Text>
              : <VStack gap="8" max>
                <Text>{t('autodial.workspace.tourScopeCounts', scope.totals)}</Text>
                <Text variant="muted">{t('autodial.workspace.tourScopeTasks', scope.totals)}</Text>
                <Text variant="muted">{t('autodial.workspace.tourScopeDnc', scope.totals)}</Text>
                {!scope.totals.tasks && <Text role="alert">{t('autodial.workspace.tourScopeEmpty')}</Text>}
                {(scope.campaign_revision !== campaign?.revision || scope.totals.active_tasks > 0) && <Text role="alert">{t('autodial.workspace.tourScopeChanged')}</Text>}
                <Text variant="muted">{t('autodial.workspace.tourScopeAdvisory')}</Text>
              </VStack>}
          </section>
          {aroundTheClock && <HStack gap="8" align="center">
            <Checkbox id="autodial-confirm-around-clock" checked={alwaysConfirmed} onChange={() => setAlwaysConfirmed((value) => !value)} />
            <Label htmlFor="autodial-confirm-around-clock">{t('autodial.workspace.confirmAroundClock')}</Label>
          </HStack>}
          {!firstLaunch && <details><summary>{t('autodial.workspace.redialAdvanced')}</summary><VStack gap="8" max>
          <Text variant="muted">{t('autodial.workspace.redialCountersHint')}</Text>
          {REDIAL_DISPOSITIONS.map((disposition) => (
            <HStack key={disposition} gap="8" align="center">
              <Checkbox
                id={`autodial-redial-${disposition}`}
                checked={selected.includes(disposition)}
                onChange={() => toggle(disposition)}
              />
              <Label htmlFor={`autodial-redial-${disposition}`}>
                {autodialDispositionLabel(disposition, t)}
                {!scopeLoading && !scopeFailed && scope && ` · ${t('autodial.workspace.tourOutcomeCount', scope.by_disposition.find((row) => row.disposition === disposition) ?? { tasks: 0, clients: 0, numbers: 0 })}`}
              </Label>
            </HStack>
          ))}</VStack></details>}
          {error && <Text role="alert" className={cls.error}>{error}</Text>}
        </VStack></ModalBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={isLoading || checking || checkFailed || !preflight?.ready || scopeLoading || scopeFailed || !scope?.totals.tasks || scope.totals.active_tasks > 0 || scope.campaign_revision !== campaign?.revision || (aroundTheClock && !alwaysConfirmed) || Boolean(campaign?.revision !== undefined && preflight.revision !== campaign.revision)} onClick={() => void onStart()}>
            {t('autodial.campaigns.start')}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </Dialog>
  );
});

StartCampaignDialog.displayName = 'StartCampaignDialog';
