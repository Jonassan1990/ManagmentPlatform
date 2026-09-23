import { redirect } from "next/navigation";
import { CreateInitiativeForm } from "@/components/initiative/initiative-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function NewInitiativePage() {
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  if (orgs.length === 0) redirect("/organization/setup");

  const organizations = [];
  for (const org of orgs) {
    const hierarchy = await organization.getHierarchy(principal, org.id);
    organizations.push({
      id: org.id,
      name: org.name,
      departments:
        hierarchy?.sections.flatMap((section) =>
          section.departments.map((department) => ({
            id: department.id,
            name: department.name,
            sectionName: section.name,
          })),
        ) ?? [],
    });
  }

  if (organizations.every((o) => o.departments.length === 0)) {
    redirect(`/organization/${orgs[0].id}`);
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: "New" },
        ]}
      />
      <PageHeader
        title="New initiative"
        description="Create a durable initiative root. Demand, requirements, and pre-study stay attached to this identity."
      />
      <Panel className="max-w-3xl">
        <CreateInitiativeForm organizations={organizations} />
      </Panel>
    </div>
  );
}
