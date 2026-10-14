import type { ReactNode } from 'react';
import { TablePageSizeContext } from '@/shared/ui/Table/TablePageSizeContext';
import { normalizeTablePageSize, useGetTenantSettingsQuery } from '@/entities/tenantSettings';

export function TablePageSizeProvider({ children }: { children: ReactNode }) {
  const { data } = useGetTenantSettingsQuery();
  const pageSize = normalizeTablePageSize(data?.['tables.page_size']);
  return (
    <TablePageSizeContext.Provider value={pageSize}>
      {children}
    </TablePageSizeContext.Provider>
  );
}
