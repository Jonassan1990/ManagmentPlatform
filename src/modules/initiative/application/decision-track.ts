/**
 * Presentation-only idea → product decision track with GO / NO-GO per step.
 * Does not invent a second lifecycle machine — maps existing gates/decisions.
 */

import type { DecisionOutcome, InitiativeStage } from "@prisma/client";

export type DecisionTrackStepId =
  | "IDEA"
  | "REQUIREMENTS"
  | "PRE_STUDY"
  | "GOVERNANCE"
  | "POC"
  | "PILOT"
  | "PROJECT"
  | "ROLES_GOVERNANCE"
  | "PRODUCT";

export type DecisionTrackVerdict =
  | "GO"
  | "CONDITIONAL_GO"
  | "NO_GO"
  | "HOLD"
  | "PENDING"
  | "IN_PROGRESS"
  | "NOT_STARTED"
  | "N_A";

export type DecisionTrackStep = {
  id: DecisionTrackStepId;
  label: string;
  description: string;
  /** What “Go” means at this step. */
  goMeans: string;
  /** What “No go” means at this step. */
  noGoMeans: string;
  verdict: DecisionTrackVerdict;
  verdictLabel: string;
  detail: string | null;
  hrefPath: string;
};

type DecisionLike = {
  outcome: DecisionOutcome;
  rationale?: string | null;
  gate?: { gateType: string } | null;
  createdAt?: Date;
};

const STAGE_RANK: Record<InitiativeStage, number> = {
  DEMAND: 0,
  REQUIREMENTS: 1,
  PRE_STUDY: 2,
  POC: 3,
  PILOT: 4,
  PROJECT: 5,
};

function verdictLabel(verdict: DecisionTrackVerdict): string {
  switch (verdict) {
    case "GO":
      return "Go";
    case "CONDITIONAL_GO":
      return "Conditional go";
    case "NO_GO":
      return "No go";
    case "HOLD":
      return "Hold";
    case "PENDING":
      return "Awaiting decision";
    case "IN_PROGRESS":
      return "In progress";
    case "N_A":
      return "See project";
    default:
      return "Not started";
  }
}

function mapGateOutcome(outcome: DecisionOutcome | undefined): DecisionTrackVerdict {
  if (!outcome) return "PENDING";
  switch (outcome) {
    case "GO":
    case "SCALE":
      return "GO";
    case "CONDITIONAL_GO":
    case "CONDITIONAL_SCALE":
      return "CONDITIONAL_GO";
    case "NO_GO":
    case "STOP":
      return "NO_GO";
    case "HOLD":
    case "EXTEND_PILOT":
      return "HOLD";
    default:
      return "PENDING";
  }
}

function latestForGate(
  decisions: DecisionLike[],
  gateType: string,
): DecisionLike | undefined {
  const matches = decisions.filter((d) => d.gate?.gateType === gateType);
  if (matches.length > 0) return matches[matches.length - 1];

  // Fallback only when gate relation was not loaded: use outcome families that
  // cannot collide across gates (pilot scale/stop vs pre-study/PoC go/no-go).
  if (gateType === "PILOT_GATE") {
    return decisions.find((d) =>
      ["SCALE", "CONDITIONAL_SCALE", "EXTEND_PILOT", "STOP"].includes(d.outcome),
    );
  }
  return undefined;
}

