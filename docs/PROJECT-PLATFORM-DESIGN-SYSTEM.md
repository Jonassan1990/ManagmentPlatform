# Project Platform — Design System (M4B-A Foundations)

**Status:** M4B-A tokens & foundations  
**Date:** 2026-10-09  
**Baseline main SHA:** `954e6eb05be083d43f9ebf34480eb297d0505ebc`  
**Related:** [PROJECT-PLATFORM-M4-UX-AUDIT.md](./PROJECT-PLATFORM-M4-UX-AUDIT.md), [ui-reference/resource-overview.html](./ui-reference/resource-overview.html)

This document describes the **token and accessibility foundation** only. Reusable React primitives (Dialog, StatusBadge, DataTable, …) are **M4B-B** and are not implemented here.

---

## 1. Design principles

1. **Preserve product identity** — Navy chrome (`--sidebar`), teal primary actions (`--accent`), neutral page background, white surfaces.
2. **One source of truth** — Semantic tokens in `src/styles/design-tokens.css`; compatibility aliases keep 700+ existing `var(--ink)` / `var(--accent)` call sites working.
3. **Managers first** — Compact, readable density; clear hierarchy; status must not rely on color alone.
4. **Progressive adoption** — New code may use `--color-*` / Tailwind theme keys; migrate old call sites incrementally (no big-bang rewrite).
5. **Accessibility by default** — Visible `:focus-visible`, disabled styling, reduced-motion, high-contrast status pairs.
6. **No domain coupling** — Status tokens are presentation-only; Prisma enums and AuthZ are unchanged.

---

## 2. Color palette

| Role | Token | Value | Notes |
|---|---|---|---|
| Page background | `--bg` / `--color-bg` | `#f4f6f8` | Neutral canvas |
| Surface | `--surface` / `--color-surface` | `#ffffff` | Cards, panels, inputs |
| Text primary | `--ink` / `--color-text` | `#15202b` | Body / headings |
| Text secondary | `--muted` / `--color-text-secondary` | `#5b6b7c` | Hints, captions |
| Border | `--line` / `--color-border` | `#d7dee7` | Dividers, inputs |
| Primary / actions | `--accent` / `--color-primary` | `#0f4c5c` | Buttons, active tabs |
| Primary soft | `--accent-soft` / `--color-primary-soft` | `#e6f1f3` | Soft highlights |
| Secondary / chrome | `--sidebar` / `--color-secondary` | `#102a43` | Nav / headers |
| Accent (reference teal) | `--color-accent` | `#087f78` | Optional emphasis aligned with UI reference |
| Success | `--ok` / `--color-success` | `#166534` | |
| Warning | `--warning` / `--color-warning` | `#9a3412` | |
| Error | `--danger` / `--color-error` | `#9b2226` | |
| Info | `--color-info` | `#1d4ed8` | New in M4B-A |
| Disabled | `--color-disabled` | `#94a3b8` | |
| Focus ring | `--color-focus-ring` | `#0f4c5c` | Matches primary |

Sidebar ink / active states remain `--sidebar-ink`, `--sidebar-active`.

---

## 3. Semantic tokens

### 3.1 Naming

| Layer | Example | Use |
|---|---|---|
| Compatibility (legacy) | `--ink`, `--accent` | Existing TSX/CSS |
| Semantic | `--color-text`, `--color-primary` | New code / docs |
| Tailwind theme | `bg-background`, `text-foreground`, `border-border` | Via `@theme inline` in `globals.css` |

### 3.2 Status presentation tokens

CSS variables `--status-{name}-fg|bg|border` plus utilities `.ds-status .ds-status--{name}`:

| Presentation key | Typical mapping (examples only) |
|---|---|
| `draft` | DRAFT scenario, draft PI |
| `in-progress` | PLANNING, ACTIVE work |
| `pending` | Pending review / approval |
| `approved` | Approved CURRENT plan |
| `completed` | Completed / closed success |
| `cancelled` | Cancelled |
| `blocked` | Blockers / hard conflicts |
| `at-risk` | Delivery health at risk |
| `unavailable` | Missing capacity data (not zero) |
| `archived` | Archived scenarios |

**These are not new domain statuses.** Map in UI adapters only (M4B-B `StatusBadge`).

### 3.3 Spacing, shape, motion

See `design-tokens.css` for `--space-*`, `--page-padding-*`, `--card-padding`, `--radius-*`, `--shadow-*`, `--transition-*`, `--focus-ring-*`.

---

## 4. Typography scale

