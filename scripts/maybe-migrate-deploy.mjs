/**
 * Apply pending Prisma migrations during Vercel production/preview builds.
 * Secrets are available in the build environment (CLI pull redacts them locally).
 * Idempotent: safe when schema is already up to date.
 *
 * Connection saturation on Prisma Postgres (`prisma_migration`) must not block
 * the Next.js build — retry, then soft-skip so deploys can ship.
 */
import { runDbBuildStep } from "./db-build-utils.mjs";

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

const result = runDbBuildStep({
  label: "maybe-migrate-deploy",
  command: "npx",
  args: ["prisma", "migrate", "deploy"],
});

if (result.ok) {
  console.log("[maybe-migrate-deploy] migrations up to date");
  process.exit(0);
}

if (!result.fatal) {
  process.exit(0);
}

process.exit(result.status ?? 1);
