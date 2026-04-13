import type { ITtsEngine } from '@/entities/engines';

export interface TtsEnginesSchema {
  isModalOpen: boolean;
  selectedEngine: ITtsEngine | null;
  modalMode: 'create' | 'edit';
}