export function buildDecisionTrack(input: {
  currentStage: InitiativeStage;
  status: string;
  decisions: DecisionLike[];
  hasProject: boolean;
  projectClosed?: boolean;
  openBlockingConditions?: number;
}): DecisionTrackStep[] {
  const rank = STAGE_RANK[input.currentStage];
  const preStudyDecision = latestForGate(input.decisions, "PRE_STUDY_GATE");
  const pocDecision = latestForGate(input.decisions, "POC_GATE");
  const pilotDecision = latestForGate(input.decisions, "PILOT_GATE");
  const blocking = (input.openBlockingConditions ?? 0) > 0;

  const ideaVerdict: DecisionTrackVerdict =
    rank > STAGE_RANK.DEMAND
      ? "GO"
      : input.currentStage === "DEMAND"
        ? "IN_PROGRESS"
        : "NOT_STARTED";

  const requirementsVerdict: DecisionTrackVerdict =
    rank > STAGE_RANK.REQUIREMENTS
      ? "GO"
      : input.currentStage === "REQUIREMENTS"
        ? "IN_PROGRESS"
        : rank < STAGE_RANK.REQUIREMENTS
          ? "NOT_STARTED"
          : "IN_PROGRESS";

  const preStudyVerdict: DecisionTrackVerdict =
    rank > STAGE_RANK.PRE_STUDY
      ? "GO"
      : input.currentStage === "PRE_STUDY"
        ? "IN_PROGRESS"
        : "NOT_STARTED";

  let governanceVerdict = mapGateOutcome(preStudyDecision?.outcome);
  if (!preStudyDecision) {
    governanceVerdict =
      rank > STAGE_RANK.PRE_STUDY
        ? "GO"
        : input.currentStage === "PRE_STUDY"
          ? "PENDING"
          : "NOT_STARTED";
  }

  let pocVerdict = mapGateOutcome(pocDecision?.outcome);
  if (!pocDecision) {
    pocVerdict =
      rank > STAGE_RANK.POC
        ? "GO"
        : input.currentStage === "POC"
          ? "IN_PROGRESS"
          : rank < STAGE_RANK.POC
            ? "NOT_STARTED"
            : "PENDING";
  }

  let pilotVerdict = mapGateOutcome(pilotDecision?.outcome);
  if (!pilotDecision) {
    pilotVerdict =
      rank > STAGE_RANK.PILOT || input.hasProject
        ? "GO"
        : input.currentStage === "PILOT"
          ? "IN_PROGRESS"
          : rank < STAGE_RANK.PILOT
            ? "NOT_STARTED"
            : "PENDING";
  }

  const projectVerdict: DecisionTrackVerdict = input.projectClosed
    ? "GO"
    : input.hasProject
      ? "IN_PROGRESS"
      : rank >= STAGE_RANK.PROJECT
        ? "IN_PROGRESS"
        : "NOT_STARTED";

  const productVerdict: DecisionTrackVerdict = input.projectClosed
    ? "GO"
    : input.hasProject
      ? "IN_PROGRESS"
      : "NOT_STARTED";

  const steps: DecisionTrackStep[] = [
    {
      id: "IDEA",
      label: "Idea / Demand",
      description: "Capture the business need and ownership.",
      goMeans: "Advance to Requirements with a clear problem statement.",
      noGoMeans: "Park or cancel — need is not worth pursuing now.",
      verdict: ideaVerdict,
      verdictLabel: verdictLabel(ideaVerdict),
      detail:
        ideaVerdict === "GO"
          ? "Demand accepted; work moved forward."
          : ideaVerdict === "IN_PROGRESS"
            ? "Complete demand, then advance."
            : null,
      hrefPath: "demand",
    },
    {
      id: "REQUIREMENTS",
      label: "Requirements",
      description: "Define what must be true for a viable solution.",
      goMeans: "Requirements are good enough to start pre-study.",
      noGoMeans: "Stop or rework — scope is unclear or not valuable.",
      verdict: requirementsVerdict,
      verdictLabel: verdictLabel(requirementsVerdict),
      detail: null,
      hrefPath: "requirements",
    },
    {
      id: "PRE_STUDY",
      label: "Pre-study",
      description: "Feasibility, options, and readiness for a formal gate.",
      goMeans: "Submit to governance for a formal go / no-go.",
      noGoMeans: "Do not submit — evidence is incomplete or risk is too high.",
      verdict: preStudyVerdict,
      verdictLabel: verdictLabel(preStudyVerdict),
      detail: null,
      hrefPath: "pre-study",
    },
    {
      id: "GOVERNANCE",
      label: "Governance gate",
      description: "Formal decision with rationale and conditions.",
      goMeans: "Proceed to PoC (or later stages when policy allows).",
      noGoMeans: "Stop the initiative — record why and archive/cancel.",
      verdict: governanceVerdict,
      verdictLabel: verdictLabel(governanceVerdict),
      detail:
        preStudyDecision?.rationale?.trim() ||
        (blocking ? "Blocking conditions still open." : null),
      hrefPath: "decisions",
    },
    {
      id: "POC",
      label: "PoC",
      description: "Prove the critical unknowns in a bounded experiment.",
      goMeans: "Evidence supports a Pilot.",
      noGoMeans: "Hypothesis failed — stop or return to discovery.",
      verdict: pocVerdict,
      verdictLabel: verdictLabel(pocVerdict),
      detail: pocDecision?.rationale?.trim() || null,
      hrefPath: "poc",
    },
    {
      id: "PILOT",
      label: "Pilot",
      description: "Validate in a real operating context before scale.",
      goMeans: "Scale to Project (or conditional scale with conditions).",
      noGoMeans: "Stop — do not convert to a delivery project.",
      verdict: pilotVerdict,
      verdictLabel: verdictLabel(pilotVerdict),
      detail: pilotDecision?.rationale?.trim() || null,
      hrefPath: "pilot",
    },
    {
      id: "PROJECT",
      label: "Project",
      description: "Delivery execution with milestones and work items.",
      goMeans: "Delivery complete enough to hand over.",
      noGoMeans: "Close or re-scope — do not treat as product-ready.",
      verdict: projectVerdict,
      verdictLabel: verdictLabel(projectVerdict),
      detail: input.hasProject ? "Project record exists." : null,
      hrefPath: "project",
    },
    {
      id: "ROLES_GOVERNANCE",
      label: "Roles & governance",
      description: "Confirm owners, RACI, and operating governance for run.",
      goMeans: "Roles and decision rights are clear for product run.",
      noGoMeans: "Hold handover until ownership and governance are set.",
      verdict: input.hasProject
        ? input.projectClosed
          ? "GO"
          : "IN_PROGRESS"
        : "NOT_STARTED",
      verdictLabel: verdictLabel(
        input.hasProject
          ? input.projectClosed
            ? "GO"
            : "IN_PROGRESS"
          : "NOT_STARTED",
      ),
      detail: "Use project ownership, issues, and org roles — not a separate gate.",
      hrefPath: "project",
    },
    {
      id: "PRODUCT",
      label: "Product",
      description: "Steady-state product / service after delivery handover.",
      goMeans: "Accepted into product operations.",
      noGoMeans: "Remains project work — not yet a product.",
      verdict: productVerdict,
      verdictLabel: verdictLabel(productVerdict),
      detail: input.projectClosed
        ? "Project closed — treat as product handover complete."
        : input.hasProject
          ? "Still in delivery; product handover when closed."
          : null,
      hrefPath: "project",
    },
  ];

  if (input.status === "CANCELLED" || input.status === "ARCHIVED") {
    return steps.map((step) =>
      step.verdict === "NOT_STARTED" || step.verdict === "PENDING"
        ? step
        : {
            ...step,
            verdict:
              step.verdict === "IN_PROGRESS" ? "NO_GO" : step.verdict,
            verdictLabel:
              step.verdict === "IN_PROGRESS"
                ? "No go / stopped"
                : step.verdictLabel,
          },
    );
  }

  return steps;
}

