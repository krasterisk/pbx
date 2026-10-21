import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import type { CallsPage, CallsQuery } from "@krasterisk/shared";
import { aiChatReducer } from "@/features/ai-chat/model/slice/aiChatSlice";
import { callResearchSeed } from "@/features/calls/model/callResearchSeed";
import { AskAboutCalls } from "./AskAboutCalls";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "ru" } }),
}));
const page = {
  total: 8,
  rows: [
    { transcript: "SECRET_TRANSCRIPT", caller: { number: "SECRET_PHONE" } },
  ],
  nextCursor: "CURSOR",
  timezone: "Asia/Krasnoyarsk",
  dataAsOf: "2026-10-18T08:00:00Z",
  projectionVersion: "2:7",
  period: { from: "2026-10-17T17:00:00Z", to: "2026-10-18T17:00:00Z" },
  source: { state: "ok", message: null, progress: null },
} as unknown as CallsPage;
describe("call research entry point", () => {
  it("opens the existing chat with exact server bounds, safe filters and revision, excluding rows/auth/pagination", () => {
    const store = configureStore({ reducer: { aiChat: aiChatReducer } });
    render(
      <Provider store={store}>
        <AskAboutCalls
          page={page}
          query={{
            employees: ["101", "102"],
            focusOutcome: "human",
            cursor: "CURSOR",
            limit: 1,
          }}
          busy={false}
          view="overview"
        />
      </Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "calls.askAi" }));
    const chat = store.getState().aiChat;
    expect(chat.isOpen).toBe(true);
    const context = JSON.parse(chat.seedMessage!.split("\n").at(-1)!);
    expect(context.filters).toMatchObject({
      ...page.period,
      employees: ["101", "102"],
      focusOutcome: "human",
    });
    expect(context).toMatchObject({
      projectionVersion: "2:7",
      observedTotal: 8,
      view: "overview",
    });
    expect(chat.seedMessage).not.toMatch(/SECRET|CURSOR|"limit"/);
    const forged = callResearchSeed(
      {
        tenantId: 999,
        accessToken: "SECRET_AUTH",
        employees: ["101"],
      } as CallsQuery,
      page,
      "journal",
      "en",
    )!;
    expect(forged).not.toMatch(/tenantId|accessToken|SECRET_AUTH/);
  });
  it("disables a stale request state or unavailable source and requires an actual server period", () => {
    const store = configureStore({ reducer: { aiChat: aiChatReducer } });
    const view = render(
      <Provider store={store}>
        <AskAboutCalls page={page} query={{}} busy view="journal" />
      </Provider>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    view.rerender(
      <Provider store={store}>
        <AskAboutCalls
          page={{ ...page, period: undefined }}
          query={{}}
          busy={false}
          view="journal"
        />
      </Provider>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    expect(
      callResearchSeed(
        {},
        {
          ...page,
          source: { state: "unavailable", message: "source", progress: null },
        },
        "journal",
        "ru",
      ),
    ).toBeNull();
    expect(store.getState().aiChat.seedMessage).toBeNull();
  });
  it("does not ask a bounded aggregate tool to scan an unbounded history and preserves explicit warnings", () => {
    const seed = callResearchSeed(
      {},
      {
        ...page,
        period: { from: "1970-01-01T00:00:00Z", to: page.period!.to },
        source: { state: "stale", message: "historyStale", progress: 50 },
      },
      "journal",
      "en",
    )!;
    expect(seed).toContain("Start with search_calls");
    expect(seed).toContain("historyStale");
    expect(seed).toContain("not an immutable snapshot");
    expect(callResearchSeed({}, page, 'attention', 'ru')).toContain('list_unreturned_missed');
  });
});
