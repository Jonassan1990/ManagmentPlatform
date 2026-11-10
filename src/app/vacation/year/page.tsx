import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { RoleCoverageList } from "@/components/vacation/vacation-calendar";
import { buttonClassName } from "@/components/ui/button";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import { AppError } from "@/modules/shared/errors";
import {
  formatDayCount,
  formatVacationAmount,
  formatVacationSpan,
} from "@/modules/vacation/application/vacation-duration";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationYearPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; org?: string; user?: string }>;
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
        <PageHeader title="Vacation by year" />
        <EmptyState
          title="No organization yet"
          description="Join an organization to view yearly vacation totals."
        />
      </div>
    );
  }

  await ensureDemoDepartmentUsers();
  const year = Number(params.year) || new Date().getUTCFullYear();
  const organizationId =
    orgs.find((o) => o.id === params.org)?.id ?? orgs[0]!.id;
  let summary;
  try {
    summary = await vacation.listYearSummary(principal, {
      organizationId,
      year,
      principalId: params.user || undefined,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <div>
          <PageHeader title="Vacation by year" />
          <EmptyState title="Year summary unavailable" description={error.message} />
        </div>
      );
    }
    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Vacation", href: "/vacation" },
          { label: "By year" },
        ]}
      />
      <PageHeader
        title={`Vacation ${year}`}
        description="Approved working days by person, and the days when a whole department role is away."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/vacation/year?org=${organizationId}&year=${year - 1}`}
              className={buttonClassName({ variant: "secondary" })}
            >
              {year - 1}
            </Link>
            <Link
              href={`/vacation/year?org=${organizationId}&year=${year + 1}`}
              className={buttonClassName({ variant: "secondary" })}
            >
              {year + 1}
            </Link>
          </div>
        }
      />

      {orgs.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/vacation/year?org=${org.id}&year=${year}`}
              className={buttonClassName({
                variant: org.id === organizationId ? "primary" : "secondary",
                size: "sm",
              })}
            >
              {org.name}
            </Link>
          ))}
        </div>
      ) : null}

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-[var(--ink)]">
          Availability
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          A role is fully away when every person with that role in the
          department has a full weekday off. Mixed developer titles are also
          grouped as Developers.
        </p>
        <RoleCoverageList gaps={summary.coverage} />
      </Panel>

      {summary.users.length === 0 ? (
        <EmptyState
          title="No approved vacation this year"
          description="Once managers accept requests, totals appear here."
        />
      ) : (
        <div className="space-y-4">
          {summary.users.map((user) => (
            <Panel key={user.principalId}>
              <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">
                {user.displayName} · {formatDayCount(user.totalWorkingDays)}{" "}
                working day{user.totalWorkingDays === 1 ? "" : "s"}
              </h2>
              <ul className="divide-y divide-[var(--line)]">
                {user.requests.map((req) => (
                  <li
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <Link
                      href={`/vacation/${req.id}`}
                      className="font-medium text-[var(--ink)] hover:underline"
                    >
                      {formatVacationSpan(
                        req.startDate,
                        req.endDate,
                        req.durationKind,
                      )}
                    </Link>
                    <span className="text-[var(--muted)]">
                      {formatVacationAmount(req)}
                      {req.reason ? ` · ${req.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
