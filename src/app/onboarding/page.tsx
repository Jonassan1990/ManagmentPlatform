import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateOnboardingForm } from "@/components/onboarding/onboarding-forms";
import { buttonClassName } from "@/components/ui/button";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

function mapStatus(status: string) {
  switch (status) {
    case "PASSED":
      return { status: "approved" as const, label: "Officially passed" };
    case "CANCELLED":
      return { status: "cancelled" as const, label: "Cancelled" };
    default:
      return { status: "in-progress" as const, label: "In progress" };
  }
}

export default async function OnboardingPage() {
  const { authz, onboarding, organization } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  const mine = await onboarding.listForPrincipal(principal);

  let canManage = false;
  let managed: Awaited<ReturnType<typeof onboarding.listManaged>> = [];
  let principals: Array<{ id: string; displayName: string | null }> = [];
  const preferredOrgId = orgs[0]?.id ?? null;

  if (preferredOrgId) {
    canManage = await authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.ONBOARDING_MANAGE,
      preferredOrgId,
    );
    if (canManage) {
      managed = await onboarding.listManaged(principal, preferredOrgId);
      principals = await onboarding.listAssignablePrincipals(
        principal,
        preferredOrgId,
      );
    }
  }

  const managedOnly = managed.filter(
    (row) =>
      row.employeePrincipalId !== principal.id &&
      row.onboarderPrincipalId !== principal.id,
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Onboarding" },
        ]}
      />
      <PageHeader
        title="Onboarding checklists"
        description="New employee and onboarder must both check every item. Official pass happens only when both sides are complete."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">
            My checklists
          </h2>
          {mine.length === 0 ? (
            <EmptyState
              title="No onboarding assigned to you"
              description="When you are the new employee or the onboarder, your checklists appear here."
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {mine.map((row) => {
                const badge = mapStatus(row.status);
                const role =
                  row.employeePrincipalId === principal.id
                    ? "Employee"
                    : "Onboarder";
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <Link
                        href={`/onboarding/${row.id}`}
                        className="font-medium text-[var(--ink)] hover:underline"
                      >
                        {row.title}
                      </Link>
                      <p className="text-sm text-[var(--muted)]">
                        You: {role} · Dual checks {row.progress.dualDone}/
                        {row.progress.total}
                      </p>
                    </div>
                    <StatusBadge status={badge.status} label={badge.label} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">
            Start onboarding
          </h2>
          {!canManage ? (
            <EmptyState
              title="Managers start checklists"
              description="Section/department managers and org admins can create an onboarding checklist and assign the employee plus onboarder."
            />
          ) : orgs.length === 0 ? (
            <EmptyState
              title="No organization"
              description="Create or join an organization first."
              action={
                <Link
                  href="/organization"
                  className={buttonClassName({ variant: "secondary" })}
                >
                  Organization
                </Link>
              }
            />
          ) : (
            <CreateOnboardingForm
              organizations={orgs.map((o) => ({ id: o.id, name: o.name }))}
              principals={principals}
              defaultOrganizationId={preferredOrgId}
            />
          )}
        </Panel>
      </div>

      {canManage && managedOnly.length > 0 ? (
        <Panel className="mt-6">
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">
            Other checklists in organization
          </h2>
          <ul className="divide-y divide-[var(--line)]">
            {managedOnly.map((row) => {
              const badge = mapStatus(row.status);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <Link
                      href={`/onboarding/${row.id}`}
                      className="font-medium text-[var(--ink)] hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      Dual checks {row.progress.dualDone}/{row.progress.total}
                    </p>
                  </div>
                  <StatusBadge status={badge.status} label={badge.label} />
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
