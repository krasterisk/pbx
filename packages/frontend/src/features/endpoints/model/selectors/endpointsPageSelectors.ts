import type { EndpointsPageSchema } from "../types/EndpointsPageSchema";
type EndpointsState = { endpointsPage: EndpointsPageSchema };

export const selectEndpointIsModalOpen = (state: EndpointsState) =>
  state.endpointsPage.isModalOpen;
export const selectEndpointIsBulkModalOpen = (state: EndpointsState) =>
  state.endpointsPage.isBulkModalOpen;
export const selectSelectedEndpoint = (state: EndpointsState) =>
  state.endpointsPage.selectedEndpoint;
export const selectEndpointModalMode = (state: EndpointsState) =>
  state.endpointsPage.modalMode;
export const selectEndpointCredentialsSipId = (state: EndpointsState) =>
  state.endpointsPage.credentialsSipId;
