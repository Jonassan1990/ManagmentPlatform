import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getDeliveryHealthSummaryAction,
  getPortfolioSnapshotAction,
  listDeliveryHealthAttentionAction,
  listPortfolioDepartmentOptionsAction,
} from "@/app/actions/portfolio";
import {
  PortfolioDashboardView,
  PortfolioScopeControls,
} from "@/components/portfolio/portfolio-dashboard";
import {
  Alert,
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import type { DeliveryHealthClassification } from "@/modules/portfolio/domain/types";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HEALTH_FOCUS_VALUES = new Set([
  "BLOCKED",
  "AT_RISK",
  "ON_TRACK",
  "COMPLETED",
  "CANCELLED",
  "UNKNOWN",
  "ATTENTION",
]);

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizationId?: string;
    departmentId?: string;
    healthFocus?: string;
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
        : "Unable to list organizations for portfolio.";
  }

  if (orgs.length === 0) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Overview", href: "/" },
            { label: "Portfolio" },
          ]}
        />
        <PageHeader
          title="Portfolio"
          description="Executive view of initiatives, delivery health, governance attention, and PI capacity."
        />
        {orgListError ? (
          <Alert tone="danger">{orgListError}</Alert>
        ) : (
          <EmptyState
            title="Organization required"
            description="Configure an organization before viewing the portfolio dashboard."
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
    params.organizationId && orgs.some((o) => o.id === params.organizationId)
      ? params.organizationId
      : orgs[0]!.id;
  const organizationName =
    orgs.find((o) => o.id === organizationId)?.name ?? "Organization";

  const departmentId =
    params.departmentId && UUID_RE.test(params.departmentId)
      ? params.departmentId
      : undefined;

  const healthFocus =
    params.healthFocus && HEALTH_FOCUS_VALUES.has(params.healthFocus)
      ? params.healthFocus
      : null;

  const attentionClassifications: DeliveryHealthClassification[] | undefined =
    healthFocus && healthFocus !== "ATTENTION"
      ? [healthFocus as DeliveryHealthClassification]
      : undefined;

  const [snapshotResult, deptResult, healthSummaryResult, healthAttentionResult] =
    await Promise.all([
      getPortfolioSnapshotAction({
        organizationId,
        ...(departmentId ? { departmentId } : {}),
      }),
      listPortfolioDepartmentOptionsAction({ organizationId }),
      getDeliveryHealthSummaryAction({
        organizationId,
        ...(departmentId ? { departmentId } : {}),
      }),
      listDeliveryHealthAttentionAction({
        organizationId,
        ...(departmentId ? { departmentId } : {}),
        ...(attentionClassifications
          ? { classifications: attentionClassifications }
          : {}),
        sortBy: "classification",
        sortDir: "asc",
        page: 1,
        pageSize: 25,
      }),
    ]);

  const departments = deptResult.ok ? deptResult.data : [];
  const departmentName = departmentId
    ? (departments.find((d) => d.id === departmentId)?.name ?? null)
    : null;

  const healthError =
    !healthSummaryResult.ok
      ? healthSummaryResult.error.message
      : !healthAttentionResult.ok
        ? healthAttentionResult.error.message
        : null;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Portfolio" },
        ]}
      />
      <PageHeader
        title="Portfolio"
        description="Authorization-aware executive dashboard for lifecycle, delivery health, governance attention, experimentation, and PI capacity."
      />

      <div className="mb-6 space-y-4">
        <PortfolioScopeControls
          organizations={orgs}
          departments={departments}
          organizationId={organizationId}
          departmentId={departmentId}
        />
        {!deptResult.ok ? (
          <Alert tone="warning">
            Department filter options could not be loaded:{" "}
            {deptResult.error.message}. Snapshot scoping still runs
            server-side.
          </Alert>
        ) : null}
      </div>

      {!snapshotResult.ok ? (
        <Panel>
          <Alert
            tone={
              snapshotResult.error.code === "FORBIDDEN" ? "warning" : "danger"
            }
          >
            {snapshotResult.error.code === "FORBIDDEN"
              ? `Access denied — ${snapshotResult.error.message}`
              : `Unable to load portfolio snapshot — ${snapshotResult.error.message}`}
          </Alert>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Portfolio data is enforced server-side. If you believe this is an
            error, confirm your organization and department role bindings.
          </p>
        </Panel>
      ) : (
        <PortfolioDashboardView
          snapshot={snapshotResult.data}
          organizationName={organizationName}
          departmentName={departmentName}
          departmentId={departmentId}
          healthSummary={
            healthSummaryResult.ok ? healthSummaryResult.data : null
          }
          healthAttention={
            healthAttentionResult.ok ? healthAttentionResult.data : null
          }
          healthFocus={healthFocus}
          healthError={healthError}
        />
      )}
    </div>
  );
}
