import type { RootState as StateSchema } from '@/app/store/store';

export const getIvrsIsModalOpen = (state: StateSchema) => state.ivrs?.isModalOpen || false;
export const getIvrsSelectedIvr = (state: StateSchema) => state.ivrs?.selectedIvr || null;
export const getIvrsModalMode = (state: StateSchema) => state.ivrs?.modalMode || 'create';
