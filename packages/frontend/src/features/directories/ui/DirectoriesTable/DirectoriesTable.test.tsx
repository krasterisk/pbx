import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DirectoriesTable } from "./DirectoriesTable";

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count != null ? `${key}:${opts.count}` : key,
  }),
}));

vi.mock("@/shared/hooks/useIsMobile", () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock("@/shared/hooks/useAppStore", () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock("@/shared/api/endpoints/directoryApi", () => ({
  useGetDirectoriesQuery: vi.fn(() => ({
    data: [
      {
        uid: 1,
        name: "Clients",
        description: "Lookup by phone",
        fields: [{ key: "phone" }],
        records: [{ phone: "7900" }],
      },
    ],
    isLoading: false,
  })),
  useDeleteDirectoryMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock("./useDirectoriesTableColumns", () => ({
  useDirectoriesTableColumns: () => [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", header: "Description" },
  ],
}));

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return {
    ...actual,
    Table: () => <div data-testid="directories-datatable">table</div>,
  };
});


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

describe("DirectoriesTable hybrid responsive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it("renders overflow-x-auto hybrid marker on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    render(<DirectoriesTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "overflow-x-auto");
    expect(screen.getByTestId("directories-table-scroll")).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it("renders mobile-card hybrid marker when useIsMobile is true", () => {
    useIsMobileMock.mockReturnValue(true);
    render(<DirectoriesTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "mobile-card");
    expect(screen.getByTestId("directories-mobile-card")).toBeInTheDocument();
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(
      document.querySelector<HTMLElement>('[data-table-activatable="true"]')!,
    ).toHaveAttribute("tabindex", "0");
    selectEntityForActions();
    expect(screen.getByRole("button", { name: "common.copy" })).toHaveAttribute(
      "aria-label",
      "common.copy",
    );
    expect(
      getSelectedDeleteAction(),
    ).toHaveAttribute("aria-label");
  });
});
