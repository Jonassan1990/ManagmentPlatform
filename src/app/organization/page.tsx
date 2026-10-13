import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { Alert } from "@/components/ui/alert";
import { homeCrumb, organizationHubCrumb } from "@/modules/navigation/breadcrumbs";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import { OrganizationChart } from "@/components/organization/organization-chart";
import { OrganizationList } from "@/components/organization/organization-list";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    redirect("/");
  }

  const { org: requestedOrgId } = await searchParams;
  const orgs = await organization.listOrganizations(principal);
  const canCreateAnother =
    orgs.length > 0
      ? await authz.can(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
          type: "PLATFORM",
        })
      : false;
  const listed = await Promise.all(
    orgs.map(async (org) => ({
      id: org.id,
      name: org.name,
      description: org.description,
      version: org.version,
      parentOrganizationId: org.parentOrganizationId,
      canEdit:
        canCreateAnother ||
        (await authz.can(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
          type: "ORGANIZATION",
          organizationId: org.id,
        })),
    })),
  );
  const byParent = new Map<string | null, typeof listed>();
  for (const org of listed) {
    const parentId = listed.some((item) => item.id === org.parentOrganizationId)
      ? org.parentOrganizationId
      : null;
    const group = byParent.get(parentId) ?? [];
    group.push({ ...org, parentOrganizationId: parentId });
    byParent.set(parentId, group);
  }
  const seen = new Set<string>();
  const ordered: ((typeof listed)[number] & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const org of byParent.get(parentId) ?? []) {
      if (seen.has(org.id)) continue;
      seen.add(org.id);
      ordered.push({ ...org, depth });
      walk(org.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const org of listed) {
    if (!seen.has(org.id)) ordered.push({ ...org, depth: 0, parentOrganizationId: null });
  }
  const chartOrgId =
    requestedOrgId && orgs.some((org) => org.id === requestedOrgId)
      ? requestedOrgId
      : await organization.findStructuredOrganizationId(orgs.map((org) => org.id));
  const chart = chartOrgId
    ? await organization.getOrganizationChart(principal, chartOrgId)
    : null;

  return (
    <div>
      <Breadcrumbs
        items={[homeCrumb(), { label: organizationHubCrumb().label }]}
      />
      <PageHeader
        title="Organization"
        description="Connect a main organization such as Q to the organizations inside it, for example QD, QM, and QC, and those to QCM or QCF."
      />

      {orgs.length === 0 ? (
        <EmptyState
          title="No organization has been configured yet"
          description="Create the first organization to unlock sections, departments, teams, and resources."
          action={
            <Link
              href="/organization/setup"
              className={buttonClassName({ variant: "primary" })}
            >
              Set up organization
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {chart ? (
            <Panel>
              <OrganizationChart
                chart={chart}
                canAssign={listed.find((org) => org.id === chart.id)?.canEdit ?? false}
              />
            </Panel>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel>
              <h2 className="mp-section-title mb-3">Organizations</h2>
              <OrganizationList orgs={ordered} selectedId={chart?.id} />
            </Panel>
            <Panel>
              <h2 className="mp-section-title mb-3">Create another organization</h2>
              {canCreateAnother ? (
                <CreateOrganizationForm
                  redirectToOrg
                  parents={ordered.map((org) => ({ id: org.id, name: org.name }))}
                />
              ) : (
                <Alert tone="info" live="polite">
                  Creating another organization requires platform organization
                  structure manage permission. You can still browse organizations
                  you can read.
                </Alert>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
