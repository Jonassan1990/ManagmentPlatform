/**
 * Apply pending Prisma migrations during Vercel production/preview builds.
 * Secrets are available in the build environment (CLI pull redacts them locally).
 * Idempotent: safe when schema is already up to date.
 */
import { spawnSync } from "node:child_process";

function sanitize(text) {
  return String(text).replace(
    /postgres(ql)?:\/\/[^@\s]+@/gi,
    "postgres://***@",
  );
}

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  console.log(
    "[maybe-migrate-deploy] skipped (DATABASE_URL or DIRECT_URL missing)",
  );
  process.exit(0);
}

// Avoid accidental migrate against local docker from a mis-set shell.
if (process.env.VERCEL !== "1" && process.env.FORCE_MIGRATE_DEPLOY !== "1") {
  console.log(
    "[maybe-migrate-deploy] skipped (not on Vercel; set FORCE_MIGRATE_DEPLOY=1 to override)",
  );
  process.exit(0);
}

console.log("[maybe-migrate-deploy] prisma migrate deploy…");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  encoding: "utf8",
  env: process.env,
  shell: process.platform === "win32",
});

const out = sanitize(`${result.stdout || ""}${result.stderr || ""}`);
if (out.trim()) process.stdout.write(out.endsWith("\n") ? out : `${out}\n`);

if (result.status !== 0) {
  console.error("[maybe-migrate-deploy] migrate deploy failed");
  process.exit(result.status ?? 1);
}

console.log("[maybe-migrate-deploy] migrations up to date");
