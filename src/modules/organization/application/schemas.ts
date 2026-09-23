import { z } from "zod";

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be at most 200 characters");

export const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be at most 2000 characters")
  .optional()
  .nullable();

export const uuidSchema = z.string().uuid("Invalid identifier");

export const createOrganizationInputSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

export const updateOrganizationInputSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  expectedVersion: z.number().int().positive(),
});

export const createSectionInputSchema = z.object({
  organizationId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
});

export const updateSectionInputSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  expectedVersion: z.number().int().positive(),
});

export const createDepartmentInputSchema = z.object({
  sectionId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
});

export const updateDepartmentInputSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  expectedVersion: z.number().int().positive(),
});

export const createTeamInputSchema = z.object({
  departmentId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
});

export const updateTeamInputSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  expectedVersion: z.number().int().positive(),
});

export const resourceTypeSchema = z.enum(["PERSON", "OTHER"]);

export const createResourceInputSchema = z.object({
  organizationId: uuidSchema,
  name: nameSchema,
  referenceCode: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  type: resourceTypeSchema.default("PERSON"),
  functionRole: z.string().trim().max(200).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  capacityHoursPerWeek: z
    .number()
    .min(0)
    .max(168)
    .optional()
    .nullable(),
  primaryTeamId: uuidSchema.optional().nullable(),
});

export const updateResourceInputSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  referenceCode: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  type: resourceTypeSchema,
  functionRole: z.string().trim().max(200).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  capacityHoursPerWeek: z.number().min(0).max(168).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export const assignMembershipInputSchema = z.object({
  resourceId: uuidSchema,
  teamId: uuidSchema,
  isPrimary: z.boolean().default(false),
});

export const archiveEntityInputSchema = z.object({
  id: uuidSchema,
  expectedVersion: z.number().int().positive(),
});
