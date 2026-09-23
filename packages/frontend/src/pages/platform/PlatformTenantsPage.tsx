import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Building2, Cpu, Settings, Users } from 'lucide-react';
import { TenantsTable, TenantFormModal } from '@/features/cloud-admin';
import { SellersTable } from '@/features/cloud-admin/ui/SellersTable/SellersTable';
import {
  AgentUsageCard,
  AiChatSettingsCard,
} from '@/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard';
import { GlobalModelsPanel } from '@/features/cloud-admin/ui/GlobalModelsPanel/GlobalModelsPanel';
import { SpeechAnalyticsModelsCard } from '@/features/cloud-admin/ui/SpeechAnalyticsModelsCard/SpeechAnalyticsModelsCard';
import { Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import cls from './PlatformPages.module.scss';

type TenantsTab = 'tenants' | 'sellers' | 'usage' | 'settings' | 'models';

/** Platform tenants tools - migrated from SuperAdminPage into /platform/tenants. */
export const PlatformTenantsPage = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TenantsTab>('tenants');

  return (
    <VStack gap="24" max className={cls.page} data-testid="platform-tenants-page">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Building2 size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('platform.tenantsTitle')}
            </Text>
            <Text variant="muted">{t('platform.tenantsSubtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      <HStack gap="4" className={cls.tabBar}>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'tenants' ? cls.tabActive : ''}`}
          onClick={() => setTab('tenants')}
        >
          <Users size={16} />
          <Text as="span">{t('platform.tenantsTab')}</Text>
        </button>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'sellers' ? cls.tabActive : ''}`}
          onClick={() => setTab('sellers')}
          data-testid="platform-sellers-tab"
        >
          <Building2 size={16} />
          <Text as="span">{t('platform.sellersTab')}</Text>
        </button>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'usage' ? cls.tabActive : ''}`}
          onClick={() => setTab('usage')}
          data-testid="platform-usage-tab"
        >
          <BarChart3 size={16} />
          <Text as="span">{t('platform.usageTab')}</Text>
        </button>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'settings' ? cls.tabActive : ''}`}
          onClick={() => setTab('settings')}
          data-testid="platform-settings-tab"
        >
          <Settings size={16} />
          <Text as="span">{t('platform.settingsTab')}</Text>
        </button>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'models' ? cls.tabActive : ''}`}
          onClick={() => setTab('models')}
          data-testid="platform-models-tab"
        >
          <Cpu size={16} />
          <Text as="span">{t('platform.modelsTab')}</Text>
        </button>
      </HStack>

      {tab === 'tenants' && (
        <Flex direction="column" align="stretch" max className={cls.tableWrap}>
          <TenantsTable />
          <TenantFormModal />
        </Flex>
      )}

      {tab === 'sellers' && <SellersTable />}
      {tab === 'usage' && <AgentUsageCard />}
      {tab === 'settings' && (
        <VStack gap="20" max>
          <AiChatSettingsCard />
          <SpeechAnalyticsModelsCard />
        </VStack>
      )}
      {tab === 'models' && <GlobalModelsPanel />}
    </VStack>
  );
};