| Token | Size | Role |
|---|---|---|
| `--text-xs` | 12px | Captions, status chips |
| `--text-sm` | 14px | Default body / forms (app body) |
| `--text-base` | 16px | Emphasized body |
| `--text-lg` / `--text-xl` | 18–20px | Section titles |
| `--text-2xl` / `--text-3xl` | 24–30px | Page titles (`PageHeader`) |
| `--text-kpi` | 28px | Numeric KPIs |

**Families:** `--font-family-sans` (Source Sans 3), `--font-family-display` (Source Serif 4), `--font-family-mono`.

Loaded in `src/app/layout.tsx` via `next/font` → `--font-source-sans` / `--font-source-serif`.

---

## 5. Spacing system

| Token | Default | Use |
|---|---|---|
| `--space-1` … `--space-10` | 4–40px | General rhythm |
| `--page-padding-x` (+ md/lg) | 16 / 24 / 32px | Shell main |
| `--page-padding-y` | 24px | Vertical page pad |
| `--section-gap` | 20px | Between sections |
| `--card-padding` | 20px | Panels |
| `--form-gap` | 12px | Form stacks |
| `--table-cell-y/x` | 8 / 12px | Compact tables |

---

## 6. Component conventions (for M4B-B+)

| Pattern | Convention |
|---|---|
| Page | `Breadcrumbs` + `PageHeader` + sections |
| Surface | `Panel` / white `--surface` + `--line` border + optional `--shadow-sm` |
| Primary button | Filled `--color-primary`, white text |
| Secondary button | Surface + border |
| Forms | `FormField` + `fieldClassName` (focus border + disabled tokens) |
| Alerts | `Alert` tones: `danger` \| `warning` \| `ok` \| `info` |
| Status | Prefer `.ds-status--*` until `StatusBadge` lands |
| Focus | Global `:focus-visible` — do not remove outlines without replacement |

---

## 7. Accessibility requirements

| Requirement | Foundation |
|---|---|
| Visible keyboard focus | `:focus-visible` → `--color-focus-ring` |
| Disabled controls | Global disabled color/cursor; inputs use disabled bg token |
| Errors | `.ds-field-error` + `Alert role="alert"` |
| Status contrast | FG/BG pairs chosen for readable contrast on white/soft surfaces |
| Reduced motion | `prefers-reduced-motion` collapses transitions/animations |
| Touch / hit targets | Prefer ≥36px controls (enforce in M4B-B primitives) |

**Claim limit:** CSS foundations support WCAG 2.2 AA; full compliance requires component behavior (dialogs, live regions) in later phases — do not claim AA from CSS alone.

---

## 8. Responsive breakpoints

Documented tokens: `--bp-sm` 640, `--bp-md` 768, `--bp-lg` 1024, `--bp-xl` 1280 (align with Tailwind defaults). Shell already uses `lg:` for persistent sidebar.

---

## 9. Usage examples

### CSS variable (compatible)

```tsx
className="bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]"
```

### Semantic alias

```tsx
className="bg-[var(--color-surface)] text-[var(--color-text)]"
```

### Status chip (foundation utility)

```html
<span class="ds-status ds-status--blocked">Blocked</span>
```

### Alert info tone

```tsx
<Alert tone="info">Read-only comparison — CURRENT remains authoritative.</Alert>
```

---

## 10. Migration strategy for existing components

1. **M4B-A (this milestone):** Tokens + globals + tiny Alert/forms wiring. No page redesigns.
2. **M4B-B:** Build primitives on tokens (`Button`, `Dialog`, `StatusBadge`, …).
3. **Incremental:** When touching a file, prefer `--color-*` / theme utilities; leave unrelated files alone.
4. **Do not** mass-replace 700+ call sites in one PR.
5. **Never** change Prisma enums to match presentation status keys.
6. **Visual guard:** Compatibility hex values for `--sidebar`, `--accent`, `--bg`, `--surface` stay stable unless a dedicated visual milestone says otherwise.

### File map

| File | Role |
|---|---|
| `src/styles/design-tokens.css` | Token definitions |
| `src/app/globals.css` | Import, `@theme`, a11y, status utilities |
| `src/components/ui/page.tsx` | `Alert` uses semantic color tokens (+ `info`) |
| `src/components/ui/forms.tsx` | Field disabled/radius token wiring |
| `tests/unit/design-tokens.test.ts` | Token presence / identity guards |

---

## 11. Out of scope (later)

- M4B-B reusable components  
- M4C navigation IA  
- M4D PI workflow simplification  
- Portfolio redesign  
- Schema / AuthZ / Auth changes  
