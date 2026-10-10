/**
 * OIDC sign-in claim validation (Auth.js callback layer).
 * Identity key is always (issuer, subject). Email is never used as a stable key.
 */

export type OidcClaimValidationInput = {
  /** Configured platform issuer (OIDC_ISSUER). */
  expectedIssuer: string;
  /** Configured OIDC client id (expected audience). */
  expectedAudience: string;
  /** Claimed issuer from token/account/profile. */
  issuer: string | null | undefined;
  /** Claimed subject (sub / providerAccountId). */
  subject: string | null | undefined;
  /**
   * Optional audience claim (`aud`). When present must include expectedAudience.
   * When absent, Auth.js discovery/token exchange is trusted for audience;
   * this helper still requires issuer + subject.
   */
  audience?: string | string[] | null;
};

export type OidcClaimValidationResult =
  | { ok: true; issuer: string; subject: string }
  | { ok: false; reason: OidcClaimRejectReason };

export type OidcClaimRejectReason =
  | "missing_issuer"
  | "missing_subject"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "missing_configuration";

function normalizeIssuer(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function validateOidcSignInClaims(
  input: OidcClaimValidationInput,
): OidcClaimValidationResult {
  const expectedIssuer = input.expectedIssuer?.trim();
  const expectedAudience = input.expectedAudience?.trim();
  if (!expectedIssuer || !expectedAudience) {
    return { ok: false, reason: "missing_configuration" };
  }

  if (typeof input.issuer !== "string" || !input.issuer.trim()) {
    return { ok: false, reason: "missing_issuer" };
  }
  if (typeof input.subject !== "string" || !input.subject.trim()) {
    return { ok: false, reason: "missing_subject" };
  }

  const issuer = normalizeIssuer(input.issuer);
  const expected = normalizeIssuer(expectedIssuer);
  if (issuer !== expected) {
    return { ok: false, reason: "issuer_mismatch" };
  }

  if (input.audience != null && input.audience !== "") {
    const audiences = Array.isArray(input.audience)
      ? input.audience
      : [input.audience];
    const normalized = audiences
      .filter((a): a is string => typeof a === "string")
      .map((a) => a.trim())
      .filter(Boolean);
    if (
      normalized.length > 0 &&
      !normalized.includes(expectedAudience)
    ) {
      return { ok: false, reason: "audience_mismatch" };
    }
  }

  return {
    ok: true,
    issuer,
    subject: input.subject.trim(),
  };
}
