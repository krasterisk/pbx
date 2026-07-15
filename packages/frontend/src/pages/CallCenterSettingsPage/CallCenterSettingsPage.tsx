import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, Flex, Text } from '@/shared/ui';
import styles from './CallCenterSettingsPage.module.scss';

export type CcSettingsTabId =
  | 'cardTemplates'
  | 'pauseReasons'
  | 'alertThresholds'
  | 'operatorSettings'
  | 'displayTokens';

const TAB_IDS: CcSettingsTabId[] = [
  'cardTemplates',
  'pauseReasons',
  'alertThresholds',
  'operatorSettings',
  'displayTokens',
];

export function CallCenterSettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CcSettingsTabId>('cardTemplates');

  return (
    <VStack gap="16" max className={styles.wrapper}>
      <VStack gap="4">
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

      <Flex className={styles.panel} align="center" justify="center">
        <Text className={styles.placeholder}>{t('callcenter.settings.placeholder')}</Text>
      </Flex>
    </VStack>
  );
}
