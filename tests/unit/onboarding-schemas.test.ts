import { describe, expect, it } from "vitest";
import {
  alignOnboardingPlan,
  DEFAULT_ONBOARDING_ITEMS,
} from "@/modules/onboarding/application/default-items";
import { ONBOARDING_ROLE_TEMPLATES } from "@/modules/onboarding/application/role-templates";
import {
  cancelOnboardingChecklistSchema,
  createOnboardingChecklistSchema,
  toggleOnboardingItemSchema,
  updateOnboardingItemsSchema,
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
  it("ships the journey through product, interviews, documents, tasks, and confirmation", () => {
    const titles = DEFAULT_ONBOARDING_ITEMS.map((item) => item.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Product they will work on",
        "Book interviews with the team",
        "Read focus-area documents",
        "Start getting tasks",
        "Onboarding confirmation",
      ]),
    );
    expect(titles.at(-1)).toBe("Onboarding confirmation");
    for (const item of DEFAULT_ONBOARDING_ITEMS) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps later steps when a draft only covers equipment setup", () => {
    const aligned = alignOnboardingPlan([
      {
        title: "Laptop Setup",
        description: "Laptop is ready for a platform engineer in INFB.",
      },
      {
        title: "Network Access",
        description: "VPN works.",
      },
    ]);
    expect(aligned.map((item) => item.title)).toEqual(
      DEFAULT_ONBOARDING_ITEMS.map((item) => item.title),
    );
    expect(aligned[0]?.description).toContain("INFB");
    expect(aligned.at(-1)?.title).toBe("Onboarding confirmation");
  });
});

describe("role onboarding templates", () => {
  it("has a distinct draft for each role and keeps the closing confirmation", () => {
    expect(ONBOARDING_ROLE_TEMPLATES.map((template) => template.label)).toEqual([
      "Engineer",
      "Analyst",
      "Technician",
      "Coordinator",
      "Specialist",
      "Manager",
    ]);
    const signatures = ONBOARDING_ROLE_TEMPLATES.map((template) =>
      template.items.map((item) => item.title).join("|"),
    );
    expect(new Set(signatures).size).toBe(ONBOARDING_ROLE_TEMPLATES.length);
    for (const template of ONBOARDING_ROLE_TEMPLATES) {
      expect(template.items.at(-1)?.title).toBe("Onboarding confirmation");
      expect(template.items.map((item) => item.title)).toEqual(
        expect.arrayContaining([
          "Product they will work on",
          "Book interviews with the team",
          "Read focus-area documents",
          "Start getting tasks",
        ]),
      );
    }
  });

  it("accepts a manager-edited draft on create and update", () => {
    const items = [
      { title: "Laptop setup", description: "Ready for an engineer." },
      { title: "Set up the development environment", description: null },
    ];
    expect(
      createOnboardingChecklistSchema.parse({
        organizationId: uuid,
        employeePrincipalId: uuid,
        onboarderPrincipalId: uuid2,
        roleTemplate: "engineer",
        items,
      }).items,
    ).toHaveLength(2);
    expect(
      updateOnboardingItemsSchema.parse({
        checklistId: uuid,
        expectedVersion: "4",
        items: [{ id: uuid2, title: "Laptop setup", description: "Edited" }],
      }),
    ).toMatchObject({ expectedVersion: 4 });
  });
});
