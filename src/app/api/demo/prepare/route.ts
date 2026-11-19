import { NextResponse } from "next/server";
import { ensurePlatformAdminReady } from "@/modules/demo/ensure-platform-admin-ready";
import { getManagerDemoPortfolioStatus } from "@/modules/demo/ensure-manager-demo-story";
import { getTempAuthEnv } from "@/server/env";
import { resolveRequestId } from "@/server/request-context";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function prepareSecret(): string | null {
  const value = process.env.DEMO_PREPARE_SECRET?.trim();
  return value && value.length >= 16 ? value : null;
}

function authorized(request: Request): boolean {
  const expected = prepareSecret();
  if (!expected) return false;
  const header =
    request.headers.get("x-demo-prepare-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(header && header === expected);
}

/**
 * Operator-only prepare endpoint for demo environments.
 * Gated by DEMO_PREPARE_SECRET (never public without the secret).
 */
export async function POST(request: Request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", requestId },
      { status: 401 },
    );
  }

  const temp = getTempAuthEnv();
  const actorPrincipalId =
    temp?.TEMP_AUTH_PRINCIPAL_ID ||
    process.env.DEMO_SEED_PRINCIPAL_ID?.trim() ||
    null;
  if (!actorPrincipalId) {
    return NextResponse.json(
      {
        ok: false,
        error: "TEMP_AUTH_PRINCIPAL_ID (or DEMO_SEED_PRINCIPAL_ID) required",
        requestId,
      },
      { status: 503 },
    );
  }

  try {
    const result = await ensurePlatformAdminReady(actorPrincipalId, {
      syncVacationSheetRoster: false,
    });
    const portfolio = await getManagerDemoPortfolioStatus();
    logger.info("demo.prepare.api", {
      requestId,
      initiatives: result.story?.initiatives,
      projects: result.story?.projects,
    });
    return NextResponse.json({
      ok: true,
      requestId,
      organizationId: result.organizationId,
      story: result.story,
      portfolio,
    });
  } catch (error) {
    logger.error("demo.prepare.api_fail", {
      requestId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: error instanceof Error ? error.message : "prepare failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", requestId },
      { status: 401 },
    );
  }
  const portfolio = await getManagerDemoPortfolioStatus();
  return NextResponse.json({ ok: true, requestId, portfolio });
}
