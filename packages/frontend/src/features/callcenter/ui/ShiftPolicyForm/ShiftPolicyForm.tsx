import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Input, Label, Switch, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  type IShiftPolicy,
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { useBaselineForm } from '../../lib/useBaselineForm';
import { FormSaveBar } from '../FormSaveBar';
import styles from './ShiftPolicyForm.module.scss';

const DEFAULT_POLICY: IShiftPolicy = {
  max_duration_min: 0,
  close_at_eod: false,
  eod_time: '00:00',
  idle_timeout_min: 0,
  idle_requires_unregistered: true,
  free_exten_on_close: true,
};

function normalizePolicy(raw: IShiftPolicy | null | undefined): IShiftPolicy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_POLICY };
  return {
    max_duration_min: Number(raw.max_duration_min) >= 0 ? Number(raw.max_duration_min) : 0,
    close_at_eod: Boolean(raw.close_at_eod),
    eod_time: typeof raw.eod_time === 'string' && /^\d{2}:\d{2}$/.test(raw.eod_time)
      ? raw.eod_time
      : '00:00',
    idle_timeout_min: Number(raw.idle_timeout_min) >= 0 ? Number(raw.idle_timeout_min) : 0,
    idle_requires_unregistered: raw.idle_requires_unregistered !== false,
    free_exten_on_close: raw.free_exten_on_close !== false,
  };
}

const DEFAULT_JOURNAL_DEPTH = 50;

type ShiftForm = IShiftPolicy & { journal_depth: number };

