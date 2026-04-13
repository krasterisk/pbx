import type { IMohClass } from '@/entities/moh';

export interface MohSchema {
  isModalOpen: boolean;
  selectedMoh: IMohClass | null;
  modalMode: 'create' | 'edit';
}
