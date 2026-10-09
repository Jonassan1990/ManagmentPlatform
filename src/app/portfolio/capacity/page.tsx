import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getPortfolioPiCapacityAction,
  listPortfolioDepartmentOptionsAction,
  listPortfolioProgramIncrementsAction,
} from "@/app/actions/portfolio";
import { PortfolioCapacityDashboard } from "@/components/portfolio/portfolio-capacity-dashboard";
import {
  Alert,
  Breadcrumbs,
  EmptyState,
  PageHeader,
} from "@/components/ui/page";
import { buildPortfolioTrail } from "@/modules/navigation/breadcrumbs";
import { selectAuthorizedPiEntry } from "@/modules/navigation/home-experience";
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
  try {
    orgs = (await organization.listOrganizations(principal)).map((o) => ({
      id: o.id,
      name: o.name,
    }));
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
    optionalUuid(params.organizationId) ?? orgs[0]!.id;
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

  // M4C-C: when no PI chosen, enter the latest authorized ACTIVE/REVIEW PI.
  // List rows are already AuthZ-filtered by the portfolio capacity query.
  if (!piId && pis.length > 0) {
    const entry = selectAuthorizedPiEntry(
      pis.map((p) => ({
        id: p.piId,
        status: p.status,
        startDate: p.startDate,
        referenceKey: p.referenceKey,
        name: p.name,
      })),
    );
    if (entry) {
      const next = new URLSearchParams();
      next.set("organizationId", organizationId);
      if (departmentId) next.set("departmentId", departmentId);
      next.set("piId", entry.id);
      redirect(`/portfolio/capacity?${next.toString()}`);
    }
  }

  let capacity: PortfolioPiCapacityResult | null = null;
  let capacityError: string | null = null;
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
        description="Available, committed and remaining hours by department, team and resource — CURRENT planning revision."
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
      />
    </div>
  );
}
