import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
  Label, Select, Switch, Text, Skeleton, Tooltip,
} from '@/shared/ui';
import {
  useGetMyUiCustomizationQuery,
  useUpdateMyUiCustomizationMutation,
  useGetMyNotificationsQuery,
  useUpdateMyNotificationsMutation,
  type SoftphonePlacement,
  type NotificationEvent,
  type NotificationChannel,
} from '@/shared/api/endpoints/callCenterApi';
import { NotificationMatrix } from '@/features/callcenter/ui/NotificationMatrix';
import styles from './CallCenterSettings.module.scss';

/** D-05: keys actually applied live by CallCenterAgentPage (coworkers/queues/waiting panels). */
const PANEL_KEYS = ['coworkers', 'queues', 'waiting'] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

const PLACEMENT_OPTIONS: SoftphonePlacement[] = ['bottom-right', 'bottom-left', 'hidden'];

/**
 * D-38/D-40/D-41/D-43: operator-facing "My panel" settings — UI visibility + softphone
 * placement (Tab 1) and the notification matrix (Tab 2). Every field respects admin locks
 * (D-39): a locked field renders disabled, shows the tenant default, and a
 * "set by administrator" hint instead of the operator's own (possibly stale) override.
 * Each toggle persists immediately via its own mutation — no separate Save step.
 */
export function CallCenterSettings() {
  const { t } = useTranslation();

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

  const handlePlacementChange = (value: SoftphonePlacement) => {
    if (ui?.locks?.softphone_placement) return;
    updateUi({ softphone_placement: value })
      .unwrap()
      .then(() => toast.success(t('callcenter.settings.customize.saved', 'Settings saved')))
      .catch(() => toast.error(t('common.error', 'Ошибка сохранения')));
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

  const placementLocked = Boolean(ui?.locks?.softphone_placement);

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

            <Text className={styles.sectionTitle}>{t('callcenter.settings.customize.placementSection', 'Softphone placement')}</Text>
            <div className={styles.field}>
              <Label htmlFor="cc-softphone-placement">{t('callcenter.settings.customize.placement.label', 'Softphone widget position')}</Label>
              {placementLocked ? (
                <Tooltip content={t('callcenter.settings.lockedHint', 'Set by administrator')}>
                  <Select id="cc-softphone-placement" value={ui?.softphone_placement ?? 'bottom-right'} disabled>
                    {PLACEMENT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t(`callcenter.settings.customize.placement.${opt}`)}
                      </option>
                    ))}
                  </Select>
                </Tooltip>
              ) : (
                <Select
                  id="cc-softphone-placement"
                  value={ui?.softphone_placement ?? 'bottom-right'}
                  onChange={(e) => handlePlacementChange(e.target.value as SoftphonePlacement)}
                >
                  {PLACEMENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {t(`callcenter.settings.customize.placement.${opt}`)}
                    </option>
                  ))}
                </Select>
              )}
            </div>
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
