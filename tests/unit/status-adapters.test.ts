import { describe, expect, it } from "vitest";
import {
  mapApprovalStateBadge,
  mapDeliveryHealthBadge,
  mapExplorerStatusBadge,
  mapInitiativeStageBadge,
  mapScenarioStatusBadge,
} from "@/components/ui/status-adapters";

describe("M4B-C status adapters", () => {
  it("maps delivery health without collapsing distinct labels", () => {
    expect(mapDeliveryHealthBadge("BLOCKED")).toEqual({
      status: "blocked",
      label: "Blocked",
    });
    expect(mapDeliveryHealthBadge("AT_RISK").label).toBe("At risk");
    expect(mapDeliveryHealthBadge("ON_TRACK").label).toBe("On track");
    expect(mapDeliveryHealthBadge("UNKNOWN").status).toBe("unavailable");
  });

  it("preserves scenario lifecycle distinctions", () => {
    expect(mapScenarioStatusBadge("SELECTED").label).toBe("Selected for review");
    expect(mapScenarioStatusBadge("PROMOTED").label).toBe("Promoted");
    expect(mapScenarioStatusBadge("ACTIVE_PLAN").label).toBe("CURRENT plan");
    expect(mapScenarioStatusBadge("DRAFT").status).toBe("draft");
  });

  it("maps initiative stages and explorer rows", () => {
    expect(mapInitiativeStageBadge("DEMAND").label).toBe("Demand");
    expect(mapInitiativeStageBadge("PROJECT").status).toBe("approved");
    expect(mapExplorerStatusBadge("INITIATIVE", "POC").label).toBe("PoC");
    expect(mapExplorerStatusBadge("PROJECT", "CANCELLED").status).toBe(
      "cancelled",
    );
  });

  it("maps approval/baseline presentation states", () => {
    expect(mapApprovalStateBadge({ hasValidApproval: true }).label).toBe(
      "Approved",
    );
    expect(
      mapApprovalStateBadge({ hasValidApproval: false, hasBaseline: true })
        .label,
    ).toBe("Baselined");
    expect(
      mapApprovalStateBadge({ hasValidApproval: false, invalidated: true })
        .label,
    ).toBe("Approval invalidated");
    expect(mapApprovalStateBadge({ hasValidApproval: false }).label).toBe(
      "Not approved",
    );
  });
});
