/**
 * Shared helpers for Vercel build-time DB steps (migrate / ensure).
 */
import { spawnSync } from "node:child_process";

export function sanitizeDbOutput(text) {
  return String(text).replace(
    /postgres(ql)?:\/\/[^@\s]+@/gi,
    "postgres://***@",
  );
}

export function isConnectionPressure(text) {
  return /too many connections|remaining connection slots|connection pool|P1001|Can't reach database server/i.test(
    text,
  );
}

/** Prefer a single connection for schema-engine / migrate against Prisma Postgres. */
export function migrateEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  for (const key of ["DIRECT_URL", "DATABASE_URL"]) {
    const value = env[key];
    if (!value || value.includes("[SENSITIVE]")) continue;
    try {
      const url = new URL(value);
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "30");
      }
      env[key] = url.toString();
    } catch {
      /* leave original if not a parseable URL */
    }
  }
  return env;
}

export function sleepSync(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  spawnSync("sleep", [String(seconds)], { stdio: "ignore" });
}

/**
 * Run a DB CLI step with retries. Soft-fails (returns ok:false, fatal:false)
 * when the DB is connection-saturated so the Next.js build can still ship.
 */
export function runDbBuildStep({
  label,
  command,
  args,
  attempts = 4,
  baseDelayMs = 4000,
}) {
  let lastOut = "";
  let lastStatus = 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(
      `[${label}] attempt ${attempt}/${attempts}: ${command} ${args.join(" ")}`,
    );
    const result = spawnSync(command, args, {
      encoding: "utf8",
      env: migrateEnv(),
      shell: process.platform === "win32",
    });
    lastStatus = result.status ?? 1;
    lastOut = sanitizeDbOutput(`${result.stdout || ""}${result.stderr || ""}`);
    if (lastOut.trim()) {
      process.stdout.write(
        lastOut.endsWith("\n") ? lastOut : `${lastOut}\n`,
      );
    }
    if (lastStatus === 0) {
      return { ok: true, fatal: false, out: lastOut };
    }
    if (!isConnectionPressure(lastOut) || attempt === attempts) {
      break;
    }
    const delay = baseDelayMs * attempt;
    console.warn(
      `[${label}] connection pressure; retrying in ${delay}ms…`,
    );
    sleepSync(delay);
  }

  if (isConnectionPressure(lastOut)) {
    console.warn(
      `[${label}] skipped after connection pressure (build continues; re-run migrate when the DB has free slots)`,
    );
    return { ok: false, fatal: false, out: lastOut };
  }

  console.error(`[${label}] failed (status ${lastStatus})`);
  return { ok: false, fatal: true, out: lastOut, status: lastStatus };
}
