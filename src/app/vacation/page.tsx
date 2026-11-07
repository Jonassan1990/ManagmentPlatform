import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateVacationForm } from "@/components/vacation/vacation-forms";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClassName } from "@/components/ui/button";
import { mapVacationStatusBadge } from "@/modules/vacation/application/vacation-status";
import { formatDateOnly } from "@/modules/vacation/application/working-days";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationPage() {
  const { authz, vacation, organization } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const [mine, orgs] = await Promise.all([
    vacation.listMine(principal),
    organization.listOrganizations(principal),
  ]);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Vacation" },
        ]}
      />
      <PageHeader
        title="My vacation requests"
        description="Request time off. Your manager can accept, reject, or ask for changes. Approved days appear on the calendar and yearly summary."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/vacation/calendar"
              className={buttonClassName({ variant: "secondary" })}
            >
              Calendar
            </Link>
            <Link
              href="/vacation/year"
              className={buttonClassName({ variant: "secondary" })}
            >
              By year
            </Link>
            <Link
              href="/vacation/inbox"
              className={buttonClassName({ variant: "secondary" })}
            >
              Manager inbox
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">New request</h2>
          {orgs.length === 0 ? (
            <EmptyState
              title="No organization yet"
              description="Join or create an organization before requesting vacation."
            />
          ) : (
            <CreateVacationForm
              organizations={orgs.map((o) => ({ id: o.id, name: o.name }))}
              defaultOrganizationId={orgs[0]?.id ?? null}
            />
          )}
        </Panel>

        <Panel>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">Your requests</h2>
          {mine.length === 0 ? (
            <EmptyState
              title="No vacation requests yet"
              description="Submit a request on the left. Working days (Mon–Fri) are counted automatically."
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {mine.map((row) => {
                const badge = mapVacationStatusBadge(row.status);
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <Link
                        href={`/vacation/${row.id}`}
                        className="font-medium text-[var(--ink)] hover:underline"
                      >
                        {formatDateOnly(row.startDate)} →{" "}
                        {formatDateOnly(row.endDate)}
                      </Link>
                      <p className="text-sm text-[var(--muted)]">
                        {row.workingDays} working day
                        {row.workingDays === 1 ? "" : "s"}
                        {row.reason ? ` · ${row.reason}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={badge.status} label={badge.label} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
