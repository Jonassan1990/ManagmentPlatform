import Link from "next/link";
import { redirect } from "next/navigation";
import { getProjectDeliveryHealthAction } from "@/app/actions/portfolio";
import { DeliveryHealthExplanation } from "@/components/portfolio/delivery-health";
import {
  Alert,
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { createServices } from "@/server/container";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PortfolioHealthExplanationPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const organizationId =
    params.organizationId && UUID_RE.test(params.organizationId)
      ? params.organizationId
      : null;
  const projectId =
    params.projectId && UUID_RE.test(params.projectId)
      ? params.projectId
      : null;

  if (!organizationId || !projectId) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Overview", href: "/" },
            { label: "Portfolio", href: "/portfolio" },
            { label: "Delivery health" },
          ]}
        />
        <PageHeader
          title="Delivery health explanation"
          description="Select a project from the portfolio dashboard attention list."
        />
        <EmptyState
          title="Project required"
          description="Open Explain from a delivery-health attention row to see structured reasons."
          action={
            <Link
              href="/portfolio"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Back to portfolio
            </Link>
          }
        />
      </div>
    );
  }

  let orgName = "Organization";
  try {
    const orgs = await organization.listOrganizations(principal);
    orgName =
      orgs.find((o) => o.id === organizationId)?.name ?? orgName;
  } catch {
    // Labels only — health query still enforces auth.
  }

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

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Portfolio", href: `/portfolio?organizationId=${organizationId}` },
          { label: "Delivery health" },
        ]}
      />
      <PageHeader
        title="Delivery health explanation"
        description={`${orgName} — structured reasons from the M2D-A classifier (read-only).`}
      />

      {!result.ok ? (
        <Panel>
          <Alert
            tone={result.error.code === "FORBIDDEN" ? "warning" : "danger"}
          >
            {result.error.code === "FORBIDDEN" || result.error.code === "NOT_FOUND"
              ? `Unable to load project health — ${result.error.message}`
              : `Error — ${result.error.message}`}
          </Alert>
          <Link
            href={`/portfolio?organizationId=${organizationId}`}
            className="mt-3 inline-block text-sm text-[var(--accent)] underline"
          >
            Back to portfolio
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
