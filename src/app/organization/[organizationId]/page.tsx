import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreateResourceForm,
  CreateSectionForm,
  EditOrganizationForm,
} from "@/components/organization/org-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let hierarchy;
  try {
    hierarchy = await organization.getHierarchy(principal, organizationId);
  } catch {
    notFound();
  }
  if (!hierarchy) notFound();

  const allTeams = hierarchy.sections.flatMap((section) =>
    section.departments.flatMap((department) =>
      department.teams.map((team) => ({
        id: team.id,
        name: `${section.name} / ${department.name} / ${team.name}`,
      })),
    ),
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Organization", href: "/organization" },
          { label: hierarchy.name },
        ]}
      />
      <PageHeader
        title={hierarchy.name}
        description={
          hierarchy.description ??
          "Navigate the hierarchy from section to resource."
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-medium">Hierarchy</h2>
            {hierarchy.sections.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No sections yet. Create the first section to continue.
              </p>
            ) : (
              <ul className="space-y-4">
                {hierarchy.sections.map((section) => (
                  <li key={section.id}>
                    <Link
                      href={`/organization/${hierarchy.id}/sections/${section.id}`}
                      className="font-medium text-[var(--accent)]"
                    >
                      Section · {section.name}
                    </Link>
                    {section.departments.length === 0 ? (
                      <p className="ml-4 mt-1 text-sm text-[var(--muted)]">
                        No departments
                      </p>
                    ) : (
                      <ul className="ml-4 mt-2 space-y-2 border-l border-[var(--line)] pl-4">
                        {section.departments.map((department) => (
                          <li key={department.id}>
                            <Link
                              href={`/organization/${hierarchy.id}/departments/${department.id}`}
                              className="text-sm font-medium"
                            >
                              Department · {department.name}
                            </Link>
                            <ul className="ml-3 mt-1 space-y-1">
                              {department.teams.map((team) => (
                                <li key={team.id}>
                                  <Link
                                    href={`/organization/${hierarchy.id}/teams/${team.id}`}
                                    className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                                  >
                                    Team · {team.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium">Resources</h2>
              <Link
                href={`/organization/${hierarchy.id}/resources`}
                className="text-sm text-[var(--accent)]"
              >
                View all
              </Link>
            </div>
            {hierarchy.resources.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No resources yet. Resources are capacity-bearing entities and are
                not the same as login accounts.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {hierarchy.resources.map((resource) => (
                  <li key={resource.id} className="py-2">
                    <Link
                      href={`/organization/${hierarchy.id}/resources/${resource.id}`}
                      className="font-medium hover:text-[var(--accent)]"
                    >
                      {resource.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">
                      {resource.type}
                      {resource.functionRole ? ` · ${resource.functionRole}` : ""}
                      {resource.memberships.length > 0
                        ? ` · ${resource.memberships
                            .map((m) => m.team.name)
                            .join(", ")}`
                        : " · no team membership"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-medium">Edit organization</h2>
            <EditOrganizationForm
              id={hierarchy.id}
              name={hierarchy.name}
              description={hierarchy.description}
              version={hierarchy.version}
            />
          </Panel>
          <Panel>
            <CreateSectionForm organizationId={hierarchy.id} />
          </Panel>
          <Panel>
            <CreateResourceForm
              organizationId={hierarchy.id}
              teams={allTeams}
            />
          </Panel>
        </div>
      </div>

      </div>
  );
}
