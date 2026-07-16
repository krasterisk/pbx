import { memo } from 'react';
import { TenantModulesPanel } from '@/features/modules/ui/TenantModulesPanel/TenantModulesPanel';

/** System → Modules — tenant enable/disable + Buy (D-22). */
export const SystemModulesPage = memo(function SystemModulesPage() {
  return <TenantModulesPanel />;
});
