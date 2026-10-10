import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { homeCrumb, initiativesHubCrumb } from "@/modules/navigation/breadcrumbs";
import { StatusBadge } from "@/components/ui/status-badge";
import { mapInitiativeStageBadge } from "@/components/ui/status-adapters";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const params = await searchParams;
  const { authz, organization, initiative } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  if (orgs.length === 0) {
    return (
      <div>
        <Breadcrumbs
          items={[homeCrumb(), { label: initiativesHubCrumb().label }]}
        />
        <EmptyState
          title="Organization required"
          description="Configure an organization before creating initiatives."
          action={
            <Link
              href="/organization/setup"
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition-[filter] duration-[var(--transition-fast)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              Set up organization
            </Link>
          }
        />
      </div>
    );
  }

  const stageFilter =
    params.stage === "DEMAND" ||
    params.stage === "REQUIREMENTS" ||
    params.stage === "PRE_STUDY" ||
    params.stage === "POC" ||
    params.stage === "PILOT" ||
    params.stage === "PROJECT"
      ? params.stage
      : undefined;

  const list = await initiative.listInitiatives(principal, {
    stage: stageFilter,
  });

  const canCreate = (
    await Promise.all(
      orgs.map((o) =>
        authz.hasPermissionInOrganization(
          principal,
          PERMISSIONS.INITIATIVE_CREATE,
          o.id,
        ),
      ),
    )
  ).some(Boolean);

  return (
    <div>
      <Breadcrumbs
        items={[homeCrumb(), { label: initiativesHubCrumb().label }]}
      />
      <PageHeader
        title="Initiatives"
        description="One initiative journey: Discovery → Governance → Validation → Delivery."
        actions={
          canCreate ? (
            <Link
              href="/initiatives/new"
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
            >
              New initiative
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FilterChip href="/initiatives" active={!stageFilter} label="All" />
        <FilterChip
          href="/initiatives?stage=DEMAND"
          active={stageFilter === "DEMAND"}
          label="Demand"
        />
        <FilterChip
          href="/initiatives?stage=REQUIREMENTS"
          active={stageFilter === "REQUIREMENTS"}
          label="Requirements"
        />
        <FilterChip
          href="/initiatives?stage=PRE_STUDY"
          active={stageFilter === "PRE_STUDY"}
          label="Pre-study"
        />
        <FilterChip
          href="/initiatives?stage=POC"
          active={stageFilter === "POC"}
          label="PoC"
        />
        <FilterChip
          href="/initiatives?stage=PILOT"
          active={stageFilter === "PILOT"}
          label="Pilot"
        />
        <FilterChip
          href="/initiatives?stage=PROJECT"
          active={stageFilter === "PROJECT"}
          label="Project"
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No initiatives yet"
          description={
            canCreate
              ? "Create the first initiative to start the demand → requirements → pre-study flow."
              : "No initiatives are visible in your authorized scope."
          }
          action={
            canCreate ? (
              <Link
                href="/initiatives/new"
                className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
              >
                Create initiative
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Panel>
          <div
            className="overflow-x-auto"
            role="region"
            tabIndex={0}
            aria-label="Initiatives table"
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">
                Initiatives with reference, stage, owner, and attention
              </caption>
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Title
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Department
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Stage
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Owner
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Attention
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {list.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-3 font-medium">
                      <Link
                        href={`/initiatives/${item.id}`}
                        className="text-[var(--accent)]"
                      >
                        {item.referenceKey}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <Link href={`/initiatives/${item.id}`}>{item.title}</Link>
                    </td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {item.department.name}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge
                        {...mapInitiativeStageBadge(item.currentStage)}
                        size="compact"
                      />
                    </td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {item.businessOwnerName}
                    </td>
                    <td className="py-3 pr-3">
                      {item.readiness?.ready
                        ? "Ready"
                        : item.attentionCount > 0
                          ? `${item.attentionCount} item(s)`
                          : "—"}
                    </td>
                    <td className="py-3 text-[var(--muted)]">
                      {item.updatedAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-md border px-3 ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--line)] text-[var(--muted)]"
      }`}
    >
      {label}
    </Link>
  );
}
