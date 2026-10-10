/**
 * M5C-B — Governance / PoC / Pilot presentation helpers.
 * Pure display mapping only — no domain rule or authorization changes.
 * Safe for server and client imports (no "use client").
 */
import type { StatusBadgeMapping } from "@/components/ui/status-adapters";

export type DecisionOutcomeOption = {
  value: string;
  label: string;
};

export const PRE_STUDY_POC_OUTCOMES: DecisionOutcomeOption[] = [
  { value: "GO", label: "Go" },
  { value: "CONDITIONAL_GO", label: "Conditional go" },
  { value: "NO_GO", label: "No-go" },
  { value: "HOLD", label: "Hold" },
];

export const PILOT_GATE_OUTCOMES: DecisionOutcomeOption[] = [
  { value: "SCALE", label: "Scale" },
  { value: "EXTEND_PILOT", label: "Extend pilot" },
  { value: "CONDITIONAL_SCALE", label: "Conditional scale" },
  { value: "STOP", label: "Stop" },
  { value: "HOLD", label: "Hold" },
];

/** Outcomes permitted for a gate — presentation helper only. */
export function outcomesForGateType(
  gateType: string | null | undefined,
): DecisionOutcomeOption[] {
  return gateType === "PILOT_GATE" ? PILOT_GATE_OUTCOMES : PRE_STUDY_POC_OUTCOMES;
}

