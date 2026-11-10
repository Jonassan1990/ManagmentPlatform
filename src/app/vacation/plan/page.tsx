import Link from "next/link";
import { redirect } from "next/navigation";
import { VacationSheetGrid } from "@/components/vacation/vacation-sheet-grid";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function VacationPlanPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    department?: string;
    person?: string;
  }>;
}) {
  const params = await searchParams;
  const { authz, vacation, organization } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");
  await ensureDemoDepartmentUsers();

  const orgs = await organization.listOrganizations(principal);
  const organizationId = orgs[0]?.id;
  if (!organizationId) {
    return (
      <div>
        <PageHeader title="Vacation plan" />
        <EmptyState
          title="No organization yet"
          description="Join an organization to open the vacation plan."
        />
      </div>
    );
  }

  const year = Number(params.year) || 2026;
  const month = Number(params.month) || new Date().getUTCMonth() + 1;
  const plan = await vacation.describeSheetPlan(principal, {
    organizationId,
    department: params.department,
    year,
    month: month >= 1 && month <= 12 ? month : 1,
  });
  const monthLabel = `${MONTHS[plan.month - 1] ?? ""} ${plan.year}`;

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
        description="The same people as each department. A waiting request stays visible until a manager accepts it, and then it becomes vacation on this plan. Public holidays are closed days."
        actions={
          <Link href="/vacation" className={buttonClassName({ variant: "secondary" })}>
            My requests
          </Link>
        }
      />
      <Panel>
        <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
          {plan.code} · {monthLabel}
        </h2>
        {plan.people.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            {plan.ownDepartment ? (
              <Link
                href={`/vacation/plan?department=${encodeURIComponent(plan.ownDepartment)}&year=${plan.year}&month=${plan.month}`}
              >
                Your row is on the {plan.ownDepartment} plan.
              </Link>
            ) : (
              "You can see your own row. A department manager sees the whole department."
            )}
          </p>
        ) : null}
        <VacationSheetGrid
          organizationId={organizationId}
          departmentId={plan.departmentId}
          departmentCode={plan.code}
          year={plan.year}
          month={plan.month}
          canEdit={plan.canEdit}
          groups={plan.groups}
          searchPeople={plan.search}
          highlight={params.person ?? null}
          people={plan.people}
        />
      </Panel>
    </div>
  );
}
