/**
 * M4D-B — Presentation-only PI planning journey stages.
 * Does not introduce a domain status machine. Derives UI state from existing
 * selection / promotion / approval preview contracts.
 */

import type { PlanApprovalStateLabel } from "./plan-approval-types";

export type PiWorkflowStageId =
  | "plan"
  | "compare"
  | "select"
  | "promote"
  | "approve"
  | "baseline";

export type PiWorkflowStageStatus =
  | "completed"
  | "current"
  | "available"
  | "blocked"
  | "upcoming";

export type PiWorkflowStage = {
  id: PiWorkflowStageId;
  label: string;
  shortLabel: string;
  status: PiWorkflowStageStatus;
  /** Why blocked / what to do next for this stage. */
  detail: string;
  href?: string;
};

export type PiWorkflowPrimaryAction = {
  stageId: PiWorkflowStageId;
  label: string;
  /** Soft navigation target when the action is not an in-page mutation. */
  href?: string;
  blocked: boolean;
  reasons: string[];
};

export type PiPlanningWorkflowView = {
  stages: PiWorkflowStage[];
  currentStageId: PiWorkflowStageId;
  primaryAction: PiWorkflowPrimaryAction;
  /** One-line lifecycle reminder — not approval semantics. */
  lifecycleNote: string;
};

export type DerivePiPlanningWorkflowInput = {
  piId: string;
  hasSelection: boolean;
  approvalState: PlanApprovalStateLabel;
  canPromote: boolean;
  promoteDisabledReasons: string[];
  canApprove: boolean;
  approveDisabledReasons: string[];
  canBaseline: boolean;
  baselineDisabledReasons: string[];
  /** AuthZ — PI_REVIEW */
  canReviewPi: boolean;
  /** AuthZ — PI_BASELINE */
  canBaselinePi: boolean;
  readinessClassification?: string | null;
  selectedLabel?: string | null;
  currentRevisionVersion?: number | null;
  hasBaseline?: boolean;
};

const LIFECYCLE_NOTE =
  "Selected ≠ Applied to current plan ≠ Approved ≠ Baselined — each step is a separate decision.";

/**
 * Pure derivation for the Review journey progress indicator.
 */
export function derivePiPlanningWorkflow(
  input: DerivePiPlanningWorkflowInput,
): PiPlanningWorkflowView {
  const promoted =
    input.approvalState === "PROMOTED_NOT_APPROVED" ||
    input.approvalState === "APPROVED" ||
    input.approvalState === "APPROVAL_STALE" ||
    input.approvalState === "BASELINED" ||
    Boolean(input.hasBaseline);

  const approved =
    input.approvalState === "APPROVED" ||
    input.approvalState === "BASELINED" ||
    Boolean(input.hasBaseline);

  const baselined =
    input.approvalState === "BASELINED" || Boolean(input.hasBaseline);

  const selectDone = input.hasSelection || promoted;
  const promoteDone = promoted;
  const approveDone = approved && input.approvalState !== "APPROVAL_STALE";
  const baselineDone = baselined;

  const boardHref = `/pi/${input.piId}/board`;
  const compareHref = `/pi/${input.piId}/compare`;
  const reviewHref = `/pi/${input.piId}/review`;
  const baselineHref = `/pi/${input.piId}/baseline`;

  const authReviewReason = input.canReviewPi
    ? []
    : ["Requires PI review permission."];
  const authBaselineReason = input.canBaselinePi
    ? []
    : ["Requires PI baseline permission (PI_BASELINE)."];

  let currentStageId: PiWorkflowStageId = "select";
  if (!selectDone) currentStageId = "select";
  else if (!promoteDone) currentStageId = "promote";
  else if (!approveDone || input.approvalState === "APPROVAL_STALE")
    currentStageId = "approve";
  else if (!baselineDone) currentStageId = "baseline";
  else currentStageId = "baseline";

  const stages: PiWorkflowStage[] = [
    {
      id: "plan",
      label: "Plan",
      shortLabel: "Plan",
      status: "completed",
      detail: "Prepare allocations on the planning board.",
      href: boardHref,
    },
    {
      id: "compare",
      label: "Compare",
      shortLabel: "Compare",
      status: selectDone || promoted ? "completed" : "available",
      detail: "Evaluate scenario alternatives side by side.",
      href: compareHref,
    },
    {
      id: "select",
      label: "Select",
      shortLabel: "Select",
      status: selectDone
        ? "completed"
        : currentStageId === "select"
          ? input.canReviewPi
            ? "current"
            : "blocked"
          : "upcoming",
      detail: selectDone
        ? input.selectedLabel
          ? `Selected scenario: ${input.selectedLabel}`
          : "A scenario is selected or already applied to the current plan."
        : input.canReviewPi
          ? "Choose one preferred draft for review. Does not change the current plan."
          : "You need review permission to select a scenario.",
      href: reviewHref,
    },
    {
      id: "promote",
      label: "Apply to current plan",
      shortLabel: "Apply",
      status: promoteDone
        ? "completed"
        : !selectDone
          ? "upcoming"
          : !input.canReviewPi || !input.canPromote
            ? "blocked"
            : currentStageId === "promote"
              ? "current"
              : "available",
      detail: promoteDone
        ? "Selected scenario was applied to the current plan."
        : [...authReviewReason, ...input.promoteDisabledReasons].join(" ") ||
          "Apply the selected scenario to the current plan (not approval).",
      href: reviewHref,
    },
    {
      id: "approve",
      label: "Approve",
      shortLabel: "Approve",
      status: approveDone
        ? "completed"
        : !promoteDone
          ? "upcoming"
          : input.approvalState === "APPROVAL_STALE"
            ? "blocked"
            : !input.canReviewPi || !input.canApprove
              ? "blocked"
              : currentStageId === "approve"
                ? "current"
                : "available",
      detail: approveDone
        ? `Current plan v${input.currentRevisionVersion ?? "—"} approved.`
        : input.approvalState === "APPROVAL_STALE"
          ? "Previous approval is stale — re-approve this exact current plan version."
          : [...authReviewReason, ...input.approveDisabledReasons].join(" ") ||
            "Approve this exact current plan version (does not create a baseline).",
      href: reviewHref,
    },
    {
      id: "baseline",
      label: "Baseline",
      shortLabel: "Baseline",
      status: baselineDone
        ? "completed"
        : !approveDone
          ? "upcoming"
          : !input.canBaselinePi || !input.canBaseline
            ? "blocked"
            : currentStageId === "baseline"
              ? "current"
              : "available",
      detail: baselineDone
        ? "Approved baseline recorded (immutable)."
        : [...authBaselineReason, ...input.baselineDisabledReasons].join(
            " ",
          ) ||
          "Record an immutable approved baseline from the approved current plan.",
      href: baselineHref,
    },
  ];

  // Recompute current from statuses for consistency
  const firstCurrent = stages.find((s) => s.status === "current");
  const firstBlocked = stages.find((s) => s.status === "blocked");
  const firstAvailable = stages.find((s) => s.status === "available");
  currentStageId =
    firstCurrent?.id ??
    firstBlocked?.id ??
    firstAvailable?.id ??
    (baselineDone ? "baseline" : "select");

  const primaryAction = buildPrimaryAction(input, {
    selectDone,
    promoteDone,
    approveDone,
    baselineDone,
    boardHref,
    compareHref,
    reviewHref,
    baselineHref,
    authReviewReason,
    authBaselineReason,
  });

  return {
    stages,
    currentStageId,
    primaryAction,
    lifecycleNote: LIFECYCLE_NOTE,
  };
}

