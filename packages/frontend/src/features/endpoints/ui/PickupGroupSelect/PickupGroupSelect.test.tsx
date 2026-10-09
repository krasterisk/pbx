import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PickupGroupSelect } from "./PickupGroupSelect";
const mocks = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/shared/api/endpoints/pickupGroupApi", () => ({
  useGetPickupGroupsQuery: () => ({
    data: [{ uid: 1, name: "Sales", slug: "sales" }],
  }),
  useCreatePickupGroupMutation: () => [mocks.create, { isLoading: false }],
  useDeletePickupGroupMutation: () => [mocks.remove, { isLoading: false }],
}));
describe("PickupGroupSelect", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps selection after a failed global delete and removes it only after success", async () => {
    const user = userEvent.setup(),
      onChange = vi.fn();
    mocks.remove
      .mockReturnValueOnce({
        unwrap: () => Promise.reject({ data: { message: "Delete failed" } }),
      })
      .mockReturnValueOnce({ unwrap: () => Promise.resolve() });
    render(
      <PickupGroupSelect
        label="Groups"
        selectedSlugs={["sales"]}
        onChange={onChange}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "endpoints.deleteGroup" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "common.deleteSelected",
      }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Delete failed",
    );
    expect(onChange).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", {
        name: "common.deleteSelected",
      }),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });
  it("adds a group with Enter without submitting the surrounding form", async () => {
    const user = userEvent.setup(),
      onChange = vi.fn(),
      submit = vi.fn((event) => event.preventDefault());
    mocks.create.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ uid: 2, name: "Support", slug: "support" }),
    });
    render(
      <form onSubmit={submit}>
        <PickupGroupSelect
          label="Groups"
          selectedSlugs={[]}
          onChange={onChange}
        />
      </form>,
    );
    await user.click(
      screen.getByRole("button", { name: "endpoints.addGroup" }),
    );
    await user.type(screen.getByRole("textbox"), " Support{Enter}");
    expect(mocks.create).toHaveBeenCalledWith({ name: "Support" });
    expect(onChange).toHaveBeenCalledWith(["support"]);
    expect(submit).not.toHaveBeenCalled();
  });
});
