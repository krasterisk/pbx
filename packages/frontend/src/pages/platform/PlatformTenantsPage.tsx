import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users } from 'lucide-react';
import { TenantsTable, TenantFormModal } from '@/features/cloud-admin';
import { SellersTable } from '@/features/cloud-admin/ui/SellersTable/SellersTable';
import { Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import cls from './PlatformPages.module.scss';

type TenantsTab = 'tenants' | 'sellers';

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
          <Text as="span">{t('platform.sellerTab')}</Text>
        </button>
      </HStack>

      {tab === 'tenants' && (
        <Flex direction="column" align="stretch" max className={cls.tableWrap}>
          <TenantsTable />
          <TenantFormModal />
        </Flex>
      )}

      {tab === 'sellers' && <SellersTable />}
    </VStack>
  );
};
