import { describe, expect, it } from "vitest";
import { ScopeType } from "@prisma/client";
import {
  OWNERSHIP_GRANTABLE_PERMISSIONS,
} from "@/modules/identity-access/application/relationship-policy";
import {
  PLATFORM_BOOTSTRAP_PERMISSIONS,
  ORGANIZATION_ADMIN_PERMISSIONS,
  VIEWER_PERMISSIONS,
  SYSTEM_ROLE_PACKS,
} from "@/modules/identity-access/application/role-packs";
import { PERMISSIONS, ROLE_KEYS } from "@/modules/shared/permissions";
import {
  assignRoleBindingInputSchema,
  expireRoleBindingInputSchema,
} from "@/modules/identity-access/application/schemas";

describe("Phase 0C role packs", () => {
  it("seeds expected system role keys", () => {
    const keys = SYSTEM_ROLE_PACKS.map((p) => p.key);
    expect(keys).toContain(ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN);
    expect(keys).toContain(ROLE_KEYS.ORGANIZATION_ADMIN);
    expect(keys).toContain(ROLE_KEYS.SECTION_MANAGER);
    expect(keys).toContain(ROLE_KEYS.DEPARTMENT_MANAGER);
    expect(keys).toContain(ROLE_KEYS.TEAM_MANAGER);
    expect(keys).toContain(ROLE_KEYS.VIEWER);
  });

  it("Platform Admin pack is not a business-mutation wildcard", () => {
    expect(PLATFORM_BOOTSTRAP_PERMISSIONS).toContain(PERMISSIONS.PLATFORM_BOOTSTRAP);
    expect(PLATFORM_BOOTSTRAP_PERMISSIONS).toContain(PERMISSIONS.ROLE_MANAGE);
    expect(PLATFORM_BOOTSTRAP_PERMISSIONS).not.toContain(PERMISSIONS.INITIATIVE_EDIT);
    expect(PLATFORM_BOOTSTRAP_PERMISSIONS).not.toContain(PERMISSIONS.DECISION_MAKE);
    expect(PLATFORM_BOOTSTRAP_PERMISSIONS).not.toContain(PERMISSIONS.PI_BASELINE);
  });

  it("Organization Admin retains delivery and governance authority", () => {
    expect(ORGANIZATION_ADMIN_PERMISSIONS).toContain(PERMISSIONS.INITIATIVE_EDIT);
    expect(ORGANIZATION_ADMIN_PERMISSIONS).toContain(PERMISSIONS.DECISION_MAKE);
    expect(ORGANIZATION_ADMIN_PERMISSIONS).toContain(PERMISSIONS.PI_BASELINE);
  });

  it("Viewer is read-only", () => {
    expect(VIEWER_PERMISSIONS).not.toContain(PERMISSIONS.INITIATIVE_EDIT);
    expect(VIEWER_PERMISSIONS).not.toContain(PERMISSIONS.PROJECT_EDIT);
    expect(VIEWER_PERMISSIONS).not.toContain(PERMISSIONS.ROLE_MANAGE);
    expect(VIEWER_PERMISSIONS).not.toContain(PERMISSIONS.ORG_STRUCTURE_MANAGE);
    expect(VIEWER_PERMISSIONS).toContain(PERMISSIONS.INITIATIVE_VIEW);
    expect(VIEWER_PERMISSIONS).toContain(PERMISSIONS.PROJECT_VIEW);
  });
});

describe("Phase 0C ownership relationship allow-list", () => {
  it("only allows narrow initiative/project view+edit", () => {
    expect(OWNERSHIP_GRANTABLE_PERMISSIONS.has(PERMISSIONS.INITIATIVE_EDIT)).toBe(true);
    expect(OWNERSHIP_GRANTABLE_PERMISSIONS.has(PERMISSIONS.PROJECT_EDIT)).toBe(true);
    expect(OWNERSHIP_GRANTABLE_PERMISSIONS.has(PERMISSIONS.DECISION_MAKE)).toBe(false);
    expect(OWNERSHIP_GRANTABLE_PERMISSIONS.has(PERMISSIONS.APPROVAL_REVIEW)).toBe(false);
    expect(OWNERSHIP_GRANTABLE_PERMISSIONS.has(PERMISSIONS.ROLE_MANAGE)).toBe(false);
    expect(OWNERSHIP_GRANTABLE_PERMISSIONS.has(PERMISSIONS.PI_BASELINE)).toBe(false);
  });
});

describe("Phase 0C role binding schemas", () => {
  it("accepts organization-scoped assignment", () => {
    const parsed = assignRoleBindingInputSchema.parse({
      principalId: "11111111-1111-4111-8111-111111111111",
      roleDefinitionId: "22222222-2222-4222-8222-222222222222",
      scopeType: ScopeType.ORGANIZATION,
      organizationId: "33333333-3333-4333-8333-333333333333",
    });
    expect(parsed.scopeType).toBe("ORGANIZATION");
  });

  it("accepts expire payload", () => {
    const parsed = expireRoleBindingInputSchema.parse({
      bindingId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.bindingId).toBeDefined();
  });
});
