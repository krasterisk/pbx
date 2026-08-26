import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Input, Label, Switch, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  type IShiftPolicy,
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
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

/** Tenant shift auto-close / extension policy (SUPERVISOR/ADMIN). */
export function ShiftPolicyForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [policy, setPolicy] = useState<IShiftPolicy>({ ...DEFAULT_POLICY });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPolicy(normalizePolicy(data.shift_policy));
  }, [data]);

  const patch = (partial: Partial<IShiftPolicy>) => {
    if (!canEdit) return;
    setPolicy((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      await update({ shift_policy: policy }).unwrap();
      setSaved(true);
      toast.success(t('callcenter.settings.shifts.saved', 'Shift policy saved'));
    } catch {
      toast.error(t('common.saveFailed', 'Save failed'));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.wrap} data-testid="shift-policy-form">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.wrap}>
        <Text variant="error">{t('common.loadFailed', 'Failed to load')}</Text>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('common.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-testid="shift-policy-form">
      <Text className={styles.title}>
        {t('callcenter.settings.shifts.title', 'Shift persistence')}
      </Text>
      <Text variant="muted" className={styles.hint}>
        {t(
          'callcenter.settings.shifts.hint',
          'When open shifts may be closed automatically and whether the directory number is freed.',
        )}
      </Text>

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
      </div>

      <div className={styles.field}>
        <Label htmlFor="shift-eod-time">
          {t('callcenter.settings.shifts.eodTime', 'End-of-day time')}
        </Label>
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
      </div>

      <div className={styles.row}>
        <Label className={styles.switchLabel}>
          <Switch
            checked={policy.free_exten_on_close}
            disabled={!canEdit}
            onCheckedChange={(v) => patch({ free_exten_on_close: v })}
          />
          {t('callcenter.settings.shifts.freeExten', 'Free directory extension on shift end')}
        </Label>
      </div>

      {canEdit && (
        <div className={styles.footer}>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving
              ? t('common.saving', 'Saving…')
              : saved
                ? t('common.saved', 'Saved')
                : t('common.save', 'Save')}
          </Button>
        </div>
      )}
    </div>
  );
}
