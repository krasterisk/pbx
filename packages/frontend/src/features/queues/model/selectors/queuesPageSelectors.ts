import { RootState } from '@/app/store/store';

export const selectQueuesIsModalOpen = (state: RootState) => state.queuesPage.isModalOpen;
export const selectQueuesModalMode = (state: RootState) => state.queuesPage.modalMode;
export const selectQueuesSelectedName = (state: RootState) => state.queuesPage.selectedQueueName;
