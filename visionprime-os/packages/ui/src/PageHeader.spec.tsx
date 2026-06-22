import React from "react";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the title and an action", () => {
    render(<PageHeader title="Customers" actions={<button>New Customer</button>} />);
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Customer" })).toBeInTheDocument();
  });
});
