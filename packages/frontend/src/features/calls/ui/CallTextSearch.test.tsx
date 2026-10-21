import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { CallTextSearch } from "./CallTextSearch";
const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: false,
  errorDetails: undefined as unknown,
  fetching: false,
  query: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "ru" } }),
}));
vi.mock("./CallDetailSheet", () => ({ partyLabel: () => "Участник" }));
vi.mock("@/shared/api/endpoints/callsApi", () => ({
  useSearchCompanyCallTextQuery: (...args: unknown[]) => {
    state.query(...args);
    return {
      currentData: state.data,
      isFetching: state.fetching,
      isError: state.error,
      error: state.errorDetails,
      refetch: vi.fn(),
    };
  },
}));
beforeEach(() => {
  state.data = undefined;
  state.error = false;
  state.errorDetails = undefined;
  state.fetching = false;
  state.query.mockClear();
});
describe("conversation phrase search", () => {
  it('explains privacy-limited results without recommending a narrower period as a remedy', async () => {
    state.data = {rows: [], coverage: {}, partialReasons: ['privacy_limited'], semantic: {state: 'ready', indexedWindows: 1, totalWindows: 1}};
    render(<CallTextSearch query={{}} onOpen={vi.fn()} allowSemantic />);
    await disclose();
    fireEvent.change(screen.getByLabelText('calls.textSearch.mode'), {target: {value: 'semantic'}});
    fireEvent.change(screen.getByLabelText('calls.textSearch.phrase'), {target: {value: 'стоимость доставки'}});
    fireEvent.click(screen.getByRole('button', {name: 'calls.textSearch.submit'}));
    expect(screen.getByText('calls.textSearch.reason.privacy_limited')).toBeInTheDocument();
    expect(screen.queryByText('calls.textSearch.partial')).not.toBeInTheDocument();
  });
  async function disclose() {
    const summary = screen.getByRole("button", {
      name: "calls.textSearch.title",
    });
    fireEvent.click(summary);
    await waitFor(() =>
      expect(summary).toHaveAttribute("aria-expanded", "true"),
    );
  }
  it("requests semantic search explicitly and explains incomplete/unavailable indexing", async () => {
    const view = render(
      <CallTextSearch query={{}} onOpen={vi.fn()} allowSemantic />,
    );
    await disclose();
    fireEvent.change(screen.getByLabelText("calls.textSearch.mode"), {
      target: { value: "semantic" },
    });
    fireEvent.change(screen.getByLabelText("calls.textSearch.phrase"), {
      target: { value: "клиент хочет уйти" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "calls.textSearch.submit" }),
    );
    expect(state.query).toHaveBeenLastCalledWith(
      { cohort: {}, phrase: "клиент хочет уйти", mode: "semantic" },
      expect.objectContaining({ skip: false }),
    );
    state.data = {
      rows: [],
      coverage: {},
      partialReasons: ["indexing"],
      semantic: { state: "indexing", indexedWindows: 1, totalWindows: 2 },
    };
    view.rerender(<CallTextSearch query={{}} onOpen={vi.fn()} allowSemantic />);
    expect(
      screen.getByText("calls.textSearch.semanticState.indexing"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("calls.textSearch.empty"),
    ).not.toBeInTheDocument();
    state.data = {
      rows: [],
      coverage: {},
      partialReasons: [],
      semantic: { state: "unavailable", indexedWindows: 0, totalWindows: 0 },
    };
    view.rerender(<CallTextSearch query={{}} onOpen={vi.fn()} allowSemantic />);
    expect(
      screen.getByText("calls.textSearch.semanticState.unavailable"),
    ).toBeInTheDocument();
  });
  it("submits the current cohort explicitly, escapes snippets and opens the exact segment", async () => {
    const open = vi.fn(),
      query = { direction: "in" as const };
    const view = render(<CallTextSearch query={query} onOpen={open} />);
    await disclose();
    expect(state.query).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
    fireEvent.change(screen.getByLabelText("calls.textSearch.phrase"), {
      target: { value: "договор" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "calls.textSearch.submit" }),
    );
    expect(state.query).toHaveBeenLastCalledWith(
      { cohort: query, phrase: "договор" },
      expect.objectContaining({ skip: false }),
    );
    state.data = {
      rows: [
        {
          callId: "call",
          caller: {kind:'external',id:null,name:'Клиент',number:null,department:null},
          recipient: {kind:'employee',id:'201',name:'Анна',number:null,department:null},
          segmentId: "seg",
          startedAt: "2026-10-18T00:00:00Z",
          startMs: 1000,
          speaker: "client",
          snippet: "<script>unsafe()</script>",
        },
      ],
      timezone: "UTC",
      coverage: {
        cohortCalls: 8,
        consideredCalls: 8,
        eligibleCalls: 1,
        scannedSegments: 10,
      },
      partialReasons: ["call_limit"],
    };
    view.rerender(<CallTextSearch query={query} onOpen={open} />);
    expect(screen.getByText("<script>unsafe()</script>")).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
    expect(screen.getByText(/calls.textSearch.partial/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "calls.textSearch.open" }),
    );
    expect(open).toHaveBeenCalledWith("call", "seg");
    state.error = true;
    view.rerender(<CallTextSearch query={query} onOpen={open} />);
    expect(
      screen.queryByText("<script>unsafe()</script>"),
    ).not.toBeInTheDocument();
  });
  it("keeps current results stable during refresh, hides failures and stops hidden searches", async () => {
    state.data = {
      rows: [],
      timezone: "UTC",
      coverage: {},
      partialReasons: [],
    };
    const view = render(<CallTextSearch query={{}} onOpen={vi.fn()} />);
    await disclose();
    fireEvent.change(screen.getByLabelText("calls.textSearch.phrase"), {
      target: { value: "фраза" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "calls.textSearch.submit" }),
    );
    expect(screen.getByText("calls.textSearch.empty")).toBeInTheDocument();
    state.fetching = true;
    view.rerender(<CallTextSearch query={{}} onOpen={vi.fn()} />);
    expect(screen.queryByText("calls.textSearch.empty")).toBeInTheDocument();
    state.error = true;
    state.errorDetails = {status:503,data:{code:'CDR_SEARCH_QUERY_REDACTED'}};
    view.rerender(<CallTextSearch query={{}} onOpen={vi.fn()} />);
    expect(screen.getByText('calls.textSearch.queryRedacted')).toBeInTheDocument();
    expect(
      screen.queryByText("calls.textSearch.empty"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "calls.textSearch.title" }),
    );
    await waitFor(() =>
      expect(state.query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      ),
    );
  });
});
