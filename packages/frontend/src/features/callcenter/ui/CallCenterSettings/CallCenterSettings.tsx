import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
  Label, Switch, Text, Skeleton, Tooltip, SegmentedControl,
} from '@/shared/ui';
import {
  useGetMyUiCustomizationQuery,
  useUpdateMyUiCustomizationMutation,
  useGetMyNotificationsQuery,
  useUpdateMyNotificationsMutation,
  type NotificationEvent,
  type NotificationChannel,
} from '@/shared/api/endpoints/callCenterApi';
import {
  loadKpiDisplay,
  saveKpiDisplay,
  type KpiDisplayMode,
} from '@/features/callcenter/lib/agentPanelPrefs';
import { NotificationMatrix } from '@/features/callcenter/ui/NotificationMatrix';
import { useEffect, useState } from 'react';
import styles from './CallCenterSettings.module.scss';

/** D-05: keys applied live by CallCenterAgentPage panel chips. */
const PANEL_KEYS = ['coworkers', 'queues', 'waiting', 'history'] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

/**
 * Operator-facing "My panel" settings — UI visibility, KPI period, notifications.
 * Softphone is docked in agent chrome (no placement setting).
 */
export function CallCenterSettings() {
  const { t } = useTranslation();
  const [kpiDisplay, setKpiDisplay] = useState<KpiDisplayMode>(() => loadKpiDisplay());

  useEffect(() => {
    setKpiDisplay(loadKpiDisplay());
  }, []);

  const { data: ui, isLoading: uiLoading, isError: uiError, refetch: refetchUi } = useGetMyUiCustomizationQuery();
  const [updateUi] = useUpdateMyUiCustomizationMutation();

  const {
    data: notifications,
    isLoading: notifLoading,
    isError: notifError,
    refetch: refetchNotifications,
  } = useGetMyNotificationsQuery();
  const [updateNotifications] = useUpdateMyNotificationsMutation();

  const handleVisibilityToggle = (key: PanelKey, checked: boolean) => {
    if (ui?.locks?.[key]) return;
    updateUi({ ui_visibility: { ...(ui?.ui_visibility ?? {}), [key]: checked } })
      .unwrap()
      .then(() => toast.success(t('callcenter.settings.customize.saved', 'Settings saved')))
      .catch(() => toast.error(t('common.error', 'Ошибка сохранения')));
  };

  const handleKpiChange = (mode: KpiDisplayMode) => {
    setKpiDisplay(mode);
    saveKpiDisplay(mode);
    toast.success(t('callcenter.settings.customize.saved', 'Settings saved'));
  };

  const handleChannelToggle = (event: NotificationEvent, channel: NotificationChannel, enabled: boolean) => {
    if ((notifications?.locks?.[event]?.length ?? 0) > 0) return;
    const current = notifications?.matrix?.[event] ?? notifications?.defaults?.[event] ?? [];
    const nextChannels = enabled
      ? Array.from(new Set([...current, channel]))
      : current.filter((c) => c !== channel);
    updateNotifications({ notification_matrix: { ...(notifications?.matrix ?? {}), [event]: nextChannels } })
      .unwrap()
      .then(() => toast.success(t('callcenter.settings.notifications.saved', 'Settings saved')))
      .catch(() => toast.error(t('common.error', 'Ошибка сохранения')));
  };

  return (
    <Tabs defaultValue="panels" className={styles.wrapper}>
      <TabsList aria-label={t('callcenter.settings.customize.title', 'Panel customization')}>
        <TabsTrigger value="panels">{t('callcenter.settings.customize.title', 'Panel customization')}</TabsTrigger>
        <TabsTrigger value="notifications">{t('callcenter.settings.notifications.title', 'Notifications')}</TabsTrigger>
      </TabsList>

      <TabsContent value="panels">
        {uiLoading ? (
          <div className={styles.skeletonWrap}>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : uiError ? (
          <div className={styles.errorCard}>
            <Text>{t('callcenter.settings.loadError')}</Text>
            <button type="button" className={styles.retryBtn} onClick={() => refetchUi()}>
              {t('callcenter.settings.retry')}
            </button>
          </div>
        ) : (
          <div className={styles.section}>
            <Text className={styles.sectionTitle}>{t('callcenter.settings.customize.visibilitySection', 'Panel visibility')}</Text>
            {PANEL_KEYS.map((key) => {
              const isLocked = Boolean(ui?.locks?.[key]);
              const checked = ui?.ui_visibility?.[key] ?? true;
              const row = (
                <div className={`${styles.row}${isLocked ? ` ${styles.rowLocked}` : ''}`} key={key}>
                  <Label htmlFor={`cc-vis-${key}`} className={styles.label}>
                    {t(`callcenter.settings.customize.visibility.${key}`)}
                  </Label>
                  <Switch
                    id={`cc-vis-${key}`}
                    checked={checked}
                    disabled={isLocked}
                    onCheckedChange={(next) => handleVisibilityToggle(key, next)}
                  />
                </div>
              );
              return isLocked ? (
                <Tooltip key={key} content={t('callcenter.settings.lockedHint', 'Set by administrator')}>
                  {row}
                </Tooltip>
              ) : row;
            })}

            <Text className={styles.sectionTitle}>
              {t('callcenter.settings.customize.kpiSection', 'Panel KPI period')}
            </Text>
            <Text variant="muted" className={styles.hint}>
              {t(
                'callcenter.settings.customize.kpiHint',
                'Period for Answered / Made / Missed on the status bar and Coworkers',
              )}
            </Text>
            <SegmentedControl
              ariaLabel={t('callcenter.settings.customize.kpiSection', 'Panel KPI period')}
              value={kpiDisplay}
              onChange={(v) => handleKpiChange(v as KpiDisplayMode)}
              options={[
                { value: 'day', label: t('callcenter.kpi.modeDay', 'Day') },
                { value: 'shift', label: t('callcenter.kpi.modeShift', 'Shift') },
                { value: 'both', label: t('callcenter.kpi.modeBoth', 'Both') },
              ]}
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="notifications">
        {notifLoading ? (
          <div className={styles.skeletonWrap}>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : notifError ? (
          <div className={styles.errorCard}>
            <Text>{t('callcenter.settings.loadError')}</Text>
            <button type="button" className={styles.retryBtn} onClick={() => refetchNotifications()}>
              {t('callcenter.settings.retry')}
            </button>
          </div>
        ) : (
          <div className={styles.section}>
            <Text variant="muted" className={styles.hint}>
              {t('callcenter.settings.notifications.subtitle', 'Choose how you want to be notified for each event')}
            </Text>
            <NotificationMatrix
              matrix={notifications?.matrix ?? {}}
              locks={notifications?.locks ?? {}}
              defaults={notifications?.defaults ?? {}}
              onChange={handleChannelToggle}
            />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
