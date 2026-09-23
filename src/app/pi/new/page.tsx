import { redirect } from "next/navigation";
import { CreatePiForm } from "@/components/pi-planning/pi-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function NewPiPage() {
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  if (orgs.length === 0) redirect("/organization/setup");

  const organizations = [];
  let capabilities = await resolveCapabilities(authz, principal, orgs[0].id);

  for (const org of orgs) {
    const caps = await resolveCapabilities(authz, principal, org.id);
    if (caps.canCreatePi) capabilities = caps;
    const hierarchy = await organization.getHierarchy(principal, org.id);
    organizations.push({
      id: org.id,
      name: org.name,
      sections:
        hierarchy?.sections.map((s) => ({
          id: s.id,
          name: s.name,
        })) ?? [],
    });
  }

  if (!capabilities.canCreatePi) {
    redirect("/pi");
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: "New" },
        ]}
      />
      <PageHeader
        title="New Program Increment"
        description="Define the PI window. Add iterations and participating departments on the settings page after creation."
      />
      <Panel className="max-w-3xl">
        <CreatePiForm
          organizations={organizations}
          capabilities={capabilities}
          defaultOrganizationId={orgs[0].id}
        />
      </Panel>
    </div>
  );
}
