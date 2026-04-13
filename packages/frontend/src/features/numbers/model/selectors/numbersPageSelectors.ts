import type { RootState as StateSchema } from '@/app/store/store';

export const getNumbersPageIsModalOpen = (state: StateSchema) => state.numbersPage?.isModalOpen || false;
export const getNumbersPageSelectedNumber = (state: StateSchema) => state.numbersPage?.selectedNumber || null;
export const getNumbersPageModalMode = (state: StateSchema) => state.numbersPage?.modalMode || 'create';
