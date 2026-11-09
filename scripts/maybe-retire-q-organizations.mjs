/**
 * Archive Q-hierarchy and Scania organizations during a Vercel build.
 * Industrial IT (I) is left active. Safe to run more than once.
 */
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[maybe-retire-q] skipped (DATABASE_URL missing)");
  process.exit(0);
}

if (process.env.VERCEL !== "1" && process.env.FORCE_RETIRE_Q !== "1") {
  console.log(
    "[maybe-retire-q] skipped (not on Vercel; set FORCE_RETIRE_Q=1 to override)",
  );
  process.exit(0);
}

console.log("[maybe-retire-q] archiving Q and Scania organizations…");
const result = spawnSync("npx", ["tsx", "scripts/retire-q-organizations.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if ((result.status ?? 1) !== 0) {
  console.error(
    "[maybe-retire-q] failed; organization list will retry on the next visit",
  );
  process.exit(0);
}

console.log("[maybe-retire-q] done");
