import { describe, expect, it } from "vitest";
import { displayOwnerName } from "@/modules/organization/application/ownership-policy";
import { createInitiativeInputSchema } from "@/modules/initiative/application/schemas";
import { updateProjectInputSchema } from "@/modules/project/application/schemas";
import {
  createPoCInputSchema,
  updatePilotInputSchema,
} from "@/modules/governance/application/schemas";
import {
  effectiveResourceCapacity,
  assertAllocationPercentsWithinLimit,
} from "@/modules/pi-planning/application/capacity-policy";

const personId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const deptId = "33333333-3333-4333-8333-333333333333";
const projectId = "44444444-4444-4444-8444-444444444444";
const initiativeId = "55555555-5555-4555-8555-555555555555";
const pilotId = "66666666-6666-4666-8666-666666666666";

describe("Phase 0B displayOwnerName read strategy", () => {
  it("prefers Resource name when FK-backed name is present", () => {
    expect(displayOwnerName("Jane Doe", "Old Snapshot")).toBe("Jane Doe");
  });

  it("falls back to snapshot when Resource name missing", () => {
    expect(displayOwnerName(null, "Old Snapshot")).toBe("Old Snapshot");
    expect(displayOwnerName("  ", "Legacy Owner")).toBe("Legacy Owner");
  });

  it("returns null when neither present", () => {
    expect(displayOwnerName(null, null)).toBeNull();
    expect(displayOwnerName("", "")).toBeNull();
  });
});

describe("Phase 0B ownership schemas", () => {
  it("accepts initiative with structured business owner", () => {
    const parsed = createInitiativeInputSchema.parse({
      organizationId: orgId,
      departmentId: deptId,
      title: "Owned initiative",
      businessOwnerResourceId: personId,
      requesterName: "External requester",
    });
    expect(parsed.businessOwnerResourceId).toBe(personId);
    expect(parsed.businessOwnerName).toBe("");
  });

  it("accepts legacy text-only initiative (no Resource FK)", () => {
    const parsed = createInitiativeInputSchema.parse({
      organizationId: orgId,
      departmentId: deptId,
      title: "Legacy",
      businessOwnerName: "Old Owner",
      requesterName: "Requester",
    });
    expect(parsed.businessOwnerResourceId).toBeUndefined();
    expect(parsed.businessOwnerName).toBe("Old Owner");
  });

  it("accepts null ownerResourceId to clear structured owner", () => {
    const parsed = updateProjectInputSchema.parse({
      projectId,
      expectedVersion: 1,
      name: "P",
      ownerResourceId: null,
      ownerName: "Snapshot",
      status: "ACTIVE",
      priority: "MEDIUM",
    });
    expect(parsed.ownerResourceId).toBeNull();
  });

  it("accepts PoC/Pilot ownerResourceId", () => {
    const poc = createPoCInputSchema.parse({
      initiativeId,
      title: "PoC",
      objective: "Obj",
      hypothesis: "Hyp",
      scope: "Scope",
      ownerResourceId: personId,
      ownerName: "Will be overwritten by Resource.name",
    });
    expect(poc.ownerResourceId).toBe(personId);

    const pilot = updatePilotInputSchema.parse({
      pilotId,
      expectedVersion: 1,
      objective: "Obj",
      scope: "Scope",
      ownerResourceId: personId,
    });
    expect(pilot.ownerResourceId).toBe(personId);
  });
});

describe("Phase 0B capacity regression (ownership must not affect math)", () => {
  it("effective capacity still uses Resource hours and membership percent only", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-14T00:00:00Z");
    const hours = effectiveResourceCapacity({
      capacityHoursPerWeek: 40,
      allocationPercent: 50,
      startDate: start,
      endDate: end,
    });
    expect(hours).toBeGreaterThan(35);
    expect(hours).toBeLessThan(45);
  });

  it("membership percent validation unchanged", () => {
    expect(assertAllocationPercentsWithinLimit([60, 40]).ok).toBe(true);
    expect(assertAllocationPercentsWithinLimit([60, 50]).ok).toBe(false);
  });
});
