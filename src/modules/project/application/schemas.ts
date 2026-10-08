import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid identifier");

const decimalMoneySchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || v === "") return null;
    return String(v);
  });

const decimalHoursSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || v === "") return null;
    return String(v);
  });

export const updateProjectInputSchema = z.object({
  projectId: uuidSchema,
  name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  /// Ordinary edits: ACTIVE / ON_HOLD / ARCHIVED only.
  /// COMPLETED / CANCELLED require closeProject (Phase 1D).
  status: z.enum(["ACTIVE", "ON_HOLD", "ARCHIVED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  objectives: z.string().trim().max(8000).optional().nullable(),
  participatingDepartmentIds: z.array(uuidSchema).max(50).optional(),
  expectedVersion: z.number().int().positive(),
});

export const updateBudgetInputSchema = z.object({
  projectId: uuidSchema,
  estimatedCost: decimalMoneySchema,
  approvedBudget: decimalMoneySchema,
  plannedCost: decimalMoneySchema,
  forecastCost: decimalMoneySchema,
  actualCost: decimalMoneySchema,
  currencyCode: z.string().trim().length(3).optional(),
  expectedVersion: z.number().int().positive(),
});

export const createMilestoneInputSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(4000).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  plannedDate: z.coerce.date().optional().nullable(),
  actualDate: z.coerce.date().optional().nullable(),
  status: z
    .enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"])
    .default("PLANNED"),
  criticality: z.boolean().default(false),
});

export const updateMilestoneInputSchema = z.object({
  milestoneId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(4000).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  plannedDate: z.coerce.date().optional().nullable(),
  actualDate: z.coerce.date().optional().nullable(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"]),
  criticality: z.boolean(),
  expectedVersion: z.number().int().positive(),
});

export const createWorkItemInputSchema = z.object({
  projectId: uuidSchema,
  type: z.enum(["EPIC", "FEATURE", "TASK"]),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  status: z
    .enum(["BACKLOG", "READY", "IN_PROGRESS", "DONE", "CANCELLED"])
    .default("BACKLOG"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  estimateHours: decimalHoursSchema,
  parentId: uuidSchema.optional().nullable(),
});

export const updateWorkItemInputSchema = z.object({
  workItemId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  status: z.enum(["BACKLOG", "READY", "IN_PROGRESS", "DONE", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  estimateHours: decimalHoursSchema,
  parentId: uuidSchema.optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Phase 1C — Project Issues
// ---------------------------------------------------------------------------

export const issueSeveritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const issueStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export const createIssueInputSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional().nullable(),
  severity: issueSeveritySchema.default("MEDIUM"),
  isBlocker: z.boolean().default(false),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  relatedRiskId: uuidSchema.optional().nullable(),
});

export const updateIssueInputSchema = z.object({
  issueId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional().nullable(),
  severity: issueSeveritySchema,
  isBlocker: z.boolean(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  relatedRiskId: uuidSchema.optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const changeIssueStatusInputSchema = z.object({
  issueId: uuidSchema,
  toStatus: issueStatusSchema,
  resolution: z.string().trim().max(8000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const resolveIssueInputSchema = z.object({
  issueId: uuidSchema,
  resolution: z.string().trim().min(1).max(8000),
  close: z.boolean().default(false),
  expectedVersion: z.number().int().positive(),
});

export const listProjectIssuesInputSchema = z.object({
  projectId: uuidSchema,
  status: issueStatusSchema.optional(),
  severity: issueSeveritySchema.optional(),
  isBlocker: z.boolean().optional(),
  activeBlockersOnly: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Phase 1D — Project Closure
// ---------------------------------------------------------------------------

export const projectClosureOutcomeSchema = z.enum([
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "CANCELLED",
]);

export const evaluateClosureReadinessInputSchema = z.object({
  projectId: uuidSchema,
  outcome: projectClosureOutcomeSchema.default("DELIVERED"),
});

export const closeProjectInputSchema = z.object({
  projectId: uuidSchema,
  outcome: projectClosureOutcomeSchema,
  summary: z.string().trim().max(8000).optional().nullable(),
  lessonsLearned: z.string().trim().max(8000).optional().nullable(),
  finalDeliveryNote: z.string().trim().max(8000).optional().nullable(),
  /** Required when readiness reports warnings. */
  acknowledgeWarnings: z.boolean().default(false),
  expectedVersion: z.number().int().positive(),
});
