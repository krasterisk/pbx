import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RoutesTable } from "./RoutesTable";

const useIsMobileMock = vi.fn((_bp?: number) => false);
const dispatchMock = vi.hoisted(() => vi.fn());

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
  useAppDispatch: () => dispatchMock,
  useAppSelector: () => [],
}));
vi.mock("@/features/dialplan-apps/model/useSchemaRefs", () => ({ useSchemaRefs: () => ({}) }));

vi.mock("@/shared/api/endpoints/routeApi", () => ({
  useGetAllRoutesQuery: vi.fn(() => ({
    data: [
      {
        uid: 1,
        context_uid: 10,
        name: "Inbound City",
        extensions: ["_XXXXXXXXXX"],
        priority: 1,
        active: 1,
        actions: [],
      },
    ],
    isLoading: false,
  })),
  useBulkDeleteRoutesMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useDeleteRouteMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock("@/shared/api/endpoints/contextApi", () => ({
  useGetContextsQuery: vi.fn(() => ({
    data: [{ uid: 10, name: "from-trunk" }],
  })),
}));

vi.mock("./useRoutesTableColumns", () => ({
  useRoutesTableColumns: () => [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "extensions", header: "Ext" },
  ],
}));

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return {
    ...actual,
    Table: () => <div data-testid="routes-datatable">table</div>,
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

describe("RoutesTable hybrid responsive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it("renders overflow-x-auto hybrid marker on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    render(<RoutesTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "overflow-x-auto");
    expect(screen.getByTestId("routes-table-scroll")).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it("opens Dialplan information in a mobile card without editing it", async () => {
    useIsMobileMock.mockReturnValue(true);
    render(<RoutesTable />);
    fireEvent.click(screen.getByRole("button", { name: "routes.modeRaw: 0" }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("routes.chain.empty.readOnly");
    fireEvent.click(tooltip);
    expect(dispatchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Inbound City"));
    expect(dispatchMock).toHaveBeenCalledOnce();
  });

  it("renders mobile-card hybrid marker when useIsMobile is true", () => {
    useIsMobileMock.mockReturnValue(true);
    render(<RoutesTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "mobile-card");
    expect(screen.getByTestId("routes-mobile-card")).toBeInTheDocument();
    expect(screen.getByText("Inbound City")).toBeInTheDocument();
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
