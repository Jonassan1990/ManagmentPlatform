/**
 * Optional production build hook.
 * - DEMO_SEED_RUN=1 → Nordic Demo Manufacturing + Central Maintenance
 * - DEMO_SEED_IT=1 → Organization I / Section IN hierarchy + persona logins
 * Uses TEMP_AUTH_PRINCIPAL_ID (or DEMO_SEED_PRINCIPAL_ID) as Org Admin actor.
 */
import { spawnSync } from "node:child_process";

const runShowcase = process.env.DEMO_SEED_RUN === "1";
const runItHierarchy =
  process.env.DEMO_SEED_IT === "1" || process.env.DEMO_SEED_IT === "true";

if (!runShowcase && !runItHierarchy) {
  console.log(
    "[maybe-seed-demo] skipped (DEMO_SEED_RUN!=1 and DEMO_SEED_IT!=1)",
  );
  process.exit(0);
}

const actor =
  process.env.DEMO_SEED_PRINCIPAL_ID ||
  process.env.TEMP_AUTH_PRINCIPAL_ID ||
  process.env.DEV_AUTH_PRINCIPAL_ID;

if (!actor) {
  console.error(
    "[maybe-seed-demo] seed requested but no TEMP_AUTH_PRINCIPAL_ID / DEMO_SEED_PRINCIPAL_ID",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("[maybe-seed-demo] DATABASE_URL missing");
  process.exit(1);
}

function runSeed(label, script) {
  console.log(`[maybe-seed-demo] ${label}…`);
  const result = spawnSync("npx", ["tsx", script], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (runShowcase) {
  runSeed(
    "seeding Nordic Demo Manufacturing into target DB",
    "scripts/seed-demo-showcase.ts",
  );
  runSeed(
    "seeding Central Maintenance resource plan",
    "scripts/seed-central-maintenance-resources.ts",
  );
}

if (runItHierarchy) {
  runSeed(
    "seeding IT hierarchy demo (I → IN → INF/INFB/…)",
    "scripts/seed-it-hierarchy-demo.ts",
  );
}

console.log("[maybe-seed-demo] seed complete");
