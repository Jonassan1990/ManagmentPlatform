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
  ClosedProjectBanner,
  CloseProjectPanel,
  CreateIssueForm,
  CreateMilestoneForm,
  CreateWorkItemForm,
  UpdateBudgetForm,
  UpdateIssueForm,
  UpdateMilestoneForm,
  UpdateProjectForm,
  UpdateWorkItemForm,
} from "@/components/project/project-forms";
import {
  ClosedProjectSummary,
  DeliverySummaryStrip,
  ManagementAttentionPanel,
  ProjectHeader,
  ProjectNextActionSlot,
  ProjectSectionNav,
} from "@/components/project/project-workspace";
import { TraceabilityPanel } from "@/components/project/traceability-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Breadcrumbs, EmptyState, Panel } from "@/components/ui/page";
import { isActiveBlockerIssue } from "@/modules/project/application/issue-policy";
import { isProjectClosedStatus } from "@/modules/project/application/closure-policy";
import {
  buildManagementAttention,
  describeProjectNextAction,
  evaluateProjectDeliveryHealth,
  resolveProjectOwnerDisplay,
  summarizeDeliveryProgress,
} from "@/modules/project/application/project-presentation";
import { buildInitiativeTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
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
  const returnContext = parseReturnContext(query);
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
  let closureReadiness: Awaited<
    ReturnType<typeof projectService.getClosureReadiness>
  > | null = null;
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
        isBlocker: issueBlockerFilter === "flagged" ? true : undefined,
      });
    } catch {
      issueList = null;
    }
    try {
      closureReadiness = await projectService.getClosureReadiness(principal, {
        projectId: project.id,
        outcome: "DELIVERED",
      });
    } catch {
      closureReadiness = null;
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

  const projectClosed = project
    ? isProjectClosedStatus(project.status) || Boolean(project.closure)
    : false;
  const mutationCapabilities = projectClosed
    ? {
        ...capabilities,
        canEditProject: false,
        canCloseProject: false,
      }
    : capabilities;

  const owner = project
    ? resolveProjectOwnerDisplay({
        ownerResource: project.ownerResource,
        ownerResourceId: project.ownerResourceId,
        ownerName: project.ownerName,
      })
    : resolveProjectOwnerDisplay({});

  const deliveryCounts = project
    ? summarizeDeliveryProgress({
        milestones: project.milestones,
        workItems: project.workItems,
        issueSummary: issueList?.summary ?? null,
      })
    : null;

  const health = project
    ? evaluateProjectDeliveryHealth({
        id: project.id,
        initiativeId: item.id,
        status: project.status,
        plannedEnd: project.plannedEnd,
        plannedStart: project.plannedStart,
        closureOutcome: project.closure?.outcome ?? null,
        issues: (issueList?.issues ?? []).map((i) => ({
          id: i.id,
          status: i.status,
          severity: i.severity,
          isBlocker: i.isBlocker,
        })),
        milestones: project.milestones.map((m) => ({
          id: m.id,
          status: m.status,
          criticality: m.criticality,
          plannedDate: m.plannedDate,
        })),
      })
    : null;

  const attention = project
    ? buildManagementAttention({
        issues: (issueList?.issues ?? []).map((i) => ({
          id: i.id,
          referenceKey: i.referenceKey,
          title: i.title,
          status: i.status,
          severity: i.severity,
          isBlocker: i.isBlocker,
        })),
        milestones: project.milestones,
        workItems: project.workItems,
      })
    : [];

  const nextAction = describeProjectNextAction({
    hasProject: Boolean(project),
    projectClosed,
    initiativeId: item.id,
    activeBlockers: deliveryCounts?.activeBlockers ?? 0,
    delayedMilestones: deliveryCounts?.milestonesMissed ?? 0,
    openWork: deliveryCounts?.workOpen ?? 0,
    closureCanClose: closureReadiness?.readiness.canClose ?? null,
    canEditProject: mutationCapabilities.canEditProject,
    canCloseProject: capabilities.canCloseProject,
  });

  return (
    <div>
      <Breadcrumbs
        items={buildInitiativeTrail({
          initiativeId: item.id,
          referenceKey: item.referenceKey,
          title: item.title,
          leaf: "Project",
          returnContext,
        })}
      />

      {!project ? (
        <>
          <header className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
              Project workspace · {item.referenceKey}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
              {item.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              No Project entity yet. Conversion remains an explicit action after
              Pilot scale decisions.
            </p>
          </header>
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
            hasProject={false}
            preserveQuery={query}
          />
          <div className="mb-4">
            <ProjectNextActionSlot action={nextAction} />
          </div>
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
        </>
      ) : (
        <>
          <ProjectHeader
            projectReference={project.referenceKey}
            projectName={project.name}
            initiativeReference={item.referenceKey}
            initiativeId={item.id}
            initiativeTitle={item.title}
            status={project.status}
            owner={owner}
            plannedStart={project.plannedStart}
            plannedEnd={project.plannedEnd}
            healthClassification={health?.classification ?? "UNKNOWN"}
            healthMessage={health?.reasons[0]?.message ?? null}
            closed={projectClosed}
            purpose={project.objectives ?? project.description}
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
            preserveQuery={query}
          />

          <ProjectSectionNav closed={projectClosed} />

          {projectClosed ? (
            <ClosedProjectSummary
              projectStatus={project.status}
              closure={project.closure}
            />
          ) : null}

          {deliveryCounts && health ? (
            <DeliverySummaryStrip
              counts={deliveryCounts}
              healthClassification={health.classification}
            />
          ) : null}

          <div className="mb-4 space-y-4">
            <ProjectNextActionSlot action={nextAction} />
            <ManagementAttentionPanel items={attention} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <section id="overview">
                <Panel>
                  <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                    Overview
                  </h2>
                  {projectClosed ? (
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Name
                        </dt>
                        <dd className="mt-0.5 font-medium">{project.name}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Priority
                        </dt>
                        <dd className="mt-0.5">{humanize(project.priority)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Description
                        </dt>
                        <dd className="mt-0.5 text-[var(--muted)]">
                          {project.description?.trim() || "Not set"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <UpdateProjectForm
                      project={project}
                      initiativeId={item.id}
                      capabilities={mutationCapabilities}
                      ownerPeople={ownerPeople}
                    />
                  )}
                </Panel>
              </section>

              <section id="delivery">
                <Panel>
                  <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                    Delivery
                  </h2>
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    Work items and milestones for this project. PI sequencing
                    lives in PI Planning.
                  </p>

                  <h3 id="work" className="mb-3 text-sm font-semibold">
                    Work items
                  </h3>
                  {project.workItems.length === 0 ? (
                    <p className="mb-4 text-sm text-[var(--muted)]">
                      No work items yet.
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
                          {!projectClosed ? (
                            <UpdateWorkItemForm
                              workItem={wi}
                              initiativeId={item.id}
                              parentOptions={project.workItems.map((w) => ({
                                id: w.id,
                                referenceKey: w.referenceKey,
                                title: w.title,
                              }))}
                              capabilities={mutationCapabilities}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!projectClosed ? (
                    <CreateWorkItemForm
                      projectId={project.id}
                      initiativeId={item.id}
                      parentOptions={project.workItems.map((w) => ({
                        id: w.id,
                        referenceKey: w.referenceKey,
                        title: w.title,
                      }))}
                      capabilities={mutationCapabilities}
                    />
                  ) : null}

                  <h3 id="milestones" className="mb-3 mt-6 text-sm font-semibold">
                    Milestones
                  </h3>
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
                          {!projectClosed ? (
                            <UpdateMilestoneForm
                              milestone={ms}
                              initiativeId={item.id}
                              capabilities={mutationCapabilities}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!projectClosed ? (
                    <CreateMilestoneForm
                      projectId={project.id}
                      initiativeId={item.id}
                      capabilities={mutationCapabilities}
                    />
                  ) : null}
                </Panel>
              </section>

              <section id="issues">
                <Panel>
                  <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                    Issues & Risks
                  </h2>
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    Materialized delivery problems. Risks stay on the initiative
                    register — link optionally when a risk becomes real. BLOCKER
                    marks an active issue that currently prevents delivery.
                  </p>
                  {!projectClosed ? (
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
                  ) : null}
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
                                  <StatusBadge
                                    status="blocked"
                                    label="BLOCKER"
                                    size="compact"
                                  />
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
                            {!projectClosed ? (
                              <UpdateIssueForm
                                issue={issue}
                                initiativeId={item.id}
                                capabilities={mutationCapabilities}
                                ownerPeople={ownerPeople}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {!projectClosed ? (
                    <CreateIssueForm
                      projectId={project.id}
                      initiativeId={item.id}
                      capabilities={mutationCapabilities}
                      ownerPeople={ownerPeople}
                      relatedRisks={relatedRisks}
                    />
                  ) : null}
                  <div className="mt-4 border-t border-[var(--line)] pt-3">
                    <p className="text-sm text-[var(--muted)]">
                      Initiative risks remain on the risk register.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/risks`}
                      className="mt-2 inline-flex min-h-11 items-center text-sm text-[#087f78] underline"
                    >
                      Open risks
                    </Link>
                  </div>
                </Panel>
              </section>

              <section id="resources">
                <Panel>
                  <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                    Resources
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    Project cost and budget fields. Capacity and allocations are
                    planned in PI Planning / Portfolio Capacity — not recalculated
                    here.
                  </p>
                  {!projectClosed ? (
                    <div className="mt-3">
                      <UpdateBudgetForm
                        project={project}
                        initiativeId={item.id}
                        capabilities={mutationCapabilities}
                      />
                    </div>
                  ) : (
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[var(--muted)]">Approved budget</dt>
                        <dd>{String(project.approvedBudget ?? "Not set")}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Actual cost</dt>
                        <dd>{String(project.actualCost ?? "Not set")}</dd>
                      </div>
                    </dl>
                  )}
                  <Link
                    href="/portfolio/capacity"
                    className="mt-3 inline-flex min-h-11 items-center text-sm text-[#087f78] underline"
                  >
                    Open portfolio capacity
                  </Link>
                </Panel>
              </section>

              <section id="closure">
                <Panel>
                  {projectClosed ? (
                    <ClosedProjectBanner
                      projectStatus={project.status}
                      closure={project.closure}
                    />
                  ) : closureReadiness ? (
                    <CloseProjectPanel
                      project={project}
                      initiativeId={item.id}
                      readiness={closureReadiness.readiness}
                      capabilities={mutationCapabilities}
                    />
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Closure readiness is unavailable.
                    </p>
                  )}
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
                  className="mt-3 inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
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

              <section id="history">
                <Panel>
                  <h2 className="mb-2 font-medium">History</h2>
                  <p className="mb-2 text-sm text-[var(--muted)]">
                    Lifecycle transitions and governance decisions remain on the
                    Initiative.
                  </p>
                  <div className="flex flex-col gap-2 text-sm">
                    <Link
                      href={`/initiatives/${item.id}/history`}
                      className="text-[#087f78] underline"
                    >
                      Open lifecycle history
                    </Link>
                    <Link
                      href={`/initiatives/${item.id}/decisions`}
                      className="text-[#087f78] underline"
                    >
                      Open decision log
                    </Link>
                    <Link
                      href={`/initiatives/${item.id}/documents`}
                      className="text-[#087f78] underline"
                    >
                      Open documents
                    </Link>
                  </div>
                </Panel>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
