import React from "react";
import { render, screen } from "@testing-library/react";
import { DataTable, DataTableColumn } from "./DataTable";

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [{ key: "name", header: "Name" }];

describe("DataTable", () => {
  it("renders a loading state when isLoading is true", () => {
    render(<DataTable columns={columns} rows={[]} isLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders an empty state when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} emptyTitle="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders one row per item", () => {
    const rows: Row[] = [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }];
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getAllByTestId("data-table-row")).toHaveLength(2);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
