import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
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

/**
 * Shared Tegel button classes (WorkMesh / Scania token skin).
 * Use on `<button>` or `<Link>` / `<a>` so chrome stays consistent.
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  const variantClass: Record<ButtonVariant, string> = {
    primary: "primary-button",
    secondary: "secondary-button",
    outline: "outline-button",
    ghost: "ghost-button",
    destructive: "danger-button",
  };
  const sizeClass: Record<ButtonSize, string> = {
    // WCAG 2.2 AA 2.5.5 / 2.5.8: interactive controls meet ≥44×44 CSS px.
    sm: "tegel-btn-sm",
    md: "tegel-btn-md",
    lg: "tegel-btn-lg",
  };
  return cn(variantClass[variant], sizeClass[size], className);
}

/**
 * Domain-agnostic Button — Scania Tegel CSS tokens via shared utilities.
 * Server-component safe (no client hooks).
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
      className={buttonClassName({ variant, size, className })}
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

/** Anchor that looks identical to `Button` — for Next.js `Link` / plain links. */
export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={buttonClassName({ variant, size, className })} {...rest}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </a>
  );
}
