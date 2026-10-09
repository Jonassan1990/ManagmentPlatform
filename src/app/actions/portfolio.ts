"use server";

import { z } from "zod";
import { AppError, toErrorPayload } from "@/modules/shared/errors";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthEvaluation,
  DeliveryHealthSummary,
  PortfolioExplorerResult,
  PortfolioPiCapacityResult,
  PortfolioPiListResult,
  PortfolioSnapshot,
} from "@/modules/portfolio/domain/types";
import { createServices } from "@/server/container";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

const portfolioQueryInputSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  asOf: z.coerce.date().optional(),
});

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error(error);
    }
    return { ok: false, error: toErrorPayload(error) };
  }
}

/**
 * M2A — authorization-aware portfolio snapshot for an organization.
 * Read-only; no mutations / revalidate needed.
 */
export async function getPortfolioSnapshotAction(
  input: unknown,
): Promise<ActionResult<PortfolioSnapshot>> {
  return run(async () => {
    const parsed = portfolioQueryInputSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.getPortfolioSnapshot(principal, parsed);
  });
}

const departmentOptionsSchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * M2B — department options for portfolio scope controls.
 * Labels only; visibility is identical to snapshot scoping.
 */
export async function listPortfolioDepartmentOptionsAction(
  input: unknown,
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  return run(async () => {
    const parsed = departmentOptionsSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.listDepartmentOptions(principal, parsed.organizationId);
  });
}

export async function listPortfolioSectionOptionsAction(
  input: unknown,
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  return run(async () => {
    const parsed = departmentOptionsSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.listSectionOptions(principal, parsed.organizationId);
  });
}

export async function listPortfolioOwnerOptionsAction(
  input: unknown,
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  return run(async () => {
    const parsed = departmentOptionsSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.listOwnerOptions(principal, parsed.organizationId);
  });
}

const explorerInputSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  entityKinds: z
    .array(z.enum(["INITIATIVE", "PROJECT"]))
    .min(1)
    .max(2)
    .optional(),
  initiativeStage: z
    .enum([
      "DEMAND",
      "REQUIREMENTS",
      "PRE_STUDY",
      "POC",
      "PILOT",
      "PROJECT",
    ])
    .optional(),
  projectStatus: z
    .enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"])
    .optional(),
  ownerResourceId: z.string().uuid().optional(),
  delivery: z
    .enum(["DELAYED", "ACTIVE_BLOCKER", "CRITICAL_ISSUE"])
    .optional(),
  deliveryHealth: z
    .enum([
      "BLOCKED",
      "AT_RISK",
      "ON_TRACK",
      "COMPLETED",
      "CANCELLED",
      "UNKNOWN",
    ])
    .optional(),
  sortBy: z.enum(["name", "updatedAt", "status", "targetDate"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  asOf: z.coerce.date().optional(),
});

/**
 * M2C — authorization-aware paginated portfolio explorer.
 */
export async function explorePortfolioAction(
  input: unknown,
): Promise<ActionResult<PortfolioExplorerResult>> {
  return run(async () => {
    const parsed = explorerInputSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.explorePortfolio(principal, parsed);
  });
}

const deliveryHealthSummarySchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  asOf: z.coerce.date().optional(),
});

const deliveryHealthClassificationSchema = z.enum([
  "BLOCKED",
  "AT_RISK",
  "ON_TRACK",
  "COMPLETED",
  "CANCELLED",
  "UNKNOWN",
]);

const deliveryHealthAttentionSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  classifications: z
    .array(deliveryHealthClassificationSchema)
    .min(1)
    .max(6)
    .optional(),
  sortBy: z
    .enum(["classification", "name", "updatedAt", "plannedEnd"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  asOf: z.coerce.date().optional(),
});

const deliveryHealthProjectSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  asOf: z.coerce.date().optional(),
});

/**
 * M2D-A — delivery-health counts by classification (read-only).
 */
export async function getDeliveryHealthSummaryAction(
  input: unknown,
): Promise<ActionResult<DeliveryHealthSummary>> {
  return run(async () => {
    const parsed = deliveryHealthSummarySchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.getDeliveryHealthSummary(principal, parsed);
  });
}

/**
 * M2D-A — paginated at-risk / blocked (or explicit classification) Project list.
 */
export async function listDeliveryHealthAttentionAction(
  input: unknown,
): Promise<ActionResult<DeliveryHealthAttentionResult>> {
  return run(async () => {
    const parsed = deliveryHealthAttentionSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.listDeliveryHealthAttention(principal, parsed);
  });
}

/**
 * M2D-A — single Project delivery-health evaluation.
 */
export async function getProjectDeliveryHealthAction(
  input: unknown,
): Promise<ActionResult<DeliveryHealthEvaluation>> {
  return run(async () => {
    const parsed = deliveryHealthProjectSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.getProjectDeliveryHealth(principal, parsed);
  });
}

const piLifecycleSchema = z.enum(["ACTIVE", "UPCOMING", "COMPLETED", "OTHER"]);

const piListInputSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  piId: z.string().uuid().optional(),
  lifecycle: z.array(piLifecycleSchema).min(1).max(4).optional(),
  asOf: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const piCapacityInputSchema = z.object({
  organizationId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  asOf: z.coerce.date().optional(),
  includeResources: z.boolean().optional(),
  includeProjectCommitments: z.boolean().optional(),
  includeConflicts: z.boolean().optional(),
  resourcePage: z.coerce.number().int().min(1).optional(),
  resourcePageSize: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * M2E-A — list Program Increments with lifecycle buckets (read-only).
 */
export async function listPortfolioProgramIncrementsAction(
  input: unknown,
): Promise<ActionResult<PortfolioPiListResult>> {
  return run(async () => {
    const parsed = piListInputSchema.parse(input);
    const { authz, portfolioPiCapacity } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolioPiCapacity.listProgramIncrements(principal, parsed);
  });
}

/**
 * M2E-A — PI capacity overview (live CURRENT revision; baseline comparison separate).
 */
export async function getPortfolioPiCapacityAction(
  input: unknown,
): Promise<ActionResult<PortfolioPiCapacityResult>> {
  return run(async () => {
    const parsed = piCapacityInputSchema.parse(input);
    const { authz, portfolioPiCapacity } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolioPiCapacity.getPiCapacityOverview(principal, parsed);
  });
}
