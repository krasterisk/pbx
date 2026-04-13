import type { RootState as StateSchema } from '@/app/store/store';

export const getPromptsIsModalOpen = (state: StateSchema) => state.prompts?.isModalOpen || false;
export const getPromptsSelectedPrompt = (state: StateSchema) => state.prompts?.selectedPrompt || null;
export const getPromptsModalMode = (state: StateSchema) => state.prompts?.modalMode || 'create';
