import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders known status labels", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("renders completed status", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });
});
