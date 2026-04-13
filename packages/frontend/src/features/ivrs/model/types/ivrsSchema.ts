import type { IIvr } from '@/entities/ivr';

export interface IvrsSchema {
  isModalOpen: boolean;
  selectedIvr: IIvr | null;
  modalMode: 'create' | 'edit';
}
