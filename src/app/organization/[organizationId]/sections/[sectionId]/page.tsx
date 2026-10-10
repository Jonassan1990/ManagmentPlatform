import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreateDepartmentForm,
  EditSectionForm,
} from "@/components/organization/org-forms";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function SectionPage({
  params,
}: {
  params: Promise<{ organizationId: string; sectionId: string }>;
}) {
  const { organizationId, sectionId } = await params;
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let section;
  let departments;
  let org;
  try {
    org = await organization.getOrganization(principal, organizationId);
    section = await organization.getSection(principal, sectionId);
    if (section.organizationId !== organizationId) notFound();
    departments = await organization.listDepartments(principal, sectionId);
  } catch {
    notFound();
  }

  const canManage = await authz.can(
    principal,
    PERMISSIONS.ORG_STRUCTURE_MANAGE,
    { type: "ORGANIZATION", organizationId },
  );

  return (
    <div>
      <Breadcrumbs
        items={buildOrganizationTrail({
          organizationId: org.id,
          organizationName: org.name,
          section: { id: section.id, name: section.name },
        })}
      />
      <PageHeader
        title={section.name}
        description={section.description ?? "Section workspace"}
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <h2 className="mb-3 font-medium">Departments</h2>
          {departments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No departments yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {departments.map((department) => (
                <li key={department.id} className="py-2">
                  <Link
                    href={`/organization/${org.id}/departments/${department.id}`}
                    className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                  >
                    {department.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-4">
          {canManage ? (
            <>
              <Panel>
                <h2 className="mb-3 font-medium">Edit section</h2>
                <EditSectionForm
                  id={section.id}
                  name={section.name}
                  description={section.description}
                  version={section.version}
                />
              </Panel>
              <Panel>
                <CreateDepartmentForm sectionId={section.id} />
              </Panel>
            </>
          ) : (
            <Panel>
              <h2 className="mb-3 font-medium">Structure changes</h2>
              <Alert tone="info" live="polite">
                This section is read-only for your account. Organization
                structure manage permission is required to edit sections or add
                departments.
              </Alert>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
