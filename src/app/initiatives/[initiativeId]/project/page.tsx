import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  humanize,
  statusToneClass,
} from "@/components/governance/governance-panels";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import {
  CreateMilestoneForm,
  CreateWorkItemForm,
  UpdateBudgetForm,
  UpdateMilestoneForm,
  UpdateProjectForm,
  UpdateWorkItemForm,
} from "@/components/project/project-forms";
import { TraceabilityPanel } from "@/components/project/traceability-panel";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const { initiativeId } = await params;
  const { authz, governance, project: projectService } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let gateWorkspace;
  let trace;
  try {
    gateWorkspace = await governance.getGateWorkspace(principal, initiativeId);
    trace = await projectService.getTraceability(principal, initiativeId);
  } catch {
    notFound();
  }

  const item = gateWorkspace.initiative;
  const capabilities = await governance.getPrincipalCapabilities(
    principal,
    item.organizationId,
  );

  let project = null;
  try {
    project = await projectService.getProjectByInitiative(principal, initiativeId);
  } catch {
    project = null;
  }

  const sectionLink = (id: string, label: string) => (
    <a
      href={`#${id}`}
      className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
    >
      {label}
    </a>
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "Project" },
        ]}
      />
      <PageHeader
        title={project?.name ?? item.title}
        description={
          project
            ? `${item.referenceKey} · ${project.referenceKey} · Project`
            : `${item.referenceKey} · Project`
        }
      />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="project"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
        hasPilot={Boolean(item.pilot)}
        hasProject={Boolean(project)}
      />

      {!project ? (
        <EmptyState
          title="No Project yet"
          description="Convert from Pilot after a Scale or Conditional scale decision. Conversion is a separate authorized action."
          action={
            <Link
              href={`/initiatives/${item.id}/pilot`}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Open Pilot workspace
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {sectionLink("overview", "Overview")}
            {sectionLink("work", "Work")}
            {sectionLink("milestones", "Milestones")}
            {sectionLink("budget", "Budget")}
            {sectionLink("risks", "Risks")}
            {sectionLink("decisions", "Decisions")}
            {sectionLink("documents", "Documents")}
            {sectionLink("history", "History")}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Panel>
              <p className="text-sm text-[var(--muted)]">Status</p>
              <p className={`mt-1 font-medium ${statusToneClass(project.status)}`}>
                {humanize(project.status)}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-[var(--muted)]">Work items</p>
              <p className="mt-1 font-medium">{project.workItems.length}</p>
            </Panel>
            <Panel>
              <p className="text-sm text-[var(--muted)]">Milestones</p>
              <p className="mt-1 font-medium">{project.milestones.length}</p>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <section id="overview">
                <Panel>
                  <UpdateProjectForm
                    project={project}
                    initiativeId={item.id}
                    capabilities={capabilities}
                  />
                </Panel>
              </section>

              <section id="work">
                <Panel>
                  <h2 className="mb-3 font-medium">Work</h2>
                  {project.workItems.length === 0 ? (
                    <p className="mb-4 text-sm text-[var(--muted)]">
                      No work items yet. Epics, features, and tasks live here —
                      not PI Planning.
                    </p>
                  ) : (
                    <ul className="mb-5 space-y-4">
                      {project.workItems.map((wi) => (
                        <li
                          key={wi.id}
                          className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"
                        >
                          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                            <span className="font-medium">
                              {wi.referenceKey} · {wi.title}
                            </span>
                            <span className={statusToneClass(wi.status)}>
                              {humanize(wi.type)} · {humanize(wi.status)}
                            </span>
                          </div>
                          <UpdateWorkItemForm
                            workItem={wi}
                            initiativeId={item.id}
                            parentOptions={project.workItems.map((w) => ({
                              id: w.id,
                              referenceKey: w.referenceKey,
                              title: w.title,
                            }))}
                            capabilities={capabilities}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <CreateWorkItemForm
                    projectId={project.id}
                    initiativeId={item.id}
                    parentOptions={project.workItems.map((w) => ({
                      id: w.id,
                      referenceKey: w.referenceKey,
                      title: w.title,
                    }))}
                    capabilities={capabilities}
                  />
                </Panel>
              </section>

              <section id="milestones">
                <Panel>
                  <h2 className="mb-3 font-medium">Milestones</h2>
                  {project.milestones.length === 0 ? (
                    <p className="mb-4 text-sm text-[var(--muted)]">
                      No milestones yet.
                    </p>
                  ) : (
                    <ul className="mb-5 space-y-4">
                      {project.milestones.map((ms) => (
                        <li
                          key={ms.id}
                          className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"
                        >
                          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                            <span className="font-medium">
                              {ms.referenceKey} · {ms.title}
                            </span>
                            <span className={statusToneClass(ms.status)}>
                              {humanize(ms.status)}
                              {ms.criticality ? " · critical" : ""}
                            </span>
                          </div>
                          <UpdateMilestoneForm
                            milestone={ms}
                            initiativeId={item.id}
                            capabilities={capabilities}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <CreateMilestoneForm
                    projectId={project.id}
                    initiativeId={item.id}
                    capabilities={capabilities}
                  />
                </Panel>
              </section>

              <section id="budget">
                <Panel>
                  <UpdateBudgetForm
                    project={project}
                    initiativeId={item.id}
                    capabilities={capabilities}
                  />
                </Panel>
              </section>
            </div>

            <div className="space-y-4">
              <TraceabilityPanel
                initiativeId={item.id}
                demand={trace.demand}
                preStudy={trace.preStudy ? { id: "prestudy" } : null}
                poc={trace.poc}
                pilot={trace.pilot}
                project={project}
                decisions={trace.decisions}
              />

              <section id="risks">
                <Panel>
                  <h2 className="mb-2 font-medium">Risks</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Project risks reuse the initiative risk register.
                  </p>
                  <Link
                    href={`/initiatives/${item.id}/risks`}
                    className="mt-2 inline-block text-sm text-[var(--accent)] underline"
                  >
                    Open risks
                  </Link>
                </Panel>
              </section>

              <section id="decisions">
                <Panel>
                  <h2 className="mb-2 font-medium">Decisions</h2>
                  <Link
                    href={`/initiatives/${item.id}/decisions`}
                    className="text-sm text-[var(--accent)] underline"
                  >
                    Open decision log
                  </Link>
                </Panel>
              </section>

              <section id="documents">
                <Panel>
                  <h2 className="mb-2 font-medium">Documents</h2>
                  <Link
                    href={`/initiatives/${item.id}/documents`}
                    className="text-sm text-[var(--accent)] underline"
                  >
                    Open documents
                  </Link>
                </Panel>
              </section>

              <section id="history">
                <Panel>
                  <h2 className="mb-2 font-medium">History</h2>
                  <Link
                    href={`/initiatives/${item.id}/history`}
                    className="text-sm text-[var(--accent)] underline"
                  >
                    Open lifecycle history
                  </Link>
                </Panel>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
