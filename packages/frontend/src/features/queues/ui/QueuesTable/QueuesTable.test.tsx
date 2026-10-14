import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueuesTable } from "./QueuesTable";

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

vi.mock("@/shared/api/endpoints/queueApi", () => ({
  useGetQueuesQuery: vi.fn(() => ({
    data: [
      {
        name: "sales",
        exten: "700",
        display_name: "Sales",
        strategy: "ringall",
        memberCount: 3,
        timeout: 15,
        maxlen: 0,
      },
    ],
    isLoading: false,
  })),
  useDeleteQueueMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock("./useQueuesTableColumns", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./useQueuesTableColumns")>();
  return {
    ...actual,
    useQueuesTableColumns: () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "display_name", header: "Display" },
    ],
  };
});

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return {
    ...actual,
    Table: () => <div data-testid="queues-datatable">table</div>,
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

describe("QueuesTable hybrid responsive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it("renders overflow-x-auto hybrid marker on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    render(<QueuesTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "overflow-x-auto");
    expect(screen.getByTestId("queues-table-scroll")).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it("renders mobile-card hybrid marker when useIsMobile is true", () => {
    useIsMobileMock.mockReturnValue(true);
    render(<QueuesTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "mobile-card");
    expect(screen.getByTestId("queues-mobile-card")).toBeInTheDocument();
    expect(screen.getByText("700")).toBeInTheDocument();
    expect(
      document.querySelector<HTMLElement>('[data-table-activatable="true"]')!,
    ).toBeInTheDocument();
    selectEntityForActions();
    expect(
      screen.getByRole("button", { name: "common.copy" }),
    ).toBeInTheDocument();
    expect(
      getSelectedDeleteAction(),
    ).toBeInTheDocument();
  });
});
