import type { IEndpointListItem } from "@krasterisk/shared";

export interface EndpointsPageSchema {
  isModalOpen: boolean;
  isBulkModalOpen: boolean;
  selectedEndpoint: IEndpointListItem | null;
  modalMode: "create" | "edit";
  credentialsSipId: string | null;
}
