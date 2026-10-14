import { useState, createRef } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCard,
  type TableRef,
} from "./Table";
import { DataTable } from "../DataTable";
import { downloadTableCsv } from "./tableCsv";
import { TableRowAction, TableRowActions } from "../TableRowActions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count ? `${key}:${options.count}` : key,
  }),
}));
type Item = { id: string; name: string; number: number };
const rows: Item[] = [
  { id: "a", name: 'Alpha; "A"', number: 201 },
  { id: "b", name: "Beta", number: 202 },
  { id: "c", name: "Gamma", number: 203 },
];
const columns: ColumnDef<Item>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "number", header: "Number" },
  { id: "actions", header: "Actions", cell: () => <button>Edit</button> },
];

describe("single shared Table", () => {
  let blob: Blob;
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((value: Blob) => {
        blob = value;
        return "blob:table";
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(["row", "card"] as const)(
    "activates a %s with pointer/keyboard while isolating every nested control",
    (mode) => {
      const activate = vi.fn();
      const action = vi.fn();
      const content = (
        <>
          <span>Open entity</span>
          <label>
            <input type="checkbox" />
            Select entity
          </label>
          <button role="switch" aria-checked="false">
            Enabled
          </button>
          <select aria-label="Context">
            <option>Default</option>
          </select>
          <input aria-label="Note" />
          <div
            contentEditable
            suppressContentEditableWarning
            data-testid="inline-editor"
          >
            Draft
          </div>
          <a href="#entity">Open details</a>
          <TableRowActions>
            <TableRowAction aria-label="Copy entity" onClick={action}>
              Copy
            </TableRowAction>
            <TableRowAction disabled aria-label="Delete entity">
              Delete
            </TableRowAction>
          </TableRowActions>
        </>
      );
      render(
        mode === "row" ? (
          <Table showSearch={false} showExport={false}>
            <TableBody>
              <TableRow onActivate={activate}>
                <TableCell>{content}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <TableCard onActivate={activate}>{content}</TableCard>
        ),
      );
      const target = document.querySelector<HTMLElement>(
        '[data-table-activatable="true"]',
      )!;
      fireEvent.click(screen.getByText("Select entity"));
      expect(screen.getByRole("checkbox")).toBeChecked();
      fireEvent.click(screen.getByRole("switch"));
      fireEvent.click(screen.getByLabelText("Context"));
      fireEvent.click(screen.getByLabelText("Note"));
      fireEvent.click(screen.getByTestId("inline-editor"));
      fireEvent.click(screen.getByRole("link"));
      fireEvent.click(screen.getByRole("button", { name: "Copy entity" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete entity" }));
      fireEvent.click(document.querySelector("[data-table-actions]")!);
      fireEvent.keyDown(screen.getByRole("checkbox"), { key: " " });
      fireEvent.keyDown(screen.getByRole("button", { name: "Copy entity" }), {
        key: "Enter",
      });
      expect(action).toHaveBeenCalledOnce();
      expect(activate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText("Open entity"));
      fireEvent.keyDown(target, { key: "Enter" });
      fireEvent.keyDown(target, { key: " " });
      expect(activate).toHaveBeenCalledTimes(3);
      expect(target).toHaveAttribute("tabindex", "0");
    },
  );

  it("keeps read-only rows inactive and lets the whole checkbox cell select without editing", () => {
    const activate = vi.fn();
    render(
      <Table
        data={rows}
        columns={columns}
        selectable
        showSearch={false}
        showExport={false}
        onRowClick={activate}
        canActivateRow={(row: Item) => row.id !== "b"}
      />,
    );
    const activeRow = screen.getByText(rows[0].name).closest("tr")!;
    fireEvent.click(within(activeRow).getByRole("checkbox").closest("td")!);
    expect(within(activeRow).getByRole("checkbox")).toBeChecked();
    expect(activate).not.toHaveBeenCalled();
    const builtin = screen.getByText("Beta").closest("tr")!;
    expect(builtin).not.toHaveAttribute("tabindex");
    fireEvent.click(screen.getByText("Beta"));
    fireEvent.keyDown(builtin, { key: "Enter" });
    expect(activate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(rows[0].name));
    expect(activate).toHaveBeenCalledWith(rows[0]);
  });

  it("keeps DataTable as the same component and shows export only after selection", async () => {
    expect(DataTable).toBe(Table);
    render(<Table data={rows} columns={columns} selectable pageSize={1} />);
    expect(
      screen.queryByRole("button", { name: "common.tableExportCsv" }),
    ).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Beta" },
    });
    expect(screen.getByText("Beta")).toBeVisible();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByText("Beta").closest("tr")!).getByRole("checkbox"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common.tableExportSelected:1" }),
    );
    expect(await blob.text()).toContain("Beta");
    expect(await blob.text()).not.toContain("Gamma");
    expect(await blob.text()).not.toContain("Actions");
  });

  it("disables search and export independently without leaking flags to DOM", () => {
    const view = render(
      <Table
        data={rows}
        columns={columns}
        rowSelection={{ 0: true }}
        showSearch={false}
      />,
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "common.tableExportSelected:1" }),
    ).toBeVisible();
    view.rerender(
      <Table
        data={rows}
        columns={columns}
        rowSelection={{ 0: true }}
        showExport={false}
      />,
    );
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "common.tableExportCsv" }),
    ).not.toBeInTheDocument();
    view.rerender(
      <Table
        data={rows}
        columns={columns}
        showSearch={false}
        showExport={false}
      />,
    );
    expect(document.querySelector("[data-table-toolbar]")).toBeNull();
    expect(screen.getByRole("table")).not.toHaveAttribute("showSearch");
  });

  it("supports controlled search and resets client page after filtering", () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Table
          data={rows}
          columns={columns}
          globalFilter={value}
          onGlobalFilterChange={setValue}
          pageSize={1}
        />
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "common.nextPage" }));
    expect(screen.getByText("Beta")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Gamma" },
    });
    expect(screen.getByText("Gamma")).toBeVisible();
  });

  it("shows domain actions with selection when search and export are disabled in both table modes", () => {
    const view = render(
      <Table
        data={rows}
        columns={columns}
        rowSelection={{ 0: true }}
        showSearch={false}
        showExport={false}
        toolbar={{ actions: <button>Create item</button> }}
      />,
    );
    expect(screen.getByRole("button", { name: "Create item" })).toBeVisible();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    view.rerender(
      <Table
        showSearch={false}
        showExport={false}
        selectedCount={1}
        actions={<button>Create item</button>}
      >
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("button", { name: "Create item" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "common.tableExportCsv" }),
    ).not.toBeInTheDocument();
  });

  it("exports selection outside current filter/page and clears it with the conditional icon", async () => {
    render(
      <Table
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        selectable
        pageSize={1}
        selectRowAriaLabel={(row) => row.id}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "common.selectionBannerClear" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "a" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Gamma" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "common.tableExportSelected:1" }),
    );
    expect(await blob.text()).toContain('"Alpha; ""A"""');
    expect(await blob.text()).not.toContain("Gamma");
    fireEvent.click(
      screen.getByRole("button", { name: "common.selectionBannerClear" }),
    );
    expect(
      screen.queryByRole("button", { name: "common.selectionBannerClear" }),
    ).not.toBeInTheDocument();
  });

  it("exports all filtered client pages and keeps the imperative API", async () => {
    const ref = createRef<TableRef>();
    render(<Table ref={ref} data={rows} columns={columns} pageSize={1} />);
    ref.current?.exportCsv();
    expect(await blob.text()).toContain("Gamma");
    ref.current?.exportCsv();
    expect(await blob.text()).toContain("Beta");
  });

  it("labels server exports as loaded-page scope and supports custom server export handlers", () => {
    const exportAll = vi.fn();
    render(
      <Table
        data={rows}
        columns={columns}
        paginationMode="server"
        totalRows={100}
        currentPage={0}
        onPageChange={vi.fn()}
        onExport={exportAll}
        rowSelection={{ 0: true }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common.tableExportLoadedCsv" }),
    );
    expect(exportAll).toHaveBeenCalledOnce();
  });

  it("uses column accessors and selected IDs for mobile CSV while excluding nonexportable fields", async () => {
    downloadTableCsv({
      data: rows,
      columns: [
        ...columns,
        { accessorKey: "id", header: "Internal", meta: { exportable: false } },
      ],
      getRowId: (row) => row.id,
      globalFilter: "Gamma",
      rowSelection: { a: true },
    });
    const csv = await blob.text();
    expect(csv).toContain("201");
    expect(csv).not.toContain("Gamma");
    expect(csv).not.toContain("Internal");
  });

  it("keeps semantic markup compatible, filters body rows and exports visible text", async () => {
    const ref = createRef<HTMLTableElement>();
    render(
      <Table ref={ref} selectedCount={1}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead exportable={false}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
            <TableCell>
              <button>Edit Alpha</button>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Beta</TableCell>
            <TableCell>
              <button>Edit Beta</button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(ref.current?.tagName).toBe("TABLE");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Beta" },
    });
    expect(screen.getByText("Alpha")).not.toBeVisible();
    expect(within(screen.getByRole("table")).getByText("Beta")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "common.tableExportSelected:1" }),
    );
    const csv = await blob.text();
    expect(csv).toContain("Beta");
    expect(csv).not.toContain("Alpha");
    expect(csv).not.toContain("Actions");
  });
});
