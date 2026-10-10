import { describe, expect, it, vi } from "vitest";
import { resolveShellNavContext } from "@/modules/navigation/resolve-shell-nav";
import { PERMISSIONS } from "@/modules/shared/permissions";

describe("resolveShellNavContext organization-local permissions", () => {
  it("surfaces Initiatives/PI for department-scoped permission holders", async () => {
    const authz = {
      hasPermissionInOrganization: vi.fn(
        async (_p: unknown, permission: string) => {
          return (
            permission === PERMISSIONS.INITIATIVE_VIEW ||
            permission === PERMISSIONS.PI_VIEW ||
            permission === PERMISSIONS.INITIATIVE_CREATE
          );
        },
      ),
    };

    const ctx = await resolveShellNavContext(
      authz as never,
      { id: "p1", displayName: "Dept Mgr", source: "temp" },
      ["org-1"],
    );

    expect(ctx.capabilities.canViewInitiatives).toBe(true);
    expect(ctx.capabilities.canCreateInitiative).toBe(true);
    expect(ctx.capabilities.canViewPi).toBe(true);
    expect(ctx.capabilities.canViewApprovals).toBe(false);
    expect(ctx.capabilities.canManageAccess).toBe(false);
    expect(authz.hasPermissionInOrganization).toHaveBeenCalled();
  });

  it("keeps viewer create flags false", async () => {
    const authz = {
      hasPermissionInOrganization: vi.fn(
        async (_p: unknown, permission: string) =>
          permission === PERMISSIONS.INITIATIVE_VIEW ||
          permission === PERMISSIONS.PI_VIEW,
      ),
    };

    const ctx = await resolveShellNavContext(
      authz as never,
      { id: "p2", displayName: "Viewer", source: "temp" },
      ["org-1"],
    );

    expect(ctx.capabilities.canViewInitiatives).toBe(true);
    expect(ctx.capabilities.canCreateInitiative).toBe(false);
    expect(ctx.capabilities.canCreatePi).toBe(false);
  });
});
