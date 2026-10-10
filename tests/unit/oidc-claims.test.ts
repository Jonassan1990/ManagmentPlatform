import { describe, expect, it } from "vitest";
import { validateOidcSignInClaims } from "@/modules/identity-access/application/oidc-claims";

const EXPECTED = {
  expectedIssuer: "https://idp.example.com",
  expectedAudience: "mgmt-client",
};

describe("validateOidcSignInClaims", () => {
  it("accepts valid issuer + subject", () => {
    const result = validateOidcSignInClaims({
      ...EXPECTED,
      issuer: "https://idp.example.com/",
      subject: "sub-123",
    });
    expect(result).toEqual({
      ok: true,
      issuer: "https://idp.example.com",
      subject: "sub-123",
    });
  });

  it("rejects missing issuer", () => {
    expect(
      validateOidcSignInClaims({
        ...EXPECTED,
        issuer: null,
        subject: "sub-123",
      }),
    ).toEqual({ ok: false, reason: "missing_issuer" });
  });

  it("rejects missing subject", () => {
    expect(
      validateOidcSignInClaims({
        ...EXPECTED,
        issuer: "https://idp.example.com",
        subject: "  ",
      }),
    ).toEqual({ ok: false, reason: "missing_subject" });
  });

  it("rejects issuer mismatch (invalid issuer)", () => {
    expect(
      validateOidcSignInClaims({
        ...EXPECTED,
        issuer: "https://evil.example.com",
        subject: "sub-123",
      }),
    ).toEqual({ ok: false, reason: "issuer_mismatch" });
  });

  it("rejects audience mismatch when aud present", () => {
    expect(
      validateOidcSignInClaims({
        ...EXPECTED,
        issuer: "https://idp.example.com",
        subject: "sub-123",
        audience: "other-client",
      }),
    ).toEqual({ ok: false, reason: "audience_mismatch" });
  });

  it("accepts audience array containing client id", () => {
    const result = validateOidcSignInClaims({
      ...EXPECTED,
      issuer: "https://idp.example.com",
      subject: "sub-123",
      audience: ["other", "mgmt-client"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing configuration", () => {
    expect(
      validateOidcSignInClaims({
        expectedIssuer: "",
        expectedAudience: "mgmt-client",
        issuer: "https://idp.example.com",
        subject: "sub-123",
      }),
    ).toEqual({ ok: false, reason: "missing_configuration" });
  });
});
