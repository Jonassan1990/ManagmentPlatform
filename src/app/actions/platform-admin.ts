"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";
import {
  ensurePlatformAdminReady,
  getPlatformAdminStatus,
} from "@/modules/demo/ensure-platform-admin-ready";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { AppError } from "@/modules/shared/errors";
import { getTempAuthEnv } from "@/server/env";

export type { ActionResult };

async function assertCanConfigurePlatform() {
  const { authz } = createServices();
  const principal = await authz.requirePrincipal();
  const temp = getTempAuthEnv();
  const isTempOwner = temp?.TEMP_AUTH_PRINCIPAL_ID === principal.id;

  const canPlatform = await authz.can(principal, PERMISSIONS.ROLE_MANAGE, {
    type: "PLATFORM",
  });
  if (!canPlatform && !isTempOwner) {
    throw new AppError(
      "FORBIDDEN",
      "Platform admin config needs platform access or the temporary owner account.",
    );
  }
  if (isTempOwner && !canPlatform) {
    await authz.ensurePlatformBootstrapAdmin(principal.id);
  }
  return principal;
}

export async function getPlatformAdminStatusAction() {
  return runAction("platformAdmin.status", async () => {
    const principal = await assertCanConfigurePlatform();
    return getPlatformAdminStatus(principal.id);
  });
}

export async function preparePlatformAdminReadyAction() {
  return runAction("platformAdmin.prepare", async () => {
    const principal = await assertCanConfigurePlatform();
    const result = await ensurePlatformAdminReady(principal.id, {
      syncVacationSheetRoster: false,
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin");
    revalidatePath("/organization");
    revalidatePath("/vacation");
    revalidatePath("/approvals");
    revalidatePath("/portfolio");
    revalidatePath("/initiatives");
    revalidatePath("/delivery");
    revalidatePath(`/organization/${result.organizationId}`);
    revalidatePath(`/organization/${result.organizationId}/admin`);
    revalidatePath(
      `/portfolio?organizationId=${result.organizationId}&departmentId=a1000000-0000-4000-8000-000000000022`,
    );
    return result;
  });
}
