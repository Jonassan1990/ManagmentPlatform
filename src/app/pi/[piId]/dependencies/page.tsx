import { notFound, redirect } from "next/navigation";
import { DependencyPanels } from "@/components/pi-planning/dependency-forms";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiDependenciesPage({
  params,
}: {
  params: Promise<{ piId: string }>;
}) {
  const { piId } = await params;
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let pi;
  let dependencies;
  let conflicts;
  let board;
  try {
    pi = await planning.getProgramIncrement(principal, piId);
    [dependencies, conflicts, board] = await Promise.all([
      planning.listDependencies(principal, pi.organizationId),
      planning.deriveConflictsForPi(piId),
      planning.getPlanningBoard(principal, piId),
    ]);
  } catch {
    notFound();
  }

  const capabilities = await resolveCapabilities(
    authz,
    principal,
    pi.organizationId,
  );

  const workItemMap = new Map<string, string>();
  for (const item of board.backlog) {
    workItemMap.set(
      item.id,
      `${item.referenceKey} — ${item.title} (${item.project.referenceKey})`,
    );
  }
  for (const dept of board.departments) {
    for (const team of dept.teams) {
      for (const cell of team.iterations) {
        for (const card of cell.cards) {
          workItemMap.set(
            card.workItem.id,
            `${card.workItem.referenceKey} — ${card.workItem.title} (${card.workItem.project.referenceKey})`,
          );
        }
      }
    }
  }

  const projectMap = new Map<string, string>();
  for (const item of board.backlog) {
    projectMap.set(
      item.project.id,
      `${item.project.referenceKey} — ${item.project.name}`,
    );
  }
  for (const dept of board.departments) {
    for (const team of dept.teams) {
      for (const cell of team.iterations) {
        for (const card of cell.cards) {
          projectMap.set(
            card.workItem.project.id,
            `${card.workItem.project.referenceKey} — ${card.workItem.project.name}`,
          );
        }
      }
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: pi.referenceKey, href: `/pi/${piId}` },
          { label: "Dependencies" },
        ]}
      />
      <PageHeader
        title="Dependencies"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — cross-team and cross-project planning links.`}
      />
      <PiTabs piId={piId} active="dependencies" />
      <DependencyPanels
        piId={piId}
        organizationId={pi.organizationId}
        dependencies={dependencies}
        conflicts={conflicts}
        workItemOptions={[...workItemMap.entries()].map(([id, label]) => ({
          id,
          label,
        }))}
        projectOptions={[...projectMap.entries()].map(([id, label]) => ({
          id,
          label,
        }))}
        capabilities={capabilities}
      />
    </div>
  );
}
