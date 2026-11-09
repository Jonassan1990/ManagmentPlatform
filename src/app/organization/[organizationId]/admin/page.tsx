import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AssignDepartmentForm,
  CreateDepartmentForm,
  CreateResourceForm,
  CreateSectionForm,
  CreateTeamForm,
  EditOrganizationForm,
} from "@/components/organization/org-forms";
import {
  AssignRoleBindingForm,
  CreateLocalTestUserForm,
  LocalLoginsList,
  RoleBindingsTable,
} from "@/components/organization/access-forms";
import { OrganizationChart } from "@/components/organization/organization-chart";
import {
  AdminConfigTabs,
  parseAdminConfigTab,
} from "@/components/organization/admin-config-tabs";
import { buttonClassName } from "@/components/ui/button";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppError } from "@/modules/shared/errors";
import { FUNCTION_ROLES } from "@/modules/organization/domain/function-roles";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { withOrgMode } from "@/modules/organization/application/org-ui-mode";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationAdminConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { organizationId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = parseAdminConfigTab(tabParam);

  const { authz, identity, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const [canStructure, canAccess] = await Promise.all([
    authz.can(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId,
    }),
    authz.can(principal, PERMISSIONS.ROLE_MANAGE, {
      type: "ORGANIZATION",
      organizationId,
    }),
  ]);

  if (!canStructure && !canAccess) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Overview", href: "/" },
            { label: "Admin config", href: "/admin" },
            { label: "Not authorized" },
          ]}
        />
        <EmptyState
          title="Not authorized"
          description="Admin config needs organization-level structure or access management permission."
          action={
            <Link
              href="/organization"
              className={buttonClassName({ variant: "secondary" })}
            >
              Back to Organization
            </Link>
          }
        />
      </div>
    );
  }

  let hierarchy;
  try {
    hierarchy = await organization.getHierarchy(principal, organizationId);
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") {
      return (
        <div>
          <EmptyState
            title="Not authorized"
            description="You cannot open admin config for this organization."
            action={
              <Link
                href="/admin"
                className={buttonClassName({ variant: "secondary" })}
              >
                Back to Admin
              </Link>
            }
          />
        </div>
      );
    }
    notFound();
  }
  if (!hierarchy) notFound();

  const [roster, chart, visibleOrgs] = await Promise.all([
    organization.getAdminConfigRoster(principal, organizationId),
    organization.getOrganizationChart(principal, organizationId),
    organization.listOrganizations(principal),
  ]);

  const allTeams = hierarchy.sections.flatMap((section) =>
    section.departments.flatMap((department) =>
      department.teams.map((team) => ({
        id: team.id,
        name: `${section.name} / ${department.name} / ${team.name}`,
      })),
    ),
  );

  const peopleOptions = hierarchy.resources
    .filter((resource) => resource.type === "PERSON")
    .map((resource) => ({
      id: resource.id,
      name: resource.name,
      role: resource.functionRole,
    }));

  let roles: Awaited<ReturnType<typeof authz.listRoleDefinitions>> = [];
  let principals: Awaited<ReturnType<typeof authz.listOrganizationPrincipals>> =
    [];
  let bindings: Awaited<ReturnType<typeof authz.listRoleBindings>> = [];
  let localLogins: Awaited<ReturnType<typeof identity.listLocalLogins>> = [];
  let localLoginsUnavailable = false;

  if (canAccess) {
    const [roleRows, principalRows, bindingRows, localResult] =
      await Promise.all([
        authz.listRoleDefinitions(principal, organizationId),
        authz.listOrganizationPrincipals(principal, organizationId),
        authz.listRoleBindings(principal, organizationId),
        identity.listLocalLogins(principal, organizationId).then(
          (rows) => ({ ok: true as const, rows }),
          () => ({ ok: false as const, rows: [] as Awaited<
            ReturnType<typeof identity.listLocalLogins>
          > }),
        ),
      ]);
    roles = roleRows;
    principals = principalRows;
    bindings = bindingRows;
    localLogins = localResult.rows;
    localLoginsUnavailable = !localResult.ok;
  }

  const sections = hierarchy.sections.map((section) => ({
    id: section.id,
    label: section.name,
  }));
  const departments = hierarchy.sections.flatMap((section) =>
    section.departments.map((department) => ({
      id: department.id,
      label: `${section.name} / ${department.name}`,
    })),
  );
  const teams = hierarchy.sections.flatMap((section) =>
    section.departments.flatMap((department) =>
      department.teams.map((team) => ({
        id: team.id,
        label: `${section.name} / ${department.name} / ${team.name}`,
      })),
    ),
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Admin config", href: "/admin" },
          { label: hierarchy.name },
        ]}
      />
      <PageHeader
        title={`Admin config · ${hierarchy.name}`}
        description="Confirm users, departments, and role packs. A person's job role is chosen from the role catalog."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organization/${organizationId}`}
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Organization view
            </Link>
            {canAccess ? (
              <Link
                href={`/organization/${organizationId}/access`}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Classic Access page
              </Link>
            ) : null}
          </div>
        }
      />

      <AdminConfigTabs organizationId={organizationId} active={tab} />

      {tab === "confirm" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "People", value: roster.summary.peopleCount },
              { label: "Confirmed", value: roster.summary.confirmedCount },
              {
                label: "Missing department",
                value: roster.summary.missingPlacement,
              },
              { label: "Missing login", value: roster.summary.missingLogin },
              { label: "Missing role", value: roster.summary.missingRole },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-md border border-[var(--line)] px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {card.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <Panel>
            <h2 className="mb-2 text-base font-semibold text-[var(--ink)]">
              Confirm roster
            </h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              A person is confirmed when they have a department/team placement, a
              linked login, and at least one role binding in this organization.
            </p>
            {roster.people.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No people yet. Use the People &amp; departments tab to add them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      <th className="py-2 pr-3 font-semibold">Person</th>
                      <th className="py-2 pr-3 font-semibold">Department / team</th>
                      <th className="py-2 pr-3 font-semibold">Login</th>
                      <th className="py-2 pr-3 font-semibold">Roles</th>
                      <th className="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.people.map((person) => (
                      <tr
                        key={person.resourceId}
                        className="border-b border-[var(--line)] align-top"
                      >
                        <td className="py-3 pr-3">
                          <Link
                            href={`/organization/${organizationId}/resources/${person.resourceId}`}
                            className="font-medium text-[var(--ink)] underline-offset-2 hover:underline"
                          >
                            {person.name}
                          </Link>
                          {person.functionRole ? (
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">
                              {person.functionRole}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3 text-[var(--muted)]">
                          {person.primaryDepartment
                            ? `${person.primaryDepartment.sectionName} / ${person.primaryDepartment.departmentName} / ${person.primaryDepartment.teamName}`
                            : "—"}
                        </td>
                        <td className="py-3 pr-3 text-[var(--muted)]">
                          {person.linkedPrincipal
                            ? (person.linkedPrincipal.displayName ??
                              person.linkedPrincipal.email ??
                              person.linkedPrincipal.id)
                            : "—"}
                        </td>
                        <td className="py-3 pr-3 text-[var(--muted)]">
                          {person.roles.length > 0
                            ? person.roles
                                .map(
                                  (role) =>
                                    `${role.roleName} (${role.scopeType.toLowerCase()})`,
                                )
                                .join(", ")
                            : "—"}
                        </td>
                        <td className="py-3">
                          <StatusBadge
                            status={person.confirmed ? "approved" : "pending"}
                            label={
                              person.confirmed
                                ? "Confirmed"
                                : person.gaps.join(" · ")
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {roster.unboundLogins.length > 0 ? (
            <Panel>
              <h2 className="mb-2 text-base font-semibold text-[var(--ink)]">
                Logins without a person record
              </h2>
              <p className="mb-3 text-sm text-[var(--muted)]">
                These accounts have roles but are not linked to a capacity person.
                Link them from the person resource page or create the person first.
              </p>
              <ul className="space-y-2 text-sm">
                {roster.unboundLogins.map((login) => (
                  <li key={login.principalId}>
                    <span className="font-medium text-[var(--ink)]">
                      {login.displayName ?? login.email ?? login.principalId}
                    </span>
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {login.roles.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === "hierarchy" ? (
        canStructure ? (
          <div className="space-y-4">
            <Panel>
              {chart ? (
                <OrganizationChart chart={chart} canAssign={false} />
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Hierarchy chart unavailable.
                </p>
              )}
            </Panel>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <h2 className="mb-3 font-medium">Edit organization</h2>
                <EditOrganizationForm
                  id={hierarchy.id}
                  name={hierarchy.name}
                  description={hierarchy.description}
                  version={hierarchy.version}
                  parentOrganizationId={hierarchy.parentOrganizationId}
                  parents={visibleOrgs.map((org) => ({
                    id: org.id,
                    name: org.name,
                  }))}
                />
              </Panel>
              <Panel>
                <CreateSectionForm organizationId={hierarchy.id} />
              </Panel>
            </div>
            {hierarchy.sections.map((section) => (
              <Panel key={section.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium">{section.name}</h2>
                  <Link
                    href={withOrgMode(
                      `/organization/${organizationId}/sections/${section.id}`,
                      "config",
                    )}
                    className="text-sm text-[var(--color-accent)] underline"
                  >
                    Open section config
                  </Link>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <CreateDepartmentForm
                    sectionId={section.id}
                    parents={section.departments.map((department) => ({
                      id: department.id,
                      name: department.name,
                    }))}
                  />
                  <div className="space-y-4">
                    {section.departments.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">
                        No departments in this section yet.
                      </p>
                    ) : (
                      section.departments.map((department) => (
                        <div
                          key={department.id}
                          className="rounded-md border border-[var(--line)] p-3"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-[var(--ink)]">
                              {department.name}
                              {department.parentDepartmentId ? (
                                <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                                  child department
                                </span>
                              ) : null}
                            </p>
                            <Link
                              href={withOrgMode(
                                `/organization/${organizationId}/departments/${department.id}`,
                                "config",
                              )}
                              className="text-sm text-[var(--color-accent)] underline"
                            >
                              Open
                            </Link>
                          </div>
                          <ul className="mb-3 text-sm text-[var(--muted)]">
                            {department.teams.length === 0 ? (
                              <li>No teams yet</li>
                            ) : (
                              department.teams.map((team) => (
                                <li key={team.id}>Team · {team.name}</li>
                              ))
                            )}
                          </ul>
                          <CreateTeamForm departmentId={department.id} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Hierarchy needs structure permission"
            description="You can manage roles, but not the organization tree, for this organization."
          />
        )
      ) : null}

      {tab === "people" ? (
        canStructure ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <CreateResourceForm
                organizationId={hierarchy.id}
                teams={allTeams}
              />
            </Panel>
            <Panel>
              <h2 className="mb-2 font-medium">Role catalog</h2>
              <p className="mb-3 text-sm text-[var(--muted)]">
                Job roles for people and onboarding come from this list.
                Permission role packs stay on the Roles &amp; users tab.
              </p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {FUNCTION_ROLES.map((role) => (
                  <li key={role.key} className="text-[var(--ink)]">
                    {role.label}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <AssignDepartmentForm
                people={peopleOptions}
                departments={roster.departments}
              />
            </Panel>
            <Panel className="xl:col-span-2">
              <h2 className="mb-3 font-medium">People in this organization</h2>
              {peopleOptions.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No people yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {roster.people.map((person) => (
                    <li
                      key={person.resourceId}
                      className="flex flex-wrap items-start justify-between gap-3 py-3"
                    >
                      <div>
                        <Link
                          href={`/organization/${organizationId}/resources/${person.resourceId}`}
                          className="font-medium text-[var(--ink)] underline-offset-2 hover:underline"
                        >
                          {person.name}
                        </Link>
                        <p className="text-sm text-[var(--muted)]">
                          {person.primaryDepartment
                            ? `${person.primaryDepartment.sectionName} / ${person.primaryDepartment.departmentName} / ${person.primaryDepartment.teamName}`
                            : "Not placed in a department yet"}
                        </p>
                      </div>
                      <StatusBadge
                        status={person.confirmed ? "approved" : "pending"}
                        label={
                          person.confirmed
                            ? "Confirmed"
                            : person.gaps.join(" · ") || "Incomplete"
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        ) : (
          <EmptyState
            title="People placement needs structure permission"
            description="Ask an organization admin to place people into departments, or use Roles & users if you only manage access."
          />
        )
      ) : null}

      {tab === "roles" ? (
        canAccess ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <CreateLocalTestUserForm
                organizationId={organizationId}
                roles={roles}
                sections={sections}
                departments={departments}
                teams={teams}
              />
            </Panel>
            <Panel>
              <LocalLoginsList
                organizationId={organizationId}
                logins={localLogins}
                unavailable={localLoginsUnavailable}
              />
            </Panel>
            <Panel>
              <AssignRoleBindingForm
                organizationId={organizationId}
                roles={roles}
                principals={principals}
                sections={sections}
                departments={departments}
                teams={teams}
              />
            </Panel>
            <Panel className="lg:col-span-2">
              <RoleBindingsTable
                bindings={bindings}
                organizationId={organizationId}
                roles={roles}
                sections={sections}
                departments={departments}
                teams={teams}
              />
            </Panel>
            <Panel className="lg:col-span-2">
              <h3 className="mb-2 font-medium">Role packs</h3>
              <ul className="space-y-2 text-sm">
                {roles.map((role) => (
                  <li key={role.id}>
                    <span className="font-medium">{role.name}</span>
                    <span className="text-[var(--muted)]"> · {role.key}</span>
                    {role.description ? (
                      <p className="text-[var(--muted)]">{role.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        ) : (
          <EmptyState
            title="Roles need access permission"
            description="You can manage hierarchy and people, but role bindings require organization Access management."
            action={
              <Link
                href={`/organization/${organizationId}/admin?tab=people`}
                className={buttonClassName({ variant: "secondary" })}
              >
                Go to People &amp; departments
              </Link>
            }
          />
        )
      ) : null}
    </div>
  );
}
