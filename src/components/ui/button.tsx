import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Optional leading icon (decorative — accessible name comes from children). */
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white hover:brightness-110 disabled:bg-[var(--color-disabled)] disabled:text-white/90",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:text-[var(--color-disabled)]",
  outline:
    "border border-[var(--color-primary)] bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] disabled:border-[var(--color-disabled)] disabled:text-[var(--color-disabled)]",
  ghost:
    "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:text-[var(--color-disabled)]",
  destructive:
    "bg-[var(--color-error)] text-white hover:brightness-110 disabled:bg-[var(--color-disabled)]",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-sm",
};

/**
 * Domain-agnostic Button. Server-component safe (no client hooks).
 * Loading is controlled by the parent; when true the button is disabled
 * to prevent duplicate submission.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  type = "button",
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-[filter,background-color,opacity] duration-[var(--transition-fast)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : (
        iconLeft
      )}
      <span>{children}</span>
      {!loading ? iconRight : null}
    </button>
  );
}
