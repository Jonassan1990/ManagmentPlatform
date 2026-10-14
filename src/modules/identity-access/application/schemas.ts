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

/** Change the role pack, scope, or end date of an existing binding. Principal stays the same. */
export const updateRoleBindingInputSchema = z.object({
  bindingId: uuidSchema,
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
  effectiveTo: z.coerce.date().optional().nullable(),
});

/** Create a local username/password Principal for testing (org ROLE_MANAGE). */
export const createLocalTestUserInputSchema = z.object({
  organizationId: uuidSchema,
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
      "Username: start with letter/number; only . _ - allowed",
    ),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().max(200).optional().nullable(),
  roleDefinitionId: uuidSchema.optional().nullable(),
  scopeType: z
    .enum(["ORGANIZATION", "SECTION", "DEPARTMENT", "TEAM"])
    .optional()
    .default("ORGANIZATION"),
  scopeId: uuidSchema.optional().nullable(),
});

/** Admin reset of a local test login password (org ROLE_MANAGE). Re-enables if disabled. */
export const resetLocalLoginPasswordInputSchema = z.object({
  organizationId: uuidSchema,
  credentialId: uuidSchema,
  password: z.string().min(8).max(200),
});

/**
 * Explicit OIDC → Principal link (R1-B cutover).
 * Never uses email as the identity key. Requires PLATFORM ROLE_MANAGE.
 */
export const linkOidcIdentityInputSchema = z.object({
  targetPrincipalId: uuidSchema,
  issuer: z.string().url().max(500),
  subject: z.string().min(1).max(500),
  emailSnapshot: z.string().email().max(320).optional().nullable(),
  displayNameSnapshot: z.string().max(200).optional().nullable(),
  /**
   * Operator acknowledgement that this is an intentional link
   * (not automatic merge by email/display name).
   */
  confirmExplicitLink: z.literal(true),
});
