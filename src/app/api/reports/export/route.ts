/**
 * M5E-B — Authorized CSV export for management reports.
 * Same AuthZ path as preview — no separate export permission.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MANAGEMENT_REPORT_TYPES,
} from "@/modules/portfolio/domain/management-reports";
import {
  csvUnavailableCell,
  toCsv,
} from "@/modules/portfolio/application/report-csv";
import { AppError } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  piId: z.string().uuid().optional(),
  reportType: z.enum(MANAGEMENT_REPORT_TYPES),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      departmentId: url.searchParams.get("departmentId") || undefined,
      piId: url.searchParams.get("piId") || undefined,
      reportType: url.searchParams.get("reportType") ?? undefined,
    });

    const { authz, managementReports } = createServices();
    const principal = await authz.requirePrincipal();
    const preview = await managementReports.getReportPreview(principal, parsed);

    if (preview.availability.state === "unavailable") {
      return NextResponse.json(
        {
          error: preview.availability.reason ?? "Report unavailable",
          code: "UNAVAILABLE",
        },
        { status: 422 },
      );
    }

    const headers = [
      "asOf",
      "scope",
      "reportType",
      ...preview.columns.map((c) => c.key),
    ];
    const rows = preview.rows.map((row) => [
      preview.asOf,
      preview.scopeLabel,
      preview.reportType,
      ...preview.columns.map((c) => {
        const v = row[c.key];
        if (v === null) return csvUnavailableCell();
        return v;
      }),
    ]);

    const csv = toCsv(headers, rows);
    const stamp = preview.asOf.slice(0, 10);
    const filename = `${preview.reportType}-${stamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Report-As-Of": preview.asOf,
        "X-Report-Truncated": preview.truncated ? "1" : "0",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid report export parameters", code: "VALIDATION" },
        { status: 400 },
      );
    }
    if (error instanceof AppError) {
      const status = error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    console.error("[reports.export]", error);
    return NextResponse.json(
      { error: "Unable to export report", code: "INTERNAL" },
      { status: 500 },
    );
  }
}
