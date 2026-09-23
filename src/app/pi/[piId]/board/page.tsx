import { notFound, redirect } from "next/navigation";
import { PlanningBoard } from "@/components/pi-planning/planning-board";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiBoardPage({
  params,
}: {
  params: Promise<{ piId: string }>;
}) {
  const { piId } = await params;
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let board;
  try {
    board = await planning.getPlanningBoard(principal, piId);
  } catch {
    notFound();
  }

  const capabilities = await resolveCapabilities(
    authz,
    principal,
    board.pi.organizationId,
  );

  const backlog = board.backlog.map((item) => ({
    id: item.id,
    referenceKey: item.referenceKey,
    title: item.title,
    type: item.type,
    status: item.status,
    priority: item.priority,
    estimateHours: item.estimateHours?.toString() ?? null,
    project: item.project,
  }));

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: board.pi.referenceKey, href: `/pi/${piId}` },
          { label: "Board" },
        ]}
      />
      <PageHeader
        title="Planning board"
        description={`${board.pi.name} · ${piStatusLabel(board.pi.status)} — drag work onto team × iteration cells, or use Move / Allocate forms.`}
      />
      <PiTabs piId={piId} active="board" />
      <PlanningBoard
        piId={piId}
        departments={board.departments}
        iterations={board.pi.iterations.map((it) => ({
          id: it.id,
          name: it.name,
          sequence: it.sequence,
          referenceKey: it.referenceKey,
        }))}
        backlog={backlog}
        capabilities={capabilities}
      />
    </div>
  );
}
