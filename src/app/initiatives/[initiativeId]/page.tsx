import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreatePoCForm,
  SubmitPreStudyButton,
} from "@/components/governance/governance-forms";
import { AdvanceLifecycleButton } from "@/components/initiative/initiative-forms";
import {
  ActivityHistoryPreview,
  AttentionPanel,
  InitiativeHeader,
  InitiativeTabs,
  LifecycleRail,
  NextActionPanel,
  ReadinessPanel,
  SituationOverview,
  resolveOwnershipParty,
} from "@/components/initiative/workspace";
import {
  ConvertToProjectForm,
  CreatePilotForm,
} from "@/components/pilot/pilot-forms";
import { Panel } from "@/components/ui/page";
import { Breadcrumbs } from "@/components/ui/page";
import { describeInitiativeNextAction } from "@/modules/initiative/application/initiative-journey";
import { buildInitiativeTrail } from "@/modules/navigation/breadcrumbs";
import {
  appendPreservedQuery,
  parseReturnContext,
} from "@/modules/navigation/return-context";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

function urgencyLabel(urgency: string | null | undefined): string | null {
  if (!urgency) return null;
  return urgency.charAt(0) + urgency.slice(1).toLowerCase();
}

function tabHref(
  initiativeId: string,
  tab: string,
  query: Record<string, string | string[] | undefined>,
): string {
  const path =
    tab === "overview" || tab === ""
      ? `/initiatives/${initiativeId}`
      : `/initiatives/${initiativeId}/${tab}`;
  return appendPreservedQuery(path, query);
}

