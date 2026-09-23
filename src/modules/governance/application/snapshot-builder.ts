import type {
  Demand,
  GateType,
  ManagedDocument,
  DocumentVersion,
  PoC,
  PoCSuccessCriterion,
  PreStudyAssessment,
  Requirement,
  Risk,
  SolutionAlternative,
  Initiative,
} from "@prisma/client";
import {
  evaluatePreStudyReadiness,
  type ReadinessResult,
} from "@/modules/initiative/application/readiness-policy";
import { evaluatePoCReadiness } from "./poc-readiness-policy";

export type SnapshotWorkspaceData = {
  initiative: Initiative;
  demand: Demand | null;
  requirements: Requirement[];
  assessments: PreStudyAssessment[];
  alternatives: SolutionAlternative[];
  risks: Risk[];
  documents: (ManagedDocument & { versions: DocumentVersion[] })[];
  poc?: (PoC & { criteria: PoCSuccessCriterion[] }) | null;
};

export type ReviewSnapshotPayload = {
  frozenAt: string;
  gateType: GateType;
  revision: number;
  initiative: {
    id: string;
    referenceKey: string;
    title: string;
    currentStage: string;
    status: string;
    version: number;
    requesterName: string;
    businessOwnerName: string;
    organizationId: string;
    departmentId: string;
  };
  demand: Demand | null;
  requirements: Requirement[];
  assessments: PreStudyAssessment[];
  alternatives: SolutionAlternative[];
  risks: Risk[];
  documents: Array<{
    id: string;
    title: string;
    category: string;
    versions: Array<{
      id: string;
      versionLabel: string;
      lifecycleStatus: string;
    }>;
  }>;
  poc: (PoC & { criteria: PoCSuccessCriterion[] }) | null;
  readiness: ReadinessResult | { ready: boolean; blockers: string[]; items: unknown[] };
};

/**
 * Build an immutable JSON payload capturing the workspace state at submission time.
 */
export function buildReviewSnapshotPayload(
  data: SnapshotWorkspaceData,
  gateType: GateType,
  revision: number,
): ReviewSnapshotPayload {
  const readiness =
    gateType === "PRE_STUDY_GATE"
      ? evaluatePreStudyReadiness({
          demand: data.demand,
          requirements: data.requirements,
          assessments: data.assessments,
          alternatives: data.alternatives,
          risks: data.risks,
          documents: data.documents,
        })
      : data.poc
        ? evaluatePoCReadiness(data.poc, data.poc.criteria)
        : { ready: false, blockers: ["PoC is missing"], items: [] };

  return {
    frozenAt: new Date().toISOString(),
    gateType,
    revision,
    initiative: {
      id: data.initiative.id,
      referenceKey: data.initiative.referenceKey,
      title: data.initiative.title,
      currentStage: data.initiative.currentStage,
      status: data.initiative.status,
      version: data.initiative.version,
      requesterName: data.initiative.requesterName,
      businessOwnerName: data.initiative.businessOwnerName,
      organizationId: data.initiative.organizationId,
      departmentId: data.initiative.departmentId,
    },
    demand: data.demand,
    requirements: data.requirements,
    assessments: data.assessments,
    alternatives: data.alternatives,
    risks: data.risks,
    documents: data.documents.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      versions: d.versions.map((v) => ({
        id: v.id,
        versionLabel: v.versionLabel,
        lifecycleStatus: v.lifecycleStatus,
      })),
    })),
    poc: data.poc ?? null,
    readiness,
  };
}
