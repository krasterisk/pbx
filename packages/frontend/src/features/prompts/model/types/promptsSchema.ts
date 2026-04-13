import type { IPrompt } from '@/entities/prompt';

export interface PromptsSchema {
  isModalOpen: boolean;
  selectedPrompt: IPrompt | null;
  modalMode: 'upload' | 'record' | 'edit';
}