/** Static roadmap copy for Delivery hub (no initiative instance). */
export const DELIVERY_ROADMAP: Array<{
  id: DecisionTrackStepId;
  label: string;
  goMeans: string;
  noGoMeans: string;
}> = [
  {
    id: "IDEA",
    label: "Idea / Demand",
    goMeans: "Advance to Requirements",
    noGoMeans: "Park or cancel the idea",
  },
  {
    id: "REQUIREMENTS",
    label: "Requirements",
    goMeans: "Start pre-study",
    noGoMeans: "Rework or stop — scope unclear",
  },
  {
    id: "PRE_STUDY",
    label: "Pre-study",
    goMeans: "Submit governance gate",
    noGoMeans: "Do not submit incomplete evidence",
  },
  {
    id: "GOVERNANCE",
    label: "Governance",
    goMeans: "Proceed to PoC",
    noGoMeans: "Stop the initiative with rationale",
  },
  {
    id: "POC",
    label: "PoC",
    goMeans: "Start Pilot",
    noGoMeans: "Stop or return to discovery",
  },
  {
    id: "PILOT",
    label: "Pilot",
    goMeans: "Scale to Project",
    noGoMeans: "Stop — do not convert",
  },
  {
    id: "PROJECT",
    label: "Project",
    goMeans: "Deliver and prepare handover",
    noGoMeans: "Close or re-scope",
  },
  {
    id: "ROLES_GOVERNANCE",
    label: "Roles & responsibilities",
    goMeans: "Ownership and RACI confirmed",
    noGoMeans: "Hold product handover",
  },
  {
    id: "PRODUCT",
    label: "Product",
    goMeans: "Accepted into product run",
    noGoMeans: "Remain in project mode",
  },
];
