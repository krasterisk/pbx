import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2 } from 'lucide-react';
import { TenantsTable, TenantFormModal } from '@/features/cloud-admin';
import { SellerSettingsForm } from '@/features/cloud-admin/ui/SellerSettingsForm/SellerSettingsForm';
import { Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import cls from './PlatformPages.module.scss';

type TenantsTab = 'tenants' | 'settings';

/** Platform tenants tools — migrated from SuperAdminPage into /platform/tenants. */
export const PlatformTenantsPage = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TenantsTab>('tenants');

  return (
    <VStack gap="20" max data-testid="platform-tenants-page">
      <Text as="h1" className={cls.pageTitle}>
        {t('platform.tenantsTitle', 'Tenants')}
      </Text>

      <HStack gap="4" className={cls.tabBar}>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'tenants' ? cls.tabActive : ''}`}
          onClick={() => setTab('tenants')}
        >
          <Users className="w-4 h-4" />
          {t('platform.tenantsTab', 'Cabinets')}
        </button>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'settings' ? cls.tabActive : ''}`}
          onClick={() => setTab('settings')}
        >
          <Building2 className="w-4 h-4" />
          {t('platform.sellerTab', 'Seller details')}
        </button>
      </HStack>

      {tab === 'tenants' && (
        <>
          <TenantsTable />
          <TenantFormModal />
        </>
      )}

      {tab === 'settings' && <SellerSettingsForm />}
    </VStack>
  );
};