export function humanizeGovernanceToken(value: string): string {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function mapGateStatusBadge(status: string | null | undefined): StatusBadgeMapping {
  switch (status) {
    case "APPROVED":
    case "DECISION_RECORDED":
      return { status: "approved", label: humanizeGovernanceToken(status) };
    case "IN_REVIEW":
    case "SUBMITTED":
    case "APPROVALS_COMPLETE":
      return { status: "pending", label: humanizeGovernanceToken(status) };
    case "CHANGES_REQUESTED":
    case "REJECTED":
      return { status: "at-risk", label: humanizeGovernanceToken(status) };
    case "DRAFT":
      return { status: "draft", label: "Draft" };
    default:
      return {
        status: "unavailable",
        label: status ? humanizeGovernanceToken(status) : "Not started",
      };
  }
}

export function mapSubmissionStatusBadge(
  status: string | null | undefined,
): StatusBadgeMapping {
  switch (status) {
    case "APPROVALS_COMPLETE":
      return { status: "pending", label: "Approvals complete" };
    case "DECISION_RECORDED":
      return { status: "approved", label: "Decision recorded" };
    case "IN_REVIEW":
      return { status: "pending", label: "In review" };
    case "SUBMITTED":
      return { status: "pending", label: "Submitted" };
    case "CHANGES_REQUESTED":
      return { status: "at-risk", label: "Changes requested" };
    case "WITHDRAWN":
    case "SUPERSEDED":
      return { status: "archived", label: humanizeGovernanceToken(status) };
    default:
      return {
        status: "draft",
        label: status ? humanizeGovernanceToken(status) : "No submission",
      };
  }
}

export function mapApprovalRequestBadge(
  status: string,
  outcome?: string | null,
): StatusBadgeMapping {
  const key = outcome ?? status;
  switch (key) {
    case "APPROVED":
      return { status: "approved", label: "Approved" };
    case "REJECTED":
      return { status: "cancelled", label: "Rejected" };
    case "CHANGES_REQUESTED":
      return { status: "at-risk", label: "Changes requested" };
    case "PENDING":
      return { status: "pending", label: "Pending review" };
    default:
      return { status: "draft", label: humanizeGovernanceToken(key) };
  }
}

export function mapDecisionOutcomeBadge(
  outcome: string | null | undefined,
): StatusBadgeMapping {
  switch (outcome) {
    case "GO":
    case "SCALE":
      return { status: "approved", label: humanizeGovernanceToken(outcome) };
    case "CONDITIONAL_GO":
    case "CONDITIONAL_SCALE":
    case "EXTEND_PILOT":
    case "HOLD":
      return { status: "pending", label: humanizeGovernanceToken(outcome) };
    case "NO_GO":
    case "STOP":
      return { status: "cancelled", label: humanizeGovernanceToken(outcome) };
    default:
      return {
        status: "unavailable",
        label: outcome ? humanizeGovernanceToken(outcome) : "No decision",
      };
  }
}

export type GovernanceBlockingKind =
  | "none"
  | "changes_requested"
  | "awaiting_approvals"
  | "decision_required"
  | "open_conditions";

export type GovernanceDecisionContext = {
  initiativeReference: string;
  initiativeTitle: string;
  gateTypeLabel: string;
  gateType: string | null;
  submissionStatusLabel: string;
  submissionStatus: string | null;
  lifecycleStageLabel: string;
  decisionOwnerLabel: string | null;
  blockingKind: GovernanceBlockingKind;
  blockingLabel: string;
  revision: number | null;
};

export function buildGovernanceDecisionContext(input: {
  referenceKey: string;
  title: string;
  currentStage: string;
  gateType?: string | null;
  submissionStatus?: string | null;
  revision?: number | null;
  decisionOwnerName?: string | null;
  changesRequested?: boolean;
  openBlockingConditions?: number;
}): GovernanceDecisionContext {
  const gateType = input.gateType ?? null;
  const submissionStatus = input.submissionStatus ?? null;
  let blockingKind: GovernanceBlockingKind = "none";
  let blockingLabel = "Nothing blocking governance right now";

  if (input.changesRequested) {
    blockingKind = "changes_requested";
    blockingLabel = "Changes requested — revise before progressing";
  } else if ((input.openBlockingConditions ?? 0) > 0) {
    blockingKind = "open_conditions";
    blockingLabel = `${input.openBlockingConditions} open condition(s) block progression`;
  } else if (submissionStatus === "APPROVALS_COMPLETE") {
    blockingKind = "decision_required";
    blockingLabel = "Approvals complete — decision required";
  } else if (
    submissionStatus === "IN_REVIEW" ||
    submissionStatus === "SUBMITTED"
  ) {
    blockingKind = "awaiting_approvals";
    blockingLabel = "Awaiting required approvals";
  }

  return {
    initiativeReference: input.referenceKey,
    initiativeTitle: input.title,
    gateType: gateType,
    gateTypeLabel: gateType
      ? humanizeGovernanceToken(gateType)
      : input.currentStage === "PRE_STUDY"
        ? "Pre-study gate (not submitted)"
        : "No active gate",
    submissionStatus,
    submissionStatusLabel: submissionStatus
      ? humanizeGovernanceToken(submissionStatus)
      : "No submission",
    lifecycleStageLabel: humanizeGovernanceToken(input.currentStage),
    decisionOwnerLabel: input.decisionOwnerName?.trim() || null,
    blockingKind,
    blockingLabel,
    revision: input.revision ?? null,
  };
}

export type GovernanceNextActionView = {
  kind:
    | "submit_pre_study"
    | "complete_readiness"
    | "open_poc"
    | "open_pilot"
    | "record_decision"
    | "await_approvals"
    | "revise"
    | "resolve_conditions"
    | "idle";
  label: string;
  detail: string;
  blocked: boolean;
  href?: string | null;
  ctaLabel?: string | null;
};

export function describeGovernanceNextAction(input: {
  initiativeId: string;
  currentStage: string;
  canSubmitFresh: boolean;
  preStudyReady: boolean;
  changesRequested: boolean;
  submissionStatus?: string | null;
  openBlockingConditions?: number;
}): GovernanceNextActionView {
  if (input.changesRequested) {
    return {
      kind: "revise",
      label: "Revise and resubmit",
      detail:
        "Update evidence, then revise the submission so reviewers receive a new revision.",
      blocked: true,
      href: null,
      ctaLabel: null,
    };
  }
  if ((input.openBlockingConditions ?? 0) > 0) {
    return {
      kind: "resolve_conditions",
      label: "Resolve open conditions",
      detail:
        "Blocking decision conditions must be closed before the next lifecycle step.",
      blocked: true,
      href: `/initiatives/${input.initiativeId}/decisions`,
      ctaLabel: "Open decisions",
    };
  }
  if (input.canSubmitFresh) {
    return {
      kind: "submit_pre_study",
      label: "Submit pre-study for governance",
      detail:
        "Freeze an evidence package for authority review. This is not a decision.",
      blocked: false,
      href: null,
      ctaLabel: null,
    };
  }
  if (input.currentStage === "PRE_STUDY" && !input.preStudyReady) {
    return {
      kind: "complete_readiness",
      label: "Complete pre-study readiness",
      detail: "Close readiness blockers before submitting for governance.",
      blocked: true,
      href: `/initiatives/${input.initiativeId}/pre-study`,
      ctaLabel: "Open pre-study",
    };
  }
  if (input.submissionStatus === "APPROVALS_COMPLETE") {
    return {
      kind: "record_decision",
      label: "Record the governance decision",
      detail:
        "Required approvals are complete. An authorized decision maker records the gate outcome.",
      blocked: false,
      href: `/initiatives/${input.initiativeId}/decisions`,
      ctaLabel: "Open decision workspace",
    };
  }
  if (
    input.submissionStatus === "IN_REVIEW" ||
    input.submissionStatus === "SUBMITTED"
  ) {
    return {
      kind: "await_approvals",
      label: "Await required approvals",
      detail:
        "Reviewers act from My Approvals. Approval outcomes are immutable once recorded.",
      blocked: false,
      href: "/approvals",
      ctaLabel: "Open My Approvals",
    };
  }
  if (input.currentStage === "POC") {
    return {
      kind: "open_poc",
      label: "Manage PoC evaluation",
      detail:
        "Operational criteria and recommendation live on the PoC workspace; formal decision stays under Decisions.",
      blocked: false,
      href: `/initiatives/${input.initiativeId}/poc`,
      ctaLabel: "Open PoC workspace",
    };
  }
  if (input.currentStage === "PILOT") {
    return {
      kind: "open_pilot",
      label: "Manage Pilot evaluation",
      detail:
        "Pilot KPIs and scale recommendation live here; SCALE does not auto-create a Project.",
      blocked: false,
      href: `/initiatives/${input.initiativeId}/pilot`,
      ctaLabel: "Open Pilot workspace",
    };
  }
  return {
    kind: "idle",
    label: "No governance action required",
    detail: "Nothing is waiting for submission, approval, or decision in the current state.",
    blocked: false,
    href: null,
    ctaLabel: null,
  };
}

/** Explicit distinction: operational recommendation ≠ formal governance decision. */
export function recommendationVsDecisionCopy(surface: "poc" | "pilot"): {
  evaluation: string;
  recommendation: string;
  decision: string;
} {
  if (surface === "poc") {
    return {
      evaluation:
        "Objectives, hypothesis, criteria, and measured results on this PoC.",
      recommendation:
        "The PoC conclusion proposed for governance — informational until a decision is recorded.",
      decision:
        "Recorded separately under Decisions after required approvals. GO does not auto-create a Pilot.",
    };
  }
  return {
    evaluation:
      "Pilot scope, target users/sites, KPIs, criteria, costs, and observed results.",
    recommendation:
      "Scale / extend / stop proposal from the pilot team — not the formal rollout decision.",
    decision:
      "SCALE / CONDITIONAL_SCALE are formal outcomes. Project conversion remains an explicit action.",
  };
}

export type LifecycleClarityMessage = {
  chain: string;
  autoCreate: string;
  nextAuthorized: string | null;
};

export function describeLifecycleClarity(input: {
  hasPoC: boolean;
  hasPilot: boolean;
  hasProject: boolean;
  latestOutcome?: string | null;
  canCreatePoC?: boolean;
  canCreatePilot?: boolean;
  canConvertProject?: boolean;
}): LifecycleClarityMessage {
  const chain = "Initiative → PoC → Pilot → Project";
  const autoCreate =
    "GO and SCALE never auto-create the next entity. Creation and conversion remain explicit, capability-gated actions.";

  let nextAuthorized: string | null = null;
  if (input.canCreatePoC && !input.hasPoC) {
    nextAuthorized = "Authorized next action: create PoC (manual).";
  } else if (input.canCreatePilot && !input.hasPilot) {
    nextAuthorized = "Authorized next action: create Pilot (manual).";
  } else if (input.canConvertProject && !input.hasProject) {
    nextAuthorized = "Authorized next action: convert to Project (manual).";
  } else if (
    input.latestOutcome === "CONDITIONAL_GO" ||
    input.latestOutcome === "CONDITIONAL_SCALE"
  ) {
    nextAuthorized =
      "Conditional decision recorded — close blocking conditions before the next create/convert step.";
  }

  return { chain, autoCreate, nextAuthorized };
}

/** Structural usability counters for docs / QA (not user-study claims). */
export function countGovernancePrimaryControls(input: {
  canSubmit: boolean;
  canRevise: boolean;
  canApprove: boolean;
  canDecide: boolean;
  hasNextActionLink: boolean;
}): number {
  return [
    input.canSubmit,
    input.canRevise,
    input.canApprove,
    input.canDecide,
    input.hasNextActionLink,
  ].filter(Boolean).length;
}

export function evidenceSummary(entries: { present: boolean }[]): {
  total: number;
  present: number;
  missing: number;
  label: string;
} {
  const total = entries.length;
  const present = entries.filter((e) => e.present).length;
  const missing = total - present;
  return {
    total,
    present,
    missing,
    label:
      total === 0
        ? "No evidence package"
        : missing === 0
          ? `All ${total} evidence items present`
          : `${present}/${total} present · ${missing} missing`,
  };
}

export function splitApprovalRequests<T extends { status: string; record?: unknown }>(
  requests: T[],
): { pending: T[]; completed: T[] } {
  const pending = requests.filter(
    (r) => r.status === "PENDING" && !r.record,
  );
  const completed = requests.filter(
    (r) => r.status !== "PENDING" || Boolean(r.record),
  );
  return { pending, completed };
}
