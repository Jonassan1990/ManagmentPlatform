import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getManagementReportPreviewAction,
} from "@/app/actions/reports";
import {
  listPortfolioDepartmentOptionsAction,
  listPortfolioProgramIncrementsAction,
} from "@/app/actions/portfolio";
import { ReportsWorkspace } from "@/components/portfolio/reports-workspace";
import {
  Alert,
  Breadcrumbs,
  EmptyState,
  PageHeader,
} from "@/components/ui/page";
import { buildPortfolioTrail } from "@/modules/navigation/breadcrumbs";
import { resolveShellNavContext } from "@/modules/navigation/resolve-shell-nav";
import {
  MANAGEMENT_REPORT_TYPES,
  type ManagementReportType,
} from "@/modules/portfolio/domain/management-reports";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(value: string | undefined): string | undefined {
  return value && UUID_RE.test(value) ? value : undefined;
}

function parseReportType(value: string | undefined): ManagementReportType {
  if (
    value &&
    (MANAGEMENT_REPORT_TYPES as readonly string[]).includes(value)
  ) {
    return value as ManagementReportType;
  }
  return "portfolio_summary";
}

export default async function PortfolioReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizationId?: string;
    departmentId?: string;
    piId?: string;
    reportType?: string;
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
    orgs = listed.map((o) => ({ id: o.id, name: o.name }));
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
        : "Unable to list organizations for reports.";
  }

  if (orgs.length === 0) {
    return (
      <div>
        <Breadcrumbs items={buildPortfolioTrail({ leaf: "Reports" })} />
        <PageHeader
          title="Reports"
          description="Authorized management reports and CSV exports from existing portfolio contracts."
        />
        {orgListError ? (
          <Alert tone="danger">{orgListError}</Alert>
        ) : (
          <EmptyState
            title="Organization required"
            description="Configure an organization before running management reports."
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
    optionalUuid(params.organizationId) ?? preferredOrgId ?? orgs[0]!.id;
  const departmentId = optionalUuid(params.departmentId);
  const piId = optionalUuid(params.piId);
  const reportType = parseReportType(params.reportType);

  const deptResult = await listPortfolioDepartmentOptionsAction({
    organizationId,
  });
  const departments = deptResult.ok ? deptResult.data : [];

  const piResult = await listPortfolioProgramIncrementsAction({
    organizationId,
    departmentId,
    pageSize: 100,
  });
  const pis = piResult.ok
    ? piResult.data.rows.map((p) => ({
        piId: p.piId,
        referenceKey: p.referenceKey,
        name: p.name,
      }))
    : [];

  const previewResult = await getManagementReportPreviewAction({
    organizationId,
    departmentId,
    piId,
    reportType,
  });

  return (
    <div>
      <Breadcrumbs
        items={buildPortfolioTrail({
          leaf: "Reports",
          organizationId,
        })}
      />
      <PageHeader
        title="Reports"
        description="Preview and export management outputs from existing portfolio, capacity, and governance read models. Unavailable metrics stay unavailable — never coerced to zero."
      />
      <ReportsWorkspace
        organizations={orgs}
        departments={departments}
        pis={pis}
        organizationId={organizationId}
        departmentId={departmentId}
        piId={piId}
        reportType={reportType}
        preview={previewResult.ok ? previewResult.data : null}
        previewError={
          previewResult.ok ? null : previewResult.error.message
        }
      />
    </div>
  );
}
