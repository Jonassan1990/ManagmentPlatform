/**
 * M4D-C — Presentation-only initiative journey grouping & stage chrome.
 * Does not introduce a second lifecycle state machine or change domain rules.
 */

import type { InitiativeStage } from "@prisma/client";
import { stageLabel } from "@/modules/initiative/application/attention";

export type InitiativeTabKey =
  | "overview"
  | "demand"
  | "requirements"
  | "pre-study"
  | "risks"
  | "documents"
  | "history"
  | "governance"
  | "decisions"
  | "poc"
  | "pilot"
  | "project";

export type InitiativeJourneyGroupId =
  | "overview"
  | "discovery"
  | "governance"
  | "validation"
  | "delivery"
  | "history";

export type InitiativeJourneyTab = {
  key: InitiativeTabKey;
  label: string;
  hrefPath: string; // relative to /initiatives/:id ("" for overview)
};

export type InitiativeJourneyGroup = {
  id: InitiativeJourneyGroupId;
  label: string;
  description: string;
  tabs: InitiativeJourneyTab[];
  /** True when the initiative's current domain stage maps into this group. */
  emphasizesCurrentStage: boolean;
};

export type InitiativeTabVisibility = {
  currentStage?: InitiativeStage;
  hasGovernance?: boolean;
  hasPoC?: boolean;
  hasPilot?: boolean;
  hasProject?: boolean;
};

const STAGE_RANK: Record<InitiativeStage, number> = {
  DEMAND: 0,
  REQUIREMENTS: 1,
  PRE_STUDY: 2,
  POC: 3,
  PILOT: 4,
  PROJECT: 5,
};

const STAGE_GROUP: Record<InitiativeStage, InitiativeJourneyGroupId> = {
  DEMAND: "discovery",
  REQUIREMENTS: "discovery",
  PRE_STUDY: "discovery",
  POC: "validation",
  PILOT: "validation",
  PROJECT: "delivery",
};

export function buildInitiativeTabGroups(
  visibility: InitiativeTabVisibility,
): InitiativeJourneyGroup[] {
  const currentStage = visibility.currentStage;
  const stageReached =
    currentStage != null && STAGE_RANK[currentStage] >= STAGE_RANK.PRE_STUDY;
  const showPhase3 = Boolean(
    stageReached || visibility.hasGovernance || visibility.hasPoC,
  );
  const showPilot =
    Boolean(visibility.hasPilot) ||
    (currentStage != null && STAGE_RANK[currentStage] >= STAGE_RANK.PILOT) ||
    (currentStage != null &&
      STAGE_RANK[currentStage] >= STAGE_RANK.POC &&
      (visibility.hasPoC || showPhase3));
  const showProject =
    Boolean(visibility.hasProject) ||
    (currentStage != null && STAGE_RANK[currentStage] >= STAGE_RANK.PROJECT) ||
    Boolean(visibility.hasPilot);

  const currentGroup =
    currentStage != null ? STAGE_GROUP[currentStage] : "overview";

  const groups: InitiativeJourneyGroup[] = [
    {
      id: "overview",
      label: "Overview",
      description: "Attention and next action",
      emphasizesCurrentStage: false,
      tabs: [{ key: "overview", label: "Overview", hrefPath: "" }],
    },
    {
      id: "discovery",
      label: "Discovery",
      description: "Demand, requirements, pre-study",
      emphasizesCurrentStage: currentGroup === "discovery",
      tabs: [
        { key: "demand", label: "Demand", hrefPath: "demand" },
        {
          key: "requirements",
          label: "Requirements",
          hrefPath: "requirements",
        },
        { key: "pre-study", label: "Pre-study", hrefPath: "pre-study" },
      ],
    },
  ];

  if (showPhase3) {
    groups.push({
      id: "governance",
      label: "Governance",
      description: "Submissions, approvals, decisions",
      emphasizesCurrentStage: false,
      tabs: [
        { key: "governance", label: "Governance", hrefPath: "governance" },
        { key: "decisions", label: "Decisions", hrefPath: "decisions" },
      ],
    });
    groups.push({
      id: "validation",
      label: "Validation",
      description: "PoC and Pilot experiments",
      emphasizesCurrentStage: currentGroup === "validation",
      tabs: [{ key: "poc", label: "PoC", hrefPath: "poc" }],
    });
  }

  const validation = groups.find((g) => g.id === "validation");
  if (validation && showPilot) {
    validation.tabs.push({ key: "pilot", label: "Pilot", hrefPath: "pilot" });
  }

  if (showProject) {
    groups.push({
      id: "delivery",
      label: "Delivery",
      description: "Project execution and closure",
      emphasizesCurrentStage: currentGroup === "delivery",
      tabs: [{ key: "project", label: "Project", hrefPath: "project" }],
    });
  }

  groups.push({
    id: "history",
    label: "History",
    description: "Risks, documents, lifecycle log",
    emphasizesCurrentStage: false,
    tabs: [
      { key: "risks", label: "Risks", hrefPath: "risks" },
      { key: "documents", label: "Documents", hrefPath: "documents" },
      { key: "history", label: "History", hrefPath: "history" },
    ],
  });

  return groups;
}

