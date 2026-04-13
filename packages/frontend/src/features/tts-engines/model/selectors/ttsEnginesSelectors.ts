import type { RootState as StateSchema } from '@/app/store/store';

export const getTtsEnginesIsModalOpen = (state: StateSchema) => state.ttsEngines?.isModalOpen || false;
export const getTtsEnginesSelectedEngine = (state: StateSchema) => state.ttsEngines?.selectedEngine || null;
export const getTtsEnginesModalMode = (state: StateSchema) => state.ttsEngines?.modalMode || 'create';
