import { useState } from 'react';
import { Users, Building2 } from 'lucide-react';
import { TenantsTable, TenantFormModal } from '@/features/cloud-admin';
import { SellerSettingsForm } from '@/features/cloud-admin/ui/SellerSettingsForm/SellerSettingsForm';
import { VStack } from '@/shared/ui/Stack';
import cls from './SuperAdminPage.module.scss';

type AdminTab = 'tenants' | 'settings';

/** SuperAdmin dashboard — thin orchestrator page (FSD: pages are ≤50-70 lines) */
export const SuperAdminPage = () => {
  const [tab, setTab] = useState<AdminTab>('tenants');

  return (
    <VStack gap="20" max>
      {/* Page tabs */}
      <div className={cls.tabBar}>
        <button
          className={`${cls.tab} ${tab === 'tenants' ? cls.tabActive : ''}`}
          onClick={() => setTab('tenants')}
        >
          <Users className="w-4 h-4" />
          Кабинеты
        </button>
        <button
          className={`${cls.tab} ${tab === 'settings' ? cls.tabActive : ''}`}
          onClick={() => setTab('settings')}
        >
          <Building2 className="w-4 h-4" />
          Реквизиты поставщика
        </button>
      </div>

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
