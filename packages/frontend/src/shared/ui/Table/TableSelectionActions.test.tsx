import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Table } from "./Table";
import { TableCard } from "./TableCard";
import { TableToolbar } from "./TableToolbar";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const data = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];
const columns = [{ accessorKey: "name", header: "Name" }];

function SelectionExample({ mobile = false }: { mobile?: boolean }) {
  const [filter, setFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter: filter });
  const rows = Array.from({ length: 128 }, (_, index) => ({
    id: `stable-${index}`, name: index < 100 ? `Alpha ${index}` : `Beta ${index}`,
  }));
  return <>
    <TableToolbar selection={selection} tableRef={selection.tableRef}
      searchValue={filter} onSearchChange={setFilter}
      exportTable={{ data: rows, columns, getRowId: (row) => row.id,
        globalFilter: filter, rowSelection: selection.rowSelection }} />
    {mobile ? rows.slice(0, 3).map((row) => <TableCard key={row.id}
      selection={selection.cardSelection(row.id, row.name)}>{row.name}</TableCard>) :
      <Table ref={selection.tableRef} data={rows} columns={columns} getRowId={(row) => row.id}
        selectable pageSize={50} showSearch={false} showExport={false}
        globalFilter={filter} rowSelection={selection.rowSelection}
        onRowSelectionChange={selection.onRowSelectionChange} selectAllAriaLabel="Select page" />}
    <span data-testid="selection-mode">{String(selection.allMatchingSelected)}</span>
  </>;
}

