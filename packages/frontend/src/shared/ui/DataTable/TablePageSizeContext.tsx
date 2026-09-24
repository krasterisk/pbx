import { createContext, useContext } from 'react';

/** Tenant cabinet page size. Null outside the tenant shell, so tables keep their own prop. */
export const TablePageSizeContext = createContext<number | null>(null);

export function useTenantTablePageSize(): number | null {
  return useContext(TablePageSizeContext);
}
