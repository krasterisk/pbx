import { useState } from 'react';
import { Users, Building2 } from 'lucide-react';
import { TenantsTable, TenantFormModal } from '@/features/cloud-admin';
import { SellersTable } from '@/features/cloud-admin/ui/SellersTable/SellersTable';
import { VStack } from '@/shared/ui/Stack';
import cls from './SuperAdminPage.module.scss';

type AdminTab = 'tenants' | 'sellers';

/** SuperAdmin dashboard - thin orchestrator page (FSD: pages are ≤50-70 lines) */
export const SuperAdminPage = () => {
  const [tab, setTab] = useState<AdminTab>('tenants');

  return (
    <VStack gap="20" max>
      <div className={cls.tabBar}>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'tenants' ? cls.tabActive : ''}`}
          onClick={() => setTab('tenants')}
        >
          <Users className="w-4 h-4" />
          Кабинеты
        </button>
        <button
          type="button"
          className={`${cls.tab} ${tab === 'sellers' ? cls.tabActive : ''}`}
          onClick={() => setTab('sellers')}
        >
          <Building2 className="w-4 h-4" />
          Поставщики
        </button>
      </div>

      {tab === 'tenants' && (
        <>
          <TenantsTable />
          <TenantFormModal />
        </>
      )}

      {tab === 'sellers' && <SellersTable />}
    </VStack>
  );
};
