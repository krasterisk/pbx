import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { Button, Flex, HStack, Text, VStack } from '@/shared/ui';
import {
  useGetCardTemplatesQuery,
  useGetPauseReasonsQuery,
  useGetTenantSettingsQuery,
  useListDisplayTokensQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetReportSchedulesQuery } from '@/shared/api/endpoints/callCenterReportsApi';
import { buildReadinessItems, thresholdsAreDefault, type ReadinessItemId } from '../../lib/settingsReadiness';
import { buildCcSettingsPath } from '../../lib/settingsUrlState';
import styles from './CcSettingsOverview.module.scss';

const TITLE_KEYS: Record<ReadinessItemId, [string, string]> = {
  pauses: ['callcenter.settings.overview.pausesTitle', 'Pause reasons'],
  thresholds: ['callcenter.settings.overview.thresholdsTitle', 'Alert thresholds'],
  screens: ['callcenter.settings.overview.screensTitle', 'TV screens'],
  schedules: ['callcenter.settings.overview.schedulesTitle', 'Report delivery'],
  templates: ['callcenter.settings.overview.templatesTitle', 'Client card template'],
  hotkeys: ['callcenter.settings.overview.hotkeysTitle', 'Hotkeys'],
};

/** Readiness checklist (U5.2): what is configured, what is not, each with a link to its section. */
export function CcSettingsOverview() {
  const { t } = useTranslation();
  const reasonsQuery = useGetPauseReasonsQuery();
  const tenantQuery = useGetTenantSettingsQuery();
  const tokensQuery = useListDisplayTokensQuery();
  const schedulesQuery = useGetReportSchedulesQuery();
  const templatesQuery = useGetCardTemplatesQuery();
  const { data: reasons } = reasonsQuery;
  const { data: tenant } = tenantQuery;
  const { data: tokens } = tokensQuery;
  const { data: schedules } = schedulesQuery;
  const { data: templates } = templatesQuery;
  const queries = [reasonsQuery, tenantQuery, tokensQuery, schedulesQuery, templatesQuery];

  const items = useMemo(
    () =>
      buildReadinessItems({
        pauseReasonsCount: reasons ? reasons.length : null,
        alertThresholds: tenant?.alert_thresholds,
        screensCount: tokens ? tokens.length : null,
        schedulesCount: schedules ? schedules.length : null,
        templatesCount: templates ? templates.length : null,
        hotkeysCustom: Boolean(tenant?.agent_hotkeys && Object.keys(tenant.agent_hotkeys).length > 0),
      }),
    [reasons, tenant, tokens, schedules, templates],
  );

  const detail = (id: ReadinessItemId, ok: boolean, count?: number): string => {
    switch (id) {
      case 'pauses':
        return ok
          ? t('callcenter.settings.overview.pausesCount', 'Defined: {{count}}', { count })
          : t('callcenter.settings.overview.pausesEmpty', 'Not defined: operators pause without a reason');
      case 'thresholds':
        return !thresholdsAreDefault(tenant?.alert_thresholds)
          ? t('callcenter.settings.overview.thresholdsCustom', 'Customised')
          : t('callcenter.settings.overview.thresholdsDefault', 'Default values');
      case 'screens':
        return ok
          ? t('callcenter.settings.overview.screensCount', 'Screens: {{count}}', { count })
          : t('callcenter.settings.overview.screensEmpty', 'No screens yet');
      case 'schedules':
        return ok
          ? t('callcenter.settings.overview.schedulesCount', 'Schedules: {{count}}', { count })
          : t('callcenter.settings.overview.schedulesEmpty', 'No schedules yet');
      case 'templates':
        return ok
          ? t('callcenter.settings.overview.templatesCount', 'Templates: {{count}}', { count })
          : t('callcenter.settings.overview.templatesEmpty', 'No template');
      default:
        return tenant?.agent_hotkeys && Object.keys(tenant.agent_hotkeys).length > 0
          ? t('callcenter.settings.overview.hotkeysCustom', 'Custom set')
          : t('callcenter.settings.overview.hotkeysDefault', 'Default set');
    }
  };

  const actionLabel = (id: ReadinessItemId, ok: boolean): string => {
    if (ok) return t('callcenter.settings.overview.open', 'Open');
    if (id === 'thresholds') return t('callcenter.settings.overview.check', 'Check');
    return t('callcenter.settings.overview.add', 'Add');
  };

  return (
    <VStack gap="12" max className={styles.wrap} data-testid="cc-settings-overview">
      {queries.some((query) => query.isLoading) && <Text role="status">{t('callcenter.settings.overview.loading', 'Checking call center readiness…')}</Text>}
      {queries.some((query) => query.isError) && <Flex role="alert" gap="8" wrap="wrap" align="center">
        <Text>{t('callcenter.settings.overview.loadError', 'Some settings could not be checked. Their readiness is unknown.')}</Text>
        <Button variant="outline" size="sm" onClick={() => queries.forEach((query) => { void query.refetch(); })}>{t('common.retry', 'Retry')}</Button>
      </Flex>}
      <VStack gap="8" max>
        <Link to="/callcenter/agent" className={styles.link}>
          {t('callcenter.settings.overview.phoneCheck', 'Check phone readiness: start a shift and make a test call')}
        </Link>
        {items.filter((item) => tenant || (item.id !== 'thresholds' && item.id !== 'hotkeys')).map((item) => (
          <Flex
            key={item.id}
            align="center"
            justify="between"
            gap="12"
            wrap="wrap"
            className={`${styles.item} ${item.ok || item.optional ? styles.ok : styles.todo}`}
            data-testid={`cc-readiness-${item.id}`}
            data-state={item.ok ? 'ok' : 'todo'}
          >
            <HStack gap="8" align="center">
              {item.optional && !item.ok ? <Info size={18} aria-hidden="true" /> : item.ok
                ? <CheckCircle2 size={18} className={styles.iconOk} aria-hidden="true" />
                : <CircleAlert size={18} className={styles.iconTodo} aria-hidden="true" />}
              <VStack gap="2">
                <Text className={styles.itemTitle}>{t(TITLE_KEYS[item.id][0], TITLE_KEYS[item.id][1])}</Text>
                <Text variant="muted" className={styles.itemDetail}>
                  <Text as="span" variant="xs" className={styles.statusWord}>
                    {item.optional && !item.ok ? t('callcenter.settings.overview.optional', 'Optional · not in use') : item.ok
                      ? t('callcenter.settings.overview.ok', 'Configured')
                      : t('callcenter.settings.overview.todo', 'Not configured')}
                  </Text>
                  {' · '}
                  {detail(item.id, item.ok, item.count)}
                </Text>
              </VStack>
            </HStack>
            <Link
              to={buildCcSettingsPath(item.tab)}
              className={styles.link}
              data-testid={`cc-readiness-link-${item.id}`}
            >
              {actionLabel(item.id, item.ok)}
            </Link>
          </Flex>
        ))}
      </VStack>
    </VStack>
  );
}
