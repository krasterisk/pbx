import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ContextsTable } from "./ContextsTable";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback?: string | { count?: number; defaultValue?: string },
    ) => {
      if (typeof fallback === "string") return fallback;
      if (fallback && typeof fallback === "object" && fallback.defaultValue) {
        return fallback.defaultValue;
      }
      return key;
    },
  }),
}));

vi.mock("@/shared/hooks/useAppStore", () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock("@/shared/api/api", () => ({
  useGetContextsQuery: () => ({
    data: [
      {
        uid: 1,
        name: "from-internal",
        comment: "Internal routing",
        is_default_for_endpoints: true,
      },
    ],
    isLoading: false,
  }),
  useBulkDeleteContextsMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteContextMutation: () => [vi.fn()],
}));


function selectEntityForActions() {
  const checkbox = screen.getAllByRole("checkbox").find(element => element.closest("tbody") || element.closest("[data-table-activatable]")) as HTMLInputElement | undefined;
  if (!checkbox) throw new Error("Missing entity checkbox");
  if (!checkbox.checked) fireEvent.click(checkbox);
}

function getSelectedDeleteAction() {
  const button = document.querySelector<HTMLButtonElement>("[data-table-delete]");
  if (!button) throw new Error("Missing selected entity delete action");
  return button;
}

describe("ContextsTable", () => {
  it("keeps row activation and accessible remaining actions", () => {
    render(<ContextsTable />);

    const edit = document.querySelector<HTMLElement>(
      '[data-table-activatable="true"]',
    )!;
    selectEntityForActions();
    const del = getSelectedDeleteAction();

    expect(edit).toHaveAttribute("tabindex", "0");
    expect(edit).toHaveAttribute("data-table-activatable", "true");
    expect(del).toHaveAttribute("aria-label");
    expect(del).toHaveAttribute("aria-label");
    expect(
      screen.getByText("contexts.defaultForEndpoints"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("contexts.defaultForTrunks"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
