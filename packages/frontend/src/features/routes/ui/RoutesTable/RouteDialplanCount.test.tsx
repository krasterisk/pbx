import { fireEvent, render, screen, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import type { IRoute, IRouteAction } from "@krasterisk/shared";
import { ru } from "@/shared/config/locales/ru";
import { en } from "@/shared/config/locales/en";
import { Table } from "@/shared/ui";
import { DialplanActionsSummary } from "@/features/dialplan-apps";
import { useRoutesTableColumns } from "./useRoutesTableColumns";

vi.mock("@/features/dialplan-apps/model/useSchemaRefs", () => ({
  useSchemaRefs: () => ({
    voiceRobots: {
      items: [{ value: "41", label: "Support robot" }],
      isLoading: false,
    },
    queues: {
      items: [{ value: "q700_0", label: "700 - Support", aliases: ["700"] }],
      isLoading: false,
    },
  }),
}));

const actions: IRouteAction[] = [
  { id: "robot", type: "voicerobot", params: { robot_uid: 41 }, condition: {} },
  {
    id: "queue",
    type: "toqueue",
    params: { target: { source: "fixed", value: "q700_0" } },
    condition: {},
    enabled: false,
  },
  { id: "finish", type: "hangup", params: { causecode: "16" }, condition: {} },
];

async function locale(language: "ru" | "en") {
  const instance = createInstance();
  await instance.init({
    lng: language,
    resources: { ru: { translation: ru }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return instance;
}

describe("route Dialplan preview", () => {
  it.each(["ru", "en"] as const)(
    "uses editor summaries and catalog names in %s, keeping disabled steps and ordering",
    async (language) => {
      const instance = await locale(language);
      render(
        <I18nextProvider i18n={instance}>
          <DialplanActionsSummary actions={actions} />
        </I18nextProvider>,
      );
      const steps = screen.getAllByRole("listitem");
      expect(steps).toHaveLength(3);
      expect(steps[0]).toHaveTextContent("Support robot");
      expect(steps[1]).toHaveTextContent("700 - Support");
      expect(steps[1]).toHaveTextContent(
        instance.t("routes.chain.badge.disabled"),
      );
      expect(steps[2]).toHaveTextContent(
        instance.t("routes.apps.hangup.cause16"),
      );
      expect(screen.getByRole("list")).not.toHaveTextContent("q700_0");
    },
  );

  it("handles empty and unknown legacy actions without exposing raw parameters", async () => {
    const instance = await locale("en");
    const view = render(
      <I18nextProvider i18n={instance}>
        <DialplanActionsSummary actions={[]} />
      </I18nextProvider>,
    );
    expect(
      screen.getByText(instance.t("routes.chain.empty.readOnly")),
    ).toBeVisible();
    view.rerender(
      <I18nextProvider i18n={instance}>
        <DialplanActionsSummary
          actions={[
            {
              id: "legacy",
              type: "legacy_action" as IRouteAction["type"],
              params: { secret: "private-value" },
              condition: {},
            },
          ]}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("legacy_action");
    expect(screen.getByRole("listitem")).toHaveTextContent(
      instance.t("routes.chain.unknown.summary"),
    );
    expect(screen.getByRole("listitem")).not.toHaveTextContent("private-value");
  });

  it("places Route Name before Context and opens the number tooltip without editing the row", async () => {
    const instance = await locale("en");
    const edit = vi.fn();
    function RouteTable() {
      const columns = useRoutesTableColumns({ 10: "sip-in" });
      const route = {
        uid: 1,
        priority: 1,
        active: 1,
        context_uid: 10,
        name: "Support route",
        extensions: ["700"],
        actions,
      } as IRoute;
      return (
        <Table
          data={[route]}
          columns={columns}
          onRowClick={edit}
          showSearch={false}
          showExport={false}
        />
      );
    }
    render(
      <I18nextProvider i18n={instance}>
        <RouteTable />
      </I18nextProvider>,
    );
    const headings = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headings.indexOf("Route Name")).toBeLessThan(
      headings.indexOf("Context"),
    );
    expect(headings).toContain("Dialplan");
    expect(headings).not.toContain("Actions");
    fireEvent.click(screen.getByRole("button", { name: "Dialplan: 3" }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Support robot");
    expect(tooltip).toHaveTextContent("700 - Support");
    fireEvent.click(within(tooltip).getByText("Support robot"));
    expect(edit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Support route"));
    expect(edit).toHaveBeenCalledOnce();
  });
});
