import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getPortfolioPiCapacityAction,
  getPortfolioSnapshotAction,
  listPortfolioDepartmentOptionsAction,
  listPortfolioProgramIncrementsAction,
} from "@/app/actions/portfolio";
import type { CapacityDependenciesView } from "@/components/portfolio/portfolio-capacity-coordination";
import {
  mapPlanningDependencyRows,
  summarizeDependencyCounts,
} from "@/components/portfolio/portfolio-capacity-coordination";
import { PortfolioCapacityDashboard } from "@/components/portfolio/portfolio-capacity-dashboard";
import {
  Alert,
  Breadcrumbs,
  EmptyState,
  PageHeader,
} from "@/components/ui/page";
import { buildPortfolioTrail } from "@/modules/navigation/breadcrumbs";
import { selectAuthorizedPiEntry } from "@/modules/navigation/home-experience";
import { resolveShellNavContext } from "@/modules/navigation/resolve-shell-nav";
import { AppError } from "@/modules/shared/errors";
import type {
  PortfolioPiCapacityResult,
  PortfolioPiListItem,
} from "@/modules/portfolio/domain/types";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(value: string | undefined): string | undefined {
  return value && UUID_RE.test(value) ? value : undefined;
}

export default async function PortfolioCapacityPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizationId?: string;
    departmentId?: string;
    piId?: string;
  }>;
}) {
  const params = await searchParams;
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let orgs: Array<{ id: string; name: string }> = [];
  let orgListError: string | null = null;
  let preferredOrgId: string | null = null;
  try {
    const listed = await organization.listOrganizations(principal);
    orgs = listed.map((o) => ({
      id: o.id,
      name: o.name,
    }));
    const navCtx = await resolveShellNavContext(
      authz,
      principal,
      listed.map((o) => o.id),
    );
    preferredOrgId = navCtx.organizationId;
  } catch (error) {
    orgListError =
      error instanceof Error
        ? error.message
        : "Unable to list organizations for PI capacity.";
  }

  if (orgs.length === 0) {
    return (
      <div>
        <Breadcrumbs
          items={buildPortfolioTrail({ leaf: "PI & Capacity" })}
        />
        <PageHeader
          title="PI & Resource Capacity"
          description="Program Increment capacity, utilization, and planning conflicts."
        />
        {orgListError ? (
          <Alert tone="danger">{orgListError}</Alert>
        ) : (
          <EmptyState
            title="Organization required"
            description="Configure an organization before viewing PI capacity."
            action={
              <Link
                href="/organization/setup"
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Set up organization
              </Link>
            }
          />
        )}
      </div>
    );
  }

  const organizationId =
    optionalUuid(params.organizationId) ??
    preferredOrgId ??
    orgs[0]!.id;
  const departmentId = optionalUuid(params.departmentId);
  const piId = optionalUuid(params.piId);

  const organizationName =
    orgs.find((o) => o.id === organizationId)?.name ?? "Organization";

  const deptResult = await listPortfolioDepartmentOptionsAction({
    organizationId,
  });
  const departments = deptResult.ok ? deptResult.data : [];

  let pis: PortfolioPiListItem[] = [];
  let listError: string | null = null;
  const listResult = await listPortfolioProgramIncrementsAction({
    organizationId,
    departmentId,
    pageSize: 100,
  });
  if (listResult.ok) {
    pis = listResult.data.rows;
  } else {
    listError = listResult.error.message;
  }

  // M4C-C: when no PI chosen, enter the latest authorized ACTIVE/REVIEW/BASELINED PI.
  // Rows are AuthZ-filtered. If the preferred org has none, try other listable orgs.
  if (!piId) {
    const tryOrgs = [
      organizationId,
      ...orgs.map((o) => o.id).filter((id) => id !== organizationId),
    ];
    for (const orgId of tryOrgs) {
      let candidates = pis;
      if (orgId !== organizationId) {
        const alt = await listPortfolioProgramIncrementsAction({
          organizationId: orgId,
          pageSize: 100,
        });
        if (!alt.ok) continue;
        candidates = alt.data.rows;
      }
      const entry = selectAuthorizedPiEntry(
        candidates.map((p) => ({
          id: p.piId,
          status: p.status,
          startDate: p.startDate,
          referenceKey: p.referenceKey,
          name: p.name,
        })),
      );
      if (entry) {
        const next = new URLSearchParams();
        next.set("organizationId", orgId);
        if (departmentId && orgId === organizationId) {
          next.set("departmentId", departmentId);
        }
        next.set("piId", entry.id);
        redirect(`/portfolio/capacity?${next.toString()}`);
      }
    }
  }

  let capacity: PortfolioPiCapacityResult | null = null;
  let capacityError: string | null = null;
  let capacityErrorCode: string | null = null;
  if (piId) {
    const capResult = await getPortfolioPiCapacityAction({
      organizationId,
      departmentId,
      piId,
      resourcePageSize: 100,
      includeResources: true,
      includeProjectCommitments: true,
      includeConflicts: true,
    });
    if (capResult.ok) {
      capacity = capResult.data;
    } else {
      capacityError = capResult.error.message;
      capacityErrorCode = capResult.error.code;
    }
  } else {
    // Explicit no-PI state using the same contract shape (no invented metrics).
    capacity = {
      asOf: new Date().toISOString(),
      scope: departmentId
        ? {
            mode: "departments",
            organizationId,
            departmentIds: [departmentId],
          }
        : { mode: "organization", organizationId },
      capacity: {
        state: "no_pi_selected",
        reason: "Select a Program Increment to load live capacity metrics.",
      },
    };
  }

  // M4E-C: PlanningDependencies via existing DependencyService (ORGANIZATION PI_VIEW).
  // Dept Managers without org-scoped PI_VIEW get an unavailable state — never broaden RBAC.
  const projectCommitments =
    capacity?.capacity.state === "ready"
      ? capacity.capacity.projectCommitments
      : [];
  let dependencies: CapacityDependenciesView = {
    state: "unavailable",
    reason:
      "PlanningDependency list requires organization-scoped PI_VIEW. Open PI Dependencies when authorized, or use portfolio dependency counts below when available.",
  };

  const snapshotResult = await getPortfolioSnapshotAction({
    organizationId,
    departmentId,
  });
  const snapshotCounts =
    snapshotResult.ok && snapshotResult.data.dependencies.available
      ? snapshotResult.data.dependencies.value
      : null;

  try {
    const { authz, planning } = createServices();
    const principal = await authz.resolveCurrentPrincipal();
    if (principal) {
      const listed = await planning.listDependencies(
        principal,
        organizationId,
      );
      const rows = mapPlanningDependencyRows(listed, projectCommitments);
      const counts = summarizeDependencyCounts(rows);
      dependencies = {
        state: "ready",
        rows,
        openCount: counts.openCount,
        criticalCount: counts.criticalCount,
      };
    }
  } catch (error) {
    const reason =
      error instanceof AppError
        ? error.message
        : "Unable to list PlanningDependencies for this organization.";
    dependencies = {
      state: "unavailable",
      reason:
        error instanceof AppError && error.code === "FORBIDDEN"
          ? "Dependency list is organization-scoped (PI_VIEW at ORGANIZATION). Department-scoped principals see counts when the portfolio snapshot returns them, not unscoped resource details."
          : reason,
      openCount: snapshotCounts?.openDependencies,
      criticalCount: snapshotCounts?.criticalOpenDependencies,
    };
  }

  if (
    dependencies.state === "unavailable" &&
    snapshotCounts &&
    dependencies.openCount == null
  ) {
    dependencies = {
      ...dependencies,
      openCount: snapshotCounts.openDependencies,
      criticalCount: snapshotCounts.criticalOpenDependencies,
    };
  }

  return (
    <div>
      <Breadcrumbs
        items={buildPortfolioTrail({
          leaf: "PI & Capacity",
          organizationId,
        })}
      />
      <PageHeader
        title="PI & Resource Capacity"
        description="Available, committed and remaining hours by department, team and resource — CURRENT planning revision. Cross-department coordination uses authorized capacity, conflicts, and PlanningDependencies only."
      />
      <PortfolioCapacityDashboard
        organizationName={organizationName}
        organizations={orgs}
        departments={departments}
        organizationId={organizationId}
        departmentId={departmentId}
        piId={piId}
        pis={pis}
        listError={listError}
        capacity={capacity}
        capacityError={capacityError}
        capacityErrorCode={capacityErrorCode}
        dependencies={dependencies}
      />
    </div>
  );
}
