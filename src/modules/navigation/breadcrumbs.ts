/**
 * M4C-B — Central breadcrumb builders aligned with M4C-A nav groups.
 * Labels must come from already-authorized application data — never invent UUIDs as titles.
 */

import type { Crumb } from "@/components/ui/page";
import {
  parseReturnContext,
  resolveReturnHref,
  returnCrumbLabel,
  type ParsedReturnContext,
} from "@/modules/navigation/return-context";

export function truncateLabel(label: string, max = 40): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function homeCrumb(): Crumb {
  return { label: "Home", href: "/" };
}

export function portfolioHubCrumb(organizationId?: string | null): Crumb {
  const href = organizationId
    ? `/portfolio?organizationId=${organizationId}`
    : "/portfolio";
  return { label: "Portfolio", href };
}

export function initiativesHubCrumb(): Crumb {
  return { label: "Initiatives", href: "/initiatives" };
}

export function piPlanningHubCrumb(): Crumb {
  return { label: "PI Planning", href: "/pi" };
}

export function organizationHubCrumb(): Crumb {
  return { label: "Organization", href: "/organization" };
}

export function governanceApprovalsCrumb(): Crumb {
  return { label: "Approvals", href: "/approvals" };
}

export function governanceDecisionsCrumb(): Crumb {
  return { label: "Decisions", href: "/decisions" };
}

/** Safe entity label — never falls back to a raw UUID. */
export function entityLabel(
  preferred: string | null | undefined,
  fallback: string,
): string {
  const value = preferred?.trim();
  if (!value) return fallback;
  // Suppress UUID-looking labels
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return fallback;
  }
  return truncateLabel(value);
}

export function buildPortfolioTrail(opts: {
  leaf?: string;
  organizationId?: string | null;
  leafHref?: string;
}): Crumb[] {
  const crumbs: Crumb[] = [homeCrumb(), portfolioHubCrumb(opts.organizationId)];
  if (opts.leaf) {
    crumbs.push({
      label: opts.leaf,
      href: opts.leafHref,
    });
  }
  return finalizeCurrent(crumbs);
}

export function buildInitiativeTrail(opts: {
  initiativeId: string;
  referenceKey: string | null | undefined;
  title?: string | null;
  leaf?: string;
  returnContext?: ParsedReturnContext | null;
}): Crumb[] {
  const crumbs: Crumb[] = [homeCrumb(), initiativesHubCrumb()];
  maybeInsertReturn(crumbs, opts.returnContext);
  crumbs.push({
    label: entityLabel(opts.referenceKey, "Initiative"),
    href: opts.leaf ? `/initiatives/${opts.initiativeId}` : undefined,
  });
  if (opts.leaf) {
    crumbs.push({ label: opts.leaf });
  }
  return finalizeCurrent(crumbs);
}

export function buildPiTrail(opts: {
  piId: string;
  referenceKey: string | null | undefined;
  name?: string | null;
  leaf?: string;
  returnContext?: ParsedReturnContext | null;
  /** Preserve PI query context on the PI hub crumb when useful. */
  piQuery?: string;
}): Crumb[] {
  const crumbs: Crumb[] = [homeCrumb(), piPlanningHubCrumb()];
  maybeInsertReturn(crumbs, opts.returnContext);
  const piHref = opts.leaf
    ? opts.piQuery
      ? `/pi/${opts.piId}?${opts.piQuery}`
      : `/pi/${opts.piId}`
    : undefined;
  crumbs.push({
    label: entityLabel(
      opts.referenceKey,
      entityLabel(opts.name, "Program Increment"),
    ),
    href: piHref,
  });
  if (opts.leaf) {
    crumbs.push({ label: opts.leaf });
  }
  return finalizeCurrent(crumbs);
}

export function buildOrganizationTrail(opts: {
  organizationId: string;
  organizationName: string | null | undefined;
  section?: { id: string; name: string | null | undefined } | null;
  department?: { id: string; name: string | null | undefined } | null;
  team?: { id: string; name: string | null | undefined } | null;
  /** When true, insert Resources hub before leaf (resource detail). */
  resourcesHub?: boolean;
  leaf?: string;
}): Crumb[] {
  const orgId = opts.organizationId;
  const crumbs: Crumb[] = [
    homeCrumb(),
    organizationHubCrumb(),
    {
      label: entityLabel(opts.organizationName, "Organization"),
      href: `/organization/${orgId}`,
    },
  ];
  if (opts.section) {
    crumbs.push({
      label: entityLabel(opts.section.name, "Section"),
      href: `/organization/${orgId}/sections/${opts.section.id}`,
    });
  }
  if (opts.department) {
    crumbs.push({
      label: entityLabel(opts.department.name, "Department"),
      href: `/organization/${orgId}/departments/${opts.department.id}`,
    });
  }
  if (opts.team) {
    crumbs.push({
      label: entityLabel(opts.team.name, "Team"),
      href: `/organization/${orgId}/teams/${opts.team.id}`,
    });
  }
  if (opts.resourcesHub) {
    crumbs.push({
      label: "Resources",
      href: `/organization/${orgId}/resources`,
    });
  }
  if (opts.leaf) {
    crumbs.push({ label: entityLabel(opts.leaf, "Detail") });
  }
  return finalizeCurrent(crumbs);
}

export function crumbsFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ParsedReturnContext | null {
  return parseReturnContext(searchParams);
}

function maybeInsertReturn(
  crumbs: Crumb[],
  ctx: ParsedReturnContext | null | undefined,
): void {
  if (!ctx) return;
  const href = resolveReturnHref(ctx);
  if (!href) return;
  // Home is already the trail root — do not duplicate it as a return crumb.
  if (ctx.from === "home" || href === "/") return;
  // Insert after Home (index 1) so: Home → Explorer → Initiatives → …
  crumbs.splice(1, 0, {
    label: returnCrumbLabel(ctx.from),
    href,
  });
}

/** Ensure the last crumb is the current page (no href). */
function finalizeCurrent(crumbs: Crumb[]): Crumb[] {
  if (crumbs.length === 0) return crumbs;
  const last = crumbs[crumbs.length - 1]!;
  crumbs[crumbs.length - 1] = { label: last.label };
  return crumbs;
}
