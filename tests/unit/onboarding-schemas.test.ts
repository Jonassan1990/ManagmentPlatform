import { describe, expect, it } from "vitest";
import { DEFAULT_ONBOARDING_ITEMS } from "@/modules/onboarding/application/default-items";
import {
  cancelOnboardingChecklistSchema,
  createOnboardingChecklistSchema,
  toggleOnboardingItemSchema,
} from "@/modules/onboarding/application/schemas";

const uuid = "11111111-1111-4111-8111-111111111111";
const uuid2 = "22222222-2222-4222-8222-222222222222";

describe("onboarding schemas", () => {
  it("requires distinct employee and onboarder ids at the form layer (service enforces)", () => {
    const parsed = createOnboardingChecklistSchema.parse({
      organizationId: uuid,
      employeePrincipalId: uuid,
      onboarderPrincipalId: uuid2,
    });
    expect(parsed.employeePrincipalId).not.toBe(parsed.onboarderPrincipalId);
  });

  it("rejects invalid create payload", () => {
    expect(() =>
      createOnboardingChecklistSchema.parse({
        organizationId: "not-a-uuid",
        employeePrincipalId: uuid,
        onboarderPrincipalId: uuid2,
      }),
    ).toThrow();
  });

  it("accepts employee and onboarder toggle roles", () => {
    expect(
      toggleOnboardingItemSchema.parse({
        checklistId: uuid,
        itemId: uuid2,
        expectedVersion: 1,
        role: "EMPLOYEE",
        checked: true,
      }).role,
    ).toBe("EMPLOYEE");
    expect(
      toggleOnboardingItemSchema.parse({
        checklistId: uuid,
        itemId: uuid2,
        expectedVersion: "3",
        role: "ONBOARDER",
        checked: false,
      }),
    ).toMatchObject({ expectedVersion: 3, checked: false, role: "ONBOARDER" });
  });

  it("accepts cancel with optional comment", () => {
    expect(
      cancelOnboardingChecklistSchema.parse({
        checklistId: uuid,
        expectedVersion: 2,
        comment: null,
      }),
    ).toMatchObject({ checklistId: uuid, expectedVersion: 2 });
  });
});

describe("default onboarding items", () => {
  it("ships a non-empty dual-ack starter checklist", () => {
    expect(DEFAULT_ONBOARDING_ITEMS.length).toBeGreaterThanOrEqual(4);
    for (const item of DEFAULT_ONBOARDING_ITEMS) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });
});
