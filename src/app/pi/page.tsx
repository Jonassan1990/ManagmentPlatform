import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { homeCrumb, piPlanningHubCrumb } from "@/modules/navigation/breadcrumbs";
import { CreatePiForm } from "@/components/pi-planning/pi-forms";
import { piStatusLabel } from "@/components/pi-planning/pi-nav";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";
import { logger } from "@/server/logger";

function formatDay(value: Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
}

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
          items={[homeCrumb(), { label: piPlanningHubCrumb().label }]}
        />
        <EmptyState
          title="Organization required"
          description="Configure an organization before creating Program Increments."
          action={
            <Link
              href="/organization/setup"
              className={buttonClassName({ variant: "primary" })}
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
    const scope = { type: "ORGANIZATION" as const, organizationId: org.id };
    try {
      const canView = await authz.can(principal, PERMISSIONS.PI_VIEW, scope);
      const canCreate = await authz.can(principal, PERMISSIONS.PI_CREATE, scope);
      if (canCreate) canCreateSomewhere = true;
      if (!canView) continue;
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
          iterationCount: pi.iterations?.length ?? 0,
        });
      }
    } catch (error) {
      logger.error("pi.list.org_failed", {
        organizationId: org.id,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[homeCrumb(), { label: piPlanningHubCrumb().label }]}
      />
      <PageHeader
        title="PI Planning"
        description="Program Increments hub — open a PI for the planning board, scenarios, compare, review, capacity, and baselines."
        actions={
          canCreateSomewhere ? (
            <Link
              href="/pi/new"
              className={buttonClassName({ variant: "primary" })}
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
                  className={buttonClassName({ variant: "primary" })}
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
                capabilities={{ canCreatePi: true }}
              />
            </Panel>
          ) : null}
        </div>
      ) : (
        <Panel>
          <div
            className="overflow-x-auto"
            role="region"
            tabIndex={0}
            aria-label="Program increments table"
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">
                Program increments with reference, organization, status, and
                dates
              </caption>
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Organization
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Dates
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Iterations
                  </th>
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
                      {formatDay(pi.startDate)} → {formatDay(pi.endDate)}
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
