import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Input, Label, Switch, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { useBaselineForm } from '../../lib/useBaselineForm';
import { FormSaveBar } from '../FormSaveBar';
import styles from './AlertThresholdsForm.module.scss';

interface ThresholdForm {
  default_sla_threshold: number;
  short_abandon_sec: number;
  alert_sound_enabled: boolean;
  max_wait_sec: number;
  abandon_rate_pct: number;
  sla_critical_pct: number;
  agents_available_min: number;
}

type NumericKey = Exclude<keyof ThresholdForm, 'alert_sound_enabled'>;

const DEFAULTS: ThresholdForm = {
  default_sla_threshold: 20,
  short_abandon_sec: 5,
  alert_sound_enabled: true,
  max_wait_sec: 60,
  abandon_rate_pct: 10,
  sla_critical_pct: 70,
  agents_available_min: 1,
};

interface NumericField {
  key: NumericKey;
  id: string;
  labelKey: string;
  hintKey: string;
  max?: number;
}

/** Every threshold carries an explanation: what it measures, where it fires, an example (U5.5). */
export const SLA_FIELDS: NumericField[] = [
  {
    key: 'default_sla_threshold',
    id: 'cc-default-sla',
    labelKey: 'callcenter.settings.alerts.defaultSla',
    hintKey: 'callcenter.settings.alerts.defaultSlaHint',
  },
  {
    key: 'short_abandon_sec',
    id: 'cc-short-abandon',
    labelKey: 'callcenter.settings.alerts.shortAbandon',
    hintKey: 'callcenter.settings.alerts.shortAbandonHint',
    max: 60,
  },
];

export const ALERT_FIELDS: NumericField[] = [
  {
    key: 'max_wait_sec',
    id: 'cc-max-wait',
    labelKey: 'callcenter.settings.alerts.maxWait',
    hintKey: 'callcenter.settings.alerts.maxWaitHint',
  },
  {
    key: 'abandon_rate_pct',
    id: 'cc-abandon',
    labelKey: 'callcenter.settings.alerts.abandonRate',
    hintKey: 'callcenter.settings.alerts.abandonRateHint',
  },
  {
    key: 'sla_critical_pct',
    id: 'cc-sla-crit',
    labelKey: 'callcenter.settings.alerts.slaCritical',
    hintKey: 'callcenter.settings.alerts.slaCriticalHint',
  },
  {
    key: 'agents_available_min',
    id: 'cc-agents-min',
    labelKey: 'callcenter.settings.alerts.agentsAvailableMin',
    hintKey: 'callcenter.settings.alerts.agentsAvailableMinHint',
  },
];

/**
 * Tenant default SLA + alert thresholds (D-07 / D-27). Editable by supervisor/admin only.
 */
export function AlertThresholdsForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const { form, setForm, dirty, syncFromServer, markSaved, revert } = useBaselineForm<ThresholdForm>(DEFAULTS);

  useEffect(() => {
    if (!data) return;
    const th = data.alert_thresholds ?? {};
    syncFromServer({
      default_sla_threshold: data.default_sla_threshold,
      short_abandon_sec: data.short_abandon_sec ?? DEFAULTS.short_abandon_sec,
      alert_sound_enabled: data.alert_sound_enabled,
      max_wait_sec: th.max_wait_sec ?? DEFAULTS.max_wait_sec,
      abandon_rate_pct: th.abandon_rate_pct ?? DEFAULTS.abandon_rate_pct,
      sla_critical_pct: th.sla_critical_pct ?? DEFAULTS.sla_critical_pct,
      agents_available_min: th.agents_available_min ?? DEFAULTS.agents_available_min,
    });
  }, [data, syncFromServer]);

  const setNum = (key: NumericKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const n = Number(e.target.value);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : prev[key] }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      await update({
        default_sla_threshold: form.default_sla_threshold,
        short_abandon_sec: form.short_abandon_sec,
        alert_sound_enabled: form.alert_sound_enabled,
        alert_thresholds: {
          max_wait_sec: form.max_wait_sec,
          abandon_rate_pct: form.abandon_rate_pct,
          sla_critical_pct: form.sla_critical_pct,
          agents_available_min: form.agents_available_min,
        },
      }).unwrap();
      markSaved();
    } catch {
      toast.error(t('common.error', 'Ошибка сохранения'));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.skeletonWrap}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState message={t('callcenter.settings.loadError')} onRetry={() => refetch()} retryLabel={t('callcenter.settings.retry')} />
    );
  }

  const renderField = (f: NumericField) => (
    <div className={styles.field} key={f.key}>
      <Label htmlFor={f.id}>{t(f.labelKey)}</Label>
      <Input
        id={f.id}
        type="number"
        min={0}
        max={f.max}
        value={form[f.key]}
        onChange={setNum(f.key)}
        disabled={!canEdit}
        aria-describedby={`${f.id}-hint`}
      />
      <Text id={`${f.id}-hint`} className={styles.hint} data-testid={`${f.id}-hint`}>
        {t(f.hintKey)}
      </Text>
    </div>
  );

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) void handleSave();
      }}
    >
      {!canEdit && (
        <Text className={styles.readonlyHint}>{t('callcenter.settings.alerts.readOnly')}</Text>
      )}

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.alerts.sla')}</Text>
        {SLA_FIELDS.map(renderField)}
      </div>

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.alerts.thresholds')}</Text>
        {ALERT_FIELDS.map(renderField)}
        <div className={styles.row}>
          <Label htmlFor="cc-alert-sound" className={styles.label}>
            {t('callcenter.settings.alerts.alertSound')}
          </Label>
          <Switch
            id="cc-alert-sound"
            checked={form.alert_sound_enabled}
            onCheckedChange={(checked) => {
              if (!canEdit) return;
              setForm((prev) => ({ ...prev, alert_sound_enabled: checked }));
            }}
            disabled={!canEdit}
            aria-describedby="cc-alert-sound-hint"
          />
        </div>
        <Text id="cc-alert-sound-hint" className={styles.hint}>
          {t('callcenter.settings.alerts.alertSoundHint')}
        </Text>
      </div>

      {canEdit && (
        <FormSaveBar
          dirty={dirty}
          saving={isSaving}
          onSave={handleSave}
          onCancel={revert}
          testId="alerts-save-bar"
        />
      )}
    </form>
  );
}
