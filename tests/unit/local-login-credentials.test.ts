import { describe, expect, it } from "vitest";
import { createLocalTestUserInputSchema } from "@/modules/identity-access/application/schemas";

describe("createLocalTestUserInputSchema", () => {
  it("accepts a valid local test user payload", () => {
    const parsed = createLocalTestUserInputSchema.parse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      username: "planner1",
      password: "test-pass-12",
      displayName: "Planner One",
      roleDefinitionId: "22222222-2222-4222-8222-222222222222",
      scopeType: "ORGANIZATION",
    });
    expect(parsed.username).toBe("planner1");
    expect(parsed.scopeType).toBe("ORGANIZATION");
  });

  it("rejects short passwords and bad usernames", () => {
    expect(() =>
      createLocalTestUserInputSchema.parse({
        organizationId: "11111111-1111-4111-8111-111111111111",
        username: "ab",
        password: "short",
      }),
    ).toThrow();
    expect(() =>
      createLocalTestUserInputSchema.parse({
        organizationId: "11111111-1111-4111-8111-111111111111",
        username: "-bad",
        password: "longenough",
      }),
    ).toThrow();
  });
});
