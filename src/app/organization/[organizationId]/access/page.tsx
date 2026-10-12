import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AssignRoleBindingForm,
  CreateLocalTestUserForm,
  LocalLoginsList,
  RoleBindingsTable,
} from "@/components/organization/access-forms";
import { buttonClassName } from "@/components/ui/button";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationAccessPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { authz, identity, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const canManage = await authz.can(principal, PERMISSIONS.ROLE_MANAGE, {
    type: "ORGANIZATION",
    organizationId,
  });
  if (!canManage) {
    notFound();
  }

  let hierarchy;
  try {
    hierarchy = await organization.getHierarchy(principal, organizationId);
  } catch {
    notFound();
  }
  if (!hierarchy) notFound();

  const [roles, principals, bindings, localLogins] = await Promise.all([
    authz.listRoleDefinitions(principal, organizationId),
    authz.listOrganizationPrincipals(principal, organizationId),
    authz.listRoleBindings(principal, organizationId),
    identity.listLocalLogins(principal, organizationId),
  ]);

  const sections = hierarchy.sections.map((s) => ({
    id: s.id,
    label: s.name,
  }));
  const departments = hierarchy.sections.flatMap((s) =>
    s.departments.map((d) => ({
      id: d.id,
      label: `${s.name} / ${d.name}`,
    })),
  );
  const teams = hierarchy.sections.flatMap((s) =>
    s.departments.flatMap((d) =>
      d.teams.map((t) => ({
        id: t.id,
        label: `${s.name} / ${d.name} / ${t.name}`,
      })),
    ),
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Organization", href: "/organization" },
          { label: hierarchy.name, href: `/organization/${organizationId}` },
          { label: "Access" },
        ]}
      />
      <PageHeader
        title="Access & roles"
        description="Create local test users, then assign RoleDefinition packs at Organization, Section, Department, or Team scope."
        actions={
          <Link
            href={`/organization/${organizationId}`}
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            Back to organization
          </Link>
        }
      />
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
          <LocalLoginsList logins={localLogins} />
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
        <Panel>
          <RoleBindingsTable
            bindings={bindings}
            organizationId={organizationId}
          />
        </Panel>
      </div>
      <Panel className="mt-4">
        <h3 className="mb-2 font-medium">Role packs</h3>
        <ul className="space-y-2 text-sm">
          {roles.map((r) => (
            <li key={r.id}>
              <span className="font-medium">{r.name}</span>
              <span className="text-[var(--muted)]"> · {r.key}</span>
              {r.description ? (
                <p className="text-[var(--muted)]">{r.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
