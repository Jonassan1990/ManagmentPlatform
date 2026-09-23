import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UpdateApprovalTemplateForm } from "@/components/governance/policy-forms";
import { humanize } from "@/components/governance/governance-panels";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function GovernancePolicyPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { authz, governance, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let org;
  try {
    org = await organization.getHierarchy(principal, organizationId);
  } catch {
    notFound();
  }
  if (!org) notFound();

  const capabilities = await governance.getPrincipalCapabilities(
    principal,
    organizationId,
  );

  if (!capabilities.canManageGovernancePolicy && !capabilities.canViewGovernance) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Overview", href: "/" },
            { label: "Organization", href: "/organization" },
            { label: org.name, href: `/organization/${organizationId}` },
            { label: "Governance policy" },
          ]}
        />
        <EmptyState
          title="Not authorized"
          description="You do not have permission to view governance policy templates."
        />
      </div>
    );
  }

  const templates = await governance.listApprovalTemplates(principal);
  const byGate = templates.reduce<Record<string, typeof templates>>((acc, t) => {
    (acc[t.gateType] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Organization", href: "/organization" },
          { label: org.name, href: `/organization/${organizationId}` },
          { label: "Governance policy" },
        ]}
      />
      <PageHeader
        title="Governance policy"
        description="Approval requirement templates by gate. Edits create a new policy version; historical submissions keep their snapshot."
        actions={
          <Link
            href={`/organization/${organizationId}`}
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            Back to organization
          </Link>
        }
      />

      {!capabilities.canManageGovernancePolicy ? (
        <Panel className="mb-4">
          <p className="text-sm text-[var(--muted)]">
            You can view templates but cannot edit them.
          </p>
        </Panel>
      ) : null}

      <div className="space-y-6">
        {Object.entries(byGate).map(([gateType, rows]) => (
          <div key={gateType} className="space-y-3">
            <h2 className="font-medium">{humanize(gateType)}</h2>
            {rows.map((template) => (
              <Panel key={template.id}>
                <UpdateApprovalTemplateForm
                  template={template}
                  organizationId={organizationId}
                  capabilities={capabilities}
                />
              </Panel>
            ))}
          </div>
        ))}
        {templates.length === 0 ? (
          <EmptyState
            title="No templates"
            description="Default templates are seeded when governance is first used."
          />
        ) : null}
      </div>
    </div>
  );
}
