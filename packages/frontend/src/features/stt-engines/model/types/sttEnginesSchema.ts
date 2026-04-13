import type { ISttEngine } from '@/entities/engines';

export interface SttEnginesSchema {
  isModalOpen: boolean;
  selectedEngine: ISttEngine | null;
  modalMode: 'create' | 'edit';
}
