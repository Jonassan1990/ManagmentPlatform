import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid identifier");

export const submitPreStudyForGovernanceInputSchema = z.object({
  initiativeId: uuidSchema,
  expectedInitiativeVersion: z.number().int().positive().optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const submitPoCForGovernanceInputSchema = z.object({
  initiativeId: uuidSchema,
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const reviseGovernanceSubmissionInputSchema = z.object({
  previousSubmissionId: uuidSchema,
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const recordApprovalInputSchema = z.object({
  approvalRequestId: uuidSchema,
  outcome: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  comment: z.string().trim().max(4000).optional().nullable(),
  conditionsText: z.string().trim().max(4000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const decisionConditionInputSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  ownerName: z.string().trim().max(200).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  requiredBeforeProgression: z.boolean().default(true),
});

export const recordDecisionInputSchema = z.object({
  submissionId: uuidSchema,
  outcome: z.enum(["GO", "CONDITIONAL_GO", "NO_GO", "HOLD"]),
  rationale: z.string().trim().min(1).max(8000),
  recommendationText: z.string().trim().max(4000).optional().nullable(),
  conditions: z.array(decisionConditionInputSchema).max(50).default([]),
  expectedPackageVersion: z.number().int().positive(),
});

export const resolveDecisionConditionInputSchema = z.object({
  conditionId: uuidSchema,
  resolutionNote: z.string().trim().min(1).max(4000),
  expectedVersion: z.number().int().positive(),
  status: z.enum(["RESOLVED", "WAIVED"]),
});

export const createPoCInputSchema = z.object({
  initiativeId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  objective: z.string().trim().min(1).max(4000),
  hypothesis: z.string().trim().min(1).max(4000),
  scope: z.string().trim().min(1).max(4000),
  outOfScope: z.string().trim().max(4000).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  estimatedCost: z.string().trim().max(500).optional().nullable(),
  resourceNotes: z.string().trim().max(4000).optional().nullable(),
  technicalConstraints: z.string().trim().max(4000).optional().nullable(),
  dependencyNotes: z.string().trim().max(4000).optional().nullable(),
});

export const updatePoCInputSchema = z.object({
  pocId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  objective: z.string().trim().min(1).max(4000),
  hypothesis: z.string().trim().min(1).max(4000),
  scope: z.string().trim().min(1).max(4000),
  outOfScope: z.string().trim().max(4000).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  estimatedCost: z.string().trim().max(500).optional().nullable(),
  resourceNotes: z.string().trim().max(4000).optional().nullable(),
  technicalConstraints: z.string().trim().max(4000).optional().nullable(),
  dependencyNotes: z.string().trim().max(4000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const transitionPoCInputSchema = z.object({
  pocId: uuidSchema,
  toStatus: z.enum([
    "DRAFT",
    "READY",
    "IN_PROGRESS",
    "EVALUATION",
    "COMPLETED",
  ]),
  expectedVersion: z.number().int().positive(),
});

export const upsertPoCCriterionInputSchema = z.object({
  pocId: uuidSchema,
  criterionId: uuidSchema.optional(),
  description: z.string().trim().min(1).max(2000),
  measurementMethod: z.string().trim().min(1).max(2000),
  target: z.string().trim().min(1).max(1000),
  unit: z.string().trim().max(100).optional().nullable(),
  required: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  expectedVersion: z.number().int().positive().optional(),
});

export const updateCriterionEvaluationInputSchema = z.object({
  criterionId: uuidSchema,
  evaluationState: z.enum(["NOT_EVALUATED", "PASS", "FAIL", "INCONCLUSIVE"]),
  actualResult: z.string().trim().max(2000).optional().nullable(),
  evidenceReference: z.string().trim().max(1000).optional().nullable(),
  evaluationNotes: z.string().trim().max(4000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const updatePoCResultsInputSchema = z.object({
  pocId: uuidSchema,
  results: z.string().trim().max(8000).optional().nullable(),
  findings: z.string().trim().max(8000).optional().nullable(),
  lessonsLearned: z.string().trim().max(8000).optional().nullable(),
  actualCost: z.string().trim().max(500).optional().nullable(),
  actualStart: z.coerce.date().optional().nullable(),
  actualEnd: z.coerce.date().optional().nullable(),
  expectedVersion: z.number().int().positive(),
});