/** Tenant shift auto-close / extension policy + softphone journal depth (SUPERVISOR/ADMIN). */
export function ShiftPolicyForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const { form: policy, setForm: setPolicy, dirty, syncFromServer, markSaved, revert } =
    useBaselineForm<ShiftForm>({ ...DEFAULT_POLICY, journal_depth: DEFAULT_JOURNAL_DEPTH });

  useEffect(() => {
    if (!data) return;
    const depth = data.journal_depth;
    syncFromServer({
      ...normalizePolicy(data.shift_policy),
      journal_depth: typeof depth === 'number' && depth > 0 ? depth : DEFAULT_JOURNAL_DEPTH,
    });
  }, [data, syncFromServer]);

  const patch = (partial: Partial<ShiftForm>) => {
    if (!canEdit) return;
    setPolicy((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      const { journal_depth: rawDepth, ...shiftPolicy } = policy;
      const journalDepth = Math.min(500, Math.max(1, Math.round(rawDepth) || DEFAULT_JOURNAL_DEPTH));
      await update({ shift_policy: shiftPolicy, journal_depth: journalDepth }).unwrap();
      markSaved();
    } catch {
      toast.error(t('common.saveFailed', 'Save failed'));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.wrap} data-testid="shift-policy-form">
        <Skeleton height="2rem" width="12rem" />
        <Skeleton height="6rem" width="100%" />
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState message={t('common.loadFailed', 'Failed to load')} onRetry={() => refetch()} retryLabel={t('common.retry', 'Retry')} />
    );
  }

  return (
    <div className={styles.wrap} data-testid="shift-policy-form">
      {!canEdit && (
        <Text variant="muted" className={styles.readOnly}>
          {t('callcenter.settings.shifts.readOnly', 'Only supervisors and admins can edit')}
        </Text>
      )}

      <div className={styles.field}>
        <Label htmlFor="shift-max-duration">
          {t('callcenter.settings.shifts.maxDuration', 'Max shift duration (minutes)')}
        </Label>
        <Text variant="muted" className={styles.fieldHint}>
          {t('callcenter.settings.shifts.maxDurationHint', '0 = disabled')}
        </Text>
        <Input
          id="shift-max-duration"
          type="number"
          min={0}
          disabled={!canEdit}
          value={policy.max_duration_min}
          onChange={(e) => patch({ max_duration_min: Math.max(0, Number(e.target.value) || 0) })}
        />
      </div>

      <div className={styles.row}>
        <Label className={styles.switchLabel}>
          <Switch
            checked={policy.close_at_eod}
            disabled={!canEdit}
            onCheckedChange={(v) => patch({ close_at_eod: v })}
          />
          {t('callcenter.settings.shifts.closeAtEod', 'Close shifts at end of day')}
        </Label>
        <Text variant="muted" className={styles.fieldHint} data-testid="shift-hint-closeAtEod">
          {t('callcenter.settings.shifts.closeAtEodHint')}
        </Text>
      </div>

      <div className={styles.field}>
        <Label htmlFor="shift-eod-time">
          {t('callcenter.settings.shifts.eodTime', 'End-of-day time')}
        </Label>
        <Text variant="muted" className={styles.fieldHint} data-testid="shift-hint-eodTime">
          {t('callcenter.settings.shifts.eodTimeHint')}
        </Text>
        <Input
          id="shift-eod-time"
          type="time"
          disabled={!canEdit || !policy.close_at_eod}
          value={policy.eod_time}
          onChange={(e) => patch({ eod_time: e.target.value || '00:00' })}
        />
      </div>

      <div className={styles.field}>
        <Label htmlFor="shift-idle">
          {t('callcenter.settings.shifts.idleTimeout', 'Close after panel idle (minutes)')}
        </Label>
        <Text variant="muted" className={styles.fieldHint}>
          {t(
            'callcenter.settings.shifts.idleTimeoutHint',
            '0 = disabled. Applies when the operator closes the browser / loses SSE.',
          )}
        </Text>
        <Input
          id="shift-idle"
          type="number"
          min={0}
          disabled={!canEdit}
          value={policy.idle_timeout_min}
          onChange={(e) => patch({ idle_timeout_min: Math.max(0, Number(e.target.value) || 0) })}
        />
      </div>

      <div className={styles.row}>
        <Label className={styles.switchLabel}>
          <Switch
            checked={policy.idle_requires_unregistered}
            disabled={!canEdit || policy.idle_timeout_min <= 0}
            onCheckedChange={(v) => patch({ idle_requires_unregistered: v })}
          />
          {t(
            'callcenter.settings.shifts.idleRequiresUnregistered',
            'Idle close only if device is unregistered',
          )}
        </Label>
        <Text variant="muted" className={styles.fieldHint} data-testid="shift-hint-idleRequiresUnregistered">
          {t('callcenter.settings.shifts.idleRequiresUnregisteredHint')}
        </Text>
      </div>

      <div className={styles.row}>
        <Label className={styles.switchLabel}>
          <Switch
            checked={policy.free_exten_on_close}
            disabled={!canEdit}
            onCheckedChange={(v) => patch({ free_exten_on_close: v })}
          />
          {t('callcenter.settings.shifts.freeExten', 'Free the operator extension on shift end')}
        </Label>
        <Text variant="muted" className={styles.fieldHint} data-testid="shift-hint-freeExten">
          {t('callcenter.settings.shifts.freeExtenHint')}
        </Text>
      </div>

      <div className={styles.field}>
        <Label htmlFor="shift-journal-depth">
          {t('callcenter.settings.customize.journalDepth', 'Softphone journal depth')}
        </Label>
        <Text variant="muted" className={styles.fieldHint}>
          {t(
            'callcenter.settings.customize.journalDepthHint',
            'Last N personal calls shown in the softphone Journal tab (default 50)',
          )}
        </Text>
        <Input
          id="shift-journal-depth"
          type="number"
          min={1}
          max={500}
          disabled={!canEdit}
          value={policy.journal_depth}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) patch({ journal_depth: n });
          }}
        />
      </div>

      {canEdit && (
        <FormSaveBar placement="footer" dirty={dirty} saving={isSaving} onSave={handleSave} onCancel={revert} testId="shift-save-bar" />
      )}
    </div>
  );
}
