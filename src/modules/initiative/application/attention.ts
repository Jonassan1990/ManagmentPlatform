/**
 * Deterministic attention engine — derived only from persisted application state.
 * No AI, no demo alerts, no hardcoded initiative-specific warnings.
 */

import type {
  Demand,
  Initiative,
  InitiativeStage,
  PreStudyAssessment,
  Requirement,
  Risk,
  SolutionAlternative,
} from "@prisma/client";
import {
  REQUIRED_ASSESSMENT_AREAS,
  assessmentAreaLabel,
  evaluatePreStudyReadiness,
  isDemandComplete,
} from "./readiness-policy";

export type AttentionSeverity = "blocker" | "warning" | "info";

export type AttentionItem = {
  key: string;
  severity: AttentionSeverity;
  message: string;
  area:
    | "demand"
    | "requirements"
    | "prestudy"
    | "risk"
    | "ownership"
    | "readiness";
};

export type AttentionSnapshot = {
  initiative: Initiative;
  demand: Demand | null;
  requirements: Requirement[];
  assessments: PreStudyAssessment[];
  alternatives: SolutionAlternative[];
  risks: Risk[];
  documents: { id: string }[];
};

export function buildAttentionItems(
  snapshot: AttentionSnapshot,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { initiative, demand, requirements, assessments, alternatives, risks } =
    snapshot;

  if (!initiative.businessOwnerName?.trim()) {
    items.push({
      key: "missing-business-owner",
      severity: "blocker",
      message: "Business owner is missing",
      area: "ownership",
    });
  }
  if (!initiative.requesterName?.trim()) {
    items.push({
      key: "missing-requester",
      severity: "blocker",
      message: "Requester is missing",
      area: "ownership",
    });
  }

  if (initiative.currentStage === "DEMAND") {
    if (!isDemandComplete(demand)) {
      items.push({
        key: "demand-incomplete",
        severity: "blocker",
        message: "Demand information is incomplete",
        area: "demand",
      });
    }
  }

  if (
    initiative.currentStage === "REQUIREMENTS" ||
    initiative.currentStage === "PRE_STUDY"
  ) {
    const unresolved = requirements.filter(
      (r) => r.status === "DRAFT" || r.status === "PROPOSED",
    );
    if (unresolved.length > 0) {
      items.push({
        key: "requirements-unresolved",
        severity: "blocker",
        message: `${unresolved.length} unresolved requirement(s)`,
        area: "requirements",
      });
    }
    if (requirements.length === 0) {
      items.push({
        key: "requirements-empty",
        severity: "blocker",
        message: "No requirements have been captured",
        area: "requirements",
      });
    }
  }

  if (initiative.currentStage === "PRE_STUDY") {
    for (const area of REQUIRED_ASSESSMENT_AREAS) {
      const assessment = assessments.find((a) => a.area === area);
      if (!assessment || assessment.status !== "COMPLETE") {
        items.push({
          key: `assessment-incomplete:${area}`,
          severity: "blocker",
          message: `${assessmentAreaLabel(area)} incomplete`,
          area: "prestudy",
        });
      }
    }
    if (alternatives.length === 0) {
      items.push({
        key: "alternatives-missing",
        severity: "blocker",
        message: "No solution alternatives captured",
        area: "prestudy",
      });
    }
    if (risks.length === 0) {
      items.push({
        key: "risks-missing",
        severity: "warning",
        message: "No risks recorded",
        area: "risk",
      });
    }

    const readiness = evaluatePreStudyReadiness({
      demand,
      requirements,
      assessments,
      alternatives,
      risks,
      documents: snapshot.documents as never[],
    });
    if (!readiness.ready) {
      items.push({
        key: "not-ready-for-governance",
        severity: "blocker",
        message: "Pre-study is not ready for governance review",
        area: "readiness",
      });
    }
  }

  return dedupe(items);
}

function dedupe(items: AttentionItem[]): AttentionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

export function stageLabel(stage: InitiativeStage): string {
  switch (stage) {
    case "DEMAND":
      return "Demand";
    case "REQUIREMENTS":
      return "Requirements";
    case "PRE_STUDY":
      return "Pre-study";
    default:
      return stage;
  }
}
