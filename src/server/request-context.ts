import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

export type RequestContext = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/** Prefer inbound header; otherwise mint a new UUID. */
export function resolveRequestId(headerValue: string | null | undefined): string {
  const trimmed = headerValue?.trim();
  if (trimmed && /^[A-Za-z0-9._-]{8,128}$/.test(trimmed)) {
    return trimmed;
  }
  return randomUUID();
}

/**
 * Resolve request id for Server Actions / RSC (Node runtime).
 * Reads `x-request-id` from Next headers when ALS is empty.
 */
export async function resolveServerRequestId(): Promise<string> {
  const existing = getRequestId();
  if (existing) return existing;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return resolveRequestId(h.get("x-request-id"));
  } catch {
    return randomUUID();
  }
}
