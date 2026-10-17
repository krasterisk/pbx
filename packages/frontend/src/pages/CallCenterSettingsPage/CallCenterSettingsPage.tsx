import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, VStack, Flex, Select, Text } from '@/shared/ui';
import { CcPageHeader } from '@/features/callcenter/ui/CcPageHeader';
import {
  buildCcSettingsPath,
  resolveCcSettingsTab,
  type CcSettingsTabId,
} from '@/features/callcenter/lib/settingsUrlState';
import { visibleSettingsGroups } from '@/features/callcenter/lib/settingsNav';
import { OperatorSettingsForm } from '@/features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm';
import { CallCenterSettings } from '@/features/callcenter/ui/CallCenterSettings';
import { AlertThresholdsForm } from '@/features/callcenter/ui/AlertThresholdsForm/AlertThresholdsForm';
import { AlertRoutingForm } from '@/features/callcenter/ui/AlertRoutingForm/AlertRoutingForm';
import { AutoPauseRulesForm } from '@/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm';
import { ShiftPolicyForm } from '@/features/callcenter/ui/ShiftPolicyForm/ShiftPolicyForm';
import { CallbackSettingsForm } from '@/features/callcenter/ui/CallbackSettingsForm/CallbackSettingsForm';
import { DisplayTokensManager } from '@/features/callcenter/ui/DisplayTokensManager/DisplayTokensManager';
import { ReportSchedulesManager } from '@/features/callcenter/ui/ReportSchedulesManager/ReportSchedulesManager';
import { PauseReasonsManager } from '@/features/callcenter/ui/PauseReasonsManager/PauseReasonsManager';
import { PermissionsSettingsPanel } from '@/features/callcenter/ui/PermissionsMatrix';
import { HotkeysSettingsForm } from '@/features/callcenter/ui/HotkeysSettingsForm';
import { CcSettingsOverview } from '@/features/callcenter/ui/CcSettingsOverview';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { CardTemplatesTab } from './ui/CardTemplatesTab/CardTemplatesTab';
import styles from './CallCenterSettingsPage.module.scss';

export type { CcSettingsTabId };

export function CallCenterSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const { section } = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();
  const level = useAppSelector(selectUserLevel);
  const canManagePermissions = level !== undefined && [UserLevel.SUPERADMIN, UserLevel.ADMIN, UserLevel.SUPERVISOR].includes(level);

  const groups = visibleSettingsGroups(canManagePermissions);
  const requestedTab = resolveCcSettingsTab(section, searchParams.get('tab'), 'overview');
  // A section the user may not open (permissions) falls back to the overview.
  const activeTab: CcSettingsTabId = groups.some((g) => g.tabs.includes(requestedTab)) ? requestedTab : 'overview';

  useEffect(() => {
    const legacyTab = searchParams.get('tab');
    if (legacyTab && !section) {
      navigate(buildCcSettingsPath(activeTab), { replace: true });
    }
  }, [activeTab, navigate, searchParams, section]);

  const openTab = (tabId: CcSettingsTabId) => {
    navigate(buildCcSettingsPath(tabId), { replace: true });
  };

  const tabTitle = (tabId: CcSettingsTabId) => t(`callcenter.settings.tabs.${tabId}`, tabId);
  const tabDesc = (tabId: CcSettingsTabId) => t(`callcenter.settings.tabDesc.${tabId}`, '');

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':
        return <CcSettingsOverview />;
      case 'operatorSettings':
        return <OperatorSettingsForm />;
      case 'myPanel':
        return <CallCenterSettings />;
      case 'permissions':
        return <PermissionsSettingsPanel />;
      case 'alertThresholds':
        return (
          <VStack gap="16" max>
            <AlertThresholdsForm />
            <AlertRoutingForm />
          </VStack>
        );
      case 'cardTemplates':
        return <CardTemplatesTab />;
      case 'pauseReasons':
        return <PauseReasonsManager />;
      case 'autoPause':
        return <AutoPauseRulesForm />;
      case 'shifts':
        return <ShiftPolicyForm />;
      case 'callback':
        return <CallbackSettingsForm />;
      case 'displayTokens':
        return <DisplayTokensManager />;
      case 'reportSchedules':
        return <ReportSchedulesManager />;
      case 'hotkeys':
        return <HotkeysSettingsForm />;
      default:
        return <Text className={styles.placeholder}>{t('callcenter.settings.placeholder')}</Text>;
    }
  };

  return (
    <VStack gap="16" max className={styles.wrapper} data-testid="cc-settings-responsive">
      <CcPageHeader
        title={t('callcenter.settings.title')}
        description={t('callcenter.settings.subtitle')}
      />

      <Flex className={styles.layout} gap="16" align="start">
        {isMobile ? (
          <Select
            className={styles.mobileSelect}
            value={activeTab}
            onChange={(e) => openTab(e.target.value as CcSettingsTabId)}
            aria-label={t('callcenter.settings.menuLabel', 'Settings sections')}
            data-testid="cc-settings-select"
          >
            {groups.map((group) => (
              <optgroup key={group.id} label={t(`callcenter.settings.groups.${group.id}`, group.id)}>
                {group.tabs.map((tabId) => (
                  <option key={tabId} value={tabId}>{tabTitle(tabId)}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        ) : (
          <Flex
            as="nav"
            direction="column"
            gap="12"
            className={styles.menu}
            aria-label={t('callcenter.settings.menuLabel', 'Settings sections')}
            data-testid="cc-settings-menu"
          >
            {groups.map((group) => (
              <VStack key={group.id} gap="2" max>
                {group.tabs.length > 1 || group.id !== 'overview' ? (
                  <Text variant="xs" className={styles.groupTitle}>
                    {t(`callcenter.settings.groups.${group.id}`, group.id)}
                  </Text>
                ) : null}
                {group.tabs.map((tabId) => (
                  <Button
                    key={tabId}
                    type="button"
                    variant="unstyled"
                    size="none"
                    className={`${styles.menuItem} ${activeTab === tabId ? styles.menuItemActive : ''}`}
                    aria-current={activeTab === tabId ? 'page' : undefined}
                    data-testid={`cc-settings-tab-${tabId}`}
                    onClick={() => openTab(tabId)}
                  >
                    <Text as="span" className={styles.menuTitle}>{tabTitle(tabId)}</Text>
                    <Text as="span" variant="xs" className={styles.menuDesc}>{tabDesc(tabId)}</Text>
                  </Button>
                ))}
              </VStack>
            ))}
          </Flex>
        )}

        <Flex className={styles.panel} direction="column" align="start" justify="start" data-testid="cc-settings-panel">
          {activeTab !== 'overview' && <Text variant="muted" role="note">
            {t(`callcenter.settings.scope.${activeTab === 'myPanel' ? 'personal' : activeTab === 'operatorSettings' ? 'operator' : activeTab === 'permissions' ? 'permissions' : 'tenant'}`)}
          </Text>}
          {isMobile && tabDesc(activeTab) ? (
            <Text variant="muted" className={styles.mobileDesc}>{tabDesc(activeTab)}</Text>
          ) : null}
          {renderPanel()}
        </Flex>
      </Flex>
    </VStack>
  );
}
