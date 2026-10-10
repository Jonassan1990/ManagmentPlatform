import { AppError, toErrorPayload } from "@/modules/shared/errors";
import { logger } from "@/server/logger";
import {
  resolveServerRequestId,
  runWithRequestContext,
} from "@/server/request-context";

export type ActionResult<T = unknown> =
  | { ok: true; data: T; requestId?: string }
  | {
      ok: false;
      error: { code: string; message: string; details?: unknown };
      requestId?: string;
    };

/**
 * Shared server-action runner: structured ops logs + request correlation.
 * Does not log passwords, tokens, or connection strings.
 */
export async function runAction<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  const requestId = await resolveServerRequestId();
  return runWithRequestContext(requestId, async () => {
    try {
      const data = await fn();
      return { ok: true, data, requestId };
    } catch (error) {
      if (error instanceof AppError) {
        if (
          error.code === "FORBIDDEN" ||
          error.code === "UNAUTHORIZED" ||
          error.code === "INTERNAL"
        ) {
          logger.warn("action.denied", {
            operation,
            code: error.code,
            message: error.message,
          });
        }
        return {
          ok: false,
          error: toErrorPayload(error),
          requestId,
        };
      }
      logger.error("action.unexpected", {
        operation,
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : "unknown",
      });
      return {
        ok: false,
        error: toErrorPayload(error),
        requestId,
      };
    }
  });
}