describe("one reusable selection toolbar", () => {
  it("replaces page selection with all filtered IDs across pages, then clears it", () => {
    render(<SelectionExample />);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select page" }));
    expect(screen.getByRole("status")).toHaveTextContent("50");
    expect(screen.getByRole("button", { name: "common.tableSelectAll" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "common.tableSelectAll" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("128");
    expect(screen.getByRole("button", { name: "common.tableSelectAll" })).toBeDisabled();
    expect(screen.getByTestId("selection-mode")).toHaveTextContent("true");
    fireEvent.click(screen.getByRole("button", { name: "common.selectionBannerClear" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Select page" })).not.toBeChecked();
  });
  it("selects all matching cards without a desktop ref and resets all-mode on filter change", () => {
    render(<SelectionExample mobile />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha 0" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Alpha" } });
    expect(screen.getByRole("status")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "common.tableSelectAll" }));
    expect(screen.getByRole("status")).toHaveTextContent("100");
    expect(screen.getByRole("button", { name: "common.tableSelectAll" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha 0" }));
    expect(screen.getByRole("button", { name: "common.tableSelectAll" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "common.tableSelectAll" }));
    expect(screen.getByTestId("selection-mode")).toHaveTextContent("true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Beta" } });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("selection-mode")).toHaveTextContent("false");
  });
  it("uses the same controller in the internal table toolbar", () => {
    function Example() {
      const selection = useCrossPageRowSelection({ globalFilter: "" });
      return <Table data={data} columns={columns} getRowId={(row) => row.id} selectable pageSize={1}
        rowSelection={selection.rowSelection} onRowSelectionChange={selection.onRowSelectionChange}
        toolbar={{ selection }} selectAllAriaLabel="Select page" />;
    }
    render(<Example />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select page" }));
    fireEvent.click(screen.getByRole("button", { name: "common.tableSelectAll" }));
    expect(screen.getByRole("status")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "common.tableSelectAll" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "common.selectionBannerClear" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("supports a semantic table using the same selection-only controller", () => {
    function Example() {
      const selection = useCrossPageRowSelection({ globalFilter: "" });
      return <>
        <button onClick={() => selection.cardSelection("a").onCheckedChange(true)}>Choose a</button>
        <Table showSearch={false} showExport={false} selection={selection} selectionRowIds={["a", "b"]}>
          <tbody><tr><td>Semantic rows</td></tr></tbody>
        </Table>
      </>;
    }
    render(<Example />);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose a" }));
    fireEvent.click(screen.getByRole("button", { name: "common.tableSelectAll" }));
    expect(screen.getByRole("status")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: "common.selectionBannerClear" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("selected entity actions", () => {
  it("checks matching identities rather than selected count and keeps the same controls mounted", () => {
    const props = {
      selectedCount: 1,
      onSelectAll: vi.fn(),
      exportTable: { data, columns, getRowId: (row: (typeof data)[number]) => row.id,
        globalFilter: "Alpha", rowSelection: { b: true } },
    };
    const view = render(<TableToolbar {...props} />);
    const selectAll = screen.getByRole("button", { name: "common.tableSelectAll" });
    const search = screen.getByRole("searchbox");
    expect(selectAll).toBeEnabled();
    view.rerender(<TableToolbar {...props} exportTable={{ ...props.exportTable, rowSelection: { a: true } }} />);
    expect(screen.getByRole("button", { name: "common.tableSelectAll" })).toBe(selectAll);
    expect(selectAll).toBeDisabled();
    expect(screen.getByRole("searchbox")).toBe(search);
    fireEvent.click(selectAll);
    expect(props.onSelectAll).not.toHaveBeenCalled();
  });
  it("hides every toolbar action until a row is selected and restores them after selection", () => {
    const props = {
      onSelectAll: vi.fn(),
      onClearSelection: vi.fn(),
      onExport: vi.fn(),
      actions: <button>Domain action</button>,
    };
    const view = render(<TableToolbar {...props} />);
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    view.rerender(<TableToolbar {...props} selectedCount={1} />);
    expect(screen.getByRole("button", { name: "Domain action" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "common.tableExportSelected" }),
    ).toBeVisible();
    view.rerender(<TableToolbar {...props} selectedCount={0} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
  it.each([0, 2])("hides copy for %s selected entities", (count) => {
    render(
      <TableToolbar
        showSearch={false}
        showExport={false}
        selectedCount={count}
        selectedItem={data[0]}
        onCopySelected={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "common.copy" })).toBeNull();
  });

  it("copies the stable selected identity even when search hides that row", () => {
    const copy = vi.fn();
    render(
      <TableToolbar
        selectedCount={1}
        onCopySelected={copy}
        exportTable={{
          data,
          columns,
          getRowId: (row) => row.id,
          globalFilter: "Alpha",
          rowSelection: { b: true },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "common.copy" }));
    expect(copy).toHaveBeenCalledWith(data[1]);
  });

  it("does not copy an unknown or forbidden selected entity", () => {
    const { rerender } = render(
      <TableToolbar
        selectedCount={1}
        onCopySelected={vi.fn()}
        exportTable={{
          data,
          columns,
          getRowId: (row) => row.id,
          rowSelection: { missing: true },
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "common.copy" })).toBeNull();
    rerender(
      <TableToolbar
        selectedCount={1}
        selectedItem={data[0]}
        onCopySelected={vi.fn()}
        canCopySelected={() => false}
      />,
    );
    expect(screen.queryByRole("button", { name: "common.copy" })).toBeNull();
  });

  it("requests deletion only with selection and preserves the disabled guard", () => {
    const remove = vi.fn();
    const { rerender } = render(
      <TableToolbar
        showSearch={false}
        showExport={false}
        selectedCount={0}
        onDeleteSelected={remove}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "common.deleteSelected" }),
    ).toBeNull();
    rerender(
      <TableToolbar
        showSearch={false}
        showExport={false}
        selectedCount={2}
        onDeleteSelected={remove}
        deleteDisabled
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common.deleteSelected" }),
    );
    expect(remove).not.toHaveBeenCalled();
    rerender(
      <TableToolbar
        showSearch={false}
        showExport={false}
        selectedCount={2}
        onDeleteSelected={remove}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common.deleteSelected" }),
    );
    expect(remove).toHaveBeenCalledOnce();
  });

  it("provides selection actions in the internal Table toolbar", () => {
    const copy = vi.fn();
    render(
      <Table
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        selectable
        selectRowAriaLabel={(row) => `Select ${row.id}`}
        toolbar={{ onCopySelected: copy }}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select a" }));
    fireEvent.click(screen.getByRole("button", { name: "common.copy" }));
    expect(copy).toHaveBeenCalledWith(data[0]);
  });

  it("selects a mobile card through the label without opening the editor", () => {
    const edit = vi.fn();
    function Card() {
      const [checked, setChecked] = useState(false);
      return (
        <TableCard
          onActivate={edit}
          selection={{
            checked,
            onCheckedChange: setChecked,
            label: "Select Alpha",
          }}
        >
          Alpha
        </TableCard>
      );
    }
    render(<Card />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Alpha" }).closest("label")!,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(edit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Alpha"));
    expect(edit).toHaveBeenCalledOnce();
  });
});
