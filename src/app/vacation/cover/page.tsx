import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleCoverCalendar } from "@/components/vacation/role-cover-calendar";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import { AppError } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationCoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    org?: string;
    department?: string;
    day?: string;
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
        <PageHeader title="Role cover" />
        <EmptyState
          title="No organization yet"
          description="Join an organization to see when a whole role is away."
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

  let cover;
  try {
    cover = await vacation.listRoleCover(principal, {
      organizationId,
      year,
      month,
      departmentId: departmentParam,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <div>
          <PageHeader title="Role cover" />
          <EmptyState title="Role cover unavailable" description={error.message} />
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

  const departmentId = cover.departmentId;
  const selectedDay =
    params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;

  function hrefFor(y: number, m: number, department = departmentId) {
    const query = new URLSearchParams({
      org: organizationId,
      year: String(y),
      month: String(m),
    });
    if (department) query.set("department", department);
    return `/vacation/cover?${query.toString()}`;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "People", href: "/vacation" },
          { label: "Role cover" },
        ]}
      />
      <PageHeader
        title="Role cover"
        description="Green means every role is in. Yellow means at least one person is still available. Red means nobody is available. Open a yellow or red day to see who is off and who is available."
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

      {orgs.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/vacation/cover?org=${org.id}&year=${year}&month=${month}`}
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

      <Panel>
        <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
          {monthLabel}
        </h2>
        {cover.departments.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href={hrefFor(year, month, null)}
              className={buttonClassName({
                variant: departmentId ? "secondary" : "primary",
                size: "sm",
              })}
            >
              All departments
            </Link>
            {cover.departments.map((department) => (
              <Link
                key={department.id}
                href={hrefFor(year, month, department.id)}
                className={buttonClassName({
                  variant:
                    department.id === departmentId ? "primary" : "secondary",
                  size: "sm",
                })}
              >
                {department.name}
              </Link>
            ))}
          </div>
        ) : null}
        <RoleCoverCalendar
          year={year}
          month={month}
          days={cover.days}
          selectedDate={selectedDay}
        />
      </Panel>
    </div>
  );
}
