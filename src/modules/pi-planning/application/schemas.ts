import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid identifier");

const decimalHoursSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v));

const optionalDecimalHoursSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || v === "") return null;
    return String(v);
  });

export const piStatusSchema = z.enum([
  "DRAFT",
  "PLANNING",
  "REVIEW",
  "BASELINED",
  "ACTIVE",
  "CLOSED",
]);

export const createPiInputSchema = z
  .object({
    organizationId: uuidSchema,
    sectionId: uuidSchema.optional().nullable(),
    name: z.string().trim().min(1).max(300),
    description: z.string().trim().max(8000).optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    planningOwnerName: z.string().trim().max(200).optional().nullable(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const updatePiInputSchema = z
  .object({
    piId: uuidSchema,
    name: z.string().trim().min(1).max(300),
    description: z.string().trim().max(8000).optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    planningOwnerName: z.string().trim().max(200).optional().nullable(),
    sectionId: uuidSchema.optional().nullable(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const createIterationInputSchema = z
  .object({
    piId: uuidSchema,
    name: z.string().trim().min(1).max(200),
    sequence: z.number().int().positive(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const updateIterationInputSchema = z
  .object({
    iterationId: uuidSchema,
    name: z.string().trim().min(1).max(200),
    sequence: z.number().int().positive(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const setParticipatingDepartmentsInputSchema = z.object({
  piId: uuidSchema,
  departments: z
    .array(
      z.object({
        departmentId: uuidSchema,
        planningOwnerName: z.string().trim().max(200).optional().nullable(),
      }),
    )
    .max(100),
});

export const setParticipatingTeamsInputSchema = z.object({
  piId: uuidSchema,
  teams: z
    .array(
      z.object({
        teamId: uuidSchema,
        departmentId: uuidSchema,
      }),
    )
    .max(200),
});

export const transitionPiInputSchema = z.object({
  piId: uuidSchema,
  toStatus: piStatusSchema,
  expectedVersion: z.number().int().positive(),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const allocateWorkInputSchema = z.object({
  piId: uuidSchema,
  workItemId: uuidSchema,
  iterationId: uuidSchema,
  teamId: uuidSchema,
  resourceId: uuidSchema.optional().nullable(),
  plannedHours: optionalDecimalHoursSchema,
  notes: z.string().trim().max(4000).optional().nullable(),
  /** Optimistic concurrency on existing WorkAllocation when updating. */
  expectedVersion: z.number().int().positive().optional(),
  /** When omitted, mutates CURRENT. Scenario edits must pass a non-CURRENT revisionId. */
  revisionId: uuidSchema.optional(),
});

export const moveAllocationInputSchema = z.object({
  allocationId: uuidSchema,
  iterationId: uuidSchema,
  teamId: uuidSchema,
  resourceId: uuidSchema.optional().nullable(),
  plannedHours: optionalDecimalHoursSchema,
  expectedVersion: z.number().int().positive(),
});

export const removeAllocationInputSchema = z.object({
  allocationId: uuidSchema,
  expectedVersion: z.number().int().positive(),
});

export const createScenarioFromCurrentInputSchema = z.object({
  piId: uuidSchema,
  label: z.string().trim().min(1).max(200),
});

export const cloneScenarioInputSchema = z.object({
  revisionId: uuidSchema,
  label: z.string().trim().min(1).max(200),
  expectedVersion: z.number().int().positive().optional(),
});

export const renameScenarioInputSchema = z.object({
  revisionId: uuidSchema,
  label: z.string().trim().min(1).max(200),
  expectedVersion: z.number().int().positive(),
});

export const archiveScenarioInputSchema = z.object({
  revisionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
});

export const reopenScenarioInputSchema = z.object({
  revisionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
});

export const markScenarioReadyInputSchema = z.object({
  revisionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
});

/** M3D-A — select a DRAFT / READY_FOR_REVIEW scenario for review (not approval). */
export const selectScenarioInputSchema = z.object({
  piId: uuidSchema,
  revisionId: uuidSchema,
  expectedPiVersion: z.number().int().positive(),
  expectedRevisionVersion: z.number().int().positive(),
});

export const clearScenarioSelectionInputSchema = z.object({
  piId: uuidSchema,
  expectedPiVersion: z.number().int().positive(),
});

export const evaluateScenarioReadinessInputSchema = z.object({
  piId: uuidSchema,
  /** Defaults to the PI's currently selected revision when omitted. */
  revisionId: uuidSchema.optional(),
});

/** M3D-B — promote selected scenario allocations into CURRENT (not approval/baseline). */
export const promoteSelectedScenarioInputSchema = z.object({
  piId: uuidSchema,
  expectedPiVersion: z.number().int().positive(),
  expectedSelectedRevisionId: uuidSchema,
  expectedSelectedRevisionVersion: z.number().int().positive(),
  expectedCurrentRevisionVersion: z.number().int().positive(),
  acknowledgeWarnings: z.boolean().default(false),
});

export const setResourceAvailabilityInputSchema = z.object({
  resourceId: uuidSchema,
  iterationId: uuidSchema,
  availableHours: optionalDecimalHoursSchema,
  reductionHours: optionalDecimalHoursSchema,
  notes: z.string().trim().max(2000).optional().nullable(),
  expectedVersion: z.number().int().positive().optional(),
});

export const createDependencyInputSchema = z
  .object({
    organizationId: uuidSchema,
    type: z.enum(["BLOCKS", "DEPENDS_ON", "RELATED"]),
    criticality: z
      .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
      .default("MEDIUM"),
    sourceType: z.enum(["WORK_ITEM", "PROJECT"]),
    sourceId: uuidSchema,
    targetType: z.enum(["WORK_ITEM", "PROJECT"]),
    targetId: uuidSchema,
    ownerName: z.string().trim().max(200).optional().nullable(),
    ownerResourceId: uuidSchema.optional().nullable(),
    neededByDate: z.coerce.date().optional().nullable(),
    description: z.string().trim().max(4000).optional().nullable(),
  })
  .refine(
    (v) => !(v.sourceType === v.targetType && v.sourceId === v.targetId),
    { message: "Dependency cannot reference the same subject as source and target" },
  );

export const updateDependencyInputSchema = z.object({
  dependencyId: uuidSchema,
  status: z.enum(["OPEN", "RESOLVED", "ACCEPTED", "CANCELLED"]),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  ownerName: z.string().trim().max(200).optional().nullable(),
  ownerResourceId: uuidSchema.optional().nullable(),
  neededByDate: z.coerce.date().optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const createBaselineInputSchema = z.object({
  piId: uuidSchema,
  label: z.string().trim().max(200).optional().nullable(),
});

export const compareScenariosInputSchema = z
  .object({
    piId: uuidSchema,
    /** Two or three PlanningRevision ids on the same PI (CURRENT and/or scenarios). */
    revisionIds: z.array(uuidSchema).min(2).max(3),
    /** Defaults to the first entry in revisionIds. */
    referenceRevisionId: uuidSchema.optional(),
    asOf: z.coerce.date().optional(),
  })
  .superRefine((v, ctx) => {
    const unique = new Set(v.revisionIds);
    if (unique.size !== v.revisionIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "revisionIds must be distinct",
        path: ["revisionIds"],
      });
    }
  });

export const decimalHoursRequiredSchema = decimalHoursSchema;
