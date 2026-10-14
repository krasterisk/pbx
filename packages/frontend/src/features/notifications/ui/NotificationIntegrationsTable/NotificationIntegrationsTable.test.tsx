import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NotificationIntegrationsTable } from "./NotificationIntegrationsTable";

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

vi.mock("@/shared/api/endpoints/notificationApi", () => ({
  useGetNotificationsQuery: vi.fn(() => ({
    data: [
      {
        uid: 1,
        name: "Sales Telegram",
        channel: "telegram",
        config: {},
        user_uid: 1,
      },
    ],
    isLoading: false,
  })),
  useDeleteNotificationMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock("./useNotificationIntegrationsTableColumns", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("./useNotificationIntegrationsTableColumns")
    >();
  return {
    ...actual,
    useNotificationIntegrationsTableColumns: () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "channel", header: "Channel" },
    ],
  };
});

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return {
    ...actual,
    Table: () => <div data-testid="notifications-datatable">table</div>,
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

describe("NotificationIntegrationsTable hybrid responsive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it("renders overflow-x-auto hybrid marker on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    render(<NotificationIntegrationsTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "overflow-x-auto");
    expect(
      screen.getByTestId("notifications-table-scroll"),
    ).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it("renders mobile-card hybrid marker when useIsMobile is true", () => {
    useIsMobileMock.mockReturnValue(true);
    render(<NotificationIntegrationsTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "mobile-card");
    expect(screen.getByTestId("notifications-mobile-card")).toBeInTheDocument();
    expect(screen.getByText("Sales Telegram")).toBeInTheDocument();
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
