import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
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

  const year = Number(params.year) || new Date().getUTCFullYear();
  const organizationId =
    orgs.find((o) => o.id === params.org)?.id ?? orgs[0]!.id;
  const summary = await vacation.listYearSummary(principal, {
    organizationId,
    year,
    principalId: params.user || undefined,
  });

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
        description="Approved working days by person for the selected year."
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
                {user.displayName} · {user.totalWorkingDays} working day
                {user.totalWorkingDays === 1 ? "" : "s"}
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
                      {req.startDate} → {req.endDate}
                    </Link>
                    <span className="text-[var(--muted)]">
                      {req.workingDays} day{req.workingDays === 1 ? "" : "s"}
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
