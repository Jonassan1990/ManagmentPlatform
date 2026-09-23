import { describe, expect, it } from "vitest";
import {
  createOrganizationInputSchema,
  createResourceInputSchema,
  createSectionInputSchema,
  updateOrganizationInputSchema,
} from "@/modules/organization/application/schemas";
import { isDevAuthEnabled } from "@/server/env";

describe("organization validation schemas", () => {
  it("accepts a valid organization create payload", () => {
    const parsed = createOrganizationInputSchema.parse({
      name: "North Section Org",
      description: "Primary organization",
    });
    expect(parsed.name).toBe("North Section Org");
  });

  it("rejects empty organization name", () => {
    expect(() =>
      createOrganizationInputSchema.parse({ name: "   " }),
    ).toThrow();
  });

  it("rejects malformed organization id on update", () => {
    expect(() =>
      updateOrganizationInputSchema.parse({
        id: "not-a-uuid",
        name: "X",
        expectedVersion: 1,
      }),
    ).toThrow();
  });

  it("requires organizationId uuid for section create", () => {
    expect(() =>
      createSectionInputSchema.parse({
        organizationId: "bad",
        name: "Section A",
      }),
    ).toThrow();
  });

  it("accepts resource create with extensible type", () => {
    const parsed = createResourceInputSchema.parse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Shared Lab Capacity",
      type: "OTHER",
      skills: ["lab"],
    });
    expect(parsed.type).toBe("OTHER");
  });
});

describe("dev auth guard", () => {
  it("never enables DEV auth in production even if flag is set", () => {
    expect(
      isDevAuthEnabled({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        ALLOW_DEV_AUTH: true,
        DEV_AUTH_PRINCIPAL_ID: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(false);
  });

  it("requires development + flag + principal id", () => {
    expect(
      isDevAuthEnabled({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://example",
        ALLOW_DEV_AUTH: true,
        DEV_AUTH_PRINCIPAL_ID: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(true);
    expect(
      isDevAuthEnabled({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://example",
        ALLOW_DEV_AUTH: false,
        DEV_AUTH_PRINCIPAL_ID: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(false);
  });
});
