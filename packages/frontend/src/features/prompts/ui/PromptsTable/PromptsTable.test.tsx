import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { PromptsTable } from "./PromptsTable";
import { promptsReducer } from "../../model/slice/promptsSlice";
import * as apiHooks from "@/shared/api/endpoints/promptsApi";

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback?:
        | string
        | { defaultValue?: string; count?: number; name?: string },
    ) => {
      if (typeof fallback === "string") return fallback || key;
      if (fallback && typeof fallback === "object") {
        if (fallback.defaultValue) return fallback.defaultValue;
        if (fallback.count != null) return `${key}:${fallback.count}`;
      }
      return key;
    },
  }),
}));

vi.mock("@/shared/hooks/useIsMobile", () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock("@/shared/api/endpoints/promptsApi", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetPromptsQuery: vi.fn(),
    useDeletePromptMutation: vi.fn(),
    useBulkDeletePromptsMutation: vi.fn(),
  };
});

const mockDispatch = vi.fn();
vi.mock("@/shared/hooks/useAppStore", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(),
}));

const renderWithStore = (ui: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      prompts: promptsReducer,
    },
  });
  return render(<Provider store={store}>{ui}</Provider>);
};

const mockPrompts = [
  {
    uid: 1,
    filename: "welcome",
    comment: "Welcome",
    description: "",
    user_uid: 1,
    source_type: "file" as const,
    tts: null,
  },
  {
    uid: 2,
    filename: "hold",
    comment: "Hold music",
    description: "Очередь ожидания",
    user_uid: 1,
    source_type: "tts" as const,
    tts: { text: "Подождите", engine_uid: 1 },
  },
];


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

describe("PromptsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
    (apiHooks.useGetPromptsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPrompts,
      isLoading: false,
    });
    (
      apiHooks.useDeletePromptMutation as ReturnType<typeof vi.fn>
    ).mockReturnValue([vi.fn()]);
    (
      apiHooks.useBulkDeletePromptsMutation as ReturnType<typeof vi.fn>
    ).mockReturnValue([vi.fn(), { isLoading: false }]);
  });

  it("renders table rows", () => {
    renderWithStore(<PromptsTable />);
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Hold music")).toBeInTheDocument();
    expect(screen.getByText("Очередь ожидания")).toBeInTheDocument();
  });

  it("shows row numbers starting from 1", () => {
    renderWithStore(<PromptsTable />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("keeps row activation and accessible remaining actions", () => {
    renderWithStore(<PromptsTable />);
    const edit = Array.from(
      document.querySelectorAll<HTMLElement>('[data-table-activatable="true"]'),
    )[0];
    selectEntityForActions();
    const del = [getSelectedDeleteAction()][0];
    expect(edit).toHaveAttribute("tabindex", "0");
    expect(edit).toHaveAttribute("data-table-activatable", "true");
    expect(del).toHaveAttribute("aria-label");
    expect(del).toHaveAttribute("aria-label");
  });

  it("renders overflow-x-auto hybrid marker on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    renderWithStore(<PromptsTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "overflow-x-auto");
    expect(screen.getByTestId("prompts-table-scroll")).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it("renders mobile-card hybrid marker when useIsMobile is true", () => {
    useIsMobileMock.mockReturnValue(true);
    renderWithStore(<PromptsTable />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "mobile-card");
    expect(screen.getAllByTestId("prompts-mobile-card").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-table-activatable="true"]',
        ),
      ).length,
    ).toBeGreaterThan(0);
    selectEntityForActions();
    expect(
      [getSelectedDeleteAction()].length,
    ).toBeGreaterThan(0);
  });
});
