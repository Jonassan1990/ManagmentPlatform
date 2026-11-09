import { z } from "zod";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.date());

const durationKind = z.enum(["FULL_DAYS", "HALF_DAY", "HOURS"]).optional();
const dayPart = z
  .union([z.enum(["MORNING", "AFTERNOON"]), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));
const hours = z
  .union([z.coerce.number(), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" || value == null ? null : value));

const vacationLengthFields = {
  durationKind,
  startDate: dateOnly,
  endDate: dateOnly.optional().nullable(),
  dayPart,
  hours,
  reason: z.string().trim().max(2000).optional().nullable(),
};

export const createVacationRequestSchema = z.object({
  organizationId: z.string().uuid(),
  ...vacationLengthFields,
});

export const updateVacationRequestSchema = z.object({
  requestId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  ...vacationLengthFields,
});

export const cancelVacationRequestSchema = z.object({
  requestId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  comment: z.string().trim().max(4000).optional().nullable(),
});

export const reviewVacationRequestSchema = z.object({
  requestId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
  comment: z.string().trim().max(4000).optional().nullable(),
});

export const vacationCalendarQuerySchema = z.object({
  organizationId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const vacationYearQuerySchema = z.object({
  organizationId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  principalId: z.string().uuid().optional(),
});
