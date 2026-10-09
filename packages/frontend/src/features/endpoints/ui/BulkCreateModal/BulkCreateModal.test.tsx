import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BulkCreateModal } from "./BulkCreateModal";
import type { IBulkJobStatus } from "@krasterisk/shared";
const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  create: vi.fn(),
  active: null as string | null,
  job: undefined as IBulkJobStatus | undefined,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : key,
  }),
}));
vi.mock("@/shared/hooks/useAppStore", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => true,
}));
vi.mock("@/shared/api/endpoints/endpointApi", () => ({
  useBulkCreateEndpointsMutation: () => [mocks.create, { isLoading: false }],
  useGetActiveBulkJobQuery: () => ({ data: { jobId: mocks.active } }),
  useGetBulkJobStatusQuery: () => ({ data: mocks.job, isError: false }),
}));
vi.mock("@/shared/api/endpoints/contextApi", () => ({
  useGetContextsQuery: () => ({ data: [{ uid: 1, name: "internal" }] }),
}));
describe("BulkCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.active = null;
    mocks.job = undefined;
  });
  it("rejects malformed ranges before calling the API", () => {
    render(<BulkCreateModal />);
    fireEvent.change(screen.getByLabelText(/endpoints.bulkExtensionsPattern/), {
      target: { value: "100oops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /common.add/ }));
    expect(screen.getByText("endpoints.invalidRange")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reports failed jobs truthfully and refreshes partially created subscribers", async () => {
    mocks.active = "job1";
    mocks.job = {
      id: "job1",
      total: 3,
      processed: 2,
      created: ["100"],
      skipped: ["101"],
      status: "error",
      error: "Job failed",
    };
    render(<BulkCreateModal />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Job failed");
    expect(screen.queryByText("common.success")).not.toBeInTheDocument();
    expect(screen.getByText("endpoints.bulkCreated:1")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "api/invalidateTags" }),
      ),
    );
  });
});
