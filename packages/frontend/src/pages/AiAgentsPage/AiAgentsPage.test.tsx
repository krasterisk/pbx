import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock("@/shared/hooks/useIsMobile", () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock("@/shared/api/endpoints/aiAgentsApi", () => ({
  useGetAiAgentsQuery: () => ({
    data: [
      {
        uid: 1,
        name: "Agent",
        unique_id: "a1",
        mode: "cascade",
        model_profile_id: null,
        toolset_id: null,
        enabled: true,
        greeting: "",
      },
    ],
  }),
  useGetAiProvidersQuery: () => ({ data: [] }),
  useGetAiToolsetsQuery: () => ({ data: [] }),
  useDeleteAiAgentMutation: () => [vi.fn()],
  useUpdateAiAgentMutation: () => [vi.fn()],
}));

vi.mock("@/features/ai-agents/ui/AiAgentModal/AiAgentModal", () => ({
  AiAgentModal: () => null,
}));

import { AiAgentsPage } from "./AiAgentsPage";


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

describe("AiAgentsPage", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it("renders title, subtitle and create CTA", () => {
    render(
      <MemoryRouter>
        <AiAgentsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("ai-agents-page-responsive")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "aiAgents.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("aiAgents.subtitle")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aiAgents.newAgent/i }),
    ).toBeInTheDocument();
  });

  it("exposes hybrid-table overflow marker on desktop", () => {
    render(
      <MemoryRouter>
        <AiAgentsPage />
      </MemoryRouter>,
    );
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "overflow-x-auto");
  });

  it("keeps row activation and accessible remaining actions", () => {
    render(
      <MemoryRouter>
        <AiAgentsPage />
      </MemoryRouter>,
    );
    const edit = document.querySelector<HTMLElement>(
      '[data-table-activatable="true"]',
    )!;
    selectEntityForActions();
    const del = getSelectedDeleteAction();
    expect(edit).toHaveAttribute("tabindex", "0");
    expect(edit).toHaveAttribute("data-table-activatable", "true");
    expect(del).toHaveAttribute("aria-label");
    expect(del).toHaveAttribute("aria-label");
  });

  it("renders mobile-card hybrid marker when useIsMobile is true", () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <MemoryRouter>
        <AiAgentsPage />
      </MemoryRouter>,
    );
    const hybrid = screen.getByTestId("hybrid-table");
    expect(hybrid).toHaveAttribute("data-hybrid", "mobile-card");
    expect(screen.getByTestId("ai-agents-mobile-card")).toBeInTheDocument();
  });
});
