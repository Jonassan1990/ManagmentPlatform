"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Footer actions (confirm/cancel, etc.). */
  footer?: ReactNode;
  /** Allow Escape / overlay click to close. Default true. */
  dismissible?: boolean;
  className?: string;
};

/**
 * Accessible modal Dialog built on Radix (focus trap, Escape, restore focus).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissible = true,
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!dismissible && !next) return;
        onOpenChange(next);
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[rgb(16_42_67_/0.45)] data-[state=open]:animate-in" />
        <RadixDialog.Content
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 -translate-y-1/2",
            "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-md)]",
            "max-h-[min(90vh,40rem)] overflow-y-auto focus:outline-none",
            className,
          )}
        >
          <div className="mb-4 space-y-1">
            <RadixDialog.Title
              id={titleId}
              className="font-[family-name:var(--font-display)] text-xl text-[var(--color-text)]"
            >
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description
                id={descriptionId}
                className="text-sm text-[var(--color-text-secondary)]"
              >
                {description}
              </RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">
                Dialog
              </RadixDialog.Description>
            )}
          </div>
          <div>{children}</div>
          {footer ? (
            <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling for irreversible actions. */
  variant?: "default" | "destructive";
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

/**
 * Confirm pattern on Dialog. Failed actions must surface `error` and stay open —
 * callers control error state; this component never auto-closes on failure.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  pending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
      title={title}
      description={description}
      dismissible={!pending}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "primary"}
            loading={pending}
            onClick={() => {
              void onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Review the details above before continuing.
        </p>
      )}
    </Dialog>
  );
}
