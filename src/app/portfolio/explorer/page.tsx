import Link from "next/link";
import { redirect } from "next/navigation";
import {
  explorePortfolioAction,
  listPortfolioDepartmentOptionsAction,
  listPortfolioOwnerOptionsAction,
  listPortfolioSectionOptionsAction,
} from "@/app/actions/portfolio";
import {
  PortfolioExplorerFilters,
  PortfolioExplorerResults,
  type ExplorerFilterState,
} from "@/components/portfolio/portfolio-explorer";
import {
  Alert,
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { buildPortfolioTrail } from "@/modules/navigation/breadcrumbs";
import type {
  PortfolioDeliveryFilter,
  PortfolioExplorerEntityKind,
  PortfolioExplorerSortBy,
} from "@/modules/portfolio/domain/types";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(value: string | undefined): string | undefined {
  return value && UUID_RE.test(value) ? value : undefined;
}

export default async function PortfolioExplorerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const get = (key: string) => {
    const v = raw[key];
    return typeof v === "string" ? v : undefined;
  };

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
        : "Unable to list organizations for portfolio explorer.";
  }

  if (orgs.length === 0) {
    return (
      <div>
        <Breadcrumbs
          items={buildPortfolioTrail({ leaf: "Explorer" })}
        />
        <PageHeader
          title="Portfolio Explorer"
          description="Search and navigate initiatives and projects in your authorized scope."
        />
        {orgListError ? (
          <Alert tone="danger">{orgListError}</Alert>
        ) : (
          <EmptyState
            title="Organization required"
            description="Configure an organization before exploring the portfolio."
            action={
              <Link
                href="/organization/setup"
                className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition-[filter] duration-[var(--transition-fast)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
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
    optionalUuid(get("organizationId")) &&
    orgs.some((o) => o.id === get("organizationId"))
      ? get("organizationId")!
      : orgs[0]!.id;

  const departmentId = optionalUuid(get("departmentId"));
  const sectionId = optionalUuid(get("sectionId"));
  const ownerResourceId = optionalUuid(get("ownerResourceId"));
  const q = get("q")?.trim() || undefined;

  const kindRaw = get("kind");
  const entityKinds: PortfolioExplorerEntityKind[] | undefined =
    kindRaw === "INITIATIVE" || kindRaw === "PROJECT"
      ? [kindRaw]
      : undefined;

  const initiativeStageRaw = get("initiativeStage");
  const initiativeStage =
    initiativeStageRaw === "DEMAND" ||
    initiativeStageRaw === "REQUIREMENTS" ||
    initiativeStageRaw === "PRE_STUDY" ||
    initiativeStageRaw === "POC" ||
    initiativeStageRaw === "PILOT" ||
    initiativeStageRaw === "PROJECT"
      ? initiativeStageRaw
      : undefined;

  const projectStatusRaw = get("projectStatus");
  const projectStatus =
    projectStatusRaw === "ACTIVE" ||
    projectStatusRaw === "ON_HOLD" ||
    projectStatusRaw === "COMPLETED" ||
    projectStatusRaw === "CANCELLED"
      ? projectStatusRaw
      : undefined;

  const deliveryRaw = get("delivery");
  const delivery: PortfolioDeliveryFilter | undefined =
    deliveryRaw === "DELAYED" ||
    deliveryRaw === "ACTIVE_BLOCKER" ||
    deliveryRaw === "CRITICAL_ISSUE"
      ? deliveryRaw
      : undefined;

  const deliveryHealthRaw = get("deliveryHealth");
  const deliveryHealth =
    deliveryHealthRaw === "BLOCKED" ||
    deliveryHealthRaw === "AT_RISK" ||
    deliveryHealthRaw === "ON_TRACK" ||
    deliveryHealthRaw === "COMPLETED" ||
    deliveryHealthRaw === "CANCELLED" ||
    deliveryHealthRaw === "UNKNOWN"
      ? deliveryHealthRaw
      : undefined;

  const sortByRaw = get("sortBy");
  const sortBy: PortfolioExplorerSortBy | undefined =
    sortByRaw === "name" ||
    sortByRaw === "updatedAt" ||
    sortByRaw === "status" ||
    sortByRaw === "targetDate"
      ? sortByRaw
      : undefined;

  const sortDirRaw = get("sortDir");
  const sortDir =
    sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : undefined;

  const page = Math.max(1, Number.parseInt(get("page") ?? "1", 10) || 1);

  const filters: ExplorerFilterState = {
    organizationId,
    departmentId,
    sectionId,
    q,
    kind: entityKinds?.[0],
    initiativeStage,
    projectStatus,
    ownerResourceId,
    delivery,
    deliveryHealth,
    sortBy,
    sortDir,
    page: String(page),
  };

  const [exploreResult, deptResult, sectionResult, ownerResult] =
    await Promise.all([
      explorePortfolioAction({
        organizationId,
        ...(departmentId ? { departmentId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(q ? { q } : {}),
        ...(entityKinds ? { entityKinds } : {}),
        ...(initiativeStage ? { initiativeStage } : {}),
        ...(projectStatus ? { projectStatus } : {}),
        ...(ownerResourceId ? { ownerResourceId } : {}),
        ...(delivery ? { delivery } : {}),
        ...(deliveryHealth ? { deliveryHealth } : {}),
        ...(sortBy ? { sortBy } : {}),
        ...(sortDir ? { sortDir } : {}),
        page,
        pageSize: 25,
      }),
      listPortfolioDepartmentOptionsAction({ organizationId }),
      listPortfolioSectionOptionsAction({ organizationId }),
      listPortfolioOwnerOptionsAction({ organizationId }),
    ]);

  return (
    <div>
      <Breadcrumbs
        items={buildPortfolioTrail({
          leaf: "Explorer",
          organizationId,
        })}
      />
      <PageHeader
        title="Portfolio Explorer"
        description="Read-only discovery of initiatives and projects. Open a row to continue in the existing workspace."
        actions={
          <Link
            href={`/portfolio?organizationId=${organizationId}`}
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            Dashboard
          </Link>
        }
      />

      <div className="mb-6 space-y-4">
        <PortfolioExplorerFilters
          filters={filters}
          organizations={orgs}
          sections={sectionResult.ok ? sectionResult.data : []}
          departments={deptResult.ok ? deptResult.data : []}
          owners={ownerResult.ok ? ownerResult.data : []}
        />
      </div>

      {!exploreResult.ok ? (
        <Panel>
          <Alert
            tone={
              exploreResult.error.code === "FORBIDDEN" ? "warning" : "danger"
            }
          >
            {exploreResult.error.code === "FORBIDDEN"
              ? `Access denied — ${exploreResult.error.message}`
              : `Unable to load explorer — ${exploreResult.error.message}`}
          </Alert>
        </Panel>
      ) : (
        <PortfolioExplorerResults
          result={exploreResult.data}
          filters={filters}
        />
      )}
    </div>
  );
}
