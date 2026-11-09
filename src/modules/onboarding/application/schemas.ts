import { z } from "zod";

export const onboardingPlanItemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const createOnboardingChecklistSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(300).optional(),
  employeePrincipalId: z.string().uuid(),
  onboarderPrincipalId: z.string().uuid(),
  notes: z.string().trim().max(4000).optional().nullable(),
  roleTemplate: z.string().trim().min(1).max(40).optional(),
  items: z.array(onboardingPlanItemSchema).min(1).max(30).optional(),
});

export const updateOnboardingItemsSchema = z.object({
  checklistId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  items: z.array(onboardingPlanItemSchema).min(1).max(30),
});

export const toggleOnboardingItemSchema = z.object({
  checklistId: z.string().uuid(),
  itemId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  role: z.enum(["EMPLOYEE", "ONBOARDER"]),
  checked: z.coerce.boolean(),
});

export const cancelOnboardingChecklistSchema = z.object({
  checklistId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  comment: z.string().trim().max(4000).optional().nullable(),
});
