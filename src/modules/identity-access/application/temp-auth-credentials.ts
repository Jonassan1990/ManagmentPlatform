/**
 * Temporary single-owner credential verification (ADR-026).
 * Best-effort in-process throttling — not globally reliable on serverless.
 */
import { compare } from "bcryptjs";
import type { TempAuthEnv } from "@/server/env";

const FAILURE_DELAY_MS = 400;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 20;

type AttemptBucket = { count: number; windowStart: number };

const failuresByKey = new Map<string, AttemptBucket>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throttleKey(username: string, ipHint?: string | null): string {
  return `${(ipHint ?? "unknown").slice(0, 64)}:${username.toLowerCase()}`;
}

export function isTempAuthThrottled(
  username: string,
  ipHint?: string | null,
): boolean {
  const key = throttleKey(username, ipHint);
  const bucket = failuresByKey.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStart > WINDOW_MS) {
    failuresByKey.delete(key);
    return false;
  }
  return bucket.count >= MAX_FAILURES;
}

function recordFailure(username: string, ipHint?: string | null): void {
  const key = throttleKey(username, ipHint);
  const now = Date.now();
  const bucket = failuresByKey.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    failuresByKey.set(key, { count: 1, windowStart: now });
    return;
  }
  bucket.count += 1;
}

function clearFailures(username: string, ipHint?: string | null): void {
  failuresByKey.delete(throttleKey(username, ipHint));
}

/** Test helper — clears in-process throttle state. */
export function resetTempAuthThrottleForTests(): void {
  failuresByKey.clear();
}

/**
 * Verify username + password against env hash.
 * Always applies a short delay on failure; returns false for any mismatch.
 * Does not log credentials or hash.
 */
export async function verifyTempAuthCredentials(input: {
  username: string;
  password: string;
  config: TempAuthEnv;
  ipHint?: string | null;
}): Promise<boolean> {
  const username = input.username.trim();
  const password = input.password;

  if (!username || !password) {
    await sleep(FAILURE_DELAY_MS);
    return false;
  }

  if (isTempAuthThrottled(username, input.ipHint)) {
    console.warn("[temp-auth] login throttled (best-effort in-process)");
    await sleep(FAILURE_DELAY_MS);
    return false;
  }

  const usernameOk = username === input.config.TEMP_AUTH_USERNAME;
  let passwordOk = false;
  try {
    // Always run compare when possible to reduce timing variance on username.
    passwordOk = await compare(password, input.config.TEMP_AUTH_PASSWORD_HASH);
  } catch {
    passwordOk = false;
  }

  if (!usernameOk || !passwordOk) {
    recordFailure(username, input.ipHint);
    console.warn("[temp-auth] authentication failed");
    await sleep(FAILURE_DELAY_MS);
    return false;
  }

  clearFailures(username, input.ipHint);
  return true;
}
