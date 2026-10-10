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
