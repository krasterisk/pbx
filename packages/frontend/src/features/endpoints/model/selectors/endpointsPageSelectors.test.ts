import { describe, expect, it } from "vitest";
import {
  endpointsPageReducer,
  endpointsPageActions,
} from "../slice/endpointsPageSlice";
import {
  selectEndpointIsModalOpen,
  selectEndpointIsBulkModalOpen,
  selectSelectedEndpoint,
  selectEndpointModalMode,
  selectEndpointCredentialsSipId,
} from "./endpointsPageSelectors";
describe("endpoints selectors", () => {
  it("reads initial state and independently opened dialogs", () => {
    const initial = {
      endpointsPage: endpointsPageReducer(undefined, { type: "init" }),
    };
    expect(selectEndpointIsModalOpen(initial)).toBe(false);
    expect(selectEndpointIsBulkModalOpen(initial)).toBe(false);
    expect(selectSelectedEndpoint(initial)).toBeNull();
    expect(selectEndpointModalMode(initial)).toBe("create");
    expect(selectEndpointCredentialsSipId(initial)).toBeNull();
    const next = {
      endpointsPage: endpointsPageReducer(
        initial.endpointsPage,
        endpointsPageActions.openCredentialsModal("e100"),
      ),
    };
    expect(selectEndpointCredentialsSipId(next)).toBe("e100");
    expect(selectEndpointIsModalOpen(next)).toBe(false);
    expect(
      selectEndpointIsBulkModalOpen({
        endpointsPage: endpointsPageReducer(
          initial.endpointsPage,
          endpointsPageActions.openBulkModal(),
        ),
      }),
    ).toBe(true);
    expect(
      selectEndpointIsModalOpen({
        endpointsPage: endpointsPageReducer(
          initial.endpointsPage,
          endpointsPageActions.openCreateModal(),
        ),
      }),
    ).toBe(true);
  });
});
