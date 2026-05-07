import type { ITenant } from '@/entities/tenant';

export interface TenantsPageSchema {
  isModalOpen: boolean;
  modalMode: 'create' | 'edit';
  selectedTenant: ITenant | null;
  searchQuery: string;
  statusFilter: string;
}
