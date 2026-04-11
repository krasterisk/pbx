/**
 * Feature: Endpoints Management — Public API
 */

// Slice
export { endpointsPageReducer, endpointsPageActions } from './model/slice/endpointsPageSlice';
export type { EndpointsPageSchema } from './model/slice/endpointsPageSlice';

// Selectors
export {
  selectEndpointIsModalOpen,
  selectEndpointIsBulkModalOpen,
  selectSelectedEndpoint,
  selectEndpointModalMode,
} from './model/selectors/endpointsPageSelectors';

// UI Components
export { EndpointsTable } from './ui/EndpointsTable/EndpointsTable';
export { EndpointFormModal } from './ui/EndpointFormModal/EndpointFormModal';
export { BulkCreateModal } from './ui/BulkCreateModal/BulkCreateModal';
export { SipCredentialsModal } from './ui/SipCredentialsModal/SipCredentialsModal';
