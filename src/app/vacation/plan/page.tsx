import Link from "next/link";
import { redirect } from "next/navigation";
import { VacationPlanGrid } from "@/components/vacation/vacation-plan-grid";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import { AppError } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationPlanPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    org?: string;
    department?: string;
  }>;
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
        <PageHeader title="Vacation plan" />
        <EmptyState
          title="No organization yet"
          description="Join an organization to plan time off by department."
        />
      </div>
    );
  }

  await ensureDemoDepartmentUsers();
  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = Number(params.month) || now.getUTCMonth() + 1;
  const organizationId =
    orgs.find((org) => org.id === params.org)?.id ?? orgs[0]!.id;
  const departmentParam =
    params.department &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.department,
    )
      ? params.department
      : undefined;

  let plan: Awaited<ReturnType<typeof vacation.listVacationPlan>>;
  try {
    plan = await vacation.listVacationPlan(principal, {
      organizationId,
      year,
      month,
      departmentId: departmentParam,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <div>
          <PageHeader title="Vacation plan" />
          <EmptyState title="Vacation plan unavailable" description={error.message} />
        </div>
      );
    }
    throw error;
  }

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  function hrefFor(y: number, m: number, department = plan.departmentId) {
    const query = new URLSearchParams({
      org: organizationId,
      year: String(y),
      month: String(m),
    });
    if (department) query.set("department", department);
    return `/vacation/plan?${query.toString()}`;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "People", href: "/vacation" },
          { label: "Vacation plan" },
        ]}
      />
      <PageHeader
        title="Vacation plan"
        description="Each department has its own plan. Colors match the 2026 sheet: vacation, education or a business trip, kompledighet, beredskap, and parental leave. A full-day vacation request shows up until you mark the day yourself."
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

      <Panel>
        <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
          {plan.departmentName ? `${plan.departmentName} · ${monthLabel}` : monthLabel}
        </h2>
        {plan.departments.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {plan.departments.map((department) => (
              <Link
                key={department.id}
                href={hrefFor(year, month, department.id)}
                className={buttonClassName({
                  variant:
                    department.id === plan.departmentId ? "primary" : "secondary",
                  size: "sm",
                })}
              >
                {department.name}
              </Link>
            ))}
          </div>
        ) : null}
        {plan.departmentId ? (
          <VacationPlanGrid
            organizationId={organizationId}
            departmentId={plan.departmentId}
            people={plan.people}
          />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            No departments are visible for this plan.
          </p>
        )}
      </Panel>
    </div>
  );
}
