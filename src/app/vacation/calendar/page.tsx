import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleCoverageList,
  VacationMonthCalendar,
} from "@/components/vacation/vacation-calendar";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import { AppError } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; org?: string }>;
}) {
  const params = await searchParams;
  const { authz, vacation, organization } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  if (orgs.length === 0) {
    return (
      <div>
        <PageHeader title="Vacation calendar" />
        <EmptyState
          title="No organization yet"
          description="Join an organization to view the vacation calendar."
        />
      </div>
    );
  }

  await ensureDemoDepartmentUsers();
  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = Number(params.month) || now.getUTCMonth() + 1;
  const organizationId =
    orgs.find((o) => o.id === params.org)?.id ?? orgs[0]!.id;

  let calendar;
  try {
    calendar = await vacation.listCalendar(principal, {
      organizationId,
      year,
      month,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <div>
          <PageHeader title="Vacation calendar" />
          <EmptyState title="Vacation calendar unavailable" description={error.message} />
        </div>
      );
    }
    throw error;
  }

  const prev =
    month === 1
      ? { year: year - 1, month: 12 }
      : { year, month: month - 1 };
  const next =
    month === 12
      ? { year: year + 1, month: 1 }
      : { year, month: month + 1 };

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  function hrefFor(y: number, m: number) {
    return `/vacation/calendar?org=${organizationId}&year=${y}&month=${m}`;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Vacation", href: "/vacation" },
          { label: "Calendar" },
        ]}
      />
      <PageHeader
        title="Vacation calendar"
        description="Approved vacations for the selected month. A department role is fully covered when everyone in that role is off."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={hrefFor(prev.year, prev.month)}
              className={buttonClassName({ variant: "secondary" })}
            >
              Previous
            </Link>
            <Link
              href={hrefFor(next.year, next.month)}
              className={buttonClassName({ variant: "secondary" })}
            >
              Next
            </Link>
          </div>
        }
      />

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-[var(--ink)]">
          Department role cover
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Shows when every person with the same role in a department is on a
          full weekday off. Developers includes Developer, Software Developer,
          and the other developer titles. The same check runs for every other
          role.
        </p>
        <RoleCoverageList gaps={calendar.coverage} />
      </Panel>

      <Panel>
        <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">
          {monthLabel}
        </h2>
        {orgs.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/vacation/calendar?org=${org.id}&year=${year}&month=${month}`}
                className={buttonClassName({
                  variant:
                    org.id === organizationId ? "primary" : "secondary",
                  size: "sm",
                })}
              >
                {org.name}
              </Link>
            ))}
          </div>
        ) : null}
        <VacationMonthCalendar
          year={year}
          month={month}
          entries={calendar.entries}
          coverage={calendar.coverage}
        />
        {calendar.entries.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No approved vacations in this month.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
