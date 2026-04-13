import type { RootState as StateSchema } from '@/app/store/store';

export const getSttEnginesIsModalOpen = (state: StateSchema) => state.sttEngines?.isModalOpen || false;
export const getSttEnginesSelectedEngine = (state: StateSchema) => state.sttEngines?.selectedEngine || null;
export const getSttEnginesModalMode = (state: StateSchema) => state.sttEngines?.modalMode || 'create';
