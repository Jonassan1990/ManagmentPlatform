"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions/organization";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function FormField({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

/** Shared control chrome — uses compatibility CSS vars + design-token focus ring. */
export const fieldClassName =
  "w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled)]";

/** Compatibility wrapper — prefer `Button variant="primary"` for new code. */
export function PrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  title?: string;
}) {
  return (
    <Button
      variant="primary"
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

/** Compatibility wrapper — prefer `Button variant="secondary"` for new code. */
export function SecondaryButton({
  children,
  type = "button",
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  type?: "submit" | "button";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      variant="secondary"
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

/** UI copy when a capability flag blocks a mutating control. */
export const NO_PERMISSION_TITLE =
  "You do not have permission to perform this action.";

export function permissionTitle(allowed: boolean | undefined): string | undefined {
  return allowed === false ? NO_PERMISSION_TITLE : undefined;
}

export function useActionForm<T>(
  action: (input: T) => Promise<ActionResult>,
  onSuccess?: (data: unknown) => void,
) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(input: T) {
    setError(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onSuccess?.(result.data);
      router.refresh();
    });
  }

  return {
    pending,
    error,
    setError,
    submit,
    ErrorAlert: error ? <Alert>{error}</Alert> : null,
  };
}
