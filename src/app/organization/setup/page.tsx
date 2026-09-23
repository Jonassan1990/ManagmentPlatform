import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationSetupPage() {
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    redirect("/");
  }

  const orgs = await organization.listOrganizations(principal);
  if (orgs.length > 0) {
    redirect("/organization");
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Organization", href: "/organization" },
          { label: "First-run setup" },
        ]}
      />
      <PageHeader
        title="First-run setup"
        description="No organization exists yet. Create the first one. No company name is assumed."
      />
      <Panel className="max-w-xl">
        <CreateOrganizationForm />
        <p className="mt-4 text-xs text-[var(--muted)]">
          Bootstrap authority is granted only when the database has zero
          organizations, and only to the authenticated principal. Production
          must eventually establish initial admin authority through a secure
          ops-time process — never a hardcoded email or identity in source.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          <Link href="/" className="underline">
            Back to overview
          </Link>
        </p>
      </Panel>
    </div>
  );
}
