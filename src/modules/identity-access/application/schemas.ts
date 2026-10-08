import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid identifier");

export const assignRoleBindingInputSchema = z.object({
  principalId: uuidSchema,
  roleDefinitionId: uuidSchema,
  scopeType: z.enum([
    "PLATFORM",
    "ORGANIZATION",
    "SECTION",
    "DEPARTMENT",
    "TEAM",
  ]),
  organizationId: uuidSchema.optional().nullable(),
  scopeId: uuidSchema.optional().nullable(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export const expireRoleBindingInputSchema = z.object({
  bindingId: uuidSchema,
  effectiveTo: z.coerce.date().optional().nullable(),
});
