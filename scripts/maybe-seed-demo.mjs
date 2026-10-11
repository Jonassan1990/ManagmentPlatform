/**
 * Optional production build hook.
 * Runs demo showcase seed only when DEMO_SEED_RUN=1.
 * Uses TEMP_AUTH_PRINCIPAL_ID (or DEMO_SEED_PRINCIPAL_ID) as Org Admin actor.
 */
import { spawnSync } from "node:child_process";

const enabled = process.env.DEMO_SEED_RUN === "1";
if (!enabled) {
  console.log("[maybe-seed-demo] skipped (DEMO_SEED_RUN!=1)");
  process.exit(0);
}

const actor =
  process.env.DEMO_SEED_PRINCIPAL_ID ||
  process.env.TEMP_AUTH_PRINCIPAL_ID ||
  process.env.DEV_AUTH_PRINCIPAL_ID;

if (!actor) {
  console.error(
    "[maybe-seed-demo] DEMO_SEED_RUN=1 but no TEMP_AUTH_PRINCIPAL_ID / DEMO_SEED_PRINCIPAL_ID",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("[maybe-seed-demo] DATABASE_URL missing");
  process.exit(1);
}

console.log("[maybe-seed-demo] seeding Nordic Demo Manufacturing into target DB…");
const result = spawnSync(
  "npx",
  ["tsx", "scripts/seed-demo-showcase.ts"],
  {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[maybe-seed-demo] seeding Central Maintenance resource plan…");
const cm = spawnSync(
  "npx",
  ["tsx", "scripts/seed-central-maintenance-resources.ts"],
  {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  },
);
if (cm.status !== 0) {
  process.exit(cm.status ?? 1);
}

console.log("[maybe-seed-demo] seed complete");