export default async function InitiativeOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ initiativeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { initiativeId } = await params;
  const query = await searchParams;
  const returnContext = parseReturnContext(query);
  const { authz, initiative, governance } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let workspace;
  let gateWorkspace;
  try {
    workspace = await initiative.getInitiativeWorkspace(principal, initiativeId);
    gateWorkspace = await governance.getGateWorkspace(principal, initiativeId);
  } catch {
    notFound();
  }

  const { initiative: item, attention, readiness, pocReadiness, pilotReadiness } =
    workspace;
  const capabilities = await governance.getPrincipalCapabilities(
    principal,
    item.organizationId,
  );
  const gateItem = gateWorkspace.initiative;
  const activeSubmission = gateItem.governanceGates
    .flatMap((g) => g.submissions)
    .find(
      (s) =>
        s.status === "IN_REVIEW" ||
        s.status === "SUBMITTED" ||
        s.status === "APPROVALS_COMPLETE" ||
        s.status === "CHANGES_REQUESTED",
    );
  const preStudyGo = gateItem.decisions.find(
    (d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO",
  );
  const pocGo = gateItem.governanceGates
    .find((g) => g.gateType === "POC_GATE")
    ?.decisions.find((d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO");
  const scaleDecision = gateItem.decisions.find(
    (d) => d.outcome === "SCALE" || d.outcome === "CONDITIONAL_SCALE",
  );
  const openBlocking = gateItem.decisions.flatMap((d) =>
    (d.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    ),
  );
  const canCreatePoC =
    !gateItem.poc &&
    item.currentStage === "PRE_STUDY" &&
    Boolean(preStudyGo) &&
    openBlocking.length === 0;
  const canCreatePilot =
    !gateItem.pilot &&
    item.currentStage === "POC" &&
    Boolean(pocGo) &&
    openBlocking.length === 0;
  const canConvertProject =
    !gateItem.project &&
    item.currentStage === "PILOT" &&
    Boolean(scaleDecision) &&
    (scaleDecision?.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    ).length === 0;
  const canSubmitPreStudy =
    item.currentStage === "PRE_STUDY" &&
    Boolean(readiness?.ready) &&
    !activeSubmission;

  const nextAction = describeInitiativeNextAction({
    currentStage: item.currentStage,
    canSubmitPreStudy,
    hasActiveSubmission: Boolean(activeSubmission),
    submissionStatus: activeSubmission?.status ?? null,
    canCreatePoC,
    canCreatePilot,
    canConvertProject,
    openBlockingConditions: openBlocking.length,
    preStudyReady: readiness?.ready ?? null,
    pocReady: pocReadiness?.ready ?? null,
    pilotReady: pilotReadiness?.ready ?? null,
  });

  const owner = resolveOwnershipParty({
    label: "Business owner",
    resource: item.businessOwnerResource,
    resourceId: item.businessOwnerResourceId,
    nameSnapshot: item.businessOwnerName,
  });
  const requester = resolveOwnershipParty({
    label: "Requester",
    resource: item.requesterResource,
    resourceId: item.requesterResourceId,
    nameSnapshot: item.requesterName,
  });
  const sponsor = resolveOwnershipParty({
    label: "Sponsor",
    resource: item.sponsorResource,
    resourceId: item.sponsorResourceId,
    nameSnapshot: null,
  });
  const priority = urgencyLabel(item.demand?.urgency ?? null);
  const nextTab = nextAction.hrefHint ?? "overview";
  const nextHref = tabHref(item.id, nextTab === "overview" ? "" : nextTab, query);
  const ctaLabel =
    nextTab === "demand"
      ? "Open Demand"
      : nextTab === "requirements"
        ? "Open Requirements"
        : nextTab === "pre-study"
          ? "Open Pre-study"
          : nextTab === "governance"
            ? "Open Governance"
            : nextTab === "decisions"
              ? "Open Decisions"
              : nextTab === "poc"
                ? "Open PoC"
                : nextTab === "pilot"
                  ? "Open Pilot"
                  : nextTab === "project"
                    ? "Open Project"
                    : "Continue";

  // Viewer / unauthorized principals still see the situation; mutation forms
  // below remain gated by existing capability checks inside the forms.
  const showMutationChrome = true;

  return (
    <div>
      <Breadcrumbs
        items={buildInitiativeTrail({
          initiativeId: item.id,
          referenceKey: item.referenceKey,
          title: item.title,
          returnContext,
        })}
      />

      <InitiativeHeader
        referenceKey={item.referenceKey}
        title={item.title}
        currentStage={item.currentStage}
        status={item.status}
        owner={owner}
        departmentName={item.department.name}
        organizationName={item.department.section?.organization?.name ?? null}
        priorityLabel={priority}
        createdAt={item.createdAt}
        updatedAt={item.updatedAt}
      />

      <div className="mb-5">
        <LifecycleRail
          current={item.currentStage}
          ownerName={owner.name}
          nextActionLabel={nextAction.label}
          blockedReason={nextAction.blocked ? nextAction.detail : null}
          premium={{
            currentStage: item.currentStage,
            hasActiveSubmission: Boolean(activeSubmission),
            submissionStatus: activeSubmission?.status ?? null,
            hasPreStudyGoDecision: Boolean(preStudyGo),
            openBlockingConditions: openBlocking.length,
            canSubmitPreStudy,
          }}
        />
      </div>

      <InitiativeTabs
        initiativeId={item.id}
        active="overview"
        currentStage={item.currentStage}
        hasGovernance={gateItem.governanceGates.length > 0}
        hasPoC={Boolean(gateItem.poc)}
        hasPilot={Boolean(gateItem.pilot)}
        hasProject={Boolean(gateItem.project)}
        preserveQuery={query}
      />

      <div className="mb-5">
        <NextActionPanel
          label={nextAction.label}
          detail={nextAction.detail}
          blocked={nextAction.blocked}
          href={nextHref}
          ctaLabel={ctaLabel}
        >
          {showMutationChrome && item.currentStage === "DEMAND" ? (
            <AdvanceLifecycleButton
              initiativeId={item.id}
              expectedVersion={item.version}
              toStage="REQUIREMENTS"
              label="Advance to Requirements"
            />
          ) : null}
          {showMutationChrome && item.currentStage === "REQUIREMENTS" ? (
            <AdvanceLifecycleButton
              initiativeId={item.id}
              expectedVersion={item.version}
              toStage="PRE_STUDY"
              label="Advance to Pre-study"
            />
          ) : null}
          {showMutationChrome && canSubmitPreStudy ? (
            <SubmitPreStudyButton
              initiativeId={item.id}
              expectedInitiativeVersion={item.version}
              capabilities={capabilities}
            />
          ) : null}
          {showMutationChrome && canCreatePoC ? (
            <CreatePoCForm
              initiativeId={item.id}
              capabilities={capabilities}
            />
          ) : null}
          {showMutationChrome && canCreatePilot ? (
            <CreatePilotForm
              initiativeId={item.id}
              capabilities={capabilities}
            />
          ) : null}
          {showMutationChrome && canConvertProject ? (
            <ConvertToProjectForm
              initiativeId={item.id}
              defaultName={item.title}
              capabilities={capabilities}
            />
          ) : null}
        </NextActionPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <SituationOverview
            problem={item.demand?.problemOpportunity}
            expectedValue={item.demand?.expectedValue}
            strategicAlignment={item.demand?.strategicAlignment}
            priorityLabel={priority}
            owner={owner}
            requester={requester}
            sponsor={sponsor}
            risks={item.risks.map((r) => ({
              id: r.id,
              referenceKey: r.referenceKey,
              title: r.title,
              status: r.status,
            }))}
          />

          <AttentionPanel items={attention} />
          <ReadinessPanel readiness={readiness} />

          {pocReadiness ? (
            <Panel aria-labelledby="poc-readiness">
              <div className="flex items-center justify-between gap-3">
                <h2 id="poc-readiness" className="font-medium">
                  PoC readiness
                </h2>
                <span
                  className={`text-sm font-medium ${
                    pocReadiness.ready ? "text-[var(--ok)]" : "text-[var(--danger)]"
                  }`}
                >
                  {pocReadiness.ready ? "READY" : "NOT READY"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Ready means PoC evidence can be submitted for a governance
                decision.
              </p>
            </Panel>
          ) : null}
          {pilotReadiness ? (
            <Panel aria-labelledby="pilot-readiness">
              <div className="flex items-center justify-between gap-3">
                <h2 id="pilot-readiness" className="font-medium">
                  Pilot readiness
                </h2>
                <span
                  className={`text-sm font-medium ${
                    pilotReadiness.ready
                      ? "text-[var(--ok)]"
                      : "text-[var(--danger)]"
                  }`}
                >
                  {pilotReadiness.ready ? "READY" : "NOT READY"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Ready means Pilot evidence can be submitted for a scale decision.
              </p>
            </Panel>
          ) : null}

          {item.currentStage === "PROJECT" && gateItem.project ? (
            <Panel>
              <h2 className="font-medium">Delivery</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                This Initiative has an authorized Project. Continue delivery work
                in the Project workspace.
              </p>
              <Link
                href={appendPreservedQuery(
                  `/initiatives/${item.id}/project`,
                  query,
                )}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Open Project workspace
              </Link>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <ActivityHistoryPreview
            transitions={item.lifecycleTransitions}
            historyHref={tabHref(item.id, "history", query)}
          />

          <Panel>
            <h2 className="mb-3 font-medium">Quick links</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href={tabHref(item.id, "demand", query)}
                  className="text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Discovery · Demand
                </Link>
              </li>
              <li>
                <Link
                  href={tabHref(item.id, "requirements", query)}
                  className="text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Discovery · Requirements
                </Link>
              </li>
              {gateItem.governanceGates.length > 0 ? (
                <li>
                  <Link
                    href={tabHref(item.id, "governance", query)}
                    className="text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    Governance
                  </Link>
                </li>
              ) : null}
              {gateItem.poc ? (
                <li>
                  <Link
                    href={tabHref(item.id, "poc", query)}
                    className="text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    Validation · PoC
                  </Link>
                </li>
              ) : null}
              {gateItem.pilot ? (
                <li>
                  <Link
                    href={tabHref(item.id, "pilot", query)}
                    className="text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    Validation · Pilot
                  </Link>
                </li>
              ) : null}
              {gateItem.project ? (
                <li>
                  <Link
                    href={tabHref(item.id, "project", query)}
                    className="text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    Delivery · Project
                  </Link>
                </li>
              ) : null}
            </ul>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Actions remain permission-checked on the server. Resource ownership
              is not Principal authorization.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
