import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, Flex, Text } from '@/shared/ui';
import { OperatorSettingsForm } from '@/features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm';
import { CallCenterSettings } from '@/features/callcenter/ui/CallCenterSettings';
import { AlertThresholdsForm } from '@/features/callcenter/ui/AlertThresholdsForm/AlertThresholdsForm';
import { AlertRoutingForm } from '@/features/callcenter/ui/AlertRoutingForm/AlertRoutingForm';
import { AutoPauseRulesForm } from '@/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm';
import { DisplayTokensManager } from '@/features/callcenter/ui/DisplayTokensManager/DisplayTokensManager';
import { ReportSchedulesManager } from '@/features/callcenter/ui/ReportSchedulesManager/ReportSchedulesManager';
import { PauseReasonsManager } from '@/features/callcenter/ui/PauseReasonsManager/PauseReasonsManager';
import { CardTemplatesTab } from './ui/CardTemplatesTab/CardTemplatesTab';
import styles from './CallCenterSettingsPage.module.scss';

export type CcSettingsTabId =
  | 'cardTemplates'
  | 'pauseReasons'
  | 'autoPause'
  | 'alertThresholds'
  | 'operatorSettings'
  | 'myPanel'
  | 'displayTokens'
  | 'reportSchedules';

const TAB_IDS: CcSettingsTabId[] = [
  'cardTemplates',
  'pauseReasons',
  'autoPause',
  'alertThresholds',
  'operatorSettings',
  'myPanel',
  'displayTokens',
  'reportSchedules',
];

export function CallCenterSettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CcSettingsTabId>('cardTemplates');

  const renderPanel = () => {
    if (activeTab === 'operatorSettings') {
      return <OperatorSettingsForm />;
    }
    if (activeTab === 'myPanel') {
      return <CallCenterSettings />;
    }
    if (activeTab === 'alertThresholds') {
      return (
        <VStack gap="16" max>
          <AlertThresholdsForm />
          <AlertRoutingForm />
        </VStack>
      );
    }
    if (activeTab === 'cardTemplates') {
      return <CardTemplatesTab />;
    }
    if (activeTab === 'pauseReasons') {
      return <PauseReasonsManager />;
    }
    if (activeTab === 'autoPause') {
      return <AutoPauseRulesForm />;
    }
    if (activeTab === 'displayTokens') {
      return <DisplayTokensManager />;
    }
    if (activeTab === 'reportSchedules') {
      return <ReportSchedulesManager />;
    }
    return <Text className={styles.placeholder}>{t('callcenter.settings.placeholder')}</Text>;
  };

  return (
    <VStack gap="16" max className={styles.wrapper} data-testid="cc-settings-responsive">
      <VStack gap="4" className="min-w-0">
        <Text
          variant="h1"
          className="text-lg sm:text-2xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent"
        >
          {t('callcenter.settings.title')}
        </Text>
        <Text className={styles.subtitle}>{t('callcenter.settings.subtitle')}</Text>
      </VStack>

      <div className={styles.tabsRow}>
        {TAB_IDS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            className={`${styles.tab} ${activeTab === tabId ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tabId)}
          >
            {t(`callcenter.settings.tabs.${tabId}`)}
          </button>
        ))}
      </div>

      <Flex className={styles.panel} align="start" justify="start">
        {renderPanel()}
      </Flex>
    </VStack>
  );
}
