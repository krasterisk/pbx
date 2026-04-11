import type { RootState } from '@/app/store/store';

export const selectEndpointIsModalOpen = (state: RootState) => state.endpointsPage.isModalOpen;
export const selectEndpointIsBulkModalOpen = (state: RootState) => state.endpointsPage.isBulkModalOpen;
export const selectSelectedEndpoint = (state: RootState) => state.endpointsPage.selectedEndpoint;
export const selectEndpointModalMode = (state: RootState) => state.endpointsPage.modalMode;
export const selectEndpointCredentialsSipId = (state: RootState) => state.endpointsPage.credentialsSipId;