function buildPrimaryAction(
  input: DerivePiPlanningWorkflowInput,
  ctx: {
    selectDone: boolean;
    promoteDone: boolean;
    approveDone: boolean;
    baselineDone: boolean;
    boardHref: string;
    compareHref: string;
    reviewHref: string;
    baselineHref: string;
    authReviewReason: string[];
    authBaselineReason: string[];
  },
): PiWorkflowPrimaryAction {
  if (ctx.baselineDone) {
    return {
      stageId: "baseline",
      label: "View baseline history",
      href: ctx.baselineHref,
      blocked: false,
      reasons: [],
    };
  }

  if (!ctx.selectDone) {
    const reasons = [
      ...ctx.authReviewReason,
      ...(input.hasSelection ? [] : []),
    ];
    return {
      stageId: "select",
      label: "Select a scenario for review",
      href: ctx.reviewHref,
      blocked: !input.canReviewPi,
      reasons,
    };
  }

  if (!ctx.promoteDone) {
    const reasons = [
      ...ctx.authReviewReason,
      ...input.promoteDisabledReasons,
    ];
    const blocked = !input.canReviewPi || !input.canPromote;
    return {
      stageId: "promote",
      label: blocked
        ? "Apply blocked"
        : "Apply selected scenario to current plan",
      href: ctx.reviewHref,
      blocked,
      reasons,
    };
  }

  if (!ctx.approveDone || input.approvalState === "APPROVAL_STALE") {
    const reasons = [
      ...ctx.authReviewReason,
      ...input.approveDisabledReasons,
      ...(input.approvalState === "APPROVAL_STALE"
        ? ["Stale approval — re-approve this exact current plan version."]
        : []),
    ];
    const blocked = !input.canReviewPi || !input.canApprove;
    const stale = input.approvalState === "APPROVAL_STALE";
    return {
      stageId: "approve",
      label: blocked
        ? stale
          ? "Re-approve current plan"
          : "Approve blocked"
        : stale
          ? "Re-approve current plan"
          : "Approve current plan",
      href: ctx.reviewHref,
      blocked,
      reasons,
    };
  }

  const reasons = [
    ...ctx.authBaselineReason,
    ...input.baselineDisabledReasons,
  ];
  const blocked = !input.canBaselinePi || !input.canBaseline;
  return {
    stageId: "baseline",
    label: blocked
      ? input.canBaselinePi
        ? "Baseline blocked"
        : "Baseline unavailable — missing baseline permission"
      : "Create approved baseline",
    href: ctx.baselineHref,
    blocked,
    reasons,
  };
}
