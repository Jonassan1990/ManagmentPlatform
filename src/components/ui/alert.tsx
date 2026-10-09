"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type AlertTone = "info" | "success" | "warning" | "error";

/** Legacy tone names used by existing pages. */
export type LegacyAlertTone = "danger" | "warning" | "ok" | "info";

const toneTokens: Record<
  AlertTone,
  { color: string; soft: string; label: string }
> = {
  info: {
    color: "var(--color-info)",
    soft: "var(--color-info-soft)",
    label: "Information",
  },
  success: {
    color: "var(--color-success)",
    soft: "var(--color-success-soft)",
    label: "Success",
  },
  warning: {
    color: "var(--color-warning)",
    soft: "var(--color-warning-soft)",
    label: "Warning",
  },
  error: {
    color: "var(--color-error)",
    soft: "var(--color-error-soft)",
    label: "Error",
  },
};

function normalizeTone(tone: AlertTone | LegacyAlertTone): AlertTone {
  if (tone === "danger") return "error";
  if (tone === "ok") return "success";
  return tone;
}

export type AlertProps = {
  tone?: AlertTone | LegacyAlertTone;
  title?: string;
  children: ReactNode;
  action?: { href: string; label: string };
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  /**
   * `assertive` → role="alert" (errors/warnings that need attention).
   * `polite` → aria-live polite (info/success).
   */
  live?: "assertive" | "polite" | "off";
};

/**
 * Inline feedback. Prefer this for new code; legacy `tone="danger"|"ok"` still work.
 */
export function Alert({
  tone = "error",
  title,
  children,
  action,
  dismissible = false,
  onDismiss,
  className,
  live,
}: AlertProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const resolved = normalizeTone(tone);
  const tokens = toneTokens[resolved];
  const politeness =
    live ??
    (resolved === "error" || resolved === "warning" ? "assertive" : "polite");

  return (
    <div
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness === "off" ? undefined : politeness}
      className={cn(
        "relative rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        className,
      )}
      style={{
        borderColor: tokens.color,
        color: tokens.color,
        background: tokens.soft,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          {title ? (
            <p className="text-xs font-semibold uppercase tracking-wide">
              {title}
            </p>
          ) : (
            <span className="sr-only">{tokens.label}</span>
          )}
          <div className={title ? "text-[var(--color-text)]" : undefined}>
            {children}
          </div>
          {action ? (
            <a
              href={action.href}
              className="inline-block pt-1 font-medium underline underline-offset-2"
              style={{ color: tokens.color }}
            >
              {action.label}
            </a>
          ) : null}
        </div>
        {dismissible ? (
          <button
            type="button"
            className="shrink-0 rounded px-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(true);
              onDismiss?.();
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Alias for documentation / call sites that prefer InlineFeedback naming. */
export const InlineFeedback = Alert;
