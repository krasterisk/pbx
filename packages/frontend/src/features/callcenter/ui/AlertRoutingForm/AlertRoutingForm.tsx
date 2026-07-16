import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Input, Label, Select, Switch, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetAlertConfigQuery,
  useUpdateAlertConfigMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import styles from './AlertRoutingForm.module.scss';

interface RoutingForm {
  enabled: boolean;
  integration_uid: number | null;
  target: string;
  cooldown_sec: number;
}

const DEFAULTS: RoutingForm = {
  enabled: false,
  integration_uid: null,
  target: '',
  cooldown_sec: 300,
};

/**
 * Alert delivery routing (D-27 close + 07-10).
 * Thresholds (WHEN) are edited above in AlertThresholdsForm (cc_settings);
 * this form configures WHERE/channel via notification_integration.
 */
export function AlertRoutingForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;

  const { data, isLoading, isError, refetch } = useGetAlertConfigQuery();
  const { data: integrations = [] } = useGetNotificationsQuery();
  const [update, { isLoading: isSaving }] = useUpdateAlertConfigMutation();
  const [form, setForm] = useState<RoutingForm>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: Boolean(data.enabled),
      integration_uid: data.integration_uid ?? null,
      target: data.target ?? '',
      cooldown_sec: data.cooldown_sec ?? DEFAULTS.cooldown_sec,
    });
  }, [data]);

  const handleSave = async () => {
    if (!canEdit) return;
    const cooldown = Math.min(3600, Math.max(30, form.cooldown_sec || 300));
    try {
      await update({
        enabled: form.enabled,
        integration_uid: form.integration_uid,
        target: form.target.trim() || null,
        cooldown_sec: cooldown,
      }).unwrap();
      setSaved(true);
      toast.success(t('callcenter.settings.alertRouting.saved', 'Маршрут алертов сохранён'));
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
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>
          {t('callcenter.settings.alertRouting.title', 'Маршрут доставки алертов')}
        </Text>
        <Text className={styles.hint}>
          {t(
            'callcenter.settings.alertRouting.hint',
            'Пороги (когда алертить) задаются выше в форме порогов; здесь настраивается маршрут доставки (куда/чем) через notification_integration.',
          )}
        </Text>

        {!canEdit && (
          <Text className={styles.readonlyHint}>
            {t(
              'callcenter.settings.alertRouting.readOnly',
              'Редактирование доступно супервизору и администратору',
            )}
          </Text>
        )}

        <div className={styles.row}>
          <Label htmlFor="ar-enabled" className={styles.label}>
            {t('callcenter.settings.alertRouting.enabled', 'Включить рассылку алертов')}
          </Label>
          <Switch
            id="ar-enabled"
            checked={form.enabled}
            disabled={!canEdit}
            onCheckedChange={(checked) => {
              if (!canEdit) return;
              setForm((prev) => ({ ...prev, enabled: checked }));
              setSaved(false);
            }}
          />
        </div>

        <div className={styles.field}>
          <Label htmlFor="ar-integration">
            {t('callcenter.settings.alertRouting.channel', 'Канал уведомлений')}
          </Label>
          <Select
            id="ar-integration"
            value={form.integration_uid ?? ''}
            disabled={!canEdit}
            onChange={(e) => {
              if (!canEdit) return;
              const v = e.target.value;
              setForm((prev) => ({
                ...prev,
                integration_uid: v === '' ? null : Number(v),
              }));
              setSaved(false);
            }}
          >
            <option value="">
              {t('callcenter.settings.alertRouting.channelNone', 'Не выбран')}
            </option>
            {integrations.map((item) => (
              <option key={item.uid} value={item.uid}>
                {item.name} ({item.channel})
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.field}>
          <Label htmlFor="ar-target">
            {t('callcenter.settings.alertRouting.target', 'Адресат (chat_id / email)')}
          </Label>
          <Input
            id="ar-target"
            value={form.target}
            disabled={!canEdit}
            onChange={(e) => {
              if (!canEdit) return;
              setForm((prev) => ({ ...prev, target: e.target.value }));
              setSaved(false);
            }}
            placeholder={t('callcenter.settings.alertRouting.targetPh', 'chat_id или email')}
          />
        </div>

        <div className={styles.field}>
          <Label htmlFor="ar-cooldown">
            {t('callcenter.settings.alertRouting.cooldown', 'Cooldown (сек, 30-3600)')}
          </Label>
          <Input
            id="ar-cooldown"
            type="number"
            min={30}
            max={3600}
            value={form.cooldown_sec}
            disabled={!canEdit}
            onChange={(e) => {
              if (!canEdit) return;
              const n = Number(e.target.value);
              setForm((prev) => ({
                ...prev,
                cooldown_sec: Number.isFinite(n) ? n : prev.cooldown_sec,
              }));
              setSaved(false);
            }}
          />
        </div>
      </div>

      {canEdit && (
        <div className={styles.actions}>
          <Button type="submit" disabled={isSaving}>
            {t('callcenter.settings.save')}
          </Button>
          {saved && (
            <Text className={styles.saved}>
              {t('callcenter.settings.alertRouting.saved', 'Маршрут алертов сохранён')}
            </Text>
          )}
        </div>
      )}
    </form>
  );
}
