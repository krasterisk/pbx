import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/hooks/useIsMobile", () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock("@/shared/api/endpoints/aiAgentsApi", () => ({
  useGetAiProvidersQuery: () => ({
    data: [
      {
        uid: 3,
        name: "Office LLM",
        vendor: "openai",
        kind: "online",
        capabilities: ["llm"],
        enabled: true,
      },
    ],
    isLoading: false,
  }),
  useDeleteAiProviderMutation: () => [vi.fn()],
  useGetGlobalAiProvidersQuery: () => ({ data: [], isLoading: false }),
  useDeleteGlobalAiProviderMutation: () => [vi.fn()],
}));

import { AiProvidersTable } from "./AiProvidersTable";

describe("AiProvidersTable", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it("renders row editing and deletion for the selected provider", () => {
    render(<AiProvidersTable onEdit={vi.fn()} />);
    expect(screen.getByText("Office LLM")).toBeInTheDocument();
    const edit = document.querySelector<HTMLElement>(
      '[data-table-activatable="true"]',
    )!;
    expect(document.querySelector('[data-table-delete]')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow' }));
    const del = document.querySelector('[data-table-delete]')!;
    expect(edit).toHaveAttribute("tabindex", "0");
    expect(edit).toHaveAttribute("data-table-activatable", "true");
    expect(del).toHaveAttribute("aria-label");
    expect(del.closest('[data-table-toolbar]')).not.toBeNull();
  });

  it("renders overflow-x-auto hybrid marker on desktop", () => {
    render(<AiProvidersTable onEdit={vi.fn()} />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "overflow-x-auto");
    expect(screen.getByTestId("ai-providers-table-scroll")).toBeInTheDocument();
  });

  it("renders mobile-card hybrid marker when useIsMobile is true", () => {
    useIsMobileMock.mockReturnValue(true);
    render(<AiProvidersTable onEdit={vi.fn()} />);
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "mobile-card");
    expect(screen.getByTestId("ai-providers-mobile-card")).toBeInTheDocument();
    expect(screen.getByText("Office LLM")).toBeInTheDocument();
  });
});
