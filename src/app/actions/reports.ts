"use server";

import { z } from "zod";
import {
  MANAGEMENT_REPORT_TYPES,
  type ManagementReportPreview,
} from "@/modules/portfolio/domain/management-reports";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";

export type { ActionResult };

const reportInputSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  piId: z.string().uuid().optional(),
  reportType: z.enum(MANAGEMENT_REPORT_TYPES),
});

export async function getManagementReportPreviewAction(
  input: unknown,
): Promise<ActionResult<ManagementReportPreview>> {
  return runAction("reports.preview", async () => {
    const parsed = reportInputSchema.parse(input);
    const { authz, managementReports } = createServices();
    const principal = await authz.requirePrincipal();
    return managementReports.getReportPreview(principal, parsed);
  });
}
