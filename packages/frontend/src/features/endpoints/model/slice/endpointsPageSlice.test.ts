import { describe, it, expect } from "vitest";
import {
  endpointsPageReducer,
  endpointsPageActions,
} from "./endpointsPageSlice";
import type { EndpointsPageSchema } from "./endpointsPageSlice";

const mockEndpoint = {
  id: "sip1",
  extension: "100",
  sipUsername: "sip1",
  callerid: "User 1",
  context: "from-internal",
  transport: "transport-udp",
  allow: "ulaw",
  status: "offline" as const,
  userAgent: null,
  clientIp: null,
  contactUri: null,
  lastRegistered: null,
  tenantid: "100",
  authType: "userpass",
};

describe("endpointsPageSlice", () => {
  const initialState: EndpointsPageSchema = {
    isModalOpen: false,
    isBulkModalOpen: false,
    selectedEndpoint: null,
    modalMode: "create",
    credentialsSipId: null,
  };

  it("should return initial state", () => {
    expect(endpointsPageReducer(undefined, { type: "unknown" })).toEqual(
      initialState,
    );
  });

  it("should handle openCreateModal", () => {
    const state = endpointsPageReducer(
      initialState,
      endpointsPageActions.openCreateModal(),
    );
    expect(state.isModalOpen).toBe(true);
    expect(state.modalMode).toBe("create");
  });

  it("should handle openEditModal", () => {
    const state = endpointsPageReducer(
      initialState,
      endpointsPageActions.openEditModal(mockEndpoint),
    );
    expect(state.isModalOpen).toBe(true);
    expect(state.modalMode).toBe("edit");
    expect(state.selectedEndpoint).toEqual(mockEndpoint);
  });

  it("should handle credentials modal", () => {
    const state = endpointsPageReducer(
      initialState,
      endpointsPageActions.openCredentialsModal("sip1"),
    );
    expect(state.credentialsSipId).toBe("sip1");
    const closedState = endpointsPageReducer(
      state,
      endpointsPageActions.closeCredentialsModal(),
    );
    expect(closedState.credentialsSipId).toBeNull();
  });

  it("clears the selected endpoint when closing or reopening in create mode", () => {
    const edited = endpointsPageReducer(
      initialState,
      endpointsPageActions.openEditModal(mockEndpoint),
    );
    expect(
      endpointsPageReducer(edited, endpointsPageActions.closeModal()),
    ).toMatchObject({ isModalOpen: false, selectedEndpoint: null });
    const created = endpointsPageReducer(
      edited,
      endpointsPageActions.openCreateModal(),
    );
    expect(created.selectedEndpoint).toBeNull();
    expect(created.modalMode).toBe("create");
  });

  it("closes the bulk dialog independently of the endpoint draft", () => {
    const edited = endpointsPageReducer(
      initialState,
      endpointsPageActions.openEditModal(mockEndpoint),
    );
    const opened = endpointsPageReducer(
      edited,
      endpointsPageActions.openBulkModal(),
    );
    const closed = endpointsPageReducer(
      opened,
      endpointsPageActions.closeBulkModal(),
    );
    expect(closed.isBulkModalOpen).toBe(false);
    expect(closed.selectedEndpoint).toEqual(mockEndpoint);
    expect(closed.isModalOpen).toBe(true);
  });
});
