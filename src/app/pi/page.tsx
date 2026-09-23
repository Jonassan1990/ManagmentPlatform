import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { CreatePiForm } from "@/components/pi-planning/pi-forms";
import { piStatusLabel } from "@/components/pi-planning/pi-nav";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiListPage() {
  const { authz, organization, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  if (orgs.length === 0) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Overview", href: "/" },
            { label: "PI Planning" },
          ]}
        />
        <EmptyState
          title="Organization required"
          description="Configure an organization before creating Program Increments."
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

  const rows: {
    id: string;
    referenceKey: string;
    name: string;
    status: string;
    organizationName: string;
    startDate: Date;
    endDate: Date;
    iterationCount: number;
  }[] = [];

  let canCreateSomewhere = false;
  for (const org of orgs) {
    const caps = await resolveCapabilities(authz, principal, org.id);
    if (caps.canCreatePi) canCreateSomewhere = true;
    if (!caps.canViewPi) continue;
    try {
      const list = await planning.listProgramIncrements(principal, org.id);
      for (const pi of list) {
        rows.push({
          id: pi.id,
          referenceKey: pi.referenceKey,
          name: pi.name,
          status: pi.status,
          organizationName: org.name,
          startDate: pi.startDate,
          endDate: pi.endDate,
          iterationCount: pi.iterations.length,
        });
      }
    } catch {
      // Skip orgs the principal cannot view for PI.
    }
  }

  const firstCaps = await resolveCapabilities(authz, principal, orgs[0].id);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning" },
        ]}
      />
      <PageHeader
        title="PI Planning"
        description="Plan Program Increments across departments and teams — capacity, dependencies, and baselines."
        actions={
          canCreateSomewhere ? (
            <Link
              href="/pi/new"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              New Program Increment
            </Link>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="No Program Increments yet"
            description="Create a PI to define iterations, participating teams, and the planning board."
            action={
              canCreateSomewhere ? (
                <Link
                  href="/pi/new"
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Create Program Increment
                </Link>
              ) : undefined
            }
          />
          {canCreateSomewhere ? (
            <Panel className="max-w-3xl">
              <h2 className="mb-3 font-medium">Quick create</h2>
              <CreatePiForm
                organizations={orgs.map((o) => ({
                  id: o.id,
                  name: o.name,
                  sections: [],
                }))}
                capabilities={firstCaps}
              />
            </Panel>
          ) : null}
        </div>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Reference</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Organization</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Dates</th>
                  <th className="py-2 font-medium">Iterations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((pi) => (
                  <tr key={pi.id}>
                    <td className="py-3 pr-3 font-medium">
                      <Link
                        href={`/pi/${pi.id}`}
                        className="text-[var(--accent)]"
                      >
                        {pi.referenceKey}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <Link href={`/pi/${pi.id}`}>{pi.name}</Link>
                    </td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {pi.organizationName}
                    </td>
                    <td className="py-3 pr-3">{piStatusLabel(pi.status)}</td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {pi.startDate.toISOString().slice(0, 10)} →{" "}
                      {pi.endDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="py-3">{pi.iterationCount}</td>
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
