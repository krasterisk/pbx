import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Input, Label, Switch, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './AlertThresholdsForm.module.scss';

interface ThresholdForm {
  default_sla_threshold: number;
  /** Softphone Journal last-N depth (D-04), default 50. */
  journal_depth: number;
  alert_sound_enabled: boolean;
  max_wait_sec: number;
  abandon_rate_pct: number;
  sla_critical_pct: number;
  agents_available_min: number;
}

const DEFAULTS: ThresholdForm = {
  default_sla_threshold: 20,
  journal_depth: 50,
  alert_sound_enabled: true,
  max_wait_sec: 60,
  abandon_rate_pct: 10,
  sla_critical_pct: 70,
  agents_available_min: 1,
};

/**
 * Tenant default SLA + alert thresholds (D-07 / D-27). Editable by supervisor/admin only.
 */
export function AlertThresholdsForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [form, setForm] = useState<ThresholdForm>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const th = data.alert_thresholds ?? {};
    setForm({
      default_sla_threshold: data.default_sla_threshold,
      journal_depth: data.journal_depth ?? DEFAULTS.journal_depth,
      alert_sound_enabled: data.alert_sound_enabled,
      max_wait_sec: th.max_wait_sec ?? DEFAULTS.max_wait_sec,
      abandon_rate_pct: th.abandon_rate_pct ?? DEFAULTS.abandon_rate_pct,
      sla_critical_pct: th.sla_critical_pct ?? DEFAULTS.sla_critical_pct,
      agents_available_min: th.agents_available_min ?? DEFAULTS.agents_available_min,
    });
  }, [data]);

  const setNum = (key: keyof ThresholdForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const n = Number(e.target.value);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      await update({
        default_sla_threshold: form.default_sla_threshold,
        journal_depth: form.journal_depth,
        alert_sound_enabled: form.alert_sound_enabled,
        alert_thresholds: {
          max_wait_sec: form.max_wait_sec,
          abandon_rate_pct: form.abandon_rate_pct,
          sla_critical_pct: form.sla_critical_pct,
          agents_available_min: form.agents_available_min,
        },
      }).unwrap();
      setSaved(true);
      toast.success(t('callcenter.settings.alerts.saved'));
      setTimeout(() => setSaved(false), 3000);
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
      <div className={styles.errorCard}>
        <Text>{t('callcenter.settings.loadError')}</Text>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          {t('callcenter.settings.retry')}
        </Button>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      {!canEdit && (
        <Text className={styles.readonlyHint}>{t('callcenter.settings.alerts.readOnly')}</Text>
      )}

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.alerts.sla')}</Text>
        <div className={styles.field}>
          <Label htmlFor="cc-default-sla">{t('callcenter.settings.alerts.defaultSla')}</Label>
          <Input
            id="cc-default-sla"
            type="number"
            min={0}
            value={form.default_sla_threshold}
            onChange={setNum('default_sla_threshold')}
            disabled={!canEdit}
          />
          <Text className={styles.hint}>{t('callcenter.settings.alerts.defaultSlaHint')}</Text>
        </div>
        <div className={styles.field}>
          <Label htmlFor="cc-journal-depth">
            {t('callcenter.settings.alerts.journalDepth', 'Softphone journal depth')}
          </Label>
          <Input
            id="cc-journal-depth"
            type="number"
            min={1}
            max={500}
            value={form.journal_depth}
            onChange={setNum('journal_depth')}
            disabled={!canEdit}
          />
          <Text className={styles.hint}>
            {t(
              'callcenter.settings.alerts.journalDepthHint',
              'Last N personal calls shown in the softphone Journal tab (default 50)',
            )}
          </Text>
        </div>
      </div>

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.alerts.thresholds')}</Text>
        <div className={styles.field}>
          <Label htmlFor="cc-max-wait">{t('callcenter.settings.alerts.maxWait')}</Label>
          <Input
            id="cc-max-wait"
            type="number"
            min={0}
            value={form.max_wait_sec}
            onChange={setNum('max_wait_sec')}
            disabled={!canEdit}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="cc-abandon">{t('callcenter.settings.alerts.abandonRate')}</Label>
          <Input
            id="cc-abandon"
            type="number"
            min={0}
            value={form.abandon_rate_pct}
            onChange={setNum('abandon_rate_pct')}
            disabled={!canEdit}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="cc-sla-crit">{t('callcenter.settings.alerts.slaCritical')}</Label>
          <Input
            id="cc-sla-crit"
            type="number"
            min={0}
            value={form.sla_critical_pct}
            onChange={setNum('sla_critical_pct')}
            disabled={!canEdit}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="cc-agents-min">{t('callcenter.settings.alerts.agentsAvailableMin')}</Label>
          <Input
            id="cc-agents-min"
            type="number"
            min={0}
            value={form.agents_available_min}
            onChange={setNum('agents_available_min')}
            disabled={!canEdit}
          />
        </div>
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
              setSaved(false);
            }}
            disabled={!canEdit}
          />
        </div>
      </div>

      {canEdit && (
        <div className={styles.actions}>
          <Button type="submit" disabled={isSaving}>
            {t('callcenter.settings.save')}
          </Button>
          {saved && <Text className={styles.saved}>{t('callcenter.settings.alerts.saved')}</Text>}
        </div>
      )}
    </form>
  );
}
