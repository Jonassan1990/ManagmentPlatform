import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid identifier");
export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(300);
export const personNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200);
export const contactSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v));

export const createInitiativeInputSchema = z.object({
  organizationId: uuidSchema,
  departmentId: uuidSchema,
  title: titleSchema,
  requesterName: personNameSchema,
  requesterContact: contactSchema,
  businessOwnerName: personNameSchema,
  businessOwnerContact: contactSchema,
  // Optional initial demand fields
  problemOpportunity: z.string().trim().max(4000).optional().default(""),
  reasonForRequest: z.string().trim().max(4000).optional().default(""),
  expectedValue: z.string().trim().max(4000).optional().default(""),
  affectedAreas: z.string().trim().max(2000).optional().default(""),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  strategicAlignment: z.string().trim().max(2000).optional().default(""),
  initialImpact: z.string().trim().max(2000).optional().default(""),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const updateInitiativeInputSchema = z.object({
  id: uuidSchema,
  title: titleSchema,
  requesterName: personNameSchema,
  requesterContact: contactSchema,
  businessOwnerName: personNameSchema,
  businessOwnerContact: contactSchema,
  expectedVersion: z.number().int().positive(),
});

export const updateDemandInputSchema = z.object({
  initiativeId: uuidSchema,
  problemOpportunity: z.string().trim().min(1).max(4000),
  reasonForRequest: z.string().trim().min(1).max(4000),
  expectedValue: z.string().trim().min(1).max(4000),
  affectedAreas: z.string().trim().min(1).max(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  strategicAlignment: z.string().trim().min(1).max(2000),
  initialImpact: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(4000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const advanceLifecycleInputSchema = z.object({
  initiativeId: uuidSchema,
  toStage: z.enum(["REQUIREMENTS", "PRE_STUDY"]),
  comment: z.string().trim().max(2000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const createRequirementInputSchema = z.object({
  initiativeId: uuidSchema,
  title: titleSchema,
  description: z.string().trim().min(1).max(8000),
  category: z.enum([
    "BUSINESS",
    "FUNCTIONAL",
    "NON_FUNCTIONAL",
    "ARCHITECTURE",
    "SECURITY",
    "INTEGRATION",
    "DATA",
    "COMPLIANCE",
    "OTHER",
  ]),
  priority: z.enum(["MUST", "SHOULD", "COULD", "WONT"]).default("SHOULD"),
  ownerName: z.string().trim().max(200).optional().nullable(),
  source: z.string().trim().max(500).optional().nullable(),
  status: z
    .enum(["DRAFT", "PROPOSED", "ACCEPTED", "DEFERRED", "REJECTED"])
    .default("DRAFT"),
  acceptanceCriteria: z
    .array(z.string().trim().min(1).max(2000))
    .max(50)
    .default([]),
});

export const updateRequirementInputSchema = z.object({
  id: uuidSchema,
  title: titleSchema,
  description: z.string().trim().min(1).max(8000),
  category: z.enum([
    "BUSINESS",
    "FUNCTIONAL",
    "NON_FUNCTIONAL",
    "ARCHITECTURE",
    "SECURITY",
    "INTEGRATION",
    "DATA",
    "COMPLIANCE",
    "OTHER",
  ]),
  priority: z.enum(["MUST", "SHOULD", "COULD", "WONT"]),
  ownerName: z.string().trim().max(200).optional().nullable(),
  source: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["DRAFT", "PROPOSED", "ACCEPTED", "DEFERRED", "REJECTED"]),
  expectedVersion: z.number().int().positive(),
});

export const addAcceptanceCriterionInputSchema = z.object({
  requirementId: uuidSchema,
  description: z.string().trim().min(1).max(2000),
});

export const createRequirementRelationInputSchema = z.object({
  fromRequirementId: uuidSchema,
  toRequirementId: uuidSchema,
  relationType: z.enum([
    "DEPENDS_ON",
    "RELATED_TO",
    "REFINES",
    "CONFLICTS_WITH",
  ]),
});

export const upsertAssessmentInputSchema = z.object({
  initiativeId: uuidSchema,
  area: z.enum([
    "BUSINESS",
    "CURRENT_STATE",
    "ARCHITECTURE",
    "SECURITY",
    "INTEGRATION",
    "DATA",
    "COST",
    "RESOURCES",
    "RISK",
    "OTHER",
  ]),
  ownerName: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]),
  summary: z.string().trim().max(4000).optional().nullable(),
  findings: z.string().trim().max(8000).optional().nullable(),
  conclusion: z.string().trim().max(4000).optional().nullable(),
  expectedVersion: z.number().int().positive().optional(),
});

export const createAlternativeInputSchema = z.object({
  initiativeId: uuidSchema,
  title: titleSchema,
  description: z.string().trim().min(1).max(4000),
  benefits: z.string().trim().max(4000).optional().nullable(),
  drawbacks: z.string().trim().max(4000).optional().nullable(),
  estimatedCost: z.string().trim().max(500).optional().nullable(),
  estimatedDuration: z.string().trim().max(200).optional().nullable(),
  riskUncertainty: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  isRecommended: z.boolean().default(false),
});

export const updateAlternativeInputSchema = z.object({
  id: uuidSchema,
  title: titleSchema,
  description: z.string().trim().min(1).max(4000),
  benefits: z.string().trim().max(4000).optional().nullable(),
  drawbacks: z.string().trim().max(4000).optional().nullable(),
  estimatedCost: z.string().trim().max(500).optional().nullable(),
  estimatedDuration: z.string().trim().max(200).optional().nullable(),
  riskUncertainty: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  isRecommended: z.boolean(),
  expectedVersion: z.number().int().positive(),
});

export const createRiskInputSchema = z.object({
  initiativeId: uuidSchema,
  title: titleSchema,
  description: z.string().trim().min(1).max(4000),
  ownerName: z.string().trim().max(200).optional().nullable(),
  probability: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  impact: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  status: z.enum(["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"]).default("OPEN"),
  mitigation: z.string().trim().max(4000).optional().nullable(),
});

export const updateRiskInputSchema = z.object({
  id: uuidSchema,
  title: titleSchema,
  description: z.string().trim().min(1).max(4000),
  ownerName: z.string().trim().max(200).optional().nullable(),
  probability: z.enum(["LOW", "MEDIUM", "HIGH"]),
  impact: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"]),
  mitigation: z.string().trim().max(4000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const createDocumentInputSchema = z.object({
  initiativeId: uuidSchema,
  title: titleSchema,
  category: z.string().trim().min(1).max(100),
  ownerName: z.string().trim().max(200).optional().nullable(),
  stage: z
    .enum(["DEMAND", "REQUIREMENTS", "PRE_STUDY", "POC"])
    .optional()
    .nullable(),
  assessmentArea: z
    .enum([
      "BUSINESS",
      "CURRENT_STATE",
      "ARCHITECTURE",
      "SECURITY",
      "INTEGRATION",
      "DATA",
      "COST",
      "RESOURCES",
      "RISK",
      "OTHER",
    ])
    .optional()
    .nullable(),
  versionLabel: z.string().trim().min(1).max(40).default("0.1"),
  changeSummary: z.string().trim().max(2000).optional().nullable(),
});
