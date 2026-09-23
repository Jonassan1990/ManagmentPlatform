import type {
  EvidenceEntryKind,
  EvidenceRequirementLevel,
  Prisma,
} from "@prisma/client";
import type { ReviewSnapshotPayload } from "./snapshot-builder";

export type EvidenceEntryDraft = {
  kind: EvidenceEntryKind;
  requirementLevel: EvidenceRequirementLevel;
  label: string;
  present: boolean;
  referenceType?: string | null;
  referenceId?: string | null;
  snapshotBinding?: Prisma.InputJsonValue;
  sortOrder: number;
};

/**
 * Derive an evidence checklist from a frozen review snapshot.
 * Entries describe presence of evidence — they are not approvals.
 */
export function buildEvidenceEntriesFromSnapshot(
  snapshot: ReviewSnapshotPayload,
): EvidenceEntryDraft[] {
  const entries: EvidenceEntryDraft[] = [];
  let sort = 0;

  if (snapshot.gateType === "PRE_STUDY_GATE") {
    entries.push({
      kind: "OTHER",
      requirementLevel: "REQUIRED",
      label: "Demand record",
      present: Boolean(snapshot.demand),
      referenceType: "Demand",
      referenceId: snapshot.demand?.id ?? null,
      sortOrder: sort++,
    });

    const accepted = snapshot.requirements.filter((r) => r.status === "ACCEPTED");
    entries.push({
      kind: "REQUIREMENT",
      requirementLevel: "REQUIRED",
      label: "Requirements baseline (accepted)",
      present: accepted.length > 0,
      snapshotBinding: {
        requirementCount: snapshot.requirements.length,
        acceptedCount: accepted.length,
      },
      sortOrder: sort++,
    });

    for (const assessment of snapshot.assessments) {
      entries.push({
        kind: "ASSESSMENT",
        requirementLevel: "REQUIRED",
        label: `Assessment: ${assessment.area}`,
        present: assessment.status === "COMPLETE",
        referenceType: "PreStudyAssessment",
        referenceId: assessment.id,
        snapshotBinding: { area: assessment.area, status: assessment.status },
        sortOrder: sort++,
      });
    }

    entries.push({
      kind: "ALTERNATIVE",
      requirementLevel: "REQUIRED",
      label: "Solution alternatives",
      present: snapshot.alternatives.length > 0,
      snapshotBinding: { count: snapshot.alternatives.length },
      sortOrder: sort++,
    });

    entries.push({
      kind: "RISK",
      requirementLevel: "OPTIONAL",
      label: "Risk register",
      present: snapshot.risks.length > 0,
      snapshotBinding: { count: snapshot.risks.length },
      sortOrder: sort++,
    });

    const docVersions = snapshot.documents.flatMap((d) =>
      d.versions.map((v) => ({ documentId: d.id, ...v })),
    );
    entries.push({
      kind: "DOCUMENT_VERSION",
      requirementLevel: "OPTIONAL",
      label: "Supporting documents",
      present: docVersions.length > 0,
      snapshotBinding: { versionCount: docVersions.length },
      sortOrder: sort++,
    });

    entries.push({
      kind: "READINESS_SUMMARY",
      requirementLevel: "REQUIRED",
      label: "Pre-study readiness",
      present: snapshot.readiness.ready,
      snapshotBinding: {
        ready: snapshot.readiness.ready,
        blockers: snapshot.readiness.blockers,
      },
      sortOrder: sort++,
    });
  } else {
    // POC_GATE
    const poc = snapshot.poc;
    entries.push({
      kind: "POC_RESULT",
      requirementLevel: "REQUIRED",
      label: "PoC results",
      present: Boolean(poc?.results?.trim()),
      referenceType: "PoC",
      referenceId: poc?.id ?? null,
      sortOrder: sort++,
    });
    entries.push({
      kind: "POC_RESULT",
      requirementLevel: "REQUIRED",
      label: "PoC findings",
      present: Boolean(poc?.findings?.trim()),
      referenceType: "PoC",
      referenceId: poc?.id ?? null,
      sortOrder: sort++,
    });
    const criteria = poc?.criteria ?? [];
    const required = criteria.filter((c) => c.required);
    const evaluated = required.filter((c) => c.evaluationState !== "NOT_EVALUATED");
    entries.push({
      kind: "OTHER",
      requirementLevel: "REQUIRED",
      label: "Required success criteria evaluated",
      present: required.length > 0 && evaluated.length === required.length,
      snapshotBinding: {
        requiredCount: required.length,
        evaluatedCount: evaluated.length,
      },
      sortOrder: sort++,
    });
    entries.push({
      kind: "READINESS_SUMMARY",
      requirementLevel: "REQUIRED",
      label: "PoC readiness",
      present: snapshot.readiness.ready,
      snapshotBinding: {
        ready: snapshot.readiness.ready,
        blockers: snapshot.readiness.blockers,
      },
      sortOrder: sort++,
    });
  }

  return entries;
}
