import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { stageLabel } from "@/modules/initiative/application/attention";
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
          items={[
            { label: "Overview", href: "/" },
            { label: "Initiatives" },
          ]}
        />
        <EmptyState
          title="Organization required"
          description="Configure an organization before creating initiatives."
          action={
            <Link
              href="/organization/setup"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
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
    params.stage === "PRE_STUDY"
      ? params.stage
      : undefined;

  const list = await initiative.listInitiatives(principal, {
    stage: stageFilter,
  });

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives" },
        ]}
      />
      <PageHeader
        title="Initiatives"
        description="Capture demand, structure requirements, and prepare pre-study readiness."
        actions={
          <Link
            href="/initiatives/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            New initiative
          </Link>
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
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No initiatives yet"
          description="Create the first initiative to start the demand → requirements → pre-study flow."
          action={
            <Link
              href="/initiatives/new"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Create initiative
            </Link>
          }
        />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Reference</th>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Department</th>
                  <th className="py-2 pr-3 font-medium">Stage</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Attention</th>
                  <th className="py-2 font-medium">Updated</th>
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
                    <td className="py-3 pr-3">{stageLabel(item.currentStage)}</td>
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
      className={`rounded-md border px-3 py-1 ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--line)] text-[var(--muted)]"
      }`}
    >
      {label}
    </Link>
  );
}
