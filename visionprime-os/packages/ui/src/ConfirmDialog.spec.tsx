import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("only calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConfirmDialog
        isOpen
        title="Delete record"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
