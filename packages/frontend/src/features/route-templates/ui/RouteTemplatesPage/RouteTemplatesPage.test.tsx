import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { IRouteTemplate } from "@krasterisk/shared";
import { RouteTemplatesPage } from "./RouteTemplatesPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      typeof fallback === "string" ? fallback : key,
  }),
}));

const rows: IRouteTemplate[] = [
  {
    uid: 1,
    name: "Queue + failover",
    description: "Built-in queue",
    vpbx_user_uid: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    slots: [{ id: "queue", kind: "queue", label: "Queue" }],
    actions: [{ id: "a", type: "toqueue", params: {}, condition: {} }],
  },
  {
    uid: 2,
    name: "Night sales",
    description: "Tenant copy",
    vpbx_user_uid: 42,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
    slots: [],
    actions: [{ id: "h", type: "hangup", params: {}, condition: {} }],
  },
];

vi.mock("@/shared/api/endpoints/routeTemplateApi", () => ({
  useGetRouteTemplatesQuery: () => ({ data: rows, isLoading: false }),
  useDeleteRouteTemplateMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock("../RouteTemplateFormModal/RouteTemplateFormModal", () => ({
  RouteTemplateFormModal: () => <div data-testid="template-form-modal" />,
}));

vi.mock("@/shared/hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

describe("RouteTemplatesPage", () => {
  it("renders the heading, create CTA and source badges", () => {
    render(<RouteTemplatesPage />);
    expect(
      screen.getByTestId("route-templates-page-responsive"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Шаблоны маршрутов/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Создать шаблон/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Встроенный")).toBeInTheDocument();
    expect(screen.getByText("Мой")).toBeInTheDocument();
    expect(screen.getByTestId("hybrid-table")).toHaveAttribute(
      "data-hybrid",
      "overflow-x-auto",
    );
  });

  it("keeps builtin editing/deletion guarded while copying only one selected template", () => {
    render(<RouteTemplatesPage />);

    expect(screen.queryByRole("button", { name: /Копировать/i })).toBeNull();

    expect(
      screen.queryByRole("button", { name: /Изменить/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Queue + failover").closest("tr"),
    ).not.toHaveAttribute("tabindex");
    expect(screen.getByText("Night sales").closest("tr")).toHaveAttribute(
      "tabindex",
      "0",
    );
    const builtin = screen.getByText('Queue + failover').closest('tr')!;
    const own = screen.getByText('Night sales').closest('tr')!;
    fireEvent.click(within(builtin).getByRole('checkbox'));
    const copy = screen.getByRole('button', { name: /Копировать/i });
    expect(copy).toBeEnabled();
    expect(copy.closest('[data-table-toolbar]')).not.toBeNull();
    expect(document.querySelector('[data-table-delete]')).toBeDisabled();
    fireEvent.click(within(own).getByRole('checkbox'));
    expect(screen.queryByRole('button', { name: /Копировать/i })).toBeNull();
    expect(document.querySelector('[data-table-delete]')).toBeEnabled();
  });
});
