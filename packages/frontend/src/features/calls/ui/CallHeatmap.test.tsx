import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CallCalendarDay } from "@krasterisk/shared";
import { CallHeatmap } from "./CallHeatmap";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
const link = (from: string, to: string) =>
  `/reports/calls?from=${from}&to=${to}&employees=101`;
const day = (date = "2026-11-01"): CallCalendarDay => ({
  date,
  from: `${date}T04:00:00Z`,
  to: `${date}T08:00:00Z`,
  total: 3,
  human: 2,
  missed: 1,
  unknown: 0,
  hours: [
    {
      hour: 1,
      offsetMinutes: -240,
      from: `${date}T05:00:00Z`,
      to: `${date}T06:00:00Z`,
      total: 1,
      human: 1,
      missed: 0,
      unknown: 0,
    },
    {
      hour: 1,
      offsetMinutes: -300,
      from: `${date}T06:00:00Z`,
      to: `${date}T07:00:00Z`,
      total: 2,
      human: 1,
      missed: 1,
      unknown: 0,
    },
    {
      hour: 2,
      offsetMinutes: -300,
      from: `${date}T07:00:00Z`,
      to: `${date}T08:00:00Z`,
      total: 0,
      human: 0,
      missed: 0,
      unknown: 0,
    },
  ],
});
describe("calendar call heatmap", () => {
  it("offers separate exact links for repeated local hours and keeps empty/outside hours distinct", () => {
    render(
      <MemoryRouter>
        <CallHeatmap days={[day()]} periodHref={link} />
      </MemoryRouter>,
    );
    const first = screen.getByRole("link", { name: /01:00 UTC−04:00/ });
    const second = screen.getByRole("link", { name: /01:00 UTC−05:00/ });
    expect(first).toHaveAttribute(
      "href",
      link("2026-11-01T05:00:00Z", "2026-11-01T06:00:00Z"),
    );
    expect(second).toHaveAttribute(
      "href",
      link("2026-11-01T06:00:00Z", "2026-11-01T07:00:00Z"),
    );
    expect(
      screen.getByRole("button", { name: /02:00 UTC−05:00/ }),
    ).toBeDisabled();
    expect(screen.getAllByLabelText("calls.heatmapMissing")).toHaveLength(22);
    expect(screen.getByRole("region")).toHaveAttribute("tabindex", "0");
  });
  it("bounds visible days and allows keyboard-usable pagination", () => {
    render(
      <MemoryRouter>
        <CallHeatmap
          days={Array.from({ length: 8 }, (_, i) =>
            day(`2026-11-${String(i + 1).padStart(2, "0")}`),
          )}
          periodHref={link}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("link", { name: /2026-11-08 01:00/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "calls.heatmapNext" }));
    expect(
      screen.getByRole("link", { name: /2026-11-08 01:00 UTC−04:00/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "calls.heatmapNext" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "calls.heatmapPrevious" }),
    );
    expect(
      screen.getByRole("link", { name: /2026-11-01 01:00 UTC−04:00/ }),
    ).toBeInTheDocument();
  });
});