/** Flat tab list for tests / callers that need a count. */
export function flattenInitiativeTabs(
  visibility: InitiativeTabVisibility,
): InitiativeJourneyTab[] {
  return buildInitiativeTabGroups(visibility).flatMap((g) => g.tabs);
}

export type InitiativeLifecycleStageView = {
  stage: InitiativeStage;
  label: string;
  state: "completed" | "current" | "upcoming";
};

export function buildLifecycleStageViews(
  current: InitiativeStage,
): InitiativeLifecycleStageView[] {
  const order: InitiativeStage[] = [
    "DEMAND",
    "REQUIREMENTS",
    "PRE_STUDY",
    "POC",
    "PILOT",
    "PROJECT",
  ];
  const currentIndex = order.indexOf(current);
  return order.map((stage, index) => ({
    stage,
    label: stageLabel(stage),
    state:
      index < currentIndex
        ? "completed"
        : index === currentIndex
          ? "current"
          : "upcoming",
  }));
}

/**
 * Presentation labels for the journey banner. Callers pass domain-derived flags;
 * this function does not re-evaluate readiness policies.
 */
export function describeInitiativeNextAction(input: {
  currentStage: InitiativeStage;
  canAdvanceToRequirements?: boolean;
  canAdvanceToPreStudy?: boolean;
  canSubmitPreStudy?: boolean;
  hasActiveSubmission?: boolean;
  submissionStatus?: string | null;
  canCreatePoC?: boolean;
  canCreatePilot?: boolean;
  canConvertProject?: boolean;
  openBlockingConditions?: number;
  preStudyReady?: boolean | null;
  pocReady?: boolean | null;
  pilotReady?: boolean | null;
  projectClosed?: boolean;
}): {
  label: string;
  detail: string;
  blocked: boolean;
  hrefHint?: InitiativeTabKey;
} {
  if (input.projectClosed) {
    return {
      label: "Project closed — read-only",
      detail:
        "Delivery mutations are disabled. Review history, issues, and closure record.",
      blocked: true,
      hrefHint: "project",
    };
  }

  switch (input.currentStage) {
    case "DEMAND":
      return {
        label: "Complete Demand, then advance to Requirements",
        detail: "Discovery stage — capture the business need.",
        blocked: false,
        hrefHint: "demand",
      };
    case "REQUIREMENTS":
      return {
        label: "Capture requirements, then advance to Pre-study",
        detail: "Discovery stage — accept requirements before validation design.",
        blocked: false,
        hrefHint: "requirements",
      };
    case "PRE_STUDY":
      if (input.canCreatePoC) {
        return {
          label: "Create PoC definition (manual — not automatic after GO)",
          detail:
            "Governance decision allows a PoC. Creating it is a separate authorized action.",
          blocked: false,
          hrefHint: "poc",
        };
      }
      if ((input.openBlockingConditions ?? 0) > 0) {
        return {
          label: "Resolve blocking decision conditions",
          detail: `${input.openBlockingConditions} open condition(s) block progression.`,
          blocked: true,
          hrefHint: "decisions",
        };
      }
      if (input.submissionStatus === "APPROVALS_COMPLETE") {
        return {
          label: "Record governance decision",
          detail: "Approvals are complete — decision is a separate step.",
          blocked: false,
          hrefHint: "decisions",
        };
      }
      if (
        input.submissionStatus === "IN_REVIEW" ||
        input.submissionStatus === "SUBMITTED"
      ) {
        return {
          label: "Track governance approvals",
          detail: "Submission is in review. Decision is not yet recorded.",
          blocked: false,
          hrefHint: "governance",
        };
      }
      if (input.submissionStatus === "CHANGES_REQUESTED") {
        return {
          label: "Revise submission after requested changes",
          detail: "Update evidence, then revise in Governance.",
          blocked: true,
          hrefHint: "governance",
        };
      }
      if (input.canSubmitPreStudy) {
        return {
          label: "Submit Pre-study for governance review",
          detail: "Readiness is READY — submit does not create a PoC.",
          blocked: false,
          hrefHint: "governance",
        };
      }
      return {
        label: "Complete Pre-study until readiness is READY",
        detail: "Assessments, alternatives, and risks feed governance readiness.",
        blocked: Boolean(input.preStudyReady === false),
        hrefHint: "pre-study",
      };
    case "POC":
      if (input.canCreatePilot) {
        return {
          label: "Create Pilot definition (manual — not automatic after GO)",
          detail: "Operational PoC evaluation and formal GO are distinct.",
          blocked: false,
          hrefHint: "pilot",
        };
      }
      if (input.submissionStatus === "APPROVALS_COMPLETE") {
        return {
          label: "Record PoC decision",
          detail: "Recommendation and formal decision remain separate.",
          blocked: false,
          hrefHint: "decisions",
        };
      }
      if (input.pocReady && !input.hasActiveSubmission) {
        return {
          label: "Submit PoC for governance decision",
          detail: "PoC readiness means evidence can be submitted — not approved.",
          blocked: false,
          hrefHint: "poc",
        };
      }
      return {
        label: "Continue PoC definition, execution, and evaluation",
        detail: "Keep operational results distinct from governance recommendation.",
        blocked: false,
        hrefHint: "poc",
      };
    case "PILOT":
      if (input.canConvertProject) {
        return {
          label: "Convert to Project (manual — not automatic after SCALE)",
          detail: "Scale decision does not create a Project by itself.",
          blocked: false,
          hrefHint: "pilot",
        };
      }
      if (input.submissionStatus === "APPROVALS_COMPLETE") {
        return {
          label: "Record Pilot / scale decision",
          detail: "Formal decision follows evaluation and approvals.",
          blocked: false,
          hrefHint: "decisions",
        };
      }
      if (input.pilotReady && !input.hasActiveSubmission) {
        return {
          label: "Submit Pilot for scale decision",
          detail: "Pilot readiness supports submission — not SCALE.",
          blocked: false,
          hrefHint: "pilot",
        };
      }
      return {
        label: "Continue Pilot execution and evaluation",
        detail: "Objectives, criteria, results, and recommendation stay distinct.",
        blocked: false,
        hrefHint: "pilot",
      };
    case "PROJECT":
      return {
        label: "Deliver work, manage issues, and prepare closure",
        detail: "Closed projects become read-only for delivery mutations.",
        blocked: false,
        hrefHint: "project",
      };
    default:
      return {
        label: "Open initiative overview",
        detail: "Follow the lifecycle rail for the current stage.",
        blocked: false,
        hrefHint: "overview",
      };
  }
}
