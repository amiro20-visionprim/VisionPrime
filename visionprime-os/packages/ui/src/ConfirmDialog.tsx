import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { colors } from "./tokens";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Every destructive admin action (delete, deactivate, manual wallet
 * adjustment, etc. once those modules exist) must route the user
 * through this before executing — see /docs/ui-ux-guidelines.md and
 * /docs/definition-of-done.md financial-feature rules.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = true,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant={isDestructive ? "danger" : "primary"} onClick={onConfirm} isLoading={isConfirming}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ color: colors.text, margin: 0 }}>{message}</p>
    </Modal>
  );
}
