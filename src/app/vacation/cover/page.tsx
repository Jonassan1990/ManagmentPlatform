import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleCoverageList } from "@/components/vacation/vacation-calendar";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import { AppError } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationCoverPage({
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

  let cover;
  try {
    cover = await vacation.listRoleCover(principal, {
      organizationId,
      year,
      month,
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

  function hrefFor(y: number, m: number) {
    return `/vacation/cover?org=${organizationId}&year=${y}&month=${m}`;
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
        description="In People, see when every person with the same role in a department is on a full weekday off."
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
        <h2 className="mb-1 text-base font-semibold text-[var(--ink)]">
          {monthLabel}
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Developers includes Developer, Software Developer, and the other
          developer titles. Testers, architects, and every other role are
          checked the same way. A half day or a few hours still leaves someone
          partly available.
        </p>
        <RoleCoverageList gaps={cover.coverage} />
      </Panel>
    </div>
  );
}
