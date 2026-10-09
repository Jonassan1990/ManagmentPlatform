import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tokensPath = path.join(
  process.cwd(),
  "src/styles/design-tokens.css",
);
const globalsPath = path.join(process.cwd(), "src/app/globals.css");

function css(file: string) {
  return readFileSync(file, "utf8");
}

describe("M4B-A design tokens", () => {
  it("defines required semantic color tokens", () => {
    const src = css(tokensPath);
    for (const token of [
      "--color-primary",
      "--color-secondary",
      "--color-accent",
      "--color-bg",
      "--color-surface",
      "--color-border",
      "--color-text",
      "--color-text-secondary",
      "--color-success",
      "--color-warning",
      "--color-error",
      "--color-info",
      "--color-disabled",
      "--color-focus-ring",
    ]) {
      expect(src, token).toContain(token);
    }
  });

  it("preserves compatibility variables used across the app", () => {
    const src = css(tokensPath);
    for (const token of [
      "--bg:",
      "--surface:",
      "--ink:",
      "--muted:",
      "--line:",
      "--accent:",
      "--accent-soft:",
      "--danger:",
      "--warning:",
      "--ok:",
      "--sidebar:",
      "--sidebar-ink:",
      "--sidebar-active:",
    ]) {
      expect(src, token).toContain(token);
    }
  });

  it("defines semantic status presentation tokens", () => {
    const src = css(tokensPath);
    for (const status of [
      "draft",
      "in-progress",
      "pending",
      "approved",
      "completed",
      "cancelled",
      "blocked",
      "at-risk",
      "unavailable",
      "archived",
    ]) {
      expect(src).toContain(`--status-${status}-fg`);
      expect(src).toContain(`--status-${status}-bg`);
    }
  });

  it("defines typography, spacing, radius, and motion foundations", () => {
    const src = css(tokensPath);
    for (const token of [
      "--font-family-sans",
      "--font-family-display",
      "--text-sm",
      "--text-3xl",
      "--text-kpi",
      "--space-4",
      "--page-padding-x",
      "--card-padding",
      "--radius-md",
      "--shadow-md",
      "--focus-ring-width",
      "--transition-normal",
    ]) {
      expect(src, token).toContain(token);
    }
  });

  it("wires Tailwind theme bridge and a11y foundations in globals", () => {
    const src = css(globalsPath);
    expect(src).toContain('@import "../styles/design-tokens.css"');
    expect(src).toContain("@theme inline");
    expect(src).toContain(":focus-visible");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain(".ds-status--blocked");
    expect(src).toContain(".ds-field-error");
  });

  it("keeps brand identity hex values stable", () => {
    const src = css(tokensPath);
    expect(src).toMatch(/--sidebar:\s*#102a43/i);
    expect(src).toMatch(/--accent:\s*#0f4c5c/i);
    expect(src).toMatch(/--bg:\s*#f4f6f8/i);
    expect(src).toMatch(/--surface:\s*#ffffff/i);
  });
});
