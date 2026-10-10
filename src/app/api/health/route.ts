import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  isDevAuthEnabled,
  isOidcConfigured,
  isTempAuthConfigured,
  getEnv,
} from "@/server/env";
import { resolveRequestId } from "@/server/request-context";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckState = "ok" | "fail";

/**
 * Lightweight liveness/readiness probe.
 * Public (middleware allowlisted). Does not expose secrets or connection strings.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const started = Date.now();

  let database: CheckState = "fail";
  let databaseLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db_timeout")), 2500),
      ),
    ]);
    databaseLatencyMs = Date.now() - t0;
    database = "ok";
  } catch (error) {
    database = "fail";
    logger.error("health.database_fail", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  const env = getEnv();
  const auth = {
    oidcConfigured: isOidcConfigured(),
    tempAuthConfigured: isTempAuthConfigured(),
    // Coerced false in production even if flag set
    devAuthEnabled: isDevAuthEnabled(env),
  };

  const ready = database === "ok";
  const status = ready ? "ok" : "fail";
  const body = {
    status,
    ready,
    checks: {
      app: "ok" as const,
      database,
      databaseLatencyMs,
      auth,
    },
    requestId,
    durationMs: Date.now() - started,
  };

  return NextResponse.json(body, {
    status: ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "x-request-id": requestId,
    },
  });
}
