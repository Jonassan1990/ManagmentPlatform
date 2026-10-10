import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getDeliveryHealthSummaryAction,
  getProjectDeliveryHealthAction,
  listDeliveryHealthAttentionAction,
  listPortfolioDepartmentOptionsAction,
} from "@/app/actions/portfolio";
import {
  DeliveryHealthAttentionList,
  DeliveryHealthCountsSection,
  DeliveryHealthExplanation,
} from "@/components/portfolio/delivery-health";
import {
  Alert,
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { buildPortfolioTrail } from "@/modules/navigation/breadcrumbs";
import { appendReturnContext } from "@/modules/navigation/return-context";
import type { DeliveryHealthClassification } from "@/modules/portfolio/domain/types";
import { createServices } from "@/server/container";
import { prisma } from "@/server/db";

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

/**
 * M4E-D: Delivery Health hub when `projectId` is absent; explanation when present.
 * Purpose: Why is delivery at risk? — not a second Portfolio dashboard.
 */
export default async function PortfolioHealthPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizationId?: string;
    departmentId?: string;
    projectId?: string;
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
        : "Unable to list organizations for delivery health.";
  }

  if (orgs.length === 0) {
    return (
      <div>
        <Breadcrumbs
          items={buildPortfolioTrail({ leaf: "Delivery health" })}
        />
        <PageHeader
          title="Delivery health"
          description="Why delivery is at risk — classifications and structured reasons for authorized projects."
        />
        {orgListError ? (
          <Alert tone="danger">{orgListError}</Alert>
        ) : (
          <EmptyState
            title="Organization required"
            description="Configure an organization before viewing delivery health."
            action={
              <Link
                href="/organization/setup"
                className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
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
  const projectId =
    params.projectId && UUID_RE.test(params.projectId)
      ? params.projectId
      : null;
  const healthFocus =
    params.healthFocus && HEALTH_FOCUS_VALUES.has(params.healthFocus)
      ? params.healthFocus
      : null;

  const portfolioHref = appendReturnContext(
    `/portfolio?organizationId=${organizationId}${departmentId ? `&departmentId=${departmentId}` : ""}`,
    {
      from: "health",
      organizationId,
      departmentId,
    },
  );
  const explorerHref = appendReturnContext(
    `/portfolio/explorer?organizationId=${organizationId}${departmentId ? `&departmentId=${departmentId}` : ""}`,
    {
      from: "health",
      organizationId,
      departmentId,
    },
  );

  // ——— Explanation mode ———
  if (projectId) {
    const result = await getProjectDeliveryHealthAction({
      organizationId,
      projectId,
    });

    let projectLabel: { referenceKey: string; name: string } | null = null;
    if (result.ok) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId },
        select: { referenceKey: true, name: true },
      });
      if (project) projectLabel = project;
    }

    const hubHref = `/portfolio/health?organizationId=${organizationId}${departmentId ? `&departmentId=${departmentId}` : ""}`;

    return (
      <div>
        <Breadcrumbs
          items={buildPortfolioTrail({
            leaf: "Delivery health",
            organizationId,
          })}
        />
        <PageHeader
          title="Delivery health explanation"
          description={`${organizationName} — structured reasons from the M2D-A classifier (read-only).`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href={hubHref}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Health hub
              </Link>
              <Link
                href={portfolioHref}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Portfolio
              </Link>
            </div>
          }
        />

        {!result.ok ? (
          <Panel>
            <Alert
              tone={result.error.code === "FORBIDDEN" ? "warning" : "danger"}
            >
              {result.error.code === "FORBIDDEN" ||
              result.error.code === "NOT_FOUND"
                ? `Unable to load project health — ${result.error.message}`
                : `Error — ${result.error.message}`}
            </Alert>
            <Link
              href={hubHref}
              className="mt-3 inline-flex min-h-11 items-center text-sm text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Back to delivery health hub
            </Link>
          </Panel>
        ) : (
          <DeliveryHealthExplanation
            evaluation={result.data}
            organizationId={organizationId}
            projectLabel={projectLabel}
          />
        )}
      </div>
    );
  }

  // ——— Hub mode (M4E-D) ———
  const attentionClassifications: DeliveryHealthClassification[] | undefined =
    healthFocus && healthFocus !== "ATTENTION"
      ? [healthFocus as DeliveryHealthClassification]
      : undefined;

  const [deptResult, healthSummaryResult, healthAttentionResult] =
    await Promise.all([
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
  const healthError =
    !healthSummaryResult.ok
      ? healthSummaryResult.error.message
      : !healthAttentionResult.ok
        ? healthAttentionResult.error.message
        : null;

  return (
    <div>
      <Breadcrumbs
        items={buildPortfolioTrail({
          leaf: "Delivery health",
          organizationId,
        })}
      />
      <PageHeader
        title="Delivery health"
        description={`${organizationName} — why delivery is at risk. Classifications and attention lists for your authorized scope. Use Explain for structured reasons; change commitments in PI Planning.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={portfolioHref}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Portfolio
            </Link>
            <Link
              href={explorerHref}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Explorer
            </Link>
          </div>
        }
      />

      <form
        method="get"
        action="/portfolio/health"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-[11px] border border-[var(--line)] bg-[var(--surface)] p-4"
        data-testid="health-scope-form"
      >
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Organization</span>
          <select
            name="organizationId"
            defaultValue={organizationId}
            className="min-h-11 min-w-[12rem] rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Department</span>
          <select
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="min-h-11 min-w-[12rem] rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="">All visible</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {healthFocus ? (
          <input type="hidden" name="healthFocus" value={healthFocus} />
        ) : null}
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>

      {healthError ? (
        <Alert tone="warning" className="mb-4">
          {healthError}
        </Alert>
      ) : null}

      {!deptResult.ok ? (
        <Alert tone="warning" className="mb-4">
          Department options unavailable — {deptResult.error.message}
        </Alert>
      ) : null}

      {healthSummaryResult.ok ? (
        <div className="mb-6">
          <DeliveryHealthCountsSection
            summary={healthSummaryResult.data}
            organizationId={organizationId}
            departmentId={departmentId}
            healthFocus={healthFocus}
          />
        </div>
      ) : null}

      {healthAttentionResult.ok ? (
        <DeliveryHealthAttentionList
          attention={healthAttentionResult.data}
          organizationId={organizationId}
          departmentId={departmentId}
          healthFocus={healthFocus}
        />
      ) : !healthError ? (
        <EmptyState
          title="No attention data"
          description="Delivery-health attention could not be loaded for this scope."
        />
      ) : null}
    </div>
  );
}
