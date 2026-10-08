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
  CreateIssueForm,
  CreateMilestoneForm,
  CreateWorkItemForm,
  UpdateBudgetForm,
  UpdateIssueForm,
  UpdateMilestoneForm,
  UpdateProjectForm,
  UpdateWorkItemForm,
} from "@/components/project/project-forms";
import { isActiveBlockerIssue } from "@/modules/project/application/issue-policy";
import { TraceabilityPanel } from "@/components/project/traceability-panel";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ initiativeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { initiativeId } = await params;
  const query = await searchParams;
  const issueStatusFilter =
    typeof query.issueStatus === "string" ? query.issueStatus : undefined;
  const issueSeverityFilter =
    typeof query.issueSeverity === "string" ? query.issueSeverity : undefined;
  const issueBlockerFilter =
    typeof query.issueBlocker === "string" ? query.issueBlocker : undefined;
  const {
    authz,
    governance,
    project: projectService,
    projectIssues,
    organization,
    initiative,
  } = createServices();
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
  const ownerPeople = await organization.listPersonOwnerCandidates(
    principal,
    item.organizationId,
  );

  let project = null;
  try {
    project = await projectService.getProjectByInitiative(principal, initiativeId);
  } catch {
    project = null;
  }

  let issueList: Awaited<
    ReturnType<typeof projectIssues.listProjectIssues>
  > | null = null;
  let relatedRisks: { id: string; referenceKey: string; title: string }[] = [];
  if (project) {
    try {
      issueList = await projectIssues.listProjectIssues(principal, {
        projectId: project.id,
        status:
          issueStatusFilter === "OPEN" ||
          issueStatusFilter === "IN_PROGRESS" ||
          issueStatusFilter === "RESOLVED" ||
          issueStatusFilter === "CLOSED"
            ? issueStatusFilter
            : undefined,
        severity:
          issueSeverityFilter === "LOW" ||
          issueSeverityFilter === "MEDIUM" ||
          issueSeverityFilter === "HIGH" ||
          issueSeverityFilter === "CRITICAL"
            ? issueSeverityFilter
            : undefined,
        activeBlockersOnly: issueBlockerFilter === "active" ? true : undefined,
        isBlocker:
          issueBlockerFilter === "flagged" ? true : undefined,
      });
    } catch {
      issueList = null;
    }
    try {
      const initWorkspace = await initiative.getInitiativeWorkspace(
        principal,
        initiativeId,
      );
      relatedRisks = (initWorkspace.initiative.risks ?? []).map((r) => ({
        id: r.id,
        referenceKey: r.referenceKey,
        title: r.title,
      }));
    } catch {
      relatedRisks = [];
    }
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
            {sectionLink("issues", "Issues")}
            {sectionLink("budget", "Budget")}
            {sectionLink("risks", "Risks")}
            {sectionLink("decisions", "Decisions")}
            {sectionLink("documents", "Documents")}
            {sectionLink("history", "History")}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <Panel>
              <p className="text-sm text-[var(--muted)]">Open issues</p>
              <p className="mt-1 font-medium">
                {issueList?.summary.openCount ?? 0}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-[var(--muted)]">Active blockers</p>
              <p className="mt-1 font-medium">
                {issueList?.summary.activeBlockerCount ?? 0}
                {(issueList?.summary.criticalOpenCount ?? 0) > 0
                  ? ` · ${issueList!.summary.criticalOpenCount} critical`
                  : ""}
              </p>
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
                    ownerPeople={ownerPeople}
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

              <section id="issues">
                <Panel>
                  <h2 className="mb-3 font-medium">Issues</h2>
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    Materialized delivery problems. Risks stay on the initiative
                    risk register — link optionally when a risk becomes real.
                    There is no separate Blocker entity; BLOCKER marks an active
                    issue that currently prevents delivery.
                  </p>
                  <form
                    className="mb-4 flex flex-wrap items-end gap-2 text-sm"
                    method="get"
                  >
                    <label className="flex flex-col gap-1">
                      <span className="text-[var(--muted)]">Status</span>
                      <select
                        name="issueStatus"
                        defaultValue={issueStatusFilter ?? ""}
                        className="rounded-md border border-[var(--line)] bg-transparent px-2 py-1"
                      >
                        <option value="">All</option>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[var(--muted)]">Severity</span>
                      <select
                        name="issueSeverity"
                        defaultValue={issueSeverityFilter ?? ""}
                        className="rounded-md border border-[var(--line)] bg-transparent px-2 py-1"
                      >
                        <option value="">All</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[var(--muted)]">Blocker</span>
                      <select
                        name="issueBlocker"
                        defaultValue={issueBlockerFilter ?? ""}
                        className="rounded-md border border-[var(--line)] bg-transparent px-2 py-1"
                      >
                        <option value="">All</option>
                        <option value="active">Active blockers</option>
                        <option value="flagged">Flagged isBlocker</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--line)] px-3 py-1.5"
                    >
                      Filter
                    </button>
                  </form>
                  {!issueList || issueList.issues.length === 0 ? (
                    <p className="mb-4 text-sm text-[var(--muted)]">
                      No issues yet.
                    </p>
                  ) : (
                    <ul className="mb-5 space-y-4">
                      {issueList.issues.map((issue) => {
                        const activeBlocker = isActiveBlockerIssue(issue);
                        return (
                          <li
                            key={issue.id}
                            className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="font-medium">
                                {issue.referenceKey} · {issue.title}
                              </span>
                              <span className="flex flex-wrap items-center gap-2">
                                {activeBlocker ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded border border-[var(--danger,#b42318)] px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--danger,#b42318)]"
                                    title="Active delivery blocker"
                                  >
                                    <span aria-hidden="true">▣</span>
                                    BLOCKER
                                  </span>
                                ) : issue.isBlocker ? (
                                  <span className="text-xs text-[var(--muted)]">
                                    blocker flag (inactive)
                                  </span>
                                ) : null}
                                <span className={statusToneClass(issue.status)}>
                                  {humanize(issue.severity)} ·{" "}
                                  {humanize(issue.status)}
                                </span>
                              </span>
                            </div>
                            <p className="mb-2 text-xs text-[var(--muted)]">
                              Owner:{" "}
                              {issue.ownerResource?.name ??
                                issue.ownerName ??
                                "Unassigned"}
                              {" · "}
                              Reported{" "}
                              {new Date(issue.reportedAt).toLocaleDateString()}
                              {issue.relatedRisk
                                ? ` · Risk ${issue.relatedRisk.referenceKey}`
                                : ""}
                            </p>
                            <UpdateIssueForm
                              issue={issue}
                              initiativeId={item.id}
                              capabilities={capabilities}
                              ownerPeople={ownerPeople}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <CreateIssueForm
                    projectId={project.id}
                    initiativeId={item.id}
                    capabilities={capabilities}
                    ownerPeople={ownerPeople}
                    relatedRisks={relatedRisks}
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
              <Panel>
                <h2 className="mb-2 font-medium">Plan delivery</h2>
                <p className="text-sm text-[var(--muted)]">
                  Work items belong on this project. Plan them into Program
                  Increments in PI Planning — capacity, sequencing, and
                  commitments live there.
                </p>
                <Link
                  href="/pi"
                  className="mt-3 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Open PI Planning
                </Link>
              </Panel>

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
