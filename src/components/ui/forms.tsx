"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions/organization";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function describedByIds(
  existing: string | undefined,
  ...ids: Array<string | undefined>
): string | undefined {
  const parts = [existing, ...ids].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Field chrome with label, optional hint/error, and ARIA wiring on a single
 * control child (`aria-invalid`, `aria-describedby`, `aria-required`).
 * Does not change validation rules — presentation only.
 */
export function FormField({
  label,
  htmlFor,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  required?: boolean;
}) {
  const errorId = useId();
  const hintId = useId();

  const childArray = Children.toArray(children).filter(Boolean);
  const singleChild =
    childArray.length === 1 && isValidElement(childArray[0])
      ? (childArray[0] as ReactElement<{
          required?: boolean;
          "aria-invalid"?: boolean | "true" | "false";
          "aria-required"?: boolean | "true" | "false";
          "aria-describedby"?: string;
        }>)
      : null;

  const childRequired = Boolean(singleChild?.props.required);
  const isRequired = Boolean(required) || childRequired;
  const hasError = Boolean(error);

  const enhancedChildren = singleChild
    ? cloneElement(singleChild, {
        "aria-invalid": hasError
          ? true
          : singleChild.props["aria-invalid"],
        "aria-required": isRequired
          ? true
          : singleChild.props["aria-required"],
        "aria-describedby": describedByIds(
          singleChild.props["aria-describedby"],
          hint ? hintId : undefined,
          hasError ? errorId : undefined,
        ),
      })
    : children;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {isRequired ? (
          <span className="text-[var(--color-error)]" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {enhancedChildren}
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-[var(--color-error)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shared control chrome — uses compatibility CSS vars + design-token focus ring. */
export const fieldClassName =
  "w-full min-h-11 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled)]";

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
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

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
    ErrorAlert: error ? (
      <div ref={errorRef} tabIndex={-1} className="outline-none">
        <Alert tone="error" live="assertive">
          {error}
        </Alert>
      </div>
    ) : null,
  };
}
